"""
Celery Worker — 비동기 작업 처리

작업 목록:
- generate_thumbnail: 썸네일 생성 후 STAC Item의 thumbnail Asset 업데이트

참조: docs/autofill_pipeline_spec.md 섹션 7
"""

from celery import Celery
from sams.config import settings

app = Celery("sams", broker=settings.CELERY_BROKER_URL)

# TODO: 태스크 등록
# @app.task
# def generate_thumbnail(item_id: str, file_path: str, data_category: str):
#     """썸네일을 생성하고 S3에 업로드한 뒤 STAC Item의 thumbnail Asset을 업데이트한다."""
#     pass
