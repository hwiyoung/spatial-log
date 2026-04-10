"""
파일 서빙 엔드포인트 — S3에서 파일을 읽어 스트리밍 응답.

GET /api/files/{collection}/{category}/{item_id}/{filename}

참조: docs/system_architecture.md 섹션 4
"""

import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from sams.config import settings
from sams.services.s3 import get_s3_client, build_s3_key

logger = logging.getLogger(__name__)
router = APIRouter()

_CONTENT_TYPES = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".tif": "image/tiff",
    ".tiff": "image/tiff",
    ".pdf": "application/pdf",
    ".mp4": "video/mp4",
    ".las": "application/vnd.las",
    ".laz": "application/vnd.laszip",
    ".obj": "text/plain",
    ".glb": "model/gltf-binary",
}


@router.get("/{collection_id}/{data_category}/{item_id}/{filename}")
async def serve_file(
    collection_id: str,
    data_category: str,
    item_id: str,
    filename: str,
):
    """S3에서 파일을 읽어 스트리밍 응답한다."""
    key = build_s3_key(collection_id, data_category, item_id, filename)
    client = get_s3_client()

    try:
        obj = client.get_object(Bucket=settings.S3_BUCKET, Key=key)
    except Exception:
        logger.warning("S3 파일 없음: %s", key)
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")

    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    content_type = _CONTENT_TYPES.get(ext, "application/octet-stream")

    # 파일명을 ASCII-safe로 변환 (한글 등 non-ASCII 대응)
    from urllib.parse import quote
    safe_filename = quote(filename)

    return StreamingResponse(
        obj["Body"].iter_chunks(chunk_size=1024 * 1024),
        media_type=content_type,
        headers={
            "Content-Disposition": f"inline; filename*=UTF-8''{safe_filename}",
            "Cache-Control": "public, max-age=3600",
        },
    )
