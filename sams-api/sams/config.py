"""SAMS API 설정. 환경변수에서 로드."""

import os

class Settings:
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://sams:sams_dev_2024@localhost:5432/samsdb")
    STAC_API_URL: str = os.getenv("STAC_API_URL", "http://localhost:8080")
    S3_ENDPOINT: str = os.getenv("S3_ENDPOINT", "http://localhost:9000")
    S3_ACCESS_KEY: str = os.getenv("S3_ACCESS_KEY", "minioadmin")
    S3_SECRET_KEY: str = os.getenv("S3_SECRET_KEY", "minioadmin")
    S3_BUCKET: str = os.getenv("S3_BUCKET", "sams-archive")
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    CELERY_BROKER_URL: str = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/1")
    UPLOAD_TMP_DIR: str = os.getenv("UPLOAD_TMP_DIR", "/tmp/uploads")

settings = Settings()
