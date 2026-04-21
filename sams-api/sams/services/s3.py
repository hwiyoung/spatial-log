"""
S3 (MinIO) 파일 스토리지 서비스.

경로 규칙: s3://sams-archive/{collection_id}/{data_category}/{item_id}/{filename}

참조: docs/system_architecture.md 섹션 4
"""

import logging
import os
from pathlib import Path

import boto3
from botocore.exceptions import ClientError

from sams.config import settings

logger = logging.getLogger(__name__)


def get_s3_client():
    """S3 클라이언트를 생성한다."""
    return boto3.client(
        "s3",
        endpoint_url=settings.S3_ENDPOINT,
        aws_access_key_id=settings.S3_ACCESS_KEY,
        aws_secret_access_key=settings.S3_SECRET_KEY,
    )


def build_s3_key(
    collection_id: str,
    data_category: str,
    item_id: str,
    filename: str,
) -> str:
    """S3 경로를 생성한다.

    Returns:
        예: "bulguksa-2024/pointcloud/bg-dabotap-pc-20240312/dabotap_scan.laz"
    """
    return f"{collection_id}/{data_category}/{item_id}/{filename}"


def upload_file(
    local_path: str,
    collection_id: str,
    data_category: str,
    item_id: str,
    filename: str | None = None,
) -> str:
    """파일을 S3에 업로드한다.

    Args:
        local_path: 로컬 파일 경로.
        collection_id: Collection ID.
        data_category: 데이터 유형.
        item_id: Item ID.
        filename: S3에 저장할 파일명. None이면 원본 파일명 사용.

    Returns:
        S3 key (경로).
    """
    if filename is None:
        filename = Path(local_path).name

    key = build_s3_key(collection_id, data_category, item_id, filename)
    client = get_s3_client()

    try:
        client.upload_file(local_path, settings.S3_BUCKET, key)
        logger.info("S3 업로드 완료: %s", key)
        return key
    except ClientError:
        logger.exception("S3 업로드 실패: %s → %s", local_path, key)
        raise


def generate_presigned_url(
    collection_id: str,
    data_category: str,
    item_id: str,
    filename: str,
    expires_in: int = 3600,
) -> str:
    """대용량 파일 직접 업로드용 Presigned URL을 생성한다.

    Returns:
        PUT용 Presigned URL.
    """
    key = build_s3_key(collection_id, data_category, item_id, filename)
    client = get_s3_client()

    url = client.generate_presigned_url(
        "put_object",
        Params={"Bucket": settings.S3_BUCKET, "Key": key},
        ExpiresIn=expires_in,
    )
    return url


def build_asset_href(
    collection_id: str,
    data_category: str,
    item_id: str,
    filename: str,
) -> str:
    """STAC Item의 Asset href를 생성한다.

    S3 직접 경로가 아닌 API 경유 URL.

    Returns:
        예: "/api/files/bulguksa-2024/pointcloud/bg-dabotap-pc/dabotap_scan.laz"
    """
    return f"/api/files/{collection_id}/{data_category}/{item_id}/{filename}"
