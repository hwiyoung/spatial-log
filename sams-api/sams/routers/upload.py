"""
Upload 엔드포인트 — 자동 채움 파이프라인의 API 인터페이스.

3개 엔드포인트:
1. POST /analyze  — 파일 업로드 → 파이프라인 실행 → 매니페스트 반환
2. POST /validate — 매니페스트 필수 필드 검증
3. POST /register — STAC Item 생성 + S3 업로드

참조: docs/system_architecture.md 섹션 3.2
"""

import logging
import os
import shutil
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from sams.config import settings
from sams.models.manifest import Manifest
from sams.pipeline import analyze
from sams.services.s3 import build_asset_href, upload_file

logger = logging.getLogger(__name__)
router = APIRouter()

# ─────────────────────────────────────────────────────────────────────────
# 1. POST /analyze
# ─────────────────────────────────────────────────────────────────────────


@router.post("/analyze", response_model=Manifest)
async def upload_analyze(
    files: list[UploadFile] = File(...),
    collection_id: str = Form(""),
):
    """파일을 받아 자동 채움 파이프라인을 실행하고 매니페스트를 반환한다."""
    if not files:
        raise HTTPException(status_code=400, detail="파일이 없습니다.")

    tmp_dir = tempfile.mkdtemp(dir=settings.UPLOAD_TMP_DIR if os.path.isdir(settings.UPLOAD_TMP_DIR) else None)
    saved_paths: list[str] = []

    try:
        # 파일을 임시 디렉토리에 저장 (원본 파일명 유지)
        for file in files:
            safe_name = file.filename or f"unknown_{uuid.uuid4().hex[:8]}"
            tmp_path = os.path.join(tmp_dir, safe_name)
            os.makedirs(os.path.dirname(tmp_path), exist_ok=True)
            content = await file.read()
            with open(tmp_path, "wb") as f:
                f.write(content)
            saved_paths.append(tmp_path)

        # Collection 기본값 조회
        collection_defaults = await _fetch_collection_defaults(collection_id)

        # 파이프라인 실행
        manifest = analyze(saved_paths, collection_defaults)

        # file_path를 원본 파일명으로 치환 (임시 경로 노출 방지)
        for item in manifest.manifest:
            item.file_path = Path(item.file_path).name
            if item.bundled_files:
                item.bundled_files = [Path(f).name for f in item.bundled_files]

        return manifest

    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


async def _fetch_collection_defaults(collection_id: str) -> dict[str, Any] | None:
    """STAC API에서 Collection 정보를 조회하여 기본값 dict를 구성한다."""
    if not collection_id:
        return None

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{settings.STAC_API_URL}/collections/{collection_id}",
                timeout=5.0,
            )
        if resp.status_code != 200:
            logger.warning("Collection 조회 실패 (HTTP %s): %s", resp.status_code, collection_id)
            return None

        col = resp.json()
        defaults: dict[str, Any] = {"id": col.get("id", collection_id)}
        if col.get("title"):
            defaults["title"] = col["title"]
        if col.get("license"):
            defaults["license"] = col["license"]

        # SAMS 확장 필드 (summaries 또는 최상위에 있을 수 있음)
        summaries = col.get("summaries", {})
        if summaries.get("project:site"):
            defaults["project:site"] = summaries["project:site"]
        elif col.get("project:site"):
            defaults["project:site"] = col["project:site"]

        if summaries.get("project:default_epsg"):
            defaults["project:default_epsg"] = summaries["project:default_epsg"]
        elif col.get("project:default_epsg"):
            defaults["project:default_epsg"] = col["project:default_epsg"]

        return defaults

    except Exception:
        logger.exception("Collection 기본값 조회 실패: %s", collection_id)
        return None


# ─────────────────────────────────────────────────────────────────────────
# 2. POST /validate
# ─────────────────────────────────────────────────────────────────────────

class ValidateRequest(BaseModel):
    """매니페스트 검증 요청."""
    manifest: list[dict[str, Any]]


class ValidationResult(BaseModel):
    """검증 결과."""
    valid: bool
    errors: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


# 카테고리별 필수 properties
_REQUIRED_PROPERTIES: dict[str, list[str]] = {
    "_common": ["datetime", "description", "data_category", "project:name", "project:site", "proj:epsg"],
    "pointcloud": ["pc:count", "pc:type"],
    "3d_model": [],
    "3d_tiles": [],
    "orthoimage": ["eo:bands"],
    "image": [],
    "panorama": [],
    "video": [],
    "document": [],
}


@router.post("/validate", response_model=ValidationResult)
async def upload_validate(req: ValidateRequest):
    """매니페스트의 필수 필드를 검증한다."""
    errors: list[str] = []
    warnings: list[str] = []

    for idx, item in enumerate(req.manifest):
        category = item.get("data_category", "unknown")
        properties = item.get("properties", item)  # 직접 dict이면 그대로

        # 공통 필수 필드
        required = list(_REQUIRED_PROPERTIES["_common"])
        required.extend(_REQUIRED_PROPERTIES.get(category, []))

        for field in required:
            val = properties.get(field)
            if val is None or (isinstance(val, str) and val.strip() == ""):
                errors.append(f"[{idx}] {field}: 필수 필드가 비어있습니다.")

        # datetime 특수 처리: null이면 start_datetime + end_datetime 필수
        if properties.get("datetime") is None:
            if not properties.get("start_datetime"):
                errors.append(f"[{idx}] datetime이 없으면 start_datetime이 필요합니다.")
            if not properties.get("end_datetime"):
                errors.append(f"[{idx}] datetime이 없으면 end_datetime이 필요합니다.")

    return ValidationResult(
        valid=len(errors) == 0,
        errors=errors,
        warnings=warnings,
    )


# ─────────────────────────────────────────────────────────────────────────
# 3. POST /register
# ─────────────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    """등록 요청."""
    collection_id: str
    items: list[dict[str, Any]]
    status: str = "draft"  # "draft" 또는 "published"


class RegisterResult(BaseModel):
    """등록 결과."""
    registered: int = 0
    item_ids: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)


@router.post("/register", response_model=RegisterResult)
async def upload_register(req: RegisterRequest):
    """검증 통과된 매니페스트로 STAC Item을 생성하고 S3에 파일을 업로드한다."""
    registered = 0
    item_ids: list[str] = []
    errors: list[str] = []

    for idx, item_data in enumerate(req.items):
        try:
            item_id = item_data.get("id") or _generate_item_id(
                req.collection_id,
                item_data.get("data_category", "unknown"),
            )

            # S3 업로드 (로컬 파일이 있는 경우)
            file_path = item_data.get("_local_path")
            category = item_data.get("data_category", "unknown")
            filename = item_data.get("_filename", Path(file_path).name if file_path else "data")

            assets = {}
            if file_path and os.path.exists(file_path):
                s3_key = upload_file(file_path, req.collection_id, category, item_id, filename)
                assets["data"] = {
                    "href": build_asset_href(req.collection_id, category, item_id, filename),
                    "type": _guess_media_type(filename),
                    "roles": ["data"],
                    "title": filename,
                }

            # STAC Item JSON 구성
            now = datetime.now(timezone.utc).isoformat()
            properties = {k: v for k, v in item_data.items() if not k.startswith("_")}
            properties["created"] = now
            properties["updated"] = now
            properties["sams:status"] = req.status

            stac_item = {
                "type": "Feature",
                "stac_version": "1.0.0",
                "id": item_id,
                "geometry": item_data.get("geometry"),
                "bbox": item_data.get("bbox"),
                "properties": properties,
                "links": item_data.get("links", []),
                "assets": assets or item_data.get("assets", {}),
                "collection": req.collection_id,
            }

            # stac-fastapi에 등록
            await _register_stac_item(req.collection_id, stac_item)

            registered += 1
            item_ids.append(item_id)

        except Exception as e:
            logger.exception("Item 등록 실패 [%d]: %s", idx, e)
            errors.append(f"[{idx}] 등록 실패: {str(e)}")

    return RegisterResult(
        registered=registered,
        item_ids=item_ids,
        errors=errors,
    )


async def _register_stac_item(collection_id: str, stac_item: dict) -> None:
    """stac-fastapi에 STAC Item을 등록한다."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{settings.STAC_API_URL}/collections/{collection_id}/items",
            json=stac_item,
            timeout=10.0,
        )
    if resp.status_code not in (200, 201):
        raise RuntimeError(
            f"STAC Item 등록 실패 (HTTP {resp.status_code}): {resp.text[:200]}"
        )


def _generate_item_id(collection_id: str, category: str) -> str:
    """Item ID를 생성한다. 규칙: {collection}-{category}-{timestamp}"""
    ts = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    short = uuid.uuid4().hex[:6]
    return f"{collection_id}-{category}-{ts}-{short}"


def _guess_media_type(filename: str) -> str:
    """파일명에서 MIME 타입을 추정한다."""
    ext = Path(filename).suffix.lower()
    _TYPES = {
        ".laz": "application/vnd.laszip",
        ".las": "application/vnd.las",
        ".e57": "application/x-e57",
        ".obj": "text/plain",
        ".glb": "model/gltf-binary",
        ".gltf": "model/gltf+json",
        ".fbx": "application/octet-stream",
        ".tif": "image/tiff",
        ".tiff": "image/tiff",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".mp4": "video/mp4",
        ".mov": "video/quicktime",
        ".pdf": "application/pdf",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }
    return _TYPES.get(ext, "application/octet-stream")
