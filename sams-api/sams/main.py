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

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="SAMS API",
    description="Spatial Asset Management System — Custom API",
    version="0.1.0",
)

# CORS — 운영에서는 SAMS_CORS_ORIGINS(쉼표 구분)로 허용 도메인을 명시한다.
# 미설정 시 로컬 개발(localhost 임의 포트)만 허용. 와일드카드(*)+credentials 조합은 브라우저가 거부하므로 금지.
_cors_origins = os.getenv("SAMS_CORS_ORIGINS", "").strip()
if _cors_origins:
    _cors_kwargs = {"allow_origins": [o.strip() for o in _cors_origins.split(",") if o.strip()]}
else:
    _cors_kwargs = {"allow_origin_regex": r"https?://(localhost|127\.0\.0\.1)(:\d+)?"}

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    **_cors_kwargs,
)

# 개발용 테스트 라우터 — 기본 비활성(인증 없이 임의 업로드가 가능하므로 외부/운영 노출 금지).
# 내부 개발에서만 SAMS_ENABLE_TEST_ROUTER=1 로 활성화한다.
if os.getenv("SAMS_ENABLE_TEST_ROUTER", "").lower() in ("1", "true", "yes"):
    from sams.routers.test import router as test_router
    app.include_router(test_router, prefix="/api", tags=["test"])

# 라우터 등록
from sams.routers.upload import router as upload_router
app.include_router(upload_router, prefix="/api/upload", tags=["upload"])

from sams.routers.collections import router as collections_router
app.include_router(collections_router, prefix="/api/collections", tags=["collections"])

from sams.routers.items import router as items_router
app.include_router(items_router, prefix="/api/items", tags=["items"])

from sams.routers.files import router as files_router
app.include_router(files_router, prefix="/api/files", tags=["files"])

from sams.routers.ontology import router as ontology_router
app.include_router(ontology_router, prefix="/api/ontology", tags=["ontology"])


@app.on_event("startup")
def init_history_table():
    """Item 이력 테이블 멱등 생성. DB 미가용 시 앱 기동은 막지 않는다 (이력은 부가 기능)."""
    import logging
    from sams.services.history import ensure_history_table
    try:
        ensure_history_table()
    except Exception:
        logging.getLogger(__name__).warning("이력 테이블 초기화 실패 — 이력 기록이 비활성화될 수 있습니다.", exc_info=True)


@app.get("/health")
def health():
    return {"status": "ok", "service": "sams-api"}
