"""
Item 관리 엔드포인트.

Draft→Published 전환, 관계(links) 관리, 타임라인 조회.
양방향 링크 자동 생성/삭제가 핵심.

참조: docs/system_architecture.md 섹션 3.2 (Item 관리)
"""

import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from sams.services import stac

logger = logging.getLogger(__name__)
router = APIRouter()


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

    props["sams:status"] = req.status
    props["updated"] = datetime.now(timezone.utc).isoformat()
    item["properties"] = props

    try:
        result = await stac.update_item(collection_id, item_id, item)
        return {"status": req.status, "item_id": item_id}
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


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
    """links를 양방향 해석하여 관련 Item 목록을 반환한다."""
    item = await stac.get_item(collection_id, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail=f"Item '{item_id}'을(를) 찾을 수 없습니다.")

    # 이 Item의 links에서 관계 추출
    links = item.get("links", [])
    related = []
    for link in links:
        rel = link.get("rel", "")
        if rel in ("derived_from", "has_derived", "related", "describedby", "prev", "next"):
            href = link.get("href", "")
            target_id = _extract_item_id_from_href(href)
            related.append({
                "rel": rel,
                "target_id": target_id,
                "href": href,
                "title": link.get("title", ""),
            })

    return {"item_id": item_id, "related": related}


# ─────────────────────────────────────────────────────────────────────────
# GET /api/items/{collection_id}/{item_id}/timeline — 시계열
# ─────────────────────────────────────────────────────────────────────────

@router.get("/{collection_id}/{item_id}/timeline")
async def get_item_timeline(collection_id: str, item_id: str):
    """같은 target + category의 시점별 Item 목록."""
    item = await stac.get_item(collection_id, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail=f"Item '{item_id}'을(를) 찾을 수 없습니다.")

    props = item.get("properties", {})
    target = props.get("target")
    category = props.get("data_category")

    if not target or not category:
        return {"item_id": item_id, "timeline": []}

    # 같은 Collection에서 같은 target + category인 Item들을 검색
    all_items = await stac.get_collection_items(collection_id)
    timeline = []
    for other in all_items:
        other_props = other.get("properties", {})
        if (other_props.get("target") == target and
                other_props.get("data_category") == category):
            timeline.append({
                "item_id": other.get("id"),
                "datetime": other_props.get("datetime"),
                "description": other_props.get("description", ""),
                "status": other_props.get("sams:status", "draft"),
                "is_current": other.get("id") == item_id,
            })

    # datetime 기준 정렬
    timeline.sort(key=lambda x: x.get("datetime") or "")

    return {"item_id": item_id, "target": target, "category": category, "timeline": timeline}


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
        await stac.update_item(req.target_collection_id, req.target_item_id, target_item)

    await stac.update_item(collection_id, item_id, source_item)

    return {"created": True, "rel": req.rel, "reverse_rel": reverse_rel}


# ─────────────────────────────────────────────────────────────────────────
# DELETE /api/items/{collection_id}/{item_id}/links/{link_index}
# ─────────────────────────────────────────────────────────────────────────

@router.delete("/{collection_id}/{item_id}/links/{link_index}")
async def delete_link(collection_id: str, item_id: str, link_index: int):
    """관계를 삭제한다. 양방향 자동 삭제."""
    item = await stac.get_item(collection_id, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail=f"Item '{item_id}'을(를) 찾을 수 없습니다.")

    links = item.get("links", [])
    if link_index < 0 or link_index >= len(links):
        raise HTTPException(status_code=400, detail=f"유효하지 않은 link_index: {link_index}")

    removed_link = links.pop(link_index)
    item["links"] = links

    # 역방향 링크 삭제
    reverse_rel = _REVERSE_REL.get(removed_link.get("rel", ""))
    if reverse_rel:
        target_id = _extract_item_id_from_href(removed_link.get("href", ""))
        if target_id:
            await _remove_reverse_link(collection_id, target_id, item_id, reverse_rel)

    await stac.update_item(collection_id, item_id, item)

    return {"deleted": True, "removed_link": removed_link}


async def _remove_reverse_link(
    collection_id: str,
    target_item_id: str,
    source_item_id: str,
    reverse_rel: str,
) -> None:
    """타겟 Item에서 소스를 가리키는 역방향 링크를 삭제한다."""
    try:
        target = await stac.get_item(collection_id, target_item_id)
        if target is None:
            return
        links = target.get("links", [])
        target["links"] = [
            l for l in links
            if not (l.get("rel") == reverse_rel and source_item_id in l.get("href", ""))
        ]
        await stac.update_item(collection_id, target_item_id, target)
    except Exception:
        logger.exception("역방향 링크 삭제 실패: %s → %s", target_item_id, source_item_id)


def _extract_item_id_from_href(href: str) -> str:
    """STAC link href에서 Item ID를 추출한다."""
    # 형식: "./item-id" 또는 "../../collection/items/item-id"
    parts = href.rstrip("/").split("/")
    return parts[-1] if parts else ""
