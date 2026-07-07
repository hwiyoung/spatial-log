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


def get_public_s3_client():
    """브라우저용 presign 전용 클라이언트 — 서명에 호스트가 포함되므로 공개 endpoint 로 만든다."""
    import boto3
    from botocore.config import Config
    endpoint = settings.S3_PUBLIC_ENDPOINT or settings.S3_ENDPOINT
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=settings.S3_ACCESS_KEY,
        aws_secret_access_key=settings.S3_SECRET_KEY,
        config=Config(signature_version="s3v4"),
        region_name="us-east-1",
    )


def generate_put_url(key: str, expires: int = 3600) -> str:
    """대용량 직접 업로드용 presigned PUT URL (브라우저 → MinIO)."""
    return get_public_s3_client().generate_presigned_url(
        "put_object",
        Params={"Bucket": settings.S3_BUCKET, "Key": key},
        ExpiresIn=expires,
    )


def initiate_multipart_upload(key: str, content_type: str | None = None) -> str:
    """대용량 multipart upload를 시작하고 upload_id를 반환한다."""
    params = {"Bucket": settings.S3_BUCKET, "Key": key}
    if content_type:
        params["ContentType"] = content_type
    resp = get_s3_client().create_multipart_upload(**params)
    return resp["UploadId"]


def generate_upload_part_url(key: str, upload_id: str, part_number: int, expires: int = 3600) -> str:
    """multipart part 업로드용 presigned URL (브라우저 → MinIO)."""
    return get_public_s3_client().generate_presigned_url(
        "upload_part",
        Params={
            "Bucket": settings.S3_BUCKET,
            "Key": key,
            "UploadId": upload_id,
            "PartNumber": part_number,
        },
        ExpiresIn=expires,
    )


def complete_multipart_upload(key: str, upload_id: str, parts: list[dict]) -> None:
    """업로드된 multipart part들을 하나의 객체로 확정한다."""
    get_s3_client().complete_multipart_upload(
        Bucket=settings.S3_BUCKET,
        Key=key,
        UploadId=upload_id,
        MultipartUpload={"Parts": parts},
    )


def abort_multipart_upload(key: str, upload_id: str) -> None:
    """진행 중인 multipart upload를 중단하고 업로드된 part를 정리한다."""
    try:
        get_s3_client().abort_multipart_upload(
            Bucket=settings.S3_BUCKET,
            Key=key,
            UploadId=upload_id,
        )
    except Exception:
        logger.warning("multipart upload 중단 실패 (무시): %s", key)


def object_size(key: str) -> int | None:
    """객체가 존재하면 크기(byte), 없으면 None."""
    try:
        head = get_s3_client().head_object(Bucket=settings.S3_BUCKET, Key=key)
        return head["ContentLength"]
    except Exception:
        return None


def download_object(key: str, local_path: str) -> None:
    get_s3_client().download_file(settings.S3_BUCKET, key, local_path)


def copy_object(src_key: str, dst_key: str) -> str:
    """버킷 내 서버측 복사 — 대용량 staging→최종 경로 이동에 사용 (재업로드 없음)."""
    get_s3_client().copy_object(
        Bucket=settings.S3_BUCKET,
        CopySource={"Bucket": settings.S3_BUCKET, "Key": src_key},
        Key=dst_key,
    )
    return dst_key


def delete_prefix(prefix: str) -> int:
    """prefix 하위 객체 일괄 삭제 (staging 정리용). 삭제한 개수 반환."""
    client = get_s3_client()
    deleted = 0
    try:
        paginator = client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=settings.S3_BUCKET, Prefix=prefix):
            keys = [{"Key": o["Key"]} for o in page.get("Contents", [])]
            if keys:
                client.delete_objects(Bucket=settings.S3_BUCKET, Delete={"Objects": keys})
                deleted += len(keys)
    except Exception:
        logger.warning("S3 prefix 정리 실패 (무시): %s", prefix)
    return deleted


def delete_object(key: str) -> None:
    try:
        get_s3_client().delete_object(Bucket=settings.S3_BUCKET, Key=key)
    except Exception:
        logger.warning("S3 객체 삭제 실패 (무시): %s", key)


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
