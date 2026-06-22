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
    source_s3_key: str,
    data_category: str,
    filename: str,
):
    """썸네일을 생성하고 S3에 업로드한 뒤 STAC Item의 thumbnail Asset을 업데이트한다.

    register 가 등록 응답을 기다리지 않도록 대용량 파일에서 디스패치된다.
    등록 세션 임시 파일은 이미 정리됐을 수 있으므로 원본을 S3 최종 경로에서 내려받는다.

    Args:
        collection_id: Collection ID.
        item_id: STAC Item ID.
        source_s3_key: 원본 데이터의 S3 키 (최종 경로).
        data_category: 데이터 유형.
        filename: 원본 파일명 (확장자 기반 썸네일 생성에 필요).
    """
    import tempfile

    from sams.pipeline.thumbnail import generate_thumbnail
    from sams.services.s3 import upload_file, build_asset_href, download_object

    logger.info("썸네일 생성 시작: %s (%s)", item_id, data_category)

    # 0) 원본 S3 다운로드 (확장자 보존 — 생성기가 확장자로 분기)
    suffix = Path(filename).suffix or ""
    tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    tmp.close()
    file_path = tmp.name
    try:
        download_object(source_s3_key, file_path)
    except Exception as exc:
        os.unlink(file_path)
        logger.warning("원본 S3 다운로드 실패 — 재시도: %s (%s)", item_id, exc)
        raise self.retry(exc=exc)

    # 1) 썸네일 생성
    thumb_path = generate_thumbnail(file_path, data_category)
    if thumb_path is None:
        logger.warning("썸네일 생성 실패 또는 미지원: %s", item_id)
        return {"status": "skipped", "item_id": item_id}

    try:
        # 2) S3 업로드 (register 동기 경로와 같은 네이밍)
        thumb_filename = f"thumbnail_{Path(filename).stem}.png"

        s3_key = upload_file(
            thumb_path,
            collection_id,
            data_category,
            item_id,
            thumb_filename,
        )

        # 3) STAC Item의 thumbnail Asset 업데이트
        updated = _update_item_thumbnail(
            collection_id, item_id,
            build_asset_href(collection_id, data_category, item_id, thumb_filename),
        )

        # 디스패치가 등록 완료보다 먼저 실행될 수 있다 (register 가 썸네일 단계에서
        # 디스패치한 뒤 STAC 등록을 진행) — Item 이 아직 없으면 재시도로 흡수한다.
        if not updated:
            raise self.retry(exc=RuntimeError(f"Item 갱신 실패(미등록일 수 있음): {item_id}"), countdown=5)

        logger.info("썸네일 완료: %s → %s", item_id, s3_key)
        # Item 갱신이 실제로 성공했을 때만 이력 기록 — 일어나지 않은 일을 기록하지 않는다
        if updated:
            from sams.services.history import record_event
            record_event(collection_id, item_id, "preview", "preview(썸네일) 생성 완료", {"s3_key": s3_key}, actor="시스템")
        return {"status": "completed", "item_id": item_id, "s3_key": s3_key}

    except Exception as exc:
        # 계획된 재시도(Retry)는 그대로 통과 — 광역 핸들러가 다시 retry 하면 이중 enqueue 된다
        from celery.exceptions import Retry
        if isinstance(exc, Retry):
            raise
        logger.exception("썸네일 S3 업로드/Item 업데이트 실패: %s", item_id)
        raise self.retry(exc=exc)

    finally:
        # 임시 파일 정리
        if thumb_path and os.path.exists(thumb_path):
            os.unlink(thumb_path)
        if os.path.exists(file_path):
            os.unlink(file_path)


def _update_item_thumbnail(collection_id: str, item_id: str, href: str) -> bool:
    """STAC Item의 thumbnail Asset을 동기적으로 업데이트한다. 성공 시에만 True.

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
        return False

    item = resp.json()
    assets = item.get("assets", {})
    assets["thumbnail"] = {
        "href": href,
        "type": "image/png",
        "roles": ["thumbnail"],
        "title": "썸네일",
    }
    item["assets"] = assets

    # Item 업데이트 — stac-fastapi Transaction 확장이 꺼져 있어 PUT 은 405.
    # API 와 동일한 pgSTAC 직접 갱신(원자적 DELETE+create)을 사용한다.
    try:
        from sams.routers.items import pgstac_update_item_sync
        pgstac_update_item_sync(collection_id, item_id, item)
        return True
    except Exception:
        logger.exception("Item 썸네일 업데이트 실패 (pgSTAC): %s", item_id)
        return False
