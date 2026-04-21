"""
Collection 관리 엔드포인트.

SAMS 확장 필드(expected_deliverables, default_epsg 등)를 포함한 Collection CRUD.
내부적으로 stac-fastapi에 STAC Collection을 생성/수정한다.

참조: docs/system_architecture.md 섹션 3.2 (Collection 관리)
"""

import logging
from collections import Counter
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from sams.services import stac

logger = logging.getLogger(__name__)
router = APIRouter()


# ─────────────────────────────────────────────────────────────────────────
# 모델
# ─────────────────────────────────────────────────────────────────────────

class ExpectedDeliverable(BaseModel):
    category: str
    count: int
    description: str = ""


class CollectionCreate(BaseModel):
    """Collection 생성 요청."""
    id: str
    title: str
    description: str = ""
    project_client: str = Field("", alias="project:client")
    project_site: str = Field("", alias="project:site")
    project_period_start: str | None = Field(None, alias="project:period_start")
    project_period_end: str | None = Field(None, alias="project:period_end")
    project_manager: str = Field("", alias="project:manager")
    project_default_epsg: int | None = Field(None, alias="project:default_epsg")
    expected_deliverables: list[ExpectedDeliverable] = Field(default_factory=list)
    license: str = "proprietary"

    model_config = {"populate_by_name": True}


class CollectionUpdate(BaseModel):
    """Collection 수정 요청."""
    title: str | None = None
    description: str | None = None
    project_client: str | None = Field(None, alias="project:client")
    project_site: str | None = Field(None, alias="project:site")
    project_period_start: str | None = Field(None, alias="project:period_start")
    project_period_end: str | None = Field(None, alias="project:period_end")
    project_manager: str | None = Field(None, alias="project:manager")
    project_default_epsg: int | None = Field(None, alias="project:default_epsg")
    expected_deliverables: list[ExpectedDeliverable] | None = None
    license: str | None = None
    status: str | None = None

    model_config = {"populate_by_name": True}


# ─────────────────────────────────────────────────────────────────────────
# POST /api/collections — 생성
# ─────────────────────────────────────────────────────────────────────────

@router.post("")
async def create_collection(req: CollectionCreate):
    """SAMS 확장 필드를 포함한 Collection을 생성한다."""
    now = datetime.now(timezone.utc).isoformat()

    stac_collection = {
        "type": "Collection",
        "stac_version": "1.0.0",
        "id": req.id,
        "title": req.title,
        "description": req.description or req.title,
        "license": req.license,
        "extent": {
            "spatial": {"bbox": [[-180, -90, 180, 90]]},
            "temporal": {"interval": [[req.project_period_start, req.project_period_end]]},
        },
        "links": [],
        "summaries": {
            "project:client": req.project_client,
            "project:site": req.project_site,
            "project:period_start": req.project_period_start,
            "project:period_end": req.project_period_end,
            "project:manager": req.project_manager,
            "project:default_epsg": req.project_default_epsg,
            "expected_deliverables": [d.model_dump() for d in req.expected_deliverables],
            "sams:status": "active",
            "created": now,
            "updated": now,
        },
    }

    try:
        import json
        import psycopg2
        from sams.config import settings
        conn = psycopg2.connect(settings.DATABASE_URL)
        try:
            cur = conn.cursor()
            cur.execute(
                "SELECT pgstac.create_collection(%s::jsonb)",
                (json.dumps(stac_collection),),
            )
            conn.commit()
        finally:
            conn.close()
        return stac_collection
    except Exception as e:
        logger.exception("Collection 생성 실패: %s", req.id)
        raise HTTPException(status_code=500, detail=f"생성 실패: {e}")


# ─────────────────────────────────────────────────────────────────────────
# GET /api/collections — 목록
# ─────────────────────────────────────────────────────────────────────────

@router.get("")
async def list_collections():
    """Collection 목록을 조회한다."""
    try:
        collections = await stac.list_collections()
        return {"collections": collections, "total": len(collections)}
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────────────────────
# GET /api/collections/{id} — 상세
# ─────────────────────────────────────────────────────────────────────────

@router.get("/{collection_id}")
async def get_collection(collection_id: str):
    """Collection 상세 정보를 조회한다."""
    col = await stac.get_collection(collection_id)
    if col is None:
        raise HTTPException(status_code=404, detail=f"Collection '{collection_id}'을(를) 찾을 수 없습니다.")
    return col


# ─────────────────────────────────────────────────────────────────────────
# PUT /api/collections/{id} — 수정
# ─────────────────────────────────────────────────────────────────────────

@router.put("/{collection_id}")
async def update_collection(collection_id: str, req: CollectionUpdate):
    """Collection을 수정한다."""
    existing = await stac.get_collection(collection_id)
    if existing is None:
        raise HTTPException(status_code=404, detail=f"Collection '{collection_id}'을(를) 찾을 수 없습니다.")

    now = datetime.now(timezone.utc).isoformat()
    summaries = existing.get("summaries", {})

    # 변경된 필드만 업데이트
    if req.title is not None:
        existing["title"] = req.title
    if req.description is not None:
        existing["description"] = req.description
    if req.license is not None:
        existing["license"] = req.license

    field_map = {
        "project_client": "project:client",
        "project_site": "project:site",
        "project_period_start": "project:period_start",
        "project_period_end": "project:period_end",
        "project_manager": "project:manager",
        "project_default_epsg": "project:default_epsg",
        "status": "sams:status",
    }
    for py_field, stac_field in field_map.items():
        val = getattr(req, py_field, None)
        if val is not None:
            summaries[stac_field] = val

    if req.expected_deliverables is not None:
        summaries["expected_deliverables"] = [d.model_dump() for d in req.expected_deliverables]

    summaries["updated"] = now
    existing["summaries"] = summaries

    try:
        import json
        import psycopg2
        from sams.config import settings
        conn = psycopg2.connect(settings.DATABASE_URL)
        try:
            cur = conn.cursor()
            cur.execute("SELECT pgstac.update_collection(%s::jsonb)", (json.dumps(existing),))
            conn.commit()
        finally:
            conn.close()
        return existing
    except Exception as e:
        logger.exception("Collection 수정 실패 (pgSTAC): %s", collection_id)
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────────────────────
# GET /api/collections/{id}/dashboard — 대시보드
# ─────────────────────────────────────────────────────────────────────────

@router.get("/{collection_id}/dashboard")
async def collection_dashboard(collection_id: str):
    """예상 vs 실제 등록 현황 대시보드."""
    col = await stac.get_collection(collection_id)
    if col is None:
        raise HTTPException(status_code=404, detail=f"Collection '{collection_id}'을(를) 찾을 수 없습니다.")

    items = await stac.get_collection_items(collection_id)

    # 유형별 실제 등록 건수
    actual_counts: Counter[str] = Counter()
    draft_items = []
    for item in items:
        props = item.get("properties", {})
        cat = props.get("data_category", "unknown")
        actual_counts[cat] += 1
        if props.get("sams:status") == "draft":
            draft_items.append({
                "id": item.get("id"),
                "data_category": cat,
                "description": props.get("description", ""),
            })

    # 예상 vs 실제
    summaries = col.get("summaries", {})
    expected = summaries.get("expected_deliverables", [])
    comparison = []
    for exp in expected:
        cat = exp.get("category", "")
        comparison.append({
            "category": cat,
            "expected": exp.get("count", 0),
            "actual": actual_counts.get(cat, 0),
            "description": exp.get("description", ""),
        })

    return {
        "collection_id": collection_id,
        "total_items": len(items),
        "type_counts": dict(actual_counts),
        "expected_vs_actual": comparison,
        "draft_count": len(draft_items),
        "draft_items": draft_items[:20],
    }


# ─────────────────────────────────────────────────────────────────────────
# GET /api/collections/{id}/spatial-summary — 공간 현황
# ─────────────────────────────────────────────────────────────────────────

@router.get("/{collection_id}/spatial-summary")
async def collection_spatial_summary(collection_id: str):
    """유형별 bbox 목록을 반환한다."""
    col = await stac.get_collection(collection_id)
    if col is None:
        raise HTTPException(status_code=404, detail=f"Collection '{collection_id}'을(를) 찾을 수 없습니다.")

    items = await stac.get_collection_items(collection_id)

    by_category: dict[str, list[dict]] = {}
    for item in items:
        props = item.get("properties", {})
        cat = props.get("data_category", "unknown")
        bbox = item.get("bbox")
        if bbox:
            by_category.setdefault(cat, []).append({
                "item_id": item.get("id"),
                "bbox": bbox,
                "description": props.get("description", ""),
            })

    return {
        "collection_id": collection_id,
        "categories": by_category,
    }


# ─────────────────────────────────────────────────────────────────────────
# DELETE /api/collections/{id} — Collection 삭제 (하위 Item 포함)
# ─────────────────────────────────────────────────────────────────────────

@router.delete("/{collection_id}")
async def delete_collection(collection_id: str):
    """Collection과 하위 Item을 모두 삭제한다."""
    import psycopg2
    from sams.config import settings
    from sams.services.s3 import get_s3_client

    col = await stac.get_collection(collection_id)
    if col is None:
        raise HTTPException(status_code=404, detail=f"Collection '{collection_id}'을(를) 찾을 수 없습니다.")

    # 1. 하위 Item 삭제 (파티션 테이블 직접)
    items = await stac.get_collection_items(collection_id)
    conn = psycopg2.connect(settings.DATABASE_URL)
    try:
        cur = conn.cursor()
        # 파티션 테이블 목록
        cur.execute("""
            SELECT inhrelid::regclass::text
            FROM pg_inherits
            WHERE inhparent = 'pgstac.items'::regclass
        """)
        partitions = [row[0] for row in cur.fetchall()]
        # 트리거 전체 비활성화 (partition_sys_meta/partition_stats 미존재 대응)
        cur.execute("ALTER TABLE pgstac.items DISABLE TRIGGER ALL")
        cur.execute("ALTER TABLE pgstac.collections DISABLE TRIGGER ALL")

        for part in partitions:
            cur.execute(f"DELETE FROM {part} WHERE collection = %s", (collection_id,))

        # 2. Collection 삭제
        cur.execute("DELETE FROM pgstac.collections WHERE id = %s", (collection_id,))

        # 트리거 복원
        cur.execute("ALTER TABLE pgstac.items ENABLE TRIGGER ALL")
        cur.execute("ALTER TABLE pgstac.collections ENABLE TRIGGER ALL")
        conn.commit()
    except Exception as e:
        conn.rollback()
        logger.exception("Collection 삭제 실패: %s", collection_id)
        raise HTTPException(status_code=500, detail=f"삭제 실패: {e}")
    finally:
        conn.close()

    # 3. S3 파일 정리 (best-effort)
    try:
        s3 = get_s3_client()
        prefix = f"{collection_id}/"
        resp = s3.list_objects_v2(Bucket=settings.S3_BUCKET, Prefix=prefix)
        objects = resp.get("Contents", [])
        if objects:
            s3.delete_objects(
                Bucket=settings.S3_BUCKET,
                Delete={"Objects": [{"Key": o["Key"]} for o in objects]},
            )
            logger.info("S3 파일 %d개 삭제: %s", len(objects), collection_id)
    except Exception:
        logger.warning("S3 정리 실패 (Collection은 이미 삭제됨): %s", collection_id)

    logger.info("Collection 삭제 완료: %s (Item %d개)", collection_id, len(items))
    return {"deleted": True, "collection_id": collection_id, "items_deleted": len(items)}
