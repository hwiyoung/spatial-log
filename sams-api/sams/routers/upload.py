"""
Upload 엔드포인트 — 자동 채움 파이프라인의 API 인터페이스.

3개 엔드포인트:
1. POST /analyze  — 파일 업로드 → 파이프라인 실행 → 매니페스트 반환 (임시 파일 보존)
2. POST /validate — 매니페스트 필수 필드 검증
3. POST /register — STAC Item 생성 + S3 업로드 + 임시 파일 정리

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
from sams.pipeline.thumbnail import generate_thumbnail
from sams.services.s3 import build_asset_href, upload_file

logger = logging.getLogger(__name__)
router = APIRouter()

def _get_session_dir(session_id: str) -> str | None:
    """세션 ID로 임시 디렉토리를 찾는다 (파일 시스템 기반)."""
    base = settings.UPLOAD_TMP_DIR if os.path.isdir(settings.UPLOAD_TMP_DIR) else tempfile.gettempdir()
    prefix = f"sams_{session_id}_"
    try:
        dirs = os.listdir(base)
    except OSError:
        logger.warning("임시 디렉토리 목록 조회 실패: %s", base)
        return None
    for d in dirs:
        if d.startswith(prefix):
            full = os.path.join(base, d)
            if os.path.isdir(full):
                logger.info("세션 디렉토리 찾음: %s → %s", session_id, full)
                return full
    logger.warning("세션 디렉토리 못 찾음: session=%s, base=%s, dirs=%s", session_id, base, dirs)
    return None


def _cleanup_session(session_id: str) -> None:
    """세션의 임시 디렉토리를 정리한다."""
    tmp_dir = _get_session_dir(session_id)
    if tmp_dir:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        logger.info("세션 정리 완료: %s", session_id)


# ─────────────────────────────────────────────────────────────────────────
# 1. POST /analyze
# ─────────────────────────────────────────────────────────────────────────


@router.post("/analyze", response_model=Manifest)
async def upload_analyze(
    files: list[UploadFile] = File(...),
    collection_id: str = Form(""),
    session_id: str = Form(""),
):
    """파일을 받아 자동 채움 파이프라인을 실행하고 매니페스트를 반환한다.
    임시 파일은 세션 ID로 관리되며, 등록 완료 시까지 보존된다.
    session_id를 프론트에서 미리 생성하여 전달하면 새로고침 후 복구에 사용."""
    if not files:
        raise HTTPException(status_code=400, detail="파일이 없습니다.")

    if not session_id:
        session_id = uuid.uuid4().hex
    tmp_dir = tempfile.mkdtemp(
        prefix=f"sams_{session_id}_",
        dir=settings.UPLOAD_TMP_DIR if os.path.isdir(settings.UPLOAD_TMP_DIR) else None,
    )
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

        # file_path를 임시 디렉토리 기준 상대경로로 치환 (임시 경로 노출 방지 + 서브디렉토리 유지)
        for item in manifest.manifest:
            try:
                item.file_path = os.path.relpath(item.file_path, tmp_dir)
            except ValueError:
                item.file_path = Path(item.file_path).name
            if item.bundled_files:
                rel_files = []
                for f in item.bundled_files:
                    try:
                        rel_files.append(os.path.relpath(f, tmp_dir))
                    except ValueError:
                        rel_files.append(Path(f).name)
                item.bundled_files = rel_files

        # 지원하지 않는 확장자(unknown 카테고리) 제외
        before = len(manifest.manifest)
        manifest.manifest = [
            item for item in manifest.manifest
            if item.detected_category != "unknown"
        ]
        skipped = before - len(manifest.manifest)
        if skipped:
            logger.info("미지원 파일 %d개 제외 (unknown 카테고리)", skipped)
            manifest.summary.total_files = len(manifest.manifest)

        # 세션 ID를 반환
        manifest.session_id = session_id
        logger.info("분석 완료 — session=%s, tmp_dir=%s, files=%d", session_id, tmp_dir, len(saved_paths))

        # manifest를 세션 디렉토리에 저장 (새로고침 후 복구용)
        try:
            import json as _json
            manifest_path = os.path.join(tmp_dir, "_manifest.json")
            with open(manifest_path, "w", encoding="utf-8") as mf:
                mf.write(_json.dumps(manifest.model_dump(), ensure_ascii=False, default=str))
        except Exception:
            logger.warning("manifest 저장 실패 (분석 결과 반환은 정상): %s", session_id)

        return manifest

    except Exception:
        # 분석 실패해도 임시 파일 유지 (리로드 시 데이터 손실 방지)
        # 등록 완료 시 또는 cleanup 주기에서 정리
        raise


@router.get("/sessions/{session_id}")
async def get_session_status(session_id: str):
    """세션의 분석 상태를 조회한다. 새로고침 후 복구에 사용."""
    import json as _json
    tmp_dir = _get_session_dir(session_id)
    if not tmp_dir:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다.")

    manifest_path = os.path.join(tmp_dir, "_manifest.json")
    if os.path.exists(manifest_path):
        try:
            with open(manifest_path, "r", encoding="utf-8") as f:
                manifest_data = _json.load(f)
            return {"status": "analyzed", "manifest": manifest_data}
        except Exception:
            return {"status": "analyzing"}
    else:
        return {"status": "analyzing"}


@router.delete("/sessions/{session_id}")
async def cancel_session(session_id: str):
    """세션의 임시 파일을 삭제한다. 업로드 취소 시 호출."""
    tmp_dir = _get_session_dir(session_id)
    if tmp_dir:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        logger.info("세션 취소 정리 완료: %s", session_id)
        return {"deleted": True, "session_id": session_id}
    return {"deleted": False, "session_id": session_id, "detail": "세션을 찾을 수 없습니다."}


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
    session_id: str = ""
    items: list[dict[str, Any]]
    status: str = "draft"  # "draft" 또는 "published"


class RegisterResult(BaseModel):
    """등록 결과."""
    registered: int = 0
    item_ids: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)


@router.post("/register", response_model=RegisterResult)
async def upload_register(req: RegisterRequest):
    """매니페스트로 STAC Item을 생성하고 S3에 파일을 업로드한다."""

    # 세션에서 임시 디렉토리 조회 (파일 시스템 기반 — 리로드에도 유지)
    tmp_dir = _get_session_dir(req.session_id) if req.session_id else None

    # Collection 자동 생성 (없으면)
    if req.collection_id:
        await _ensure_collection(req.collection_id)

    registered = 0
    item_ids: list[str] = []
    errors: list[str] = []

    for idx, item_data in enumerate(req.items):
        try:
            item_id = item_data.get("id") or _generate_item_id(
                req.collection_id,
                item_data.get("data_category", "unknown"),
            )

            category = item_data.get("data_category", "unknown")
            filename = item_data.get("_filename", "data")  # 상대경로 가능 (서브디렉토리/파일명)
            display_name = Path(filename).name  # S3 키·title 용 파일명만

            # S3 업로드 — 세션 임시 디렉토리에서 파일 찾기
            assets = {}
            bundled_files = item_data.get("_bundled_files", [])

            if tmp_dir:
                local_path = os.path.join(tmp_dir, filename)
                if os.path.exists(local_path):
                    # 이미지 세트: 전체 파일을 S3에 병렬 업로드
                    if bundled_files:
                        import concurrent.futures
                        all_bf = [filename] + bundled_files
                        upload_args = []
                        for bf in all_bf:
                            bf_path = os.path.join(tmp_dir, bf)
                            if os.path.exists(bf_path):
                                upload_args.append((bf_path, req.collection_id, category, item_id, Path(bf).name))

                        uploaded_count = 0
                        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
                            futures = [executor.submit(upload_file, *args) for args in upload_args]
                            for f in concurrent.futures.as_completed(futures):
                                try:
                                    f.result()
                                    uploaded_count += 1
                                except Exception:
                                    pass

                        assets["data"] = {
                            "href": build_asset_href(req.collection_id, category, item_id, display_name),
                            "type": _guess_media_type(display_name),
                            "roles": ["data"],
                            "title": f"{display_name} 외 {len(bundled_files)}개 파일",
                            "file_count": uploaded_count,
                        }
                        logger.info("이미지 세트 S3 업로드 완료: %d개 파일 (병렬)", uploaded_count)
                    else:
                        # 단일 파일 업로드
                        s3_key = upload_file(local_path, req.collection_id, category, item_id, display_name)
                        assets["data"] = {
                            "href": build_asset_href(req.collection_id, category, item_id, display_name),
                            "type": _guess_media_type(display_name),
                            "roles": ["data"],
                            "title": display_name,
                        }
                        logger.info("S3 업로드 완료: %s → %s", display_name, s3_key)

                    # 썸네일 생성 + S3 업로드
                    try:
                        thumb_path = generate_thumbnail(local_path, category)
                        if thumb_path:
                            thumb_filename = f"thumbnail_{Path(display_name).stem}.png"
                            upload_file(thumb_path, req.collection_id, category, item_id, thumb_filename)
                            assets["thumbnail"] = {
                                "href": build_asset_href(req.collection_id, category, item_id, thumb_filename),
                                "type": "image/png",
                                "roles": ["thumbnail"],
                                "title": "Thumbnail",
                            }
                            os.unlink(thumb_path)
                            logger.info("썸네일 생성 완료: %s", thumb_filename)
                    except Exception:
                        logger.warning("썸네일 생성 실패 (등록은 계속): %s", display_name)
                else:
                    logger.warning("임시 파일 없음: %s (tmp_dir=%s, filename=%s)", local_path, tmp_dir, filename)

            # bbox와 geometry 구성
            bbox_4326 = item_data.get("bbox_4326")
            bbox_raw = item_data.get("bbox")
            geometry = item_data.get("geometry")
            epsg = item_data.get("proj:epsg")

            # EPSG가 없으면 Collection의 default_epsg를 사용
            if not epsg:
                try:
                    import httpx as _httpx
                    async with _httpx.AsyncClient() as _c:
                        _r = await _c.get(f"{settings.STAC_API_URL}/collections/{req.collection_id}", timeout=3.0)
                        if _r.status_code == 200:
                            _col = _r.json()
                            _summaries = _col.get("summaries", {})
                            epsg = _summaries.get("project:default_epsg") or _col.get("project:default_epsg")
                            if epsg:
                                epsg = int(epsg)
                except Exception:
                    pass

            # bbox_4326이 없으면 raw bbox + EPSG로 변환 시도
            if not bbox_4326 and bbox_raw and epsg and epsg != 4326:
                try:
                    from rasterio.crs import CRS
                    from rasterio.warp import transform_bounds
                    # 3D bbox(6값)이면 XY만 사용
                    if len(bbox_raw) == 6:
                        left, bottom, right, top = bbox_raw[0], bbox_raw[1], bbox_raw[3], bbox_raw[4]
                    else:
                        left, bottom, right, top = bbox_raw[0], bbox_raw[1], bbox_raw[2], bbox_raw[3]
                    w, s, e, n = transform_bounds(CRS.from_epsg(epsg), CRS.from_epsg(4326), left, bottom, right, top)
                    bbox_4326 = [round(w, 7), round(s, 7), round(e, 7), round(n, 7)]
                except Exception:
                    logger.warning("bbox 변환 실패 (EPSG:%s)", epsg)

            # 최종 bbox 결정 (4326 우선, 없으면 raw)
            bbox = bbox_4326 or (bbox_raw if bbox_raw and len(bbox_raw) == 4 else None)

            if bbox and not geometry:
                geometry = {
                    "type": "Polygon",
                    "coordinates": [[
                        [bbox[0], bbox[1]],
                        [bbox[2], bbox[1]],
                        [bbox[2], bbox[3]],
                        [bbox[0], bbox[3]],
                        [bbox[0], bbox[1]],
                    ]],
                }

            # geometry가 여전히 없으면 기본 Point 설정 (pgSTAC은 null geometry 불가)
            if not geometry:
                geometry = {"type": "Point", "coordinates": [0, 0]}
                if not bbox:
                    bbox = [0, 0, 0, 0]

            # STAC Item JSON 구성
            now = datetime.now(timezone.utc).isoformat()
            properties = {k: v for k, v in item_data.items() if not k.startswith("_") and k not in ("bbox", "geometry", "id", "links", "assets")}
            properties["created"] = now
            properties["updated"] = now
            properties["sams:status"] = req.status

            # datetime 보장 — pgSTAC 필수 요구사항
            if not properties.get("datetime") and not (properties.get("start_datetime") and properties.get("end_datetime")):
                properties["datetime"] = now

            stac_item = {
                "type": "Feature",
                "stac_version": "1.0.0",
                "id": item_id,
                "geometry": geometry,
                "bbox": bbox,
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

            # S3 롤백 — 등록 실패 시 이미 올린 파일 정리
            if assets:
                try:
                    from sams.services.s3 import get_s3_client
                    s3 = get_s3_client()
                    prefix = f"{req.collection_id}/{category}/{item_id}/"
                    resp = s3.list_objects_v2(Bucket=settings.S3_BUCKET, Prefix=prefix)
                    objects = resp.get("Contents", [])
                    if objects:
                        s3.delete_objects(
                            Bucket=settings.S3_BUCKET,
                            Delete={"Objects": [{"Key": o["Key"]} for o in objects]},
                        )
                        logger.info("S3 롤백: %d개 파일 삭제 (%s)", len(objects), prefix)
                except Exception:
                    logger.warning("S3 롤백 실패: %s", item_id)

    # 등록 완료 후 세션 정리
    if req.session_id:
        _cleanup_session(req.session_id)

    return RegisterResult(
        registered=registered,
        item_ids=item_ids,
        errors=errors,
    )


def _get_db_connection():
    """pgSTAC DB에 직접 연결한다."""
    import psycopg2
    return psycopg2.connect(settings.DATABASE_URL)


async def _ensure_collection(collection_id: str) -> None:
    """Collection이 없으면 pgSTAC에 직접 생성한다."""
    import json
    try:
        conn = _get_db_connection()
        try:
            cur = conn.cursor()
            # 존재 확인
            cur.execute("SELECT pgstac.get_collection(%s)", (collection_id,))
            result = cur.fetchone()
            if result and result[0]:
                return  # 이미 존재

            # 기본 Collection 생성
            collection = {
                "type": "Collection",
                "id": collection_id,
                "stac_version": "1.0.0",
                "description": f"Auto-created collection: {collection_id}",
                "title": collection_id,
                "license": "proprietary",
                "extent": {
                    "spatial": {"bbox": [[-180, -90, 180, 90]]},
                    "temporal": {"interval": [[None, None]]},
                },
                "links": [],
            }
            cur.execute(
                "SELECT pgstac.create_collection(%s::jsonb)",
                (json.dumps(collection),),
            )
            conn.commit()
            logger.info("Collection 생성 완료 (pgSTAC): %s", collection_id)
        finally:
            conn.close()
    except Exception:
        logger.exception("Collection 확인/생성 실패: %s", collection_id)


async def _register_stac_item(collection_id: str, stac_item: dict) -> None:
    """pgSTAC에 직접 STAC Item을 등록한다."""
    import json
    conn = _get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT pgstac.create_item(%s::jsonb)",
            (json.dumps(stac_item),),
        )
        conn.commit()
        logger.info("STAC Item 등록 완료 (pgSTAC): %s", stac_item.get("id"))
    except Exception as e:
        conn.rollback()
        raise RuntimeError(f"STAC Item 등록 실패 (pgSTAC): {e}") from e
    finally:
        conn.close()


def _generate_item_id(collection_id: str, category: str) -> str:
    """Item ID를 생성한다. 규칙: {collection}-{category}-{timestamp}"""
    ts = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    short = uuid.uuid4().hex[:6]
    prefix = collection_id if collection_id else "sams"
    return f"{prefix}-{category}-{ts}-{short}"


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
