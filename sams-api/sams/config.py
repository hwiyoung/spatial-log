"""SAMS API 설정. 환경변수에서 로드."""

import os

def _bytes_env(name: str, default: int) -> int:
    raw = os.getenv(name)
    if not raw:
        return default
    raw = raw.strip().upper()
    units = {
        "KB": 1000,
        "MB": 1000 ** 2,
        "GB": 1000 ** 3,
        "TB": 1000 ** 4,
        "KIB": 1024,
        "MIB": 1024 ** 2,
        "GIB": 1024 ** 3,
        "TIB": 1024 ** 4,
    }
    for unit, factor in sorted(units.items(), key=lambda item: len(item[0]), reverse=True):
        if raw.endswith(unit):
            return int(float(raw[:-len(unit)].strip()) * factor)
    return int(raw)

class Settings:
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://sams:sams_dev_2024@localhost:5432/samsdb")
    STAC_API_URL: str = os.getenv("STAC_API_URL", "http://localhost:8080")
    S3_ENDPOINT: str = os.getenv("S3_ENDPOINT", "http://localhost:9000")
    S3_ACCESS_KEY: str = os.getenv("S3_ACCESS_KEY", "minioadmin")
    S3_SECRET_KEY: str = os.getenv("S3_SECRET_KEY", "minioadmin")
    S3_BUCKET: str = os.getenv("S3_BUCKET", "sams-archive")
    # 브라우저 직접 업로드용 presign endpoint — 컨테이너 내부 주소(S3_ENDPOINT)는
    # 브라우저가 접근할 수 없으므로 호스트 노출 주소를 따로 받는다. 미설정 시 S3_ENDPOINT.
    S3_PUBLIC_ENDPOINT: str = os.getenv("S3_PUBLIC_ENDPOINT", "")
    # 이 크기 이상이면 썸네일을 Celery 비동기로 생성 (등록 응답 지연 방지)
    THUMB_ASYNC_THRESHOLD_MB: int = int(os.getenv("THUMB_ASYNC_THRESHOLD_MB", "50"))
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    CELERY_BROKER_URL: str = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/1")
    UPLOAD_TMP_DIR: str = os.getenv("UPLOAD_TMP_DIR", "/tmp/uploads")
    MAX_UPLOAD_BYTES: int = _bytes_env("MAX_UPLOAD_BYTES", 1 * 1024 ** 4)          # 1 TiB
    WARN_UPLOAD_BYTES: int = _bytes_env("WARN_UPLOAD_BYTES", 500 * 1024 ** 3)     # 500 GiB
    UPLOAD_STALE_MULTIPART_SECONDS: int = int(os.getenv("UPLOAD_STALE_MULTIPART_SECONDS", str(24 * 60 * 60)))
    UPLOAD_ANALYSIS_STALE_SECONDS: int = int(os.getenv("UPLOAD_ANALYSIS_STALE_SECONDS", str(15 * 60)))
    UPLOAD_CLEANUP_INTERVAL_SECONDS: int = int(os.getenv("UPLOAD_CLEANUP_INTERVAL_SECONDS", str(60 * 60)))

settings = Settings()
