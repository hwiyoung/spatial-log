"""
Tests for Collections + Items 엔드포인트.

stac-fastapi 호출은 mock 처리.
참조: docs/system_architecture.md 섹션 3.2
"""

from unittest.mock import patch, AsyncMock

import pytest
from fastapi.testclient import TestClient

from sams.main import app

client = TestClient(app)


# ==========================================================================
# Mock 헬퍼
# ==========================================================================

SAMPLE_COLLECTION = {
    "type": "Collection",
    "stac_version": "1.0.0",
    "id": "test-project",
    "title": "테스트 프로젝트",
    "description": "테스트",
    "license": "proprietary",
    "extent": {
        "spatial": {"bbox": [[-180, -90, 180, 90]]},
        "temporal": {"interval": [[None, None]]},
    },
    "links": [],
    "summaries": {
        "project:site": "서울",
        "project:default_epsg": 5186,
        "expected_deliverables": [{"category": "pointcloud", "count": 3, "description": "테스트"}],
        "sams:status": "active",
    },
}


def _make_item(item_id: str, category: str = "pointcloud", status: str = "draft", **extra_props):
    props = {
        "datetime": "2024-03-12T09:30:00Z",
        "description": "테스트 아이템",
        "data_category": category,
        "project:name": "테스트",
        "project:site": "서울",
        "proj:epsg": 5186,
        "sams:status": status,
        **extra_props,
    }
    return {
        "type": "Feature",
        "stac_version": "1.0.0",
        "id": item_id,
        "geometry": None,
        "bbox": [129.33, 35.79, 129.34, 35.80],
        "properties": props,
        "links": [],
        "assets": {},
        "collection": "test-project",
    }


# ==========================================================================
# POST /api/collections — 생성
# ==========================================================================

class TestCreateCollection:

    @patch("sams.routers.collections.stac.create_collection", new_callable=AsyncMock)
    def test_create_collection(self, mock_create):
        mock_create.return_value = SAMPLE_COLLECTION

        resp = client.post("/api/collections", json={
            "id": "test-project",
            "title": "테스트 프로젝트",
            "project:site": "서울",
            "project:default_epsg": 5186,
        })

        assert resp.status_code == 200
        assert mock_create.called
        call_arg = mock_create.call_args[0][0]
        assert call_arg["id"] == "test-project"
        assert call_arg["summaries"]["project:site"] == "서울"


# ==========================================================================
# GET /api/collections — 목록
# ==========================================================================

class TestListCollections:

    @patch("sams.routers.collections.stac.list_collections", new_callable=AsyncMock)
    def test_list_collections(self, mock_list):
        mock_list.return_value = [SAMPLE_COLLECTION]

        resp = client.get("/api/collections")

        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 1


# ==========================================================================
# GET /api/collections/{id}/dashboard — 대시보드
# ==========================================================================

class TestCollectionDashboard:

    @patch("sams.routers.collections.stac.get_collection_items", new_callable=AsyncMock)
    @patch("sams.routers.collections.stac.get_collection", new_callable=AsyncMock)
    def test_dashboard(self, mock_get_col, mock_get_items):
        mock_get_col.return_value = SAMPLE_COLLECTION
        mock_get_items.return_value = [
            _make_item("item-1", "pointcloud", "published"),
            _make_item("item-2", "pointcloud", "draft"),
            _make_item("item-3", "3d_model", "draft"),
        ]

        resp = client.get("/api/collections/test-project/dashboard")

        assert resp.status_code == 200
        body = resp.json()
        assert body["total_items"] == 3
        assert body["type_counts"]["pointcloud"] == 2
        assert body["type_counts"]["3d_model"] == 1
        assert body["draft_count"] == 2
        # expected vs actual
        assert len(body["expected_vs_actual"]) == 1
        assert body["expected_vs_actual"][0]["expected"] == 3
        assert body["expected_vs_actual"][0]["actual"] == 2


# ==========================================================================
# PUT /api/items/{collection}/{item}/status — Draft→Published
# ==========================================================================

class TestItemStatus:

    @patch("sams.routers.items.stac.update_item", new_callable=AsyncMock)
    @patch("sams.routers.items.stac.get_item", new_callable=AsyncMock)
    def test_publish_complete_item(self, mock_get, mock_update):
        mock_get.return_value = _make_item("item-1", status="draft")
        mock_update.return_value = _make_item("item-1", status="published")

        resp = client.put(
            "/api/items/test-project/item-1/status",
            json={"status": "published"},
        )

        assert resp.status_code == 200
        assert resp.json()["status"] == "published"

    @patch("sams.routers.items.stac.get_item", new_callable=AsyncMock)
    def test_publish_incomplete_item_fails(self, mock_get):
        """필수 필드 누락 시 Published 전환 거부."""
        incomplete = _make_item("item-1", status="draft")
        incomplete["properties"]["description"] = ""  # 빈 필수 필드
        mock_get.return_value = incomplete

        resp = client.put(
            "/api/items/test-project/item-1/status",
            json={"status": "published"},
        )

        assert resp.status_code == 400
        assert "description" in resp.json()["detail"]

    @patch("sams.routers.items.stac.get_item", new_callable=AsyncMock)
    def test_item_not_found(self, mock_get):
        mock_get.return_value = None

        resp = client.put(
            "/api/items/test-project/nonexistent/status",
            json={"status": "published"},
        )

        assert resp.status_code == 404


# ==========================================================================
# GET /api/items/{collection}/{item}/related — 관련 Item
# ==========================================================================

class TestItemRelated:

    @patch("sams.routers.items.stac.get_item", new_callable=AsyncMock)
    def test_get_related(self, mock_get):
        item = _make_item("item-1")
        item["links"] = [
            {"rel": "derived_from", "href": "./item-2", "type": "application/geo+json"},
            {"rel": "related", "href": "./item-3", "type": "application/geo+json"},
            {"rel": "self", "href": "/collections/test/items/item-1"},  # 무시됨
        ]
        mock_get.return_value = item

        resp = client.get("/api/items/test-project/item-1/related")

        assert resp.status_code == 200
        body = resp.json()
        assert len(body["related"]) == 2
        rels = {r["rel"] for r in body["related"]}
        assert rels == {"derived_from", "related"}


# ==========================================================================
# GET /api/items/{collection}/{item}/timeline — 시계열
# ==========================================================================

class TestItemTimeline:

    @patch("sams.routers.items.stac.get_collection_items", new_callable=AsyncMock)
    @patch("sams.routers.items.stac.get_item", new_callable=AsyncMock)
    def test_timeline(self, mock_get, mock_items):
        mock_get.return_value = _make_item("item-1", "pointcloud", target="다보탑")
        mock_items.return_value = [
            _make_item("item-1", "pointcloud", target="다보탑",
                       datetime="2024-03-12T00:00:00Z"),
            _make_item("item-2", "pointcloud", target="다보탑",
                       datetime="2024-06-15T00:00:00Z"),
            _make_item("item-3", "3d_model", target="다보탑"),  # 다른 category
        ]

        resp = client.get("/api/items/test-project/item-1/timeline")

        assert resp.status_code == 200
        body = resp.json()
        assert len(body["timeline"]) == 2  # 같은 target + category만
        assert body["timeline"][0]["is_current"] is True


# ==========================================================================
# POST /api/items/{collection}/{item}/links — 양방향 링크
# ==========================================================================

class TestItemLinks:

    @patch("sams.routers.items.stac.update_item", new_callable=AsyncMock)
    @patch("sams.routers.items.stac.get_item", new_callable=AsyncMock)
    def test_add_link_bidirectional(self, mock_get, mock_update):
        source = _make_item("item-1")
        target = _make_item("item-2")
        mock_get.side_effect = [source, target]
        mock_update.return_value = {}

        resp = client.post(
            "/api/items/test-project/item-1/links",
            json={
                "rel": "derived_from",
                "target_collection_id": "test-project",
                "target_item_id": "item-2",
            },
        )

        assert resp.status_code == 200
        body = resp.json()
        assert body["rel"] == "derived_from"
        assert body["reverse_rel"] == "has_derived"
        # update가 두 번 호출됨 (target + source)
        assert mock_update.call_count == 2

    @patch("sams.routers.items.stac.get_item", new_callable=AsyncMock)
    def test_add_link_source_not_found(self, mock_get):
        mock_get.return_value = None

        resp = client.post(
            "/api/items/test-project/nonexistent/links",
            json={
                "rel": "related",
                "target_collection_id": "test-project",
                "target_item_id": "item-2",
            },
        )

        assert resp.status_code == 404
