"""
SAMS API — Spatial Asset Management System

커스텀 비즈니스 로직을 처리하는 API.
STAC 표준 엔드포인트는 stac-fastapi (port 8080)가 별도 처리.

구현 순서:
1. /api/upload/analyze ⭐ (자동 채움 파이프라인 — 최우선)
2. /api/upload/validate
3. /api/upload/register
4. /api/collections (SAMS 확장)
5. /api/items (관계 관리, Draft 전환)
6. /api/search (자동완성, 패싯)
7. /api/files (S3 Presigned URL 리다이렉트)

참조: docs/system_architecture.md 섹션 3
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="SAMS API",
    description="Spatial Asset Management System — Custom API",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Phase 1: 사내 전용이므로 전체 허용
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 개발용 테스트 라우터 (운영 배포 시 제거)
from sams.routers.test import router as test_router
app.include_router(test_router, prefix="/api", tags=["test"])

# TODO: 라우터 등록
# from sams.routers import upload, collections, items, search, files
# app.include_router(upload.router, prefix="/api/upload", tags=["upload"])
# app.include_router(collections.router, prefix="/api/collections", tags=["collections"])
# app.include_router(items.router, prefix="/api/items", tags=["items"])
# app.include_router(search.router, prefix="/api/search", tags=["search"])
# app.include_router(files.router, prefix="/api/files", tags=["files"])


@app.get("/health")
def health():
    return {"status": "ok", "service": "sams-api"}
