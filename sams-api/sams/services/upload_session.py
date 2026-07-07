"""Upload session helpers shared by API and Celery worker."""

import json
import logging
import os
import shutil
import tempfile
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sams.config import settings
from sams.pipeline import analyze
from sams.services.s3 import abort_multipart_upload, delete_prefix, download_object

logger = logging.getLogger(__name__)

MANIFEST_FILE = "_manifest.json"
STAGED_FILE = "_staged_files.json"
STATUS_FILE = "_analysis_status.json"
MULTIPART_FILE = "_multipart_uploads.json"
_SESSION_META_FILES = {MANIFEST_FILE, STAGED_FILE, STATUS_FILE, MULTIPART_FILE}


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def get_session_dir(session_id: str) -> str | None:
    """Find the temp directory for an upload session."""
    base = settings.UPLOAD_TMP_DIR if os.path.isdir(settings.UPLOAD_TMP_DIR) else tempfile.gettempdir()
    prefix = f"sams_{session_id}_"
    try:
        dirs = os.listdir(base)
    except OSError:
        logger.warning("임시 디렉토리 목록 조회 실패: %s", base)
        return None
    for d in dirs:
        full = os.path.join(base, d)
        if d.startswith(prefix) and os.path.isdir(full):
            return full
    return None


def ensure_session_dir(session_id: str) -> str:
    """Return an existing session dir or create one."""
    return get_session_dir(session_id) or tempfile.mkdtemp(
        prefix=f"sams_{session_id}_",
        dir=settings.UPLOAD_TMP_DIR if os.path.isdir(settings.UPLOAD_TMP_DIR) else None,
    )


def cleanup_session(session_id: str) -> bool:
    tmp_dir = get_session_dir(session_id)
    if not tmp_dir:
        return False
    shutil.rmtree(tmp_dir, ignore_errors=True)
    logger.info("세션 정리 완료: %s", session_id)
    return True


def _read_json(path: str, default: Any) -> Any:
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default


def _write_json(path: str, data: Any) -> None:
    with open(path, "w", encoding="utf-8") as f:
        f.write(json.dumps(data, ensure_ascii=False, default=str))


def save_analysis_status(session_id: str, status: str, **extra: Any) -> dict[str, Any]:
    tmp_dir = ensure_session_dir(session_id)
    data = {"status": status, "session_id": session_id, "updated_at": utc_now_iso(), **extra}
    _write_json(os.path.join(tmp_dir, STATUS_FILE), data)
    return data


def load_analysis_status(session_id: str) -> dict[str, Any] | None:
    tmp_dir = get_session_dir(session_id)
    if not tmp_dir:
        return None
    path = os.path.join(tmp_dir, STATUS_FILE)
    if not os.path.exists(path):
        return None
    return _read_json(path, None)


def touch_running_status(session_id: str) -> None:
    """Refresh a running analysis heartbeat without changing its other fields."""
    tmp_dir = get_session_dir(session_id)
    if not tmp_dir:
        return
    path = os.path.join(tmp_dir, STATUS_FILE)
    if not os.path.exists(path):
        return
    data = _read_json(path, None)
    if not isinstance(data, dict) or data.get("status") != "running":
        return
    data["updated_at"] = utc_now_iso()
    _write_json(path, data)


def load_manifest(session_id: str) -> dict[str, Any] | None:
    tmp_dir = get_session_dir(session_id)
    if not tmp_dir:
        return None
    path = os.path.join(tmp_dir, MANIFEST_FILE)
    if not os.path.exists(path):
        return None
    return _read_json(path, None)


def save_manifest(session_id: str, manifest) -> None:
    tmp_dir = ensure_session_dir(session_id)
    _write_json(os.path.join(tmp_dir, MANIFEST_FILE), manifest.model_dump())


def record_staged_upload(session_id: str, filename: str, staging_key: str, size: int) -> None:
    tmp_dir = ensure_session_dir(session_id)
    path = os.path.join(tmp_dir, STAGED_FILE)
    staged = _read_json(path, [])
    staged = [s for s in staged if s.get("filename") != filename]
    staged.append({"filename": filename, "staging_key": staging_key, "size": size, "updated_at": utc_now_iso()})
    _write_json(path, staged)


def load_staged_uploads(session_id: str) -> list[dict[str, Any]]:
    tmp_dir = get_session_dir(session_id)
    if not tmp_dir:
        return []
    data = _read_json(os.path.join(tmp_dir, STAGED_FILE), [])
    return data if isinstance(data, list) else []


def staged_upload_map(session_id: str) -> dict[str, dict[str, Any]]:
    return {s.get("filename"): s for s in load_staged_uploads(session_id) if s.get("filename")}


def _multipart_path(tmp_dir: str) -> str:
    return os.path.join(tmp_dir, MULTIPART_FILE)


def load_multipart_uploads(session_id: str) -> list[dict[str, Any]]:
    tmp_dir = get_session_dir(session_id)
    if not tmp_dir:
        return []
    data = _read_json(_multipart_path(tmp_dir), [])
    return data if isinstance(data, list) else []


def _save_multipart_uploads(session_id: str, uploads: list[dict[str, Any]]) -> None:
    tmp_dir = ensure_session_dir(session_id)
    _write_json(_multipart_path(tmp_dir), uploads)


def record_multipart_upload(
    session_id: str,
    filename: str,
    staging_key: str,
    upload_id: str,
    expected_size: int,
) -> None:
    uploads = load_multipart_uploads(session_id)
    now = utc_now_iso()
    uploads = [
        u for u in uploads
        if not (u.get("staging_key") == staging_key and u.get("upload_id") == upload_id)
    ]
    uploads.append({
        "filename": filename,
        "staging_key": staging_key,
        "upload_id": upload_id,
        "expected_size": expected_size,
        "status": "open",
        "created_at": now,
        "updated_at": now,
    })
    _save_multipart_uploads(session_id, uploads)


def get_multipart_upload(session_id: str, staging_key: str, upload_id: str) -> dict[str, Any] | None:
    for upload in load_multipart_uploads(session_id):
        if upload.get("staging_key") == staging_key and upload.get("upload_id") == upload_id:
            return upload
    return None


def touch_multipart_upload(session_id: str, staging_key: str, upload_id: str) -> None:
    uploads = load_multipart_uploads(session_id)
    changed = False
    for upload in uploads:
        if upload.get("staging_key") == staging_key and upload.get("upload_id") == upload_id:
            upload["updated_at"] = utc_now_iso()
            changed = True
            break
    if changed:
        _save_multipart_uploads(session_id, uploads)


def set_multipart_upload_status(session_id: str, staging_key: str, upload_id: str, status: str) -> None:
    uploads = load_multipart_uploads(session_id)
    changed = False
    for upload in uploads:
        if upload.get("staging_key") == staging_key and upload.get("upload_id") == upload_id:
            upload["status"] = status
            upload["updated_at"] = utc_now_iso()
            changed = True
            break
    if changed:
        _save_multipart_uploads(session_id, uploads)


async def save_upload_files(tmp_dir: str, files: list, safe_name_fn) -> None:
    """Persist FastAPI UploadFile objects without loading each whole file into memory."""
    for file in files:
        safe_name = safe_name_fn(file.filename)
        if not safe_name:
            safe_name = f"unknown_{os.urandom(4).hex()}"
        tmp_path = os.path.join(tmp_dir, safe_name)
        os.makedirs(os.path.dirname(tmp_path), exist_ok=True)
        with open(tmp_path, "wb") as out:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                out.write(chunk)


def _is_session_meta_file(tmp_dir: str, path: str) -> bool:
    rel = Path(os.path.relpath(path, tmp_dir))
    return len(rel.parts) == 1 and rel.name in _SESSION_META_FILES


def collect_session_files(tmp_dir: str) -> list[str]:
    saved_paths: list[str] = []
    for root, _dirs, names in os.walk(tmp_dir):
        for name in names:
            path = os.path.join(root, name)
            if _is_session_meta_file(tmp_dir, path):
                continue
            saved_paths.append(path)
    return saved_paths


def session_payload_size(session_id: str) -> int:
    tmp_dir = get_session_dir(session_id)
    if not tmp_dir:
        return 0
    staged = staged_upload_map(session_id)
    total = sum(int(s.get("size") or 0) for s in staged.values())
    staged_names = set(staged)
    for path in collect_session_files(tmp_dir):
        rel = os.path.relpath(path, tmp_dir)
        if rel in staged_names:
            continue
        try:
            total += os.path.getsize(path)
        except OSError:
            continue
    return total


def _materialize_staged_uploads(session_id: str, tmp_dir: str) -> None:
    for staged in load_staged_uploads(session_id):
        filename = staged.get("filename")
        staging_key = staged.get("staging_key")
        size = staged.get("size")
        if not filename or not staging_key:
            continue
        local_path = os.path.join(tmp_dir, filename)
        if os.path.exists(local_path) and (not isinstance(size, int) or os.path.getsize(local_path) == size):
            continue
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        download_object(staging_key, local_path)
        if isinstance(size, int) and os.path.getsize(local_path) != size:
            raise ValueError(f"staging 다운로드 크기가 일치하지 않습니다: {filename}")


def _remove_materialized_staged_uploads(session_id: str, tmp_dir: str) -> None:
    for staged in load_staged_uploads(session_id):
        filename = staged.get("filename")
        if not filename:
            continue
        local_path = os.path.join(tmp_dir, filename)
        try:
            if os.path.exists(local_path):
                os.unlink(local_path)
        except OSError:
            logger.warning("분석용 staging 복사본 삭제 실패: %s", local_path)


def _relativize_manifest(manifest, tmp_dir: str) -> None:
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


def run_analysis_for_session(session_id: str, collection_defaults: dict[str, Any] | None = None):
    """Materialize staged files, run pipeline analysis, and persist the manifest."""
    tmp_dir = get_session_dir(session_id)
    if not tmp_dir:
        raise ValueError("세션을 찾을 수 없습니다.")

    save_analysis_status(session_id, "running", collection_defaults=collection_defaults)
    _materialize_staged_uploads(session_id, tmp_dir)
    saved_paths = collect_session_files(tmp_dir)
    if not saved_paths:
        raise ValueError("파일이 없습니다.")

    stop_heartbeat = threading.Event()

    def _heartbeat() -> None:
        while not stop_heartbeat.wait(60):
            try:
                touch_running_status(session_id)
            except Exception:
                logger.warning("분석 heartbeat 갱신 실패: %s", session_id, exc_info=True)

    heartbeat_thread = threading.Thread(target=_heartbeat, daemon=True)
    heartbeat_thread.start()
    try:
        manifest = analyze(saved_paths, collection_defaults)
    finally:
        stop_heartbeat.set()
        heartbeat_thread.join(timeout=1)
    _relativize_manifest(manifest, tmp_dir)

    before = len(manifest.manifest)
    manifest.manifest = [
        item for item in manifest.manifest
        if item.detected_category != "unknown"
    ]
    skipped = before - len(manifest.manifest)
    if skipped:
        logger.info("미지원 파일 %d개 제외 (unknown 카테고리)", skipped)
        manifest.summary.total_files = len(manifest.manifest)

    manifest.session_id = session_id
    save_manifest(session_id, manifest)
    _remove_materialized_staged_uploads(session_id, tmp_dir)
    save_analysis_status(session_id, "analyzed", collection_defaults=collection_defaults)
    return manifest


def is_status_stale(status: dict[str, Any], max_age_seconds: int) -> bool:
    if status.get("status") not in ("queued", "running"):
        return False
    updated = _parse_iso(status.get("updated_at"))
    if not updated:
        return False
    return (datetime.now(timezone.utc) - updated).total_seconds() > max_age_seconds


def iter_session_ids() -> list[str]:
    base = settings.UPLOAD_TMP_DIR if os.path.isdir(settings.UPLOAD_TMP_DIR) else tempfile.gettempdir()
    try:
        dirs = os.listdir(base)
    except OSError:
        return []
    session_ids: list[str] = []
    for d in dirs:
        if not d.startswith("sams_"):
            continue
        parts = d.split("_", 2)
        if len(parts) >= 3:
            session_ids.append(parts[1])
    return session_ids


def cleanup_stale_multipart_uploads(max_age_seconds: int | None = None) -> int:
    max_age = max_age_seconds or settings.UPLOAD_STALE_MULTIPART_SECONDS
    now = datetime.now(timezone.utc)
    cleaned = 0
    for session_id in iter_session_ids():
        uploads = load_multipart_uploads(session_id)
        changed = False
        for upload in uploads:
            if upload.get("status") != "open":
                continue
            updated = _parse_iso(upload.get("updated_at")) or _parse_iso(upload.get("created_at"))
            if not updated or (now - updated).total_seconds() <= max_age:
                continue
            staging_key = upload.get("staging_key")
            upload_id = upload.get("upload_id")
            if staging_key and upload_id:
                abort_multipart_upload(staging_key, upload_id)
            if staging_key:
                delete_prefix(staging_key)
            upload["status"] = "aborted_stale"
            upload["updated_at"] = utc_now_iso()
            cleaned += 1
            changed = True
        if changed:
            _save_multipart_uploads(session_id, uploads)
    return cleaned
