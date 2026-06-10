"""
Item 관리 엔드포인트.

Draft→Published 전환, 관계(links) 관리, 타임라인 조회.
양방향 링크 자동 생성/삭제가 핵심.

참조: docs/system_architecture.md 섹션 3.2 (Item 관리)
"""

import json
import logging
from datetime import datetime, timezone
from typing import Any

import psycopg2
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from sams.config import settings
from sams.services import history, stac

logger = logging.getLogger(__name__)
router = APIRouter()


_SYSTEM_RELS = {"collection", "parent", "root", "self", "items", "next", "prev", "license"}
# 사용자 관계 링크(양방향 포함). get_related(나열)와 delete_link(인덱스)가 동일한 링크 집합을 같은
# 순서로 열거하도록 두 곳에서 이 INCLUDE 목록을 공유한다 — 인덱스 공간 불일치로 인한 오삭제 방지.
_USER_RELS = {"derived_from", "has_derived", "related", "describedby", "describes", "prev", "next"}

def _strip_system_links(item: dict) -> dict:
    """stac-api가 자동으로 붙이는 시스템 링크를 제거한다. 사용자 링크만 유지."""
    _stac_system_rels = {"collection", "parent", "root", "self", "items", "license"}
    links = item.get("links", [])
    item["links"] = [l for l in links if l.get("rel") not in _stac_system_rels]
    return item


async def _pgstac_update_item(collection_id: str, item_id: str, item: dict) -> None:
    """pgSTAC에 직접 Item을 갱신한다 (삭제 후 재삽입).

    stac-fastapi의 Transaction 확장이 비활성화되어 PUT이 405이므로,
    pgSTAC SQL 함수를 직접 호출한다.
    저장 전 stac-api가 붙인 시스템 링크를 정리하여 중복을 방지한다.
    """
    _strip_system_links(item)

    conn = psycopg2.connect(settings.DATABASE_URL)
    try:
        cur = conn.cursor()
        cur.execute("ALTER TABLE pgstac.items DISABLE TRIGGER ALL")
        cur.execute("""
            SELECT inhrelid::regclass::text
            FROM pg_inherits WHERE inhparent = 'pgstac.items'::regclass
        """)
        for (part,) in cur.fetchall():
            cur.execute(f"DELETE FROM {part} WHERE id = %s AND collection = %s", (item_id, collection_id))
            if cur.rowcount > 0:
                break
        cur.execute("ALTER TABLE pgstac.items ENABLE TRIGGER ALL")
        conn.commit()

        cur.execute("SELECT pgstac.create_item(%s::jsonb)", (json.dumps(item),))
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise RuntimeError(f"Item 갱신 실패 (pgSTAC): {e}") from e
    finally:
        conn.close()


# ─────────────────────────────────────────────────────────────────────────
# PUT /api/items/{collection_id}/{item_id}/status — Draft→Published
# ─────────────────────────────────────────────────────────────────────────

class StatusUpdate(BaseModel):
    status: str  # "draft" 또는 "published"


@router.put("/{collection_id}/{item_id}/status")
async def update_item_status(collection_id: str, item_id: str, req: StatusUpdate):
    """Item의 상태를 변경한다. Published 전환 시 필수 필드를 검증한다."""
    item = await stac.get_item(collection_id, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail=f"Item '{item_id}'을(를) 찾을 수 없습니다.")

    props = item.get("properties", {})

    # Published 전환 시 필수 필드 검증
    if req.status == "published":
        missing = _check_required_for_publish(props)
        if missing:
            raise HTTPException(
                status_code=400,
                detail=f"Published 전환 불가: 필수 필드 누락 — {', '.join(missing)}",
            )

    old_status = props.get("sams:status")
    props["sams:status"] = req.status
    props["updated"] = datetime.now(timezone.utc).isoformat()
    item["properties"] = props

    try:
        await _pgstac_update_item(collection_id, item_id, item)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    if req.status != old_status:
        history.record_event(collection_id, item_id, "status", f"상태 전환 → {req.status}", {"status": req.status})
    return {"status": req.status, "item_id": item_id}


def _check_required_for_publish(props: dict) -> list[str]:
    """Published 전환 시 필수 필드 누락 확인."""
    required = ["datetime", "description", "data_category", "project:name", "project:site", "proj:epsg"]
    missing = []
    for field in required:
        val = props.get(field)
        if val is None or (isinstance(val, str) and val.strip() == ""):
            # datetime이 null이면 start/end 확인
            if field == "datetime" and props.get("start_datetime") and props.get("end_datetime"):
                continue
            missing.append(field)
    return missing


# ─────────────────────────────────────────────────────────────────────────
# GET /api/items/{collection_id}/{item_id}/related — 관련 Item
# ─────────────────────────────────────────────────────────────────────────

@router.get("/{collection_id}/{item_id}/related")
async def get_related_items(collection_id: str, item_id: str):
    """links를 양방향 해석하여 관련 Item 목록을 반환한다. 대상 Item의 description도 포함."""
    item = await stac.get_item(collection_id, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail=f"Item '{item_id}'을(를) 찾을 수 없습니다.")

    links = item.get("links", [])
    related = []
    for link in links:
        rel = link.get("rel", "")
        if rel not in _USER_RELS:
            continue
        href = link.get("href", "")
        target_id = _extract_item_id_from_href(href)
        target_col = collection_id
        if "items/" in href and not href.startswith("./"):
            parts = href.split("/")
            idx = parts.index("items") if "items" in parts else -1
            if idx > 0:
                target_col = parts[idx - 1]

        # 대상 Item 조회하여 description, category, 상태, 존재 여부 가져오기
        description = ""
        data_category = ""
        target_status = "unknown"
        target_found = False
        try:
            target_item = await stac.get_item(target_col, target_id)
            if target_item:
                target_found = True
                tp = target_item.get("properties", {})
                description = tp.get("description", "")
                data_category = tp.get("data_category", "")
                target_status = tp.get("sams:status", "draft")
        except Exception:
            pass

        related.append({
            "rel": rel,
            "target_id": target_id,
            "target_collection_id": target_col,
            "href": href,
            "title": link.get("title", "") or description,
            "description": description,
            "data_category": data_category,
            "status": target_status,
            "missing": not target_found,
        })

    return {"item_id": item_id, "related": related}


# ─────────────────────────────────────────────────────────────────────────
# GET /api/items/{collection_id}/{item_id}/timeline — 시계열
# ─────────────────────────────────────────────────────────────────────────

@router.get("/{collection_id}/{item_id}/timeline")
async def get_item_timeline(collection_id: str, item_id: str):
    """시계열 Item 목록. 두 가지 소스를 합산:
    1) 같은 target + category인 Item (기존)
    2) prev/next 링크로 연결된 Item (링크 체인 순회)
    """
    item = await stac.get_item(collection_id, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail=f"Item '{item_id}'을(를) 찾을 수 없습니다.")

    props = item.get("properties", {})
    target = props.get("target")
    category = props.get("data_category")

    seen_ids: set[str] = set()
    timeline = []

    def _add_to_timeline(it: dict, col_id: str) -> None:
        iid = it.get("id")
        if iid in seen_ids:
            return
        seen_ids.add(iid)
        it_props = it.get("properties", {})
        dt = it_props.get("datetime")
        if not dt and it_props.get("start_datetime"):
            dt = it_props["start_datetime"]
        timeline.append({
            "item_id": iid,
            "collection_id": col_id,
            "datetime": dt,
            "description": it_props.get("description", ""),
            "status": it_props.get("sams:status", "draft"),
            "data_category": it_props.get("data_category", "unknown"),
            "is_current": iid == item_id,
        })

    # 1) 같은 target + category (기존 방식)
    if target and category:
        all_items = await stac.get_collection_items(collection_id)
        for other in all_items:
            other_props = other.get("properties", {})
            if (other_props.get("target") == target and
                    other_props.get("data_category") == category):
                _add_to_timeline(other, collection_id)

    # 2) prev/next 링크 체인 순회
    _add_to_timeline(item, collection_id)
    await _follow_prev_next_chain(item, collection_id, seen_ids, _add_to_timeline)

    # datetime 기준 정렬
    timeline.sort(key=lambda x: x.get("datetime") or "")

    return {"item_id": item_id, "target": target, "category": category, "timeline": timeline}


async def _follow_prev_next_chain(item: dict, collection_id: str, seen_ids: set, add_fn) -> None:
    """prev/next 링크를 양방향으로 따라가며 시계열에 추가한다. 최대 50개까지."""
    max_depth = 50

    for direction in ("prev", "next"):
        current = item
        current_col = collection_id
        for _ in range(max_depth):
            links = current.get("links", [])
            target_link = None
            for l in links:
                if l.get("rel") == direction:
                    target_link = l
                    break
            if not target_link:
                break

            href = target_link.get("href", "")
            target_id = _extract_item_id_from_href(href)
            if not target_id or target_id in seen_ids:
                break

            # href에서 collection 추출
            target_col = current_col
            if "items/" in href and not href.startswith("./"):
                parts = href.split("/")
                items_idx = parts.index("items") if "items" in parts else -1
                if items_idx > 0:
                    target_col = parts[items_idx - 1]

            linked = await stac.get_item(target_col, target_id)
            if not linked:
                break

            add_fn(linked, target_col)
            current = linked
            current_col = target_col


# ─────────────────────────────────────────────────────────────────────────
# GET /api/items/{collection_id}/{item_id}/history — 이력 조회
# ─────────────────────────────────────────────────────────────────────────

@router.get("/{collection_id}/{item_id}/history")
async def get_item_history(collection_id: str, item_id: str):
    """Item 의 이력(등록·상태·메타데이터·위치·이동·관계·preview)을 최신순으로 반환한다."""
    item = await stac.get_item(collection_id, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail=f"Item '{item_id}'을(를) 찾을 수 없습니다.")

    try:
        events = history.list_events(collection_id, item_id)
    except Exception:
        logger.exception("이력 조회 실패: %s/%s", collection_id, item_id)
        events = []

    return {"item_id": item_id, "history": events}


# ─────────────────────────────────────────────────────────────────────────
# POST /api/items/{collection_id}/{item_id}/links — 관계 추가
# ─────────────────────────────────────────────────────────────────────────

# 역방향 관계 매핑
_REVERSE_REL: dict[str, str] = {
    "derived_from": "has_derived",
    "has_derived": "derived_from",
    "related": "related",
    "describedby": "describes",
    "describes": "describedby",
    "prev": "next",
    "next": "prev",
}


class LinkCreate(BaseModel):
    rel: str  # derived_from, related, describedby, prev, next
    target_collection_id: str
    target_item_id: str
    title: str = ""


@router.post("/{collection_id}/{item_id}/links")
async def add_link(collection_id: str, item_id: str, req: LinkCreate):
    """관계를 추가한다. 양방향 자동 생성."""
    # 소스 Item 조회
    source_item = await stac.get_item(collection_id, item_id)
    if source_item is None:
        raise HTTPException(status_code=404, detail=f"Item '{item_id}'을(를) 찾을 수 없습니다.")

    # 타겟 Item 조회
    target_item = await stac.get_item(req.target_collection_id, req.target_item_id)
    if target_item is None:
        raise HTTPException(status_code=404, detail=f"Target Item '{req.target_item_id}'을(를) 찾을 수 없습니다.")

    # 소스 → 타겟 링크 추가
    source_href = (
        f"../../{req.target_collection_id}/items/{req.target_item_id}"
        if req.target_collection_id != collection_id
        else f"./{req.target_item_id}"
    )
    source_link = {"rel": req.rel, "href": source_href, "type": "application/geo+json"}
    if req.title:
        source_link["title"] = req.title

    source_links = source_item.get("links", [])
    source_links.append(source_link)
    source_item["links"] = source_links

    # 타겟 → 소스 역방향 링크 추가
    reverse_rel = _REVERSE_REL.get(req.rel)
    if reverse_rel:
        target_href = (
            f"../../{collection_id}/items/{item_id}"
            if req.target_collection_id != collection_id
            else f"./{item_id}"
        )
        target_link = {"rel": reverse_rel, "href": target_href, "type": "application/geo+json"}
        target_links = target_item.get("links", [])
        target_links.append(target_link)
        target_item["links"] = target_links
        await _pgstac_update_item(req.target_collection_id, req.target_item_id, target_item)

    await _pgstac_update_item(collection_id, item_id, source_item)

    history.record_event(
        collection_id, item_id, "relation",
        f"관계 추가: {req.rel} → {req.target_item_id}",
        {"rel": req.rel, "target": req.target_item_id, "target_collection": req.target_collection_id},
    )
    if reverse_rel:
        history.record_event(
            req.target_collection_id, req.target_item_id, "relation",
            f"관계 추가(역방향): {reverse_rel} → {item_id}",
            {"rel": reverse_rel, "target": item_id, "target_collection": collection_id},
        )

    return {"created": True, "rel": req.rel, "reverse_rel": reverse_rel}


# ─────────────────────────────────────────────────────────────────────────
# DELETE /api/items/{collection_id}/{item_id}/links/{link_index}
# ─────────────────────────────────────────────────────────────────────────

@router.delete("/{collection_id}/{item_id}/links/{link_index}")
async def delete_link(collection_id: str, item_id: str, link_index: int):
    """관계를 삭제한다. 양방향 자동 삭제.
    link_index는 사용자 링크(시스템 링크 제외) 기준 인덱스."""
    item = await stac.get_item(collection_id, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail=f"Item '{item_id}'을(를) 찾을 수 없습니다.")

    links = item.get("links", [])

    # 사용자 링크만 추출하여 인덱스 매핑 — get_related 와 동일한 INCLUDE 목록(_USER_RELS)을 써서
    # 프론트가 related[] 순번으로 보낸 link_index 가 정확히 같은 링크를 가리키게 한다.
    user_links = [(i, l) for i, l in enumerate(links) if l.get("rel") in _USER_RELS]
    if link_index < 0 or link_index >= len(user_links):
        raise HTTPException(status_code=400, detail=f"유효하지 않은 link_index: {link_index}")

    actual_index, removed_link = user_links[link_index]
    links.pop(actual_index)
    item["links"] = links

    # 역방향 링크 삭제 — 대상 collection 은 href 에서 파생 (cross-collection 링크 지원)
    removed_rel = removed_link.get("rel", "")
    removed_href = removed_link.get("href", "")
    removed_target = _extract_item_id_from_href(removed_href)
    target_col = _extract_collection_from_href(removed_href, collection_id)
    reverse_rel = _REVERSE_REL.get(removed_rel)
    reverse_removed = False
    if reverse_rel and removed_target:
        reverse_removed = await _remove_reverse_link(target_col, removed_target, item_id, reverse_rel)

    await _pgstac_update_item(collection_id, item_id, item)

    history.record_event(
        collection_id, item_id, "relation",
        f"관계 삭제: {removed_rel} → {removed_target}",
        {"rel": removed_rel, "target": removed_target},
    )
    # 역방향 이벤트는 역방향 링크가 실제로 정리된 경우에만 — 일어나지 않은 일을 기록하지 않는다
    if reverse_removed:
        history.record_event(
            target_col, removed_target, "relation",
            f"관계 삭제(역방향): {reverse_rel} → {item_id}",
            {"rel": reverse_rel, "target": item_id, "target_collection": collection_id},
        )

    return {"deleted": True, "removed_link": removed_link}


async def _remove_reverse_link(
    collection_id: str,
    target_item_id: str,
    source_item_id: str,
    reverse_rel: str,
) -> bool:
    """타겟 Item에서 소스를 가리키는 역방향 링크를 삭제한다. 실제로 갱신했을 때만 True."""
    try:
        target = await stac.get_item(collection_id, target_item_id)
        if target is None:
            return False
        links = target.get("links", [])
        target["links"] = [
            l for l in links
            if not (l.get("rel") == reverse_rel and source_item_id in l.get("href", ""))
        ]
        await _pgstac_update_item(collection_id, target_item_id, target)
        return True
    except Exception:
        logger.exception("역방향 링크 삭제 실패: %s → %s", target_item_id, source_item_id)
        return False


def _extract_item_id_from_href(href: str) -> str:
    """STAC link href에서 Item ID를 추출한다."""
    # 형식: "./item-id" 또는 "../../collection/items/item-id"
    parts = href.rstrip("/").split("/")
    return parts[-1] if parts else ""


def _extract_collection_from_href(href: str, fallback_collection: str) -> str:
    """STAC link href에서 대상 collection 을 추출한다. 같은 collection("./id")이면 fallback."""
    if "items/" in href and not href.startswith("./"):
        parts = href.split("/")
        idx = parts.index("items") if "items" in parts else -1
        if idx > 0:
            return parts[idx - 1]
    return fallback_collection


# ─────────────────────────────────────────────────────────────────────────
# PUT /api/items/{collection_id}/{item_id}/properties — 메타데이터 편집
# ─────────────────────────────────────────────────────────────────────────

@router.put("/{collection_id}/{item_id}/properties")
async def update_item_properties(collection_id: str, item_id: str, req: dict[str, Any]):
    """Item의 properties를 부분 업데이트한다."""
    item = await stac.get_item(collection_id, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail=f"Item을 찾을 수 없습니다: {item_id}")

    props = item.get("properties", {})
    old_status = props.get("sams:status")
    for key, value in req.items():
        if value is None or value == "":
            props.pop(key, None)
        else:
            props[key] = value
    props["updated"] = datetime.now(timezone.utc).isoformat()
    item["properties"] = props

    try:
        await _pgstac_update_item(collection_id, item_id, item)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    changed = [k for k in req.keys() if k not in ("updated",)]
    meta_fields = [k for k in changed if k != "sams:status"]
    if meta_fields:
        history.record_event(
            collection_id, item_id, "meta",
            f"메타데이터 수정 — {', '.join(meta_fields[:6])}{' 외' if len(meta_fields) > 6 else ''}",
            {"fields": meta_fields},
        )
    new_status = props.get("sams:status")
    if "sams:status" in changed and new_status != old_status:
        summary = f"상태 전환 → {new_status}" if new_status is not None else "상태 해제"
        history.record_event(collection_id, item_id, "status", summary, {"status": new_status})

    return {"updated": True, "item_id": item_id}


# ─────────────────────────────────────────────────────────────────────────
# PUT /api/items/{collection_id}/{item_id}/location — 위치 수동 지정
# ─────────────────────────────────────────────────────────────────────────

class LocationUpdate(BaseModel):
    longitude: float
    latitude: float


@router.put("/{collection_id}/{item_id}/location")
async def update_item_location(collection_id: str, item_id: str, req: LocationUpdate):
    """Item의 위치(bbox/geometry)를 사용자 지정 좌표로 갱신한다.

    3D 모델 등 자체 좌표가 없는 데이터의 위치를 수동으로 설정할 때 사용.
    좌표 기준 ±0.0001° 크기의 작은 bbox와 Polygon geometry를 생성한다.
    """
    import json
    import psycopg2
    from sams.config import settings

    item = await stac.get_item(collection_id, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail=f"Item을 찾을 수 없습니다: {item_id}")

    lng, lat = req.longitude, req.latitude
    delta = 0.0001
    bbox = [lng - delta, lat - delta, lng + delta, lat + delta]
    geometry = {
        "type": "Polygon",
        "coordinates": [[
            [bbox[0], bbox[1]],
            [bbox[2], bbox[1]],
            [bbox[2], bbox[3]],
            [bbox[0], bbox[3]],
            [bbox[0], bbox[1]],
        ]],
    }

    item["bbox"] = bbox
    item["geometry"] = geometry
    props = item.get("properties", {})
    props["updated"] = datetime.now(timezone.utc).isoformat()
    props["sams:location_source"] = "manual"
    item["properties"] = props

    # pgSTAC는 partition 변경을 위해 update_item 사용
    try:
        conn = psycopg2.connect(settings.DATABASE_URL)
        try:
            cur = conn.cursor()
            cur.execute("ALTER TABLE pgstac.items DISABLE TRIGGER ALL")

            # 기존 항목 삭제
            cur.execute("""
                SELECT inhrelid::regclass::text
                FROM pg_inherits WHERE inhparent = 'pgstac.items'::regclass
            """)
            partitions = [row[0] for row in cur.fetchall()]
            for part in partitions:
                cur.execute(f"DELETE FROM {part} WHERE id = %s AND collection = %s", (item_id, collection_id))
                if cur.rowcount > 0:
                    break

            cur.execute("ALTER TABLE pgstac.items ENABLE TRIGGER ALL")
            conn.commit()

            # 새 항목 삽입
            cur.execute("SELECT pgstac.create_item(%s::jsonb)", (json.dumps(item),))
            conn.commit()
        finally:
            conn.close()
    except Exception as e:
        logger.exception("Item 위치 갱신 실패: %s", item_id)
        raise HTTPException(status_code=500, detail=f"위치 갱신 실패: {e}")

    logger.info("Item 위치 갱신: %s/%s → [%f, %f]", collection_id, item_id, lng, lat)
    history.record_event(
        collection_id, item_id, "location",
        f"위치 수동 지정 ({lng:.4f}, {lat:.4f})",
        {"longitude": lng, "latitude": lat},
    )
    return {"updated": True, "bbox": bbox, "longitude": lng, "latitude": lat}


# ─────────────────────────────────────────────────────────────────────────
# POST /api/items/{collection_id}/{item_id}/move — 프로젝트 간 이동
# ─────────────────────────────────────────────────────────────────────────

class MoveRequest(BaseModel):
    target_collection_id: str


@router.post("/{collection_id}/{item_id}/move")
async def move_item(collection_id: str, item_id: str, req: MoveRequest):
    """Item을 다른 Collection으로 이동한다. DB 레코드 이동 + S3 파일 이동."""
    import json
    import psycopg2
    from sams.config import settings
    from sams.services.s3 import get_s3_client

    if req.target_collection_id == collection_id:
        raise HTTPException(status_code=400, detail="같은 프로젝트로는 이동할 수 없습니다.")

    # 1. Item 조회
    item = await stac.get_item(collection_id, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail=f"Item을 찾을 수 없습니다: {item_id}")

    # 2. 대상 Collection 존재 확인
    target_col = await stac.get_collection(req.target_collection_id)
    if target_col is None:
        raise HTTPException(status_code=404, detail=f"대상 프로젝트를 찾을 수 없습니다: {req.target_collection_id}")

    category = item.get("properties", {}).get("data_category", "unknown")

    # 3. S3 파일 이동 (copy + delete)
    moved_assets = {}
    try:
        s3 = get_s3_client()
        for asset_key, asset in item.get("assets", {}).items():
            href = asset.get("href", "")
            if href.startswith("/api/files/"):
                old_s3_key = href.replace("/api/files/", "")
                # 기존: {old_collection}/{category}/{item_id}/{filename}
                parts = old_s3_key.split("/")
                if len(parts) >= 4:
                    filename = parts[-1]
                    new_s3_key = f"{req.target_collection_id}/{category}/{item_id}/{filename}"
                    new_href = f"/api/files/{new_s3_key}"
                    try:
                        s3.copy_object(
                            Bucket=settings.S3_BUCKET,
                            CopySource={"Bucket": settings.S3_BUCKET, "Key": old_s3_key},
                            Key=new_s3_key,
                        )
                        s3.delete_object(Bucket=settings.S3_BUCKET, Key=old_s3_key)
                        moved_assets[asset_key] = {**asset, "href": new_href}
                    except Exception:
                        logger.warning("S3 파일 이동 실패: %s → %s", old_s3_key, new_s3_key)
                        moved_assets[asset_key] = asset
                else:
                    moved_assets[asset_key] = asset
            else:
                moved_assets[asset_key] = asset
    except Exception:
        logger.warning("S3 이동 중 오류 (DB 이동은 계속 진행): %s", item_id)
        moved_assets = item.get("assets", {})

    # 4. DB에서 이동 (구 파티션 삭제 → 새 파티션 삽입)
    try:
        conn = psycopg2.connect(settings.DATABASE_URL)
        try:
            cur = conn.cursor()
            cur.execute("ALTER TABLE pgstac.items DISABLE TRIGGER ALL")

            # 삭제
            cur.execute("""
                SELECT inhrelid::regclass::text
                FROM pg_inherits WHERE inhparent = 'pgstac.items'::regclass
            """)
            partitions = [row[0] for row in cur.fetchall()]
            for part in partitions:
                cur.execute(f"DELETE FROM {part} WHERE id = %s AND collection = %s", (item_id, collection_id))
                if cur.rowcount > 0:
                    break

            cur.execute("ALTER TABLE pgstac.items ENABLE TRIGGER ALL")
            conn.commit()
        finally:
            conn.close()
    except Exception as e:
        logger.exception("Item 삭제 실패 (이동 중): %s", item_id)
        raise HTTPException(status_code=500, detail=f"이동 실패: {e}")

    # 5. 새 Collection에 삽입
    item["collection"] = req.target_collection_id
    item["assets"] = moved_assets
    item["properties"]["updated"] = datetime.now(timezone.utc).isoformat()

    # stac-fastapi 링크 등 불필요 필드 정리
    item.pop("type", None)
    item["type"] = "Feature"
    item.pop("stac_extensions", None)

    try:
        import json as _json
        conn = psycopg2.connect(settings.DATABASE_URL)
        try:
            cur = conn.cursor()
            cur.execute("SELECT pgstac.create_item(%s::jsonb)", (_json.dumps(item),))
            conn.commit()
        finally:
            conn.close()
    except Exception as e:
        logger.exception("Item 삽입 실패 (이동 중): %s", item_id)
        raise HTTPException(status_code=500, detail=f"이동 실패 (삽입): {e}")

    logger.info("Item 이동 완료: %s/%s → %s", collection_id, item_id, req.target_collection_id)
    # 이력이 Item 을 따라가도록 collection_id 갱신 후, 새 collection 기준으로 이동 이벤트 기록
    history.move_history(collection_id, item_id, req.target_collection_id)
    history.record_event(
        req.target_collection_id, item_id, "assign",
        f"프로젝트 이동: {collection_id} → {req.target_collection_id}",
        {"from": collection_id, "to": req.target_collection_id},
    )
    return {
        "moved": True,
        "item_id": item_id,
        "from_collection": collection_id,
        "to_collection": req.target_collection_id,
    }


# ─────────────────────────────────────────────────────────────────────────
# DELETE /api/items/{collection_id}/{item_id} — 아이템 삭제
# ─────────────────────────────────────────────────────────────────────────

@router.delete("/{collection_id}/{item_id}")
async def delete_item(collection_id: str, item_id: str):
    """STAC Item을 삭제한다. S3 파일도 정리."""
    import json
    import psycopg2
    from sams.config import settings
    from sams.services.s3 import get_s3_client

    # 1. Item 조회 (S3 파일 경로 확보)
    item = await stac.get_item(collection_id, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail=f"Item을 찾을 수 없습니다: {item_id}")

    # 2. pgSTAC에서 삭제 (파티션 테이블 직접 삭제)
    try:
        conn = psycopg2.connect(settings.DATABASE_URL)
        try:
            cur = conn.cursor()
            # 트리거 전체 비활성화 (partition_sys_meta 미존재 대응)
            cur.execute("ALTER TABLE pgstac.items DISABLE TRIGGER ALL")

            # 파티션 테이블 목록 조회 후 삭제
            cur.execute("""
                SELECT inhrelid::regclass::text
                FROM pg_inherits
                WHERE inhparent = 'pgstac.items'::regclass
            """)
            partitions = [row[0] for row in cur.fetchall()]
            deleted = False
            for part in partitions:
                cur.execute(f"DELETE FROM {part} WHERE id = %s AND collection = %s", (item_id, collection_id))
                if cur.rowcount > 0:
                    deleted = True
                    break

            # 트리거 복원
            cur.execute("ALTER TABLE pgstac.items ENABLE TRIGGER ALL")
            conn.commit()
            if not deleted:
                raise RuntimeError(f"Item을 찾을 수 없습니다: {item_id}")
        finally:
            conn.close()
    except RuntimeError:
        raise
    except Exception as e:
        logger.exception("Item 삭제 실패 (pgSTAC): %s", item_id)
        raise HTTPException(status_code=500, detail=f"삭제 실패: {e}")

    # 3. S3 파일 삭제 (prefix 단위 — assets 누락이나 부분 등록도 정리)
    try:
        s3 = get_s3_client()
        category = item.get("properties", {}).get("data_category", "unknown")
        prefix = f"{collection_id}/{category}/{item_id}/"
        resp = s3.list_objects_v2(Bucket=settings.S3_BUCKET, Prefix=prefix)
        objects = resp.get("Contents", [])
        if objects:
            s3.delete_objects(
                Bucket=settings.S3_BUCKET,
                Delete={"Objects": [{"Key": o["Key"]} for o in objects]},
            )
            logger.info("S3 정리: %d개 파일 삭제 (%s)", len(objects), prefix)
    except Exception:
        logger.warning("S3 정리 실패 (Item은 이미 삭제됨): %s", item_id)

    logger.info("Item 삭제 완료: %s/%s", collection_id, item_id)
    history.delete_history(collection_id, item_id)
    return {"deleted": True, "item_id": item_id}
