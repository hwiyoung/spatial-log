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
# GET /api/upload/policy
# ==========================================================================

class TestUploadPolicy:
    """프론트가 사용하는 업로드 정책."""

    def test_policy_returns_runtime_limits(self):
        resp = client.get("/api/upload/policy")

        assert resp.status_code == 200
        body = resp.json()
        assert body["max_upload_bytes"] > body["warn_upload_bytes"] > 0
        assert body["large_file_threshold_bytes"] == 100 * 1024 * 1024
        assert body["multipart_part_size_bytes"] >= 64 * 1024 * 1024
        assert body["multipart_max_parts"] == 10000


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
    def test_register_does_not_persist_ontology_annotation(self, mock_register):
        """ontology dry-run annotation은 STAC properties로 저장하지 않는다."""
        mock_register.return_value = None

        req = {
            "collection_id": "test-project",
            "items": [{
                "data_category": "pointcloud",
                "description": "테스트 포인트클라우드",
                "ontology": {"target_concept": "bulguksa_dabotap"},
            }],
            "status": "draft",
        }

        resp = client.post("/api/upload/register", json=req)

        assert resp.status_code == 200
        stac_item = mock_register.call_args.args[1]
        assert "ontology" not in stac_item["properties"]

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


class TestRegisterAcceptedLinks:
    """수락된 관계 제안(_accepted_links, manifest 인덱스) → 양방향 STAC links 생성."""

    @patch("sams.routers.items._pgstac_update_item", new_callable=AsyncMock)
    @patch("sams.services.stac.get_item", new_callable=AsyncMock)
    @patch("sams.routers.upload._register_stac_item", new_callable=AsyncMock)
    def test_accepted_links_created_bidirectionally(self, mock_register, mock_get, mock_update):
        mock_register.return_value = None
        # 링크 생성 단계에서 조회되는 Item — 등록 직후라 links 비어 있음
        mock_get.side_effect = lambda col, iid: {
            "type": "Feature", "id": iid, "collection": col,
            "properties": {}, "links": [], "assets": {},
        }

        req = {
            "collection_id": "test-project",
            "items": [
                {
                    "data_category": "image",
                    "_manifest_idx": 0,
                    # related 은 유효, prev 는 업로드 제안 허용 목록 밖 → 무시
                    "_accepted_links": [
                        {"target_idx": 1, "rel": "related"},
                        {"target_idx": 1, "rel": "prev"},
                        {"target_idx": 99, "rel": "related"},   # 미등록 인덱스 → 무시
                    ],
                },
                {"data_category": "document", "_manifest_idx": 1},
            ],
            "status": "draft",
        }

        resp = client.post("/api/upload/register", json=req)
        body = resp.json()
        assert resp.status_code == 200
        assert body["registered"] == 2
        id0, id1 = body["item_ids"]

        # 소스·타겟 각각 1회씩 링크 갱신
        assert mock_update.call_count == 2
        updated = {call.args[1]: call.args[2] for call in mock_update.call_args_list}
        assert set(updated.keys()) == {id0, id1}
        src_links = updated[id0]["links"]
        tgt_links = updated[id1]["links"]
        assert {"rel": "related", "href": f"./{id1}", "type": "application/geo+json"} in src_links
        assert {"rel": "related", "href": f"./{id0}", "type": "application/geo+json"} in tgt_links
        # prev(허용 외)·idx 99(미등록) 는 만들어지지 않음
        assert all(l["rel"] == "related" for l in src_links)

    @patch("sams.routers.items._pgstac_update_item", new_callable=AsyncMock)
    @patch("sams.services.stac.get_item", new_callable=AsyncMock)
    @patch("sams.routers.upload._register_stac_item", new_callable=AsyncMock)
    def test_excluded_target_not_linked(self, mock_register, mock_get, mock_update):
        """대상 항목이 등록 실패하면 해당 링크는 건너뛴다 (등록은 유지)."""
        mock_register.side_effect = [None, RuntimeError("등록 실패")]
        mock_get.side_effect = lambda col, iid: {
            "type": "Feature", "id": iid, "collection": col,
            "properties": {}, "links": [], "assets": {},
        }

        req = {
            "collection_id": "test-project",
            "items": [
                {"data_category": "image", "_manifest_idx": 0,
                 "_accepted_links": [{"target_idx": 1, "rel": "related"}]},
                {"data_category": "document", "_manifest_idx": 1},
            ],
        }

        resp = client.post("/api/upload/register", json=req)
        body = resp.json()
        assert body["registered"] == 1
        assert mock_update.call_count == 0   # 타겟 미등록 → 링크 생성 없음


class TestPresignedFlow:
    """대용량 직접 업로드 — presigned URL 발급 / 완료 통지 검증."""

    @patch("sams.routers.upload.generate_put_url")
    def test_presigned_url_issued(self, mock_url):
        mock_url.return_value = "http://minio.example/put?sig=x"
        resp = client.get("/api/upload/presigned-url", params={"filename": "scan.las", "session_id": "abcdef123456"})
        assert resp.status_code == 200
        body = resp.json()
        assert body["staging_key"] == "_staging/abcdef123456/scan.las"
        assert body["url"].startswith("http")
        assert body["session_id"] == "abcdef123456"

    def test_presigned_url_rejects_traversal(self):
        for bad in ["../etc/passwd", "/abs/path.las", "a/../../b.las"]:
            resp = client.get("/api/upload/presigned-url", params={"filename": bad, "session_id": "abcdef123456"})
            assert resp.status_code == 400, bad

    def test_upload_complete_rejects_foreign_staging_key(self):
        """다른 세션의 staging_key 를 가리키면 400 — 세션 경계 강제."""
        resp = client.post("/api/upload/upload-complete", json={
            "session_id": "abcdef123456",
            "staging_key": "_staging/othersession/scan.las",
            "filename": "scan.las",
        })
        assert resp.status_code == 400

    @patch("sams.routers.upload.object_size")
    def test_upload_complete_missing_object_404(self, mock_size):
        mock_size.return_value = None
        resp = client.post("/api/upload/upload-complete", json={
            "session_id": "abcdef123456",
            "staging_key": "_staging/abcdef123456/scan.las",
            "filename": "scan.las",
        })
        assert resp.status_code == 404

    @patch("sams.routers.upload.record_staged_upload")
    @patch("sams.routers.upload.object_size")
    def test_upload_complete_records_staging(self, mock_size, mock_record):
        mock_size.return_value = 123456789
        resp = client.post("/api/upload/upload-complete", json={
            "session_id": "abcdef123456",
            "staging_key": "_staging/abcdef123456/scan.las",
            "filename": "scan.las",
        })
        assert resp.status_code == 200
        assert resp.json()["size"] == 123456789
        mock_record.assert_called_once_with(
            "abcdef123456",
            "scan.las",
            "_staging/abcdef123456/scan.las",
            123456789,
        )

    @patch("sams.routers.upload.object_size")
    def test_upload_complete_rejects_size_mismatch(self, mock_size):
        mock_size.return_value = 123
        resp = client.post("/api/upload/upload-complete", json={
            "session_id": "abcdef123456",
            "staging_key": "_staging/abcdef123456/scan.las",
            "filename": "scan.las",
            "size": 124,
        })
        assert resp.status_code == 400

    @patch("sams.worker.analyze_session_task.delay")
    def test_analyze_async_enqueues_task(self, mock_delay):
        mock_delay.return_value.id = "task-123"
        files = [("files", ("scan.laz", io.BytesIO(b"\x00" * 10), "application/octet-stream"))]
        resp = client.post(
            "/api/upload/analyze-async",
            files=files,
            data={"session_id": "abcdef123456", "collection_id": ""},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "queued"
        assert body["session_id"] == "abcdef123456"
        assert body["task_id"] == "task-123"
        mock_delay.assert_called_once()

    @patch("sams.routers.upload.initiate_multipart_upload")
    def test_multipart_initiate(self, mock_init):
        mock_init.return_value = "upload-123"
        resp = client.post("/api/upload/multipart/initiate", json={
            "session_id": "abcdef123456",
            "filename": "scan.las",
            "size": 150 * 1024 * 1024,
            "content_type": "application/octet-stream",
        })
        assert resp.status_code == 200
        body = resp.json()
        assert body["staging_key"] == "_staging/abcdef123456/scan.las"
        assert body["upload_id"] == "upload-123"
        assert body["part_size"] >= 64 * 1024 * 1024
        assert body["part_count"] == 3

    def test_multipart_initiate_requires_size(self):
        resp = client.post("/api/upload/multipart/initiate", json={
            "session_id": "abcdef123456",
            "filename": "scan.las",
            "content_type": "application/octet-stream",
        })
        assert resp.status_code == 400

    @patch("sams.routers.upload.settings.MAX_UPLOAD_BYTES", 10)
    def test_multipart_initiate_rejects_oversize(self):
        resp = client.post("/api/upload/multipart/initiate", json={
            "session_id": "abcdef123456",
            "filename": "scan.las",
            "size": 11,
            "content_type": "application/octet-stream",
        })
        assert resp.status_code == 413

    @patch("sams.routers.upload.generate_upload_part_url")
    @patch("sams.routers.upload.get_multipart_upload")
    def test_multipart_part_url_issued(self, mock_get_upload, mock_url):
        mock_get_upload.return_value = {
            "status": "open",
            "staging_key": "_staging/abcdef123456/scan.las",
            "upload_id": "upload-123",
            "expected_size": 150 * 1024 * 1024,
        }
        mock_url.return_value = "http://minio.example/part?sig=x"
        resp = client.post("/api/upload/multipart/part-url", json={
            "session_id": "abcdef123456",
            "staging_key": "_staging/abcdef123456/scan.las",
            "upload_id": "upload-123",
            "part_number": 2,
        })
        assert resp.status_code == 200
        body = resp.json()
        assert body["url"].startswith("http")
        assert body["part_number"] == 2

    def test_multipart_part_url_rejects_foreign_staging_key(self):
        resp = client.post("/api/upload/multipart/part-url", json={
            "session_id": "abcdef123456",
            "staging_key": "_staging/other/scan.las",
            "upload_id": "upload-123",
            "part_number": 1,
        })
        assert resp.status_code == 400

    @patch("sams.routers.upload.record_staged_upload")
    @patch("sams.routers.upload.object_size")
    @patch("sams.routers.upload.get_multipart_upload")
    @patch("sams.routers.upload.complete_multipart_upload")
    def test_multipart_complete_records_staging(self, mock_complete, mock_get_upload, mock_size, mock_record):
        mock_complete.return_value = None
        mock_get_upload.return_value = {
            "status": "open",
            "staging_key": "_staging/abcdef123456/scan.las",
            "upload_id": "upload-123",
            "expected_size": 150 * 1024 * 1024,
        }
        mock_size.return_value = 150 * 1024 * 1024
        resp = client.post("/api/upload/multipart/complete", json={
            "session_id": "abcdef123456",
            "staging_key": "_staging/abcdef123456/scan.las",
            "filename": "scan.las",
            "upload_id": "upload-123",
            "parts": [
                {"part_number": 1, "etag": '"etag-1"'},
                {"part_number": 2, "etag": '"etag-2"'},
            ],
        })
        assert resp.status_code == 200
        assert resp.json()["size"] == 150 * 1024 * 1024
        mock_complete.assert_called_once()
        mock_record.assert_called_once_with(
            "abcdef123456",
            "scan.las",
            "_staging/abcdef123456/scan.las",
            150 * 1024 * 1024,
        )

    @patch("sams.routers.upload.object_size")
    @patch("sams.routers.upload.get_multipart_upload")
    @patch("sams.routers.upload.complete_multipart_upload")
    def test_multipart_complete_rejects_size_mismatch(self, mock_complete, mock_get_upload, mock_size):
        mock_complete.return_value = None
        mock_get_upload.return_value = {
            "status": "open",
            "staging_key": "_staging/abcdef123456/scan.las",
            "upload_id": "upload-123",
            "expected_size": 10,
        }
        mock_size.return_value = 11
        resp = client.post("/api/upload/multipart/complete", json={
            "session_id": "abcdef123456",
            "staging_key": "_staging/abcdef123456/scan.las",
            "filename": "scan.las",
            "upload_id": "upload-123",
            "parts": [{"part_number": 1, "etag": '"etag-1"'}],
        })
        assert resp.status_code == 400

    def test_multipart_complete_rejects_duplicate_parts(self):
        resp = client.post("/api/upload/multipart/complete", json={
            "session_id": "abcdef123456",
            "staging_key": "_staging/abcdef123456/scan.las",
            "filename": "scan.las",
            "upload_id": "upload-123",
            "parts": [
                {"part_number": 1, "etag": '"etag-1"'},
                {"part_number": 1, "etag": '"etag-dup"'},
            ],
        })
        assert resp.status_code == 400

    @patch("sams.routers.upload.abort_multipart_upload")
    def test_multipart_abort(self, mock_abort):
        resp = client.post("/api/upload/multipart/abort", json={
            "session_id": "abcdef123456",
            "staging_key": "_staging/abcdef123456/scan.las",
            "upload_id": "upload-123",
        })
        assert resp.status_code == 200
        assert resp.json()["ok"] is True
        mock_abort.assert_called_once()
