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
import re
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from sams.config import settings
from sams.models.manifest import Manifest
from sams.pipeline.thumbnail import generate_thumbnail
from sams.services import history
from sams.services.s3 import (
    upload_file, build_asset_href, build_s3_key,
    generate_put_url, object_size, copy_object, delete_object, delete_prefix,
    initiate_multipart_upload, generate_upload_part_url, complete_multipart_upload,
    abort_multipart_upload,
)
from sams.services.upload_session import (
    collect_session_files,
    cleanup_stale_multipart_uploads,
    cleanup_session as cleanup_upload_session,
    ensure_session_dir,
    get_multipart_upload,
    get_session_dir,
    is_status_stale,
    load_analysis_status,
    load_manifest,
    load_staged_uploads,
    record_staged_upload,
    record_multipart_upload,
    run_analysis_for_session,
    save_analysis_status,
    save_upload_files,
    session_payload_size,
    set_multipart_upload_status,
    staged_upload_map,
    touch_multipart_upload,
)

logger = logging.getLogger(__name__)

router = APIRouter()

MULTIPART_PART_SIZE = 64 * 1024 * 1024
MULTIPART_MAX_PARTS = 10_000
_last_multipart_cleanup = 0.0

REGISTER_EXCLUDED_PROPERTY_KEYS = {
    "bbox",
    "geometry",
    "id",
    "links",
    "assets",
    "ontology",
    "ontology_annotations",
}
ONTOLOGY_CONCEPT_WRITE_FIELDS = (
    "sams:site_concept",
    "sams:target_concept",
    "sams:ontology_version",
)
ONTOLOGY_CONCEPT_WRITE_FIELD_SET = set(ONTOLOGY_CONCEPT_WRITE_FIELDS)


class UploadPolicyResponse(BaseModel):
    """클라이언트가 업로드 전 표시/차단에 사용하는 정책값."""
    max_upload_bytes: int
    warn_upload_bytes: int
    large_file_threshold_bytes: int
    multipart_part_size_bytes: int
    multipart_max_parts: int
    ontology_concept_write_enabled: bool
    ontology_concept_write_fields: list[str]


@router.get("/policy", response_model=UploadPolicyResponse)
async def upload_policy():
    """현재 런타임 업로드 정책. 프론트 하드코딩과 서버 설정 불일치를 방지한다."""
    return UploadPolicyResponse(
        max_upload_bytes=settings.MAX_UPLOAD_BYTES,
        warn_upload_bytes=settings.WARN_UPLOAD_BYTES,
        large_file_threshold_bytes=100 * 1024 * 1024,
        multipart_part_size_bytes=MULTIPART_PART_SIZE,
        multipart_max_parts=MULTIPART_MAX_PARTS,
        ontology_concept_write_enabled=settings.ONTOLOGY_CONCEPT_WRITE_ENABLED,
        ontology_concept_write_fields=list(ONTOLOGY_CONCEPT_WRITE_FIELDS),
    )


def _validate_upload_size(size: int | None, label: str = "업로드") -> None:
    if size is None:
        return
    if size <= 0:
        raise HTTPException(status_code=400, detail=f"{label} 크기가 유효하지 않습니다.")
    if size > settings.MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"{label} 크기가 최대 업로드 크기({settings.MAX_UPLOAD_BYTES} bytes)를 초과합니다.",
        )


def _is_ontology_concept_property(key: str) -> bool:
    return key == "sams:ontology_version" or (key.startswith("sams:") and key.endswith("_concept"))


def _register_property_value(key: str, value: Any) -> tuple[bool, Any]:
    if key.startswith("_") or key in REGISTER_EXCLUDED_PROPERTY_KEYS:
        return False, None

    if not _is_ontology_concept_property(key):
        return True, value

    if not settings.ONTOLOGY_CONCEPT_WRITE_ENABLED:
        return False, None
    if key not in ONTOLOGY_CONCEPT_WRITE_FIELD_SET:
        return False, None
    if value is None:
        return False, None
    if not isinstance(value, str):
        raise HTTPException(status_code=400, detail=f"{key} 값은 문자열이어야 합니다.")

    cleaned = value.strip()
    if not cleaned:
        return False, None
    if len(cleaned) > 128:
        raise HTTPException(status_code=400, detail=f"{key} 값이 너무 깁니다.")
    return True, cleaned


def _register_properties(item_data: dict[str, Any]) -> dict[str, Any]:
    properties: dict[str, Any] = {}
    for key, value in item_data.items():
        include, cleaned = _register_property_value(key, value)
        if include:
            properties[key] = cleaned
    return properties


def _validate_session_payload_size(session_id: str) -> None:
    total = session_payload_size(session_id)
    if total > settings.MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"업로드 세션 총 크기({total} bytes)가 최대 업로드 크기({settings.MAX_UPLOAD_BYTES} bytes)를 초과합니다.",
        )


def _maybe_cleanup_stale_multipart_uploads() -> None:
    global _last_multipart_cleanup
    now = time.time()
    if now - _last_multipart_cleanup < settings.UPLOAD_CLEANUP_INTERVAL_SECONDS:
        return
    _last_multipart_cleanup = now
    try:
        cleaned = cleanup_stale_multipart_uploads()
        if cleaned:
            logger.info("오래된 multipart upload 정리: %d건", cleaned)
    except Exception:
        logger.warning("오래된 multipart upload 정리 실패", exc_info=True)


def _validate_session_id(session_id: str) -> None:
    if not re.fullmatch(r"[A-Za-z0-9_-]{6,64}", session_id):
        raise HTTPException(status_code=400, detail="유효하지 않은 세션 ID 입니다.")


def _staging_key(session_id: str, safe_name: str) -> str:
    return f"_staging/{session_id}/{safe_name}"


def _validate_staging_key(session_id: str, staging_key: str, safe_name: str | None = None) -> None:
    _validate_session_id(session_id)
    prefix = f"_staging/{session_id}/"
    if not staging_key.startswith(prefix) or ".." in staging_key:
        raise HTTPException(status_code=400, detail="staging_key 가 세션과 일치하지 않습니다.")
    if safe_name is not None and staging_key != _staging_key(session_id, safe_name):
        raise HTTPException(status_code=400, detail="staging_key 가 세션과 일치하지 않습니다.")


def _multipart_part_size(size: int | None) -> tuple[int, int | None]:
    if size is None or size <= 0:
        return MULTIPART_PART_SIZE, None
    part_size = max(MULTIPART_PART_SIZE, (size + MULTIPART_MAX_PARTS - 1) // MULTIPART_MAX_PARTS)
    one_mib = 1024 * 1024
    part_size = ((part_size + one_mib - 1) // one_mib) * one_mib
    part_count = (size + part_size - 1) // part_size
    return part_size, part_count

def _safe_relative_name(name: str | None) -> str | None:
    """업로드 파일명 검증 — 절대경로·상위 참조·제어문자를 거부하고 정규화된 상대경로만 허용."""
    if not name:
        return None
    if any(ord(c) < 0x20 or ord(c) == 0x7F for c in name):   # NUL·제어문자
        return None
    name = name.replace("\\", "/")
    if name.startswith("/") or name.startswith("~"):
        return None
    parts = [p for p in name.split("/") if p not in ("", ".")]
    if not parts or any(p == ".." for p in parts):
        return None
    return "/".join(parts)


def _get_session_dir(session_id: str) -> str | None:
    """세션 ID로 임시 디렉토리를 찾는다 (파일 시스템 기반)."""
    return get_session_dir(session_id)


def _cleanup_session(session_id: str) -> None:
    """세션의 임시 디렉토리를 정리한다."""
    cleanup_upload_session(session_id)


# ─────────────────────────────────────────────────────────────────────────
# 1. POST /analyze
# ─────────────────────────────────────────────────────────────────────────


@router.post("/analyze", response_model=Manifest)
async def upload_analyze(
    files: list[UploadFile] | None = File(None),
    collection_id: str = Form(""),
    session_id: str = Form(""),
):
    """파일을 받아 자동 채움 파이프라인을 실행하고 매니페스트를 반환한다.
    임시 파일은 세션 ID로 관리되며, 등록 완료 시까지 보존된다.
    session_id를 프론트에서 미리 생성하여 전달하면 새로고침 후 복구에 사용."""
    if not session_id:
        session_id = uuid.uuid4().hex
    # presigned 대용량 파일이 이미 받아져 있는 세션이면 그 디렉토리를 재사용 —
    # 소용량(multipart)과 대용량(presigned)이 한 배치로 묶여 번들링·관계 제안이 함께 동작한다.
    _validate_session_id(session_id)
    tmp_dir = ensure_session_dir(session_id)

    try:
        # 파일을 임시 디렉토리에 저장 (원본 파일명 유지). 대용량 staging 객체가 있으면
        # run_analysis_for_session()이 분석 전에 내려받는다.
        await save_upload_files(tmp_dir, files or [], _safe_relative_name)
        _validate_session_payload_size(session_id)
        if not collect_session_files(tmp_dir) and not load_staged_uploads(session_id):
            raise HTTPException(status_code=400, detail="파일이 없습니다.")

        # Collection 기본값 조회
        collection_defaults = await _fetch_collection_defaults(collection_id)

        # 파이프라인 실행
        manifest = run_analysis_for_session(session_id, collection_defaults)
        logger.info("분석 완료 — session=%s, tmp_dir=%s, files=%d", session_id, tmp_dir, len(collect_session_files(tmp_dir)))
        return manifest

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        # 분석 실패해도 임시 파일 유지 (리로드 시 데이터 손실 방지)
        # 등록 완료 시 또는 cleanup 주기에서 정리
        raise


class AnalyzeAsyncResponse(BaseModel):
    """비동기 분석 접수 결과."""
    status: str
    session_id: str
    task_id: str | None = None


@router.post("/analyze-async", response_model=AnalyzeAsyncResponse)
async def upload_analyze_async(
    files: list[UploadFile] | None = File(None),
    collection_id: str = Form(""),
    session_id: str = Form(""),
):
    """파일 저장 후 분석을 Celery worker에 맡긴다. 클라이언트는 /sessions/{id}를 폴링한다."""
    if not session_id:
        session_id = uuid.uuid4().hex
    _validate_session_id(session_id)
    tmp_dir = ensure_session_dir(session_id)

    await save_upload_files(tmp_dir, files or [], _safe_relative_name)
    _validate_session_payload_size(session_id)
    if not collect_session_files(tmp_dir) and not load_staged_uploads(session_id):
        raise HTTPException(status_code=400, detail="파일이 없습니다.")

    collection_defaults = await _fetch_collection_defaults(collection_id)
    save_analysis_status(session_id, "queued", collection_defaults=collection_defaults)
    try:
        from sams.worker import analyze_session_task
        task = analyze_session_task.delay(session_id, collection_defaults)
    except Exception as e:
        save_analysis_status(session_id, "failed", error=str(e))
        logger.exception("분석 태스크 큐 등록 실패: %s", session_id)
        raise HTTPException(status_code=500, detail=f"분석 태스크 큐 등록 실패: {e}")

    save_analysis_status(session_id, "queued", task_id=task.id, collection_defaults=collection_defaults)
    return AnalyzeAsyncResponse(status="queued", session_id=session_id, task_id=task.id)


@router.get("/sessions/{session_id}")
async def get_session_status(session_id: str):
    """세션의 분석 상태를 조회한다. 새로고침 후 복구에 사용."""
    tmp_dir = _get_session_dir(session_id)
    if not tmp_dir:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다.")

    manifest_data = load_manifest(session_id)
    if manifest_data:
        return {"status": "analyzed", "manifest": manifest_data}
    status = load_analysis_status(session_id)
    if status:
        if is_status_stale(status, settings.UPLOAD_ANALYSIS_STALE_SECONDS):
            return {**status, "status": "stalled", "stale": True, "can_retry": True}
        return status
    return {"status": "analyzing"}


@router.post("/sessions/{session_id}/retry-analysis", response_model=AnalyzeAsyncResponse)
async def retry_session_analysis(session_id: str):
    """stalled/failed/queued 세션의 분석 태스크를 다시 enqueue한다."""
    _validate_session_id(session_id)
    if not _get_session_dir(session_id):
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다.")
    status = load_analysis_status(session_id) or {}
    collection_defaults = status.get("collection_defaults")
    save_analysis_status(session_id, "queued", collection_defaults=collection_defaults)
    try:
        from sams.worker import analyze_session_task
        task = analyze_session_task.delay(session_id, collection_defaults)
    except Exception as e:
        save_analysis_status(session_id, "failed", error=str(e), collection_defaults=collection_defaults)
        logger.exception("분석 태스크 재시도 큐 등록 실패: %s", session_id)
        raise HTTPException(status_code=500, detail=f"분석 태스크 재시도 큐 등록 실패: {e}")
    save_analysis_status(session_id, "queued", task_id=task.id, collection_defaults=collection_defaults)
    return AnalyzeAsyncResponse(status="queued", session_id=session_id, task_id=task.id)


@router.delete("/sessions/{session_id}")
async def cancel_session(session_id: str):
    """세션의 임시 파일과 staging 객체를 삭제한다. 업로드 취소 시 호출."""
    removed_staging = 0
    if re.fullmatch(r"[A-Za-z0-9_-]{6,64}", session_id):
        removed_staging = delete_prefix(f"_staging/{session_id}/")
        if removed_staging:
            logger.info("취소 — staging %d개 정리: %s", removed_staging, session_id)
    tmp_dir = _get_session_dir(session_id)
    if tmp_dir:
        _cleanup_session(session_id)
        return {"deleted": True, "session_id": session_id, "staging_removed": removed_staging}
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


class UploadCompleteRequest(BaseModel):
    """대용량 직접 업로드 완료 통지."""
    session_id: str
    staging_key: str
    filename: str
    size: int | None = None


class MultipartInitRequest(BaseModel):
    """대용량 multipart 업로드 시작 요청."""
    session_id: str = ""
    filename: str
    size: int | None = None
    content_type: str | None = None


class MultipartPartUrlRequest(BaseModel):
    """multipart part presigned URL 요청."""
    session_id: str
    staging_key: str
    upload_id: str
    part_number: int


class MultipartPart(BaseModel):
    part_number: int
    etag: str


class MultipartCompleteRequest(BaseModel):
    """multipart 업로드 완료 요청."""
    session_id: str
    staging_key: str
    filename: str
    upload_id: str
    parts: list[MultipartPart]


class MultipartAbortRequest(BaseModel):
    """multipart 업로드 중단 요청."""
    session_id: str
    staging_key: str
    upload_id: str


def _prepare_completed_staging_upload(
    session_id: str,
    staging_key: str,
    filename: str,
    expected_size: int | None = None,
) -> dict[str, Any]:
    """staging 객체를 검증하고 세션에 기록한다. 실제 다운로드는 분석 태스크가 수행한다."""
    safe_name = _safe_relative_name(filename)
    if not safe_name:
        raise HTTPException(status_code=400, detail=f"유효하지 않은 파일명입니다: {filename}")
    _validate_staging_key(session_id, staging_key, safe_name)

    size = object_size(staging_key)
    if size is None:
        raise HTTPException(status_code=404, detail="업로드된 객체를 찾을 수 없습니다. 업로드가 완료되었는지 확인하세요.")
    if expected_size is not None and size != expected_size:
        raise HTTPException(status_code=400, detail="업로드된 객체 크기가 예상 크기와 일치하지 않습니다.")

    record_staged_upload(session_id, safe_name, staging_key, size)
    return {"ok": True, "session_id": session_id, "size": size, "filename": safe_name}


@router.get("/presigned-url")
async def upload_presigned_url(filename: str, session_id: str = "", size: int | None = None):
    """대용량(>=100MB) 직접 업로드용 presigned PUT URL 발급.

    흐름(설계서 §4.2): URL 발급 → 브라우저가 MinIO 에 직접 PUT → upload-complete 통지.
    staging 경로(_staging/{session}/{file})에 올리고 등록 시 최종 경로로 서버측 복사한다.
    """
    safe_name = _safe_relative_name(filename)
    if not safe_name:
        raise HTTPException(status_code=400, detail=f"유효하지 않은 파일명입니다: {filename}")
    if not session_id:
        session_id = uuid.uuid4().hex
    _validate_session_id(session_id)
    _validate_upload_size(size, safe_name)

    staging_key = _staging_key(session_id, safe_name)
    try:
        url = generate_put_url(staging_key)
    except Exception as e:
        logger.exception("presigned URL 발급 실패")
        raise HTTPException(status_code=500, detail=f"presigned URL 발급 실패: {e}")
    return {"session_id": session_id, "staging_key": staging_key, "url": url, "expires_in": 3600}


@router.post("/multipart/initiate")
async def upload_multipart_initiate(req: MultipartInitRequest):
    """대용량 파일을 part 단위로 직접 업로드하기 위한 multipart 세션을 시작한다."""
    safe_name = _safe_relative_name(req.filename)
    if not safe_name:
        raise HTTPException(status_code=400, detail=f"유효하지 않은 파일명입니다: {req.filename}")
    session_id = req.session_id or uuid.uuid4().hex
    _validate_session_id(session_id)
    if req.size is None:
        raise HTTPException(status_code=400, detail="파일 크기가 필요합니다.")
    _validate_upload_size(req.size, safe_name)
    _maybe_cleanup_stale_multipart_uploads()
    staging_key = _staging_key(session_id, safe_name)
    part_size, part_count = _multipart_part_size(req.size)
    try:
        upload_id = initiate_multipart_upload(staging_key, req.content_type)
    except Exception as e:
        logger.exception("multipart upload 시작 실패")
        raise HTTPException(status_code=500, detail=f"multipart upload 시작 실패: {e}")
    record_multipart_upload(session_id, safe_name, staging_key, upload_id, req.size)
    return {
        "session_id": session_id,
        "staging_key": staging_key,
        "upload_id": upload_id,
        "part_size": part_size,
        "part_count": part_count,
        "expires_in": 3600,
    }


@router.post("/multipart/part-url")
async def upload_multipart_part_url(req: MultipartPartUrlRequest):
    """multipart part 하나를 업로드할 presigned URL을 발급한다."""
    _validate_staging_key(req.session_id, req.staging_key)
    if req.part_number < 1 or req.part_number > MULTIPART_MAX_PARTS:
        raise HTTPException(status_code=400, detail="part_number 범위가 유효하지 않습니다.")
    if not req.upload_id:
        raise HTTPException(status_code=400, detail="upload_id가 필요합니다.")
    upload = get_multipart_upload(req.session_id, req.staging_key, req.upload_id)
    if not upload or upload.get("status") != "open":
        raise HTTPException(status_code=404, detail="multipart upload 세션을 찾을 수 없습니다.")
    try:
        url = generate_upload_part_url(req.staging_key, req.upload_id, req.part_number)
    except Exception as e:
        logger.exception("multipart part URL 발급 실패")
        raise HTTPException(status_code=500, detail=f"multipart part URL 발급 실패: {e}")
    touch_multipart_upload(req.session_id, req.staging_key, req.upload_id)
    return {"url": url, "part_number": req.part_number, "expires_in": 3600}


@router.post("/multipart/complete")
async def upload_multipart_complete(req: MultipartCompleteRequest):
    """multipart part를 객체로 확정한 뒤 기존 분석 준비 흐름으로 넘긴다."""
    safe_name = _safe_relative_name(req.filename)
    if not safe_name:
        raise HTTPException(status_code=400, detail=f"유효하지 않은 파일명입니다: {req.filename}")
    _validate_staging_key(req.session_id, req.staging_key, safe_name)
    if not req.parts:
        raise HTTPException(status_code=400, detail="완료할 part 목록이 없습니다.")
    if len(req.parts) > MULTIPART_MAX_PARTS:
        raise HTTPException(status_code=400, detail="part 개수가 너무 많습니다.")

    seen: set[int] = set()
    parts: list[dict[str, Any]] = []
    for p in sorted(req.parts, key=lambda part: part.part_number):
        if p.part_number < 1 or p.part_number > MULTIPART_MAX_PARTS or p.part_number in seen:
            raise HTTPException(status_code=400, detail="part 목록이 유효하지 않습니다.")
        seen.add(p.part_number)
        etag = p.etag.strip()
        if not etag:
            raise HTTPException(status_code=400, detail="part ETag가 비어 있습니다.")
        parts.append({"PartNumber": p.part_number, "ETag": etag})

    upload = get_multipart_upload(req.session_id, req.staging_key, req.upload_id)
    if not upload or upload.get("status") != "open":
        raise HTTPException(status_code=404, detail="multipart upload 세션을 찾을 수 없습니다.")

    try:
        complete_multipart_upload(req.staging_key, req.upload_id, parts)
    except Exception as e:
        logger.exception("multipart upload 완료 실패: %s", req.staging_key)
        raise HTTPException(status_code=500, detail=f"multipart upload 완료 실패: {e}")

    expected_size = upload.get("expected_size") if isinstance(upload.get("expected_size"), int) else None
    result = _prepare_completed_staging_upload(req.session_id, req.staging_key, safe_name, expected_size)
    set_multipart_upload_status(req.session_id, req.staging_key, req.upload_id, "completed")
    return result


@router.post("/multipart/abort")
async def upload_multipart_abort(req: MultipartAbortRequest):
    """진행 중인 multipart upload를 중단한다."""
    _validate_staging_key(req.session_id, req.staging_key)
    if not req.upload_id:
        raise HTTPException(status_code=400, detail="upload_id가 필요합니다.")
    abort_multipart_upload(req.staging_key, req.upload_id)
    set_multipart_upload_status(req.session_id, req.staging_key, req.upload_id, "aborted")
    return {"ok": True, "session_id": req.session_id, "staging_key": req.staging_key}


@router.post("/upload-complete")
async def upload_complete(req: UploadCompleteRequest):
    """직접 업로드 완료 통지 — 객체 존재 확인 후 분석용으로 세션 디렉토리에 내려받는다.

    메타데이터 추출·썸네일은 로컬 파일이 필요하므로 staging 에서 1회 다운로드한다
    (등록 시 원본은 staging→최종 서버측 복사 — 재업로드 없음).
    """
    _validate_upload_size(req.size, req.filename)
    return _prepare_completed_staging_upload(req.session_id, req.staging_key, req.filename, req.size)


class RegisterResult(BaseModel):
    """등록 결과."""
    registered: int = 0
    item_ids: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)


@router.post("/register", response_model=RegisterResult)
async def upload_register(req: RegisterRequest):
    """매니페스트로 STAC Item을 생성하고 S3에 파일을 업로드한다."""

    if not req.items:
        raise HTTPException(status_code=400, detail="등록할 항목이 없습니다.")

    # 세션에서 임시 디렉토리 조회 (파일 시스템 기반 — 리로드에도 유지)
    tmp_dir = _get_session_dir(req.session_id) if req.session_id else None
    session_prefix = f"_staging/{req.session_id}/" if req.session_id else None
    staged_by_name = staged_upload_map(req.session_id) if req.session_id else {}

    # Collection 자동 생성 (없으면)
    if req.collection_id:
        await _ensure_collection(req.collection_id)

    registered = 0
    item_ids: list[str] = []
    errors: list[str] = []
    # 수락된 관계 제안 해석용 — 배치 내 링크 대상의 ID 는 지금 이 루프에서 생성되므로
    # manifest 인덱스 → 생성된 item_id 매핑을 만들고, 전 항목 등록 후 링크를 일괄 생성한다.
    registered_by_midx: dict[int, str] = {}
    pending_links: list[tuple[int, list[dict]]] = []   # (source_midx, accepted_links)

    for idx, item_data in enumerate(req.items):
        try:
            staging_to_delete: list[str] = []   # STAC 등록 성공 후에만 staging 삭제 (실패 시 재시도 가능)
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
                local_exists = os.path.exists(local_path)
                staging_key = item_data.get("_staging_key")
                staged_info = staged_by_name.get(filename) or {}
                if not staging_key and staged_info:
                    staging_key = staged_info.get("staging_key")

                def _validated_staging_key(name: str, provided_key: str | None = None) -> str | None:
                    info = staged_by_name.get(name) or {}
                    key = provided_key or info.get("staging_key")
                    if not (session_prefix and isinstance(key, str)
                            and key.startswith(session_prefix) and ".." not in key):
                        return None
                    size = object_size(key)
                    if size is None:
                        return None
                    expected = info.get("size")
                    if isinstance(expected, int) and size != expected:
                        raise RuntimeError(f"staging 객체 크기 불일치: {name}")
                    return key

                primary_staging_key = _validated_staging_key(filename, staging_key)

                if local_exists or primary_staging_key:
                    # 이미지 세트: 전체 파일을 S3에 병렬 업로드
                    if bundled_files:
                        import concurrent.futures
                        all_bf = [filename] + bundled_files

                        def _copy_or_upload(bf: str) -> None:
                            """번들 멤버 — presigned staging 에 있으면 서버측 복사, 없으면 업로드."""
                            bf_path = os.path.join(tmp_dir, bf)
                            sk = _validated_staging_key(bf)
                            if sk:
                                copy_object(sk, build_s3_key(req.collection_id, category, item_id, Path(bf).name))
                                staging_to_delete.append(sk)
                                return
                            if os.path.exists(bf_path):
                                upload_file(bf_path, req.collection_id, category, item_id, Path(bf).name)
                            else:
                                raise FileNotFoundError(bf)

                        uploaded_count = 0
                        upload_errors: list[str] = []
                        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
                            futures = [executor.submit(_copy_or_upload, bf) for bf in all_bf]
                            for f in concurrent.futures.as_completed(futures):
                                try:
                                    f.result()
                                    uploaded_count += 1
                                except Exception as exc:
                                    upload_errors.append(str(exc))

                        if upload_errors:
                            delete_prefix(f"{req.collection_id}/{category}/{item_id}/")
                            preview = "; ".join(upload_errors[:3])
                            more = "" if len(upload_errors) <= 3 else f" 외 {len(upload_errors) - 3}건"
                            raise RuntimeError(f"이미지 세트 파일 업로드 실패 {len(upload_errors)}건: {preview}{more}")

                        assets["data"] = {
                            "href": build_asset_href(req.collection_id, category, item_id, display_name),
                            "type": _guess_media_type(display_name),
                            "roles": ["data"],
                            "title": f"{display_name} 외 {len(bundled_files)}개 파일",
                            "file_count": uploaded_count,
                        }
                        logger.info("이미지 세트 S3 업로드 완료: %d개 파일 (병렬)", uploaded_count)
                    else:
                        # 단일 파일 — presigned 로 staging 에 이미 올라간 대용량이면
                        # 서버측 복사(재업로드 없음), 아니면 임시 파일을 업로드.
                        # staging 키는 이 요청의 세션 영역으로 한정 (다른 세션 객체 접근 차단).
                        if primary_staging_key:
                            s3_key = copy_object(primary_staging_key, build_s3_key(req.collection_id, category, item_id, display_name))
                            # 삭제는 STAC 등록 성공 후 — 등록 실패 롤백 시 staging 이 남아 재시도 가능
                            staging_to_delete.append(primary_staging_key)
                            logger.info("S3 staging 복사 완료: %s → %s", primary_staging_key, s3_key)
                        else:
                            s3_key = upload_file(local_path, req.collection_id, category, item_id, display_name)
                            logger.info("S3 업로드 완료: %s → %s", display_name, s3_key)
                        assets["data"] = {
                            "href": build_asset_href(req.collection_id, category, item_id, display_name),
                            "type": _guess_media_type(display_name),
                            "roles": ["data"],
                            "title": display_name,
                        }

                    # 썸네일 — 대용량은 Celery 비동기 (등록 응답 지연 방지), 소용량은 동기
                    thumb_async = False
                    try:
                        final_s3_key = build_s3_key(req.collection_id, category, item_id, display_name)
                        should_async_thumb = (
                            bool(primary_staging_key) or
                            os.path.getsize(local_path) >= settings.THUMB_ASYNC_THRESHOLD_MB * 1024 * 1024
                        )
                        if should_async_thumb:
                            from sams.worker import generate_thumbnail_task
                            generate_thumbnail_task.delay(
                                req.collection_id, item_id,
                                final_s3_key,
                                category, display_name,
                            )
                            thumb_async = True
                            logger.info("썸네일 비동기 디스패치: %s (%s)", item_id, display_name)
                    except Exception:
                        logger.warning("썸네일 비동기 디스패치 실패 — 동기로 폴백: %s", display_name)
                    try:
                        thumb_path = None if (thumb_async or not local_exists) else generate_thumbnail(local_path, category)
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
            properties = _register_properties(item_data)
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

            # 등록 확정 — 이제 staging 원본을 정리한다
            for sk in staging_to_delete:
                delete_object(sk)

            registered += 1
            item_ids.append(item_id)

            # 클라이언트 제공 인덱스는 검증 후 사용 — 비정수면 루프 인덱스로 폴백, 중복은 선착순.
            # (등록 성공 후의 예외가 except 의 S3 롤백으로 흘러 "등록은 됐는데 파일만 삭제"가 되는 것 방지)
            midx = item_data.get("_manifest_idx", idx)
            if not isinstance(midx, int) or isinstance(midx, bool):
                midx = idx
            registered_by_midx.setdefault(midx, item_id)
            accepted = item_data.get("_accepted_links")
            if isinstance(accepted, list) and accepted:
                pending_links.append((midx, accepted))

            history.record_event(
                req.collection_id, item_id, "register",
                f"{req.status.capitalize()}로 등록 · 자동 분류 → {category}",
                {"status": req.status, "category": category},
            )
            # 동기 썸네일 경로(이 루프 상단)가 실제로 thumbnail asset 을 붙인 경우에만 기록.
            # 등록 성공 후에 기록해야 등록 실패 시 고아 이벤트가 남지 않는다.
            if (stac_item.get("assets") or {}).get("thumbnail"):
                history.record_event(
                    req.collection_id, item_id, "preview",
                    "preview(썸네일) 생성 완료",
                    {"asset": "thumbnail"}, actor="시스템",
                )

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

    # 수락된 관계 제안 → STAC links 생성 (양방향). 링크 실패가 등록을 되돌리지는 않는다 —
    # 등록은 이미 커밋됐으므로 어떤 예외도 errors 로만 강등한다 (500 이면 프론트가 재시도 → 중복 등록 위험).
    if pending_links:
        try:
            link_errors = await _create_accepted_links(req.collection_id, registered_by_midx, pending_links)
            errors.extend(link_errors)
        except Exception as e:
            logger.exception("관계 링크 일괄 생성 실패")
            errors.append(f"관계 링크 생성 실패: {e}")

    # 등록 완료 후 세션 정리 (로컬 임시 + 잔여 staging — 제외된 행 등)
    if req.session_id:
        _cleanup_session(req.session_id)
        if re.fullmatch(r"[A-Za-z0-9_-]{6,64}", req.session_id):
            removed = delete_prefix(f"_staging/{req.session_id}/")
            if removed:
                logger.info("잔여 staging 정리: %d개 (%s)", removed, req.session_id)

    return RegisterResult(
        registered=registered,
        item_ids=item_ids,
        errors=errors,
    )


# 업로드 제안 수락으로 만들 수 있는 관계 — prev/next 등은 보완/Detail 에서 별도 authoring
_ALLOWED_SUGGEST_RELS = {"derived_from", "related", "describedby"}


async def _create_accepted_links(
    collection_id: str,
    registered_by_midx: dict[int, str],
    pending_links: list[tuple[int, list[dict]]],
) -> list[str]:
    """수락된 제안(_accepted_links, manifest 인덱스 기반)을 실제 STAC links 로 해석·생성한다.

    배치 내 링크 대상의 item_id 는 등록 시점에 생성되므로 인덱스→ID 매핑으로 해석한다.
    Detail 의 관계 추가와 동일하게 역방향 링크도 함께 만든다(_REVERSE_REL 재사용).
    실패는 오류 목록으로 반환만 하고 등록 자체는 유지한다 (graceful degradation).
    """
    from sams.routers.items import _REVERSE_REL, _pgstac_update_item
    from sams.services import stac

    # 항목별로 추가할 링크·이력 이벤트를 모아 항목당 1회만 조회/갱신
    additions: dict[str, dict] = {}   # item_id -> {"links": [...], "events": [(rel, target_id)]}

    def _add(item_id: str, rel: str, target_id: str) -> None:
        entry = additions.setdefault(item_id, {"links": [], "events": []})
        entry["links"].append({"rel": rel, "href": f"./{target_id}", "type": "application/geo+json"})
        entry["events"].append((rel, target_id))

    for source_midx, accepted in pending_links:
        source_id = registered_by_midx.get(source_midx)
        if not source_id:
            continue
        seen: set[tuple[str, str]] = set()
        for link in accepted:
            if not isinstance(link, dict):
                continue
            rel = link.get("rel")
            target_idx = link.get("target_idx")
            if not isinstance(target_idx, int) or isinstance(target_idx, bool):
                continue
            target_id = registered_by_midx.get(target_idx)
            if rel not in _ALLOWED_SUGGEST_RELS or not target_id or target_id == source_id:
                continue
            if (rel, target_id) in seen:
                continue
            seen.add((rel, target_id))
            _add(source_id, rel, target_id)
            reverse = _REVERSE_REL.get(rel)
            if reverse:
                _add(target_id, reverse, source_id)

    link_errors: list[str] = []
    for item_id, entry in additions.items():
        try:
            item = await stac.get_item(collection_id, item_id)
            if item is None:
                link_errors.append(f"관계 링크 생성 실패: {item_id} 조회 불가")
                continue
            existing = item.get("links", [])
            have = {(l.get("rel"), l.get("href")) for l in existing}
            new_links = [l for l in entry["links"] if (l["rel"], l["href"]) not in have]
            if not new_links:
                continue
            item["links"] = existing + new_links
            await _pgstac_update_item(collection_id, item_id, item)
            for rel, target_id in entry["events"]:
                history.record_event(
                    collection_id, item_id, "relation",
                    f"관계 추가(업로드 제안 수락): {rel} → {target_id}",
                    {"rel": rel, "target": target_id}, actor="시스템",
                )
        except Exception as e:
            logger.exception("관계 링크 생성 실패: %s", item_id)
            link_errors.append(f"관계 링크 생성 실패({item_id}): {e}")

    return link_errors


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
