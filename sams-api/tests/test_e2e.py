"""
E2E 통합 테스트 — 전체 흐름 시나리오

FastAPI TestClient로 실제 파이프라인을 실행하여 검증.
STAC API 호출은 mock으로 처리 (Docker 의존 없이 실행 가능).

시나리오:
1. 파일 업로드 → analyze → 매니페스트
2. 매니페스트 validate
3. 매니페스트 register
4. Collection 생성/조회
5. Item status 전환

참조: docs/CLAUDE_CODE_GUIDE.md Step 13
"""

import io
import json
from unittest.mock import patch, AsyncMock

import pytest
from fastapi.testclient import TestClient

from sams.main import app

client = TestClient(app)


# ==========================================================================
# 시나리오 1: 파일 업로드 → 분석 → 검증 → 등록 전체 흐름
# ==========================================================================

class TestUploadFlow:
    """벌크 업로드 전체 흐름."""

    def test_full_upload_flow(self):
        """파일 업로드 → analyze → validate → register 전체 흐름."""

        # ── Step 1: analyze ──
        files = [
            ("files", ("dabotap_scan.laz", io.BytesIO(b"\x00" * 100), "application/octet-stream")),
            ("files", ("dabotap_model.obj", io.BytesIO(b"v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n"), "text/plain")),
            ("files", ("report.pdf", io.BytesIO(b"\x00" * 50), "application/octet-stream")),
        ]

        resp = client.post("/api/upload/analyze", files=files, data={"collection_id": ""})
        assert resp.status_code == 200

        manifest = resp.json()
        assert manifest["summary"]["total_files"] == 3
        assert len(manifest["manifest"]) == 3

        # 유형 판별 확인
        categories = {item["detected_category"] for item in manifest["manifest"]}
        assert "pointcloud" in categories
        assert "3d_model" in categories
        assert "document" in categories

        # 파일명이 원본 그대로인지 (임시 경로 아님)
        filenames = {item["file_path"] for item in manifest["manifest"]}
        assert "dabotap_scan.laz" in filenames
        assert "dabotap_model.obj" in filenames
        assert "report.pdf" in filenames

        # 자동 채움률 확인
        assert manifest["summary"]["auto_filled_percentage"] > 0

        # 필수 빈 필드 확인
        for item in manifest["manifest"]:
            assert "datetime" in item["required_empty"]
            assert "description" in item["required_empty"]

        # 관계 제안 확인 (dabotap 공통 키워드)
        all_links = []
        for item in manifest["manifest"]:
            all_links.extend(item["suggested_links"])
        assert len(all_links) > 0  # 최소 1개 관계 제안

        # ── Step 2: validate (일부러 누락된 상태) ──
        validate_manifest = [{"data_category": "pointcloud"}]  # 필수 필드 누락
        resp = client.post("/api/upload/validate", json={"manifest": validate_manifest})
        assert resp.status_code == 200
        assert resp.json()["valid"] is False
        assert len(resp.json()["errors"]) > 0

        # ── Step 2b: validate (정상) ──
        valid_manifest = [{
            "data_category": "pointcloud",
            "datetime": "2024-03-12T09:30:00Z",
            "description": "다보탑 LiDAR 스캔",
            "project:name": "테스트",
            "project:site": "경주",
            "proj:epsg": 5186,
            "pc:count": 15000000,
            "pc:type": "lidar",
        }]
        resp = client.post("/api/upload/validate", json={"manifest": valid_manifest})
        assert resp.status_code == 200
        assert resp.json()["valid"] is True

        # ── Step 3: register (mock STAC) ──
        with patch("sams.routers.upload._register_stac_item", new_callable=AsyncMock) as mock_reg:
            mock_reg.return_value = None

            resp = client.post("/api/upload/register", json={
                "collection_id": "test-e2e",
                "items": [{
                    "data_category": "pointcloud",
                    "description": "다보탑 LiDAR",
                    "datetime": "2024-03-12T09:30:00Z",
                }],
                "status": "draft",
            })

            assert resp.status_code == 200
            body = resp.json()
            assert body["registered"] == 1
            assert len(body["item_ids"]) == 1
            assert "test-e2e" in body["item_ids"][0]


# ==========================================================================
# 시나리오 2: Collection 생성 → 조회 → 대시보드
# ==========================================================================

class TestCollectionFlow:
    """Collection CRUD + 대시보드."""

    @patch("sams.routers.collections.stac.create_collection", new_callable=AsyncMock)
    @patch("sams.routers.collections.stac.list_collections", new_callable=AsyncMock)
    @patch("sams.routers.collections.stac.get_collection", new_callable=AsyncMock)
    @patch("sams.routers.collections.stac.get_collection_items", new_callable=AsyncMock)
    def test_collection_lifecycle(self, mock_items, mock_get, mock_list, mock_create):
        """생성 → 목록 → 대시보드."""
        sample_col = {
            "id": "test-e2e-col",
            "title": "E2E 테스트",
            "summaries": {
                "project:site": "서울",
                "sams:status": "active",
                "expected_deliverables": [
                    {"category": "pointcloud", "count": 2, "description": "PC 2건"},
                ],
            },
        }
        mock_create.return_value = sample_col
        mock_list.return_value = [sample_col]
        mock_get.return_value = sample_col
        mock_items.return_value = [
            _make_stac_item("item-1", "pointcloud", "published"),
            _make_stac_item("item-2", "pointcloud", "draft"),
            _make_stac_item("item-3", "document", "published"),
        ]

        # 생성
        resp = client.post("/api/collections", json={
            "id": "test-e2e-col",
            "title": "E2E 테스트",
            "project:site": "서울",
        })
        assert resp.status_code == 200

        # 목록
        resp = client.get("/api/collections")
        assert resp.status_code == 200
        assert resp.json()["total"] == 1

        # 대시보드
        resp = client.get("/api/collections/test-e2e-col/dashboard")
        assert resp.status_code == 200
        body = resp.json()
        assert body["total_items"] == 3
        assert body["type_counts"]["pointcloud"] == 2
        assert body["draft_count"] == 1
        # 예상 vs 실제
        assert body["expected_vs_actual"][0]["expected"] == 2
        assert body["expected_vs_actual"][0]["actual"] == 2


# ==========================================================================
# 시나리오 3: Item 상태 전환 + 관계 조회
# ==========================================================================

class TestItemFlow:
    """Item status + related + timeline."""

    @patch("sams.routers.items._pgstac_update_item", new_callable=AsyncMock)
    @patch("sams.routers.items.stac.get_item", new_callable=AsyncMock)
    def test_draft_to_published(self, mock_get, mock_update):
        """Draft → Published 전환."""
        item = _make_stac_item("item-1", "pointcloud", "draft")
        mock_get.return_value = item
        mock_update.return_value = item

        # 필수 필드가 모두 있으므로 성공
        resp = client.put(
            "/api/items/test-col/item-1/status",
            json={"status": "published"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "published"

    @patch("sams.routers.items.stac.get_item", new_callable=AsyncMock)
    def test_publish_fails_without_required(self, mock_get):
        """필수 필드 누락 시 Published 거부."""
        item = _make_stac_item("item-1", "pointcloud", "draft")
        item["properties"]["description"] = ""
        mock_get.return_value = item

        resp = client.put(
            "/api/items/test-col/item-1/status",
            json={"status": "published"},
        )
        assert resp.status_code == 400

    @patch("sams.routers.items.stac.get_item", new_callable=AsyncMock)
    def test_related_items(self, mock_get):
        """관련 Item 조회."""
        item = _make_stac_item("item-1", "pointcloud", "published")
        item["links"] = [
            {"rel": "derived_from", "href": "./item-2", "type": "application/geo+json"},
            {"rel": "related", "href": "./item-3", "type": "application/geo+json"},
        ]
        mock_get.return_value = item

        resp = client.get("/api/items/test-col/item-1/related")
        assert resp.status_code == 200
        assert len(resp.json()["related"]) == 2

    @patch("sams.routers.items.stac.get_collection_items", new_callable=AsyncMock)
    @patch("sams.routers.items.stac.get_item", new_callable=AsyncMock)
    def test_timeline(self, mock_get, mock_items):
        """시계열 조회."""
        mock_get.return_value = _make_stac_item("item-1", "pointcloud", "published", target="다보탑")
        mock_items.return_value = [
            _make_stac_item("item-1", "pointcloud", "published", target="다보탑", datetime="2024-03-12T00:00:00Z"),
            _make_stac_item("item-2", "pointcloud", "published", target="다보탑", datetime="2025-03-12T00:00:00Z"),
        ]

        resp = client.get("/api/items/test-col/item-1/timeline")
        assert resp.status_code == 200
        body = resp.json()
        assert len(body["timeline"]) == 2
        assert body["timeline"][0]["is_current"] is True


# ==========================================================================
# 시나리오 4: 파이프라인 analyze — Collection 상속 + 관계 제안
# ==========================================================================

class TestPipelineIntegration:
    """파이프라인 자체의 통합 검증."""

    def test_analyze_with_collection_defaults(self):
        """Collection 기본값이 inherited에 반영되는지."""
        # Collection을 직접 파라미터로 전달할 수 없으므로
        # 내부 analyze() 함수를 직접 호출
        from sams.pipeline import analyze

        import tempfile, os
        tmp = tempfile.mkdtemp()
        laz = os.path.join(tmp, "scan.laz")
        with open(laz, "wb") as f:
            f.write(b"\x00" * 100)

        result = analyze(
            [laz],
            collection_defaults={
                "id": "test", "title": "테스트 프로젝트",
                "project:site": "경주", "project:default_epsg": 5186,
            },
        )

        item = result.manifest[0]
        # Collection 상속 확인
        assert "project:name" in item.inherited
        assert item.inherited["project:name"].value == "테스트 프로젝트"
        assert item.inherited["project:name"].source == "collection_default"
        # proj:epsg는 파일에서 못 추출하면 Collection 값 상속
        assert "proj:epsg" in item.inherited
        assert item.inherited["proj:epsg"].value == 5186

        import shutil
        shutil.rmtree(tmp, ignore_errors=True)

    def test_analyze_suggest_links(self):
        """같은 target의 파일 간 관계 제안."""
        from sams.pipeline import analyze

        import tempfile, os
        tmp = tempfile.mkdtemp()
        for name in ["dabotap_scan.laz", "dabotap_model.obj"]:
            with open(os.path.join(tmp, name), "wb") as f:
                f.write(b"\x00" * 50)

        result = analyze(
            [os.path.join(tmp, "dabotap_scan.laz"), os.path.join(tmp, "dabotap_model.obj")],
            None,
        )

        all_links = []
        for item in result.manifest:
            all_links.extend(item.suggested_links)

        derived = [l for l in all_links if l.rel == "derived_from"]
        assert len(derived) >= 1  # 3D 모델 ← 포인트클라우드

        import shutil
        shutil.rmtree(tmp, ignore_errors=True)


# ==========================================================================
# 헬퍼
# ==========================================================================

def _make_stac_item(item_id, category="pointcloud", status="draft", **extra_props):
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
    if category == "pointcloud" and "pc:count" not in props:
        props["pc:count"] = 15230482   # 유형별 Published 필수 필드 (_TYPE_REQUIRED)
    return {
        "type": "Feature",
        "stac_version": "1.0.0",
        "id": item_id,
        "geometry": {"type": "Point", "coordinates": [129.33, 35.79]},
        "bbox": [129.33, 35.79, 129.34, 35.80],
        "properties": props,
        "links": [],
        "assets": {},
        "collection": "test-col",
    }
