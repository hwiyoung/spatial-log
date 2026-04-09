"""
Celery Worker — 비동기 작업 처리

작업 목록:
- generate_thumbnail: 썸네일 생성 후 S3 업로드, STAC Item thumbnail Asset 업데이트

실패해도 에러 로그만 남기고 Item 등록에는 영향 없음.
참조: docs/autofill_pipeline_spec.md 섹션 7
"""

import logging
import os
from pathlib import Path

from celery import Celery

from sams.config import settings

logger = logging.getLogger(__name__)

app = Celery("sams", broker=settings.CELERY_BROKER_URL)
app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_track_started=True,
    task_acks_late=True,
)


@app.task(bind=True, max_retries=2, default_retry_delay=30)
def generate_thumbnail_task(
    self,
    collection_id: str,
    item_id: str,
    file_path: str,
    data_category: str,
):
    """썸네일을 생성하고 S3에 업로드한 뒤 STAC Item의 thumbnail Asset을 업데이트한다.

    Args:
        collection_id: Collection ID.
        item_id: STAC Item ID.
        file_path: S3에서 다운로드한 로컬 파일 경로, 또는 원본 임시 파일 경로.
        data_category: 데이터 유형.
    """
    from sams.pipeline.thumbnail import generate_thumbnail
    from sams.services.s3 import upload_file, build_asset_href

    logger.info("썸네일 생성 시작: %s (%s)", item_id, data_category)

    # 1) 썸네일 생성
    thumb_path = generate_thumbnail(file_path, data_category)
    if thumb_path is None:
        logger.warning("썸네일 생성 실패 또는 미지원: %s", item_id)
        return {"status": "skipped", "item_id": item_id}

    try:
        # 2) S3 업로드
        original_name = Path(file_path).stem
        thumb_filename = f"{original_name}_thumb.png"

        s3_key = upload_file(
            thumb_path,
            collection_id,
            data_category,
            item_id,
            thumb_filename,
        )

        # 3) STAC Item의 thumbnail Asset 업데이트
        _update_item_thumbnail(
            collection_id, item_id,
            build_asset_href(collection_id, data_category, item_id, thumb_filename),
        )

        logger.info("썸네일 완료: %s → %s", item_id, s3_key)
        return {"status": "completed", "item_id": item_id, "s3_key": s3_key}

    except Exception as exc:
        logger.exception("썸네일 S3 업로드/Item 업데이트 실패: %s", item_id)
        raise self.retry(exc=exc)

    finally:
        # 임시 파일 정리
        if thumb_path and os.path.exists(thumb_path):
            os.unlink(thumb_path)


def _update_item_thumbnail(collection_id: str, item_id: str, href: str) -> None:
    """STAC Item의 thumbnail Asset을 동기적으로 업데이트한다.

    Celery 태스크 내부에서는 async를 쓸 수 없으므로 httpx 동기 클라이언트 사용.
    """
    import httpx

    # Item 조회
    resp = httpx.get(
        f"{settings.STAC_API_URL}/collections/{collection_id}/items/{item_id}",
        timeout=10.0,
    )
    if resp.status_code != 200:
        logger.error("Item 조회 실패: %s (HTTP %s)", item_id, resp.status_code)
        return

    item = resp.json()
    assets = item.get("assets", {})
    assets["thumbnail"] = {
        "href": href,
        "type": "image/png",
        "roles": ["thumbnail"],
        "title": "썸네일",
    }
    item["assets"] = assets

    # Item 업데이트
    resp = httpx.put(
        f"{settings.STAC_API_URL}/collections/{collection_id}/items/{item_id}",
        json=item,
        timeout=10.0,
    )
    if resp.status_code >= 400:
        logger.error("Item 썸네일 업데이트 실패: %s (HTTP %s)", item_id, resp.status_code)
