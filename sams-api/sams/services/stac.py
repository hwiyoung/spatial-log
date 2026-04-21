"""
stac-fastapi 호출 래퍼.

SAMS API가 내부적으로 stac-fastapi (port 8080)를 호출하여
Collection/Item CRUD 및 검색을 수행한다.

참조: docs/system_architecture.md 섹션 3.1
"""

import logging
from typing import Any

import httpx

from sams.config import settings

logger = logging.getLogger(__name__)

_TIMEOUT = 10.0


# ─────────────────────────────────────────────────────────────────────────
# Collection
# ─────────────────────────────────────────────────────────────────────────

async def create_collection(collection_json: dict[str, Any]) -> dict:
    """STAC Collection을 생성한다."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{settings.STAC_API_URL}/collections",
            json=collection_json,
            timeout=_TIMEOUT,
        )
    _check_response(resp, "Collection 생성")
    return resp.json()


async def get_collection(collection_id: str) -> dict | None:
    """STAC Collection을 조회한다. 없으면 None."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{settings.STAC_API_URL}/collections/{collection_id}",
            timeout=_TIMEOUT,
        )
    if resp.status_code == 404:
        return None
    _check_response(resp, "Collection 조회")
    return resp.json()


async def update_collection(collection_id: str, collection_json: dict[str, Any]) -> dict:
    """STAC Collection을 수정한다."""
    async with httpx.AsyncClient() as client:
        resp = await client.put(
            f"{settings.STAC_API_URL}/collections/{collection_id}",
            json=collection_json,
            timeout=_TIMEOUT,
        )
    _check_response(resp, "Collection 수정")
    return resp.json()


async def delete_collection(collection_id: str) -> None:
    """STAC Collection을 삭제한다."""
    async with httpx.AsyncClient() as client:
        resp = await client.delete(
            f"{settings.STAC_API_URL}/collections/{collection_id}",
            timeout=_TIMEOUT,
        )
    _check_response(resp, "Collection 삭제")


async def list_collections() -> list[dict]:
    """모든 STAC Collection 목록을 조회한다."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{settings.STAC_API_URL}/collections",
            timeout=_TIMEOUT,
        )
    _check_response(resp, "Collection 목록 조회")
    data = resp.json()
    return data.get("collections", [])


# ─────────────────────────────────────────────────────────────────────────
# Item
# ─────────────────────────────────────────────────────────────────────────

async def get_item(collection_id: str, item_id: str) -> dict | None:
    """STAC Item을 조회한다. 없으면 None."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{settings.STAC_API_URL}/collections/{collection_id}/items/{item_id}",
            timeout=_TIMEOUT,
        )
    if resp.status_code == 404:
        return None
    _check_response(resp, "Item 조회")
    return resp.json()


async def update_item(collection_id: str, item_id: str, item_json: dict[str, Any]) -> dict:
    """STAC Item을 수정한다."""
    async with httpx.AsyncClient() as client:
        resp = await client.put(
            f"{settings.STAC_API_URL}/collections/{collection_id}/items/{item_id}",
            json=item_json,
            timeout=_TIMEOUT,
        )
    _check_response(resp, "Item 수정")
    return resp.json()


async def delete_item(collection_id: str, item_id: str) -> None:
    """STAC Item을 삭제한다."""
    async with httpx.AsyncClient() as client:
        resp = await client.delete(
            f"{settings.STAC_API_URL}/collections/{collection_id}/items/{item_id}",
            timeout=_TIMEOUT,
        )
    _check_response(resp, "Item 삭제")


async def search_items(
    collections: list[str] | None = None,
    filter_params: dict[str, Any] | None = None,
    limit: int = 100,
) -> list[dict]:
    """STAC Item 검색."""
    body: dict[str, Any] = {"limit": limit}
    if collections:
        body["collections"] = collections
    if filter_params:
        body.update(filter_params)

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{settings.STAC_API_URL}/search",
            json=body,
            timeout=_TIMEOUT,
        )
    _check_response(resp, "Item 검색")
    data = resp.json()
    return data.get("features", [])


async def get_collection_items(collection_id: str, limit: int = 1000) -> list[dict]:
    """Collection에 속한 모든 Item을 조회한다."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{settings.STAC_API_URL}/collections/{collection_id}/items",
            params={"limit": limit},
            timeout=_TIMEOUT,
        )
    _check_response(resp, "Collection Items 조회")
    data = resp.json()
    return data.get("features", [])


# ─────────────────────────────────────────────────────────────────────────
# 헬퍼
# ─────────────────────────────────────────────────────────────────────────

def _check_response(resp: httpx.Response, action: str) -> None:
    """HTTP 응답 상태 코드를 확인한다."""
    if resp.status_code >= 400:
        logger.error(
            "%s 실패 (HTTP %s): %s",
            action, resp.status_code, resp.text[:300],
        )
        raise RuntimeError(f"{action} 실패 (HTTP {resp.status_code}): {resp.text[:200]}")
