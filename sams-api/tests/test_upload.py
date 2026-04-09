"""
Tests for Upload 엔드포인트 (/api/upload/*)

FastAPI TestClient로 analyze, validate 엔드포인트를 검증.
register는 S3 + STAC API 연동이 필요하므로 mock 기반.

참조: docs/system_architecture.md 섹션 3.2
"""

import io
import json
from unittest.mock import patch, AsyncMock

import pytest
from fastapi.testclient import TestClient

from sams.main import app

client = TestClient(app)


# ==========================================================================
# POST /api/upload/analyze
# ==========================================================================

class TestUploadAnalyze:
    """파일 업로드 → 파이프라인 분석."""

    def test_analyze_single_file(self):
        """단일 파일 업로드 → 매니페스트 반환."""
        file_content = b"\x00" * 100
        files = [("files", ("scan.laz", io.BytesIO(file_content), "application/octet-stream"))]

        resp = client.post("/api/upload/analyze", files=files, data={"collection_id": ""})

        assert resp.status_code == 200
        body = resp.json()
        assert "manifest" in body
        assert "summary" in body
        assert len(body["manifest"]) == 1

        item = body["manifest"][0]
        assert item["file_path"] == "scan.laz"  # 임시 경로가 아닌 원본 파일명
        assert item["detected_category"] == "pointcloud"
        assert item["category_confidence"] == 1.0

    def test_analyze_multiple_files(self):
        """여러 파일 업로드."""
        files = [
            ("files", ("scan.laz", io.BytesIO(b"\x00" * 10), "application/octet-stream")),
            ("files", ("report.pdf", io.BytesIO(b"\x00" * 10), "application/octet-stream")),
            ("files", ("flight.mp4", io.BytesIO(b"\x00" * 10), "application/octet-stream")),
        ]

        resp = client.post("/api/upload/analyze", files=files)

        assert resp.status_code == 200
        body = resp.json()
        assert body["summary"]["total_files"] == 3
        categories = {item["detected_category"] for item in body["manifest"]}
        assert categories == {"pointcloud", "document", "video"}

    def test_analyze_with_collection_id(self):
        """collection_id가 있으면 Collection 기본값 조회를 시도."""
        files = [("files", ("scan.laz", io.BytesIO(b"\x00" * 10), "application/octet-stream"))]

        # STAC API가 없어도 graceful하게 처리
        resp = client.post(
            "/api/upload/analyze",
            files=files,
            data={"collection_id": "nonexistent-collection"},
        )

        assert resp.status_code == 200
        body = resp.json()
        assert len(body["manifest"]) == 1

    def test_analyze_no_files_returns_400(self):
        """파일 없이 요청하면 400."""
        resp = client.post("/api/upload/analyze", files=[])

        # FastAPI가 필수 파라미터 누락으로 422 반환
        assert resp.status_code in (400, 422)

    def test_analyze_response_has_required_empty(self):
        """응답에 required_empty 포함."""
        files = [("files", ("scan.laz", io.BytesIO(b"\x00" * 10), "application/octet-stream"))]

        resp = client.post("/api/upload/analyze", files=files)

        item = resp.json()["manifest"][0]
        assert "required_empty" in item
        assert "datetime" in item["required_empty"]
        assert "description" in item["required_empty"]

    def test_analyze_file_path_no_tmp_leak(self):
        """임시 디렉토리 경로가 응답에 노출되지 않는다."""
        files = [("files", ("scan.laz", io.BytesIO(b"\x00" * 10), "application/octet-stream"))]

        resp = client.post("/api/upload/analyze", files=files)

        item = resp.json()["manifest"][0]
        assert "/tmp" not in item["file_path"]
        assert item["file_path"] == "scan.laz"


# ==========================================================================
# POST /api/upload/validate
# ==========================================================================

class TestUploadValidate:
    """매니페스트 필수 필드 검증."""

    def test_validate_complete_manifest(self):
        """모든 필수 필드가 있으면 valid=true."""
        manifest = [{
            "data_category": "pointcloud",
            "datetime": "2024-03-12T09:30:00Z",
            "description": "다보탑 포인트 클라우드",
            "project:name": "다보탑 보수",
            "project:site": "경주",
            "proj:epsg": 5186,
            "pc:count": 15230482,
            "pc:type": "lidar",
        }]

        resp = client.post("/api/upload/validate", json={"manifest": manifest})

        assert resp.status_code == 200
        body = resp.json()
        assert body["valid"] is True
        assert len(body["errors"]) == 0

    def test_validate_missing_required_fields(self):
        """필수 필드 누락 → valid=false + errors."""
        manifest = [{"data_category": "pointcloud"}]

        resp = client.post("/api/upload/validate", json={"manifest": manifest})

        assert resp.status_code == 200
        body = resp.json()
        assert body["valid"] is False
        assert len(body["errors"]) > 0
        # datetime, description, project:name 등이 누락
        error_text = " ".join(body["errors"])
        assert "datetime" in error_text
        assert "description" in error_text

    def test_validate_empty_string_is_error(self):
        """빈 문자열도 필수 필드 누락으로 처리."""
        manifest = [{
            "data_category": "document",
            "datetime": "2024-01-01",
            "description": "",  # 빈 문자열
            "project:name": "테스트",
            "project:site": "서울",
            "proj:epsg": 5186,
        }]

        resp = client.post("/api/upload/validate", json={"manifest": manifest})

        body = resp.json()
        assert body["valid"] is False
        assert any("description" in e for e in body["errors"])

    def test_validate_datetime_null_needs_range(self):
        """datetime이 null이면 start_datetime + end_datetime 필요."""
        manifest = [{
            "data_category": "pointcloud",
            "datetime": None,
            "description": "테스트",
            "project:name": "테스트",
            "project:site": "서울",
            "proj:epsg": 5186,
            "pc:count": 1000,
            "pc:type": "lidar",
        }]

        resp = client.post("/api/upload/validate", json={"manifest": manifest})

        body = resp.json()
        assert body["valid"] is False
        error_text = " ".join(body["errors"])
        assert "start_datetime" in error_text

    def test_validate_category_specific_fields(self):
        """카테고리별 필수 필드 검증 (pointcloud → pc:count, pc:type)."""
        manifest = [{
            "data_category": "pointcloud",
            "datetime": "2024-01-01",
            "description": "테스트",
            "project:name": "테스트",
            "project:site": "서울",
            "proj:epsg": 5186,
            # pc:count, pc:type 누락
        }]

        resp = client.post("/api/upload/validate", json={"manifest": manifest})

        body = resp.json()
        assert body["valid"] is False
        error_text = " ".join(body["errors"])
        assert "pc:count" in error_text
        assert "pc:type" in error_text

    def test_validate_multiple_items(self):
        """여러 Item 검증 — 인덱스 표시."""
        manifest = [
            {"data_category": "pointcloud"},
            {"data_category": "document", "datetime": "2024-01-01",
             "description": "보고서", "project:name": "테스트",
             "project:site": "서울", "proj:epsg": 5186},
        ]

        resp = client.post("/api/upload/validate", json={"manifest": manifest})

        body = resp.json()
        assert body["valid"] is False
        # [0] 에러는 있고, [1]은 없어야
        idx0_errors = [e for e in body["errors"] if e.startswith("[0]")]
        idx1_errors = [e for e in body["errors"] if e.startswith("[1]")]
        assert len(idx0_errors) > 0
        assert len(idx1_errors) == 0


# ==========================================================================
# POST /api/upload/register — mock 기반
# ==========================================================================

class TestUploadRegister:
    """STAC Item 등록 (S3 + STAC API mock)."""

    @patch("sams.routers.upload._register_stac_item", new_callable=AsyncMock)
    def test_register_creates_item(self, mock_register):
        """등록 요청 → item_id 반환."""
        mock_register.return_value = None

        req = {
            "collection_id": "test-project",
            "items": [{
                "data_category": "document",
                "description": "테스트 문서",
            }],
            "status": "draft",
        }

        resp = client.post("/api/upload/register", json=req)

        assert resp.status_code == 200
        body = resp.json()
        assert body["registered"] == 1
        assert len(body["item_ids"]) == 1
        assert "test-project" in body["item_ids"][0]
        assert mock_register.called

    @patch("sams.routers.upload._register_stac_item", new_callable=AsyncMock)
    def test_register_stac_failure_reported(self, mock_register):
        """STAC 등록 실패 → errors에 기록, 다른 Item은 계속 진행."""
        mock_register.side_effect = [
            RuntimeError("STAC 오류"),
            None,
        ]

        req = {
            "collection_id": "test-project",
            "items": [
                {"data_category": "pointcloud"},
                {"data_category": "document"},
            ],
        }

        resp = client.post("/api/upload/register", json=req)

        body = resp.json()
        assert body["registered"] == 1  # 두 번째만 성공
        assert len(body["errors"]) == 1
        assert "STAC" in body["errors"][0] or "등록 실패" in body["errors"][0]
