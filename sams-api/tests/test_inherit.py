"""
Tests for pipeline inherit.py — Collection 기본값 상속

참조: docs/autofill_pipeline_spec.md 섹션 5
"""

import pytest

from sams.pipeline.inherit import apply_collection_defaults, _is_empty


# ==========================================================================
# _is_empty 헬퍼
# ==========================================================================

class TestIsEmpty:
    def test_none_is_empty(self):
        assert _is_empty(None) is True

    def test_empty_string_is_empty(self):
        assert _is_empty("") is True

    def test_whitespace_is_empty(self):
        assert _is_empty("  ") is True

    def test_zero_is_not_empty(self):
        assert _is_empty(0) is False

    def test_string_is_not_empty(self):
        assert _is_empty("value") is False

    def test_list_is_not_empty(self):
        assert _is_empty([]) is False  # 빈 리스트는 유효한 값


# ==========================================================================
# apply_collection_defaults
# ==========================================================================

class TestApplyCollectionDefaults:
    """Collection 기본값 상속 테스트."""

    def test_no_collection_returns_extracted_with_sources(self):
        """Collection이 없으면 추출값만 반환, source는 file."""
        extracted = {"proj:epsg": 5186, "file:size": 1024}
        result = apply_collection_defaults(extracted, None)

        assert result["proj:epsg"] == 5186
        assert result["_sources"]["proj:epsg"] == "file"

    def test_collection_fills_empty_fields(self):
        """추출값이 없는 필드에 Collection 기본값이 채워진다."""
        extracted = {"file:size": 1024}
        collection = {
            "id": "proj-001",
            "title": "다보탑 보수",
            "project:site": "경주",
            "project:default_epsg": 5186,
            "license": "proprietary",
        }
        result = apply_collection_defaults(extracted, collection)

        assert result["collection"] == "proj-001"
        assert result["project:name"] == "다보탑 보수"
        assert result["project:site"] == "경주"
        assert result["proj:epsg"] == 5186
        assert result["license"] == "proprietary"

        # source 태그 확인
        assert result["_sources"]["collection"] == "collection_default"
        assert result["_sources"]["project:name"] == "collection_default"
        assert result["_sources"]["proj:epsg"] == "collection_default"

    def test_file_value_takes_priority(self):
        """파일 추출값 > Collection 기본값."""
        extracted = {"proj:epsg": 4326, "file:size": 1024}
        collection = {"project:default_epsg": 5186}
        result = apply_collection_defaults(extracted, collection)

        # 파일에서 추출한 4326이 유지
        assert result["proj:epsg"] == 4326
        assert result["_sources"]["proj:epsg"] == "file"

    def test_empty_string_is_overwritten(self):
        """빈 문자열은 비어있는 것으로 간주, Collection 값으로 덮어쓴다."""
        extracted = {"project:name": "", "file:size": 100}
        collection = {"title": "신규 프로젝트"}
        result = apply_collection_defaults(extracted, collection)

        assert result["project:name"] == "신규 프로젝트"
        assert result["_sources"]["project:name"] == "collection_default"

    def test_none_value_is_overwritten(self):
        """None은 비어있는 것으로 간주."""
        extracted = {"proj:epsg": None}
        collection = {"project:default_epsg": 5186}
        result = apply_collection_defaults(extracted, collection)

        assert result["proj:epsg"] == 5186
        assert result["_sources"]["proj:epsg"] == "collection_default"

    def test_zero_value_is_preserved(self):
        """0은 유효한 값으로 간주, 덮어쓰지 않는다."""
        extracted = {"proj:epsg": 0}
        collection = {"project:default_epsg": 5186}
        result = apply_collection_defaults(extracted, collection)

        assert result["proj:epsg"] == 0

    def test_original_not_mutated(self):
        """원본 dict를 변경하지 않는다."""
        extracted = {"file:size": 1024}
        collection = {"title": "테스트"}
        original_keys = set(extracted.keys())

        apply_collection_defaults(extracted, collection)

        assert set(extracted.keys()) == original_keys

    def test_partial_collection(self):
        """Collection에 일부 필드만 있어도 정상 동작."""
        extracted = {"file:size": 1024}
        collection = {"id": "proj-002"}
        result = apply_collection_defaults(extracted, collection)

        assert result["collection"] == "proj-002"
        assert "project:name" not in result  # title이 없으므로

    def test_existing_sources_preserved(self):
        """이미 _sources가 있으면 유지하면서 추가."""
        extracted = {
            "proj:epsg": 4326,
            "_sources": {"proj:epsg": "file"},
        }
        collection = {"title": "테스트"}
        result = apply_collection_defaults(extracted, collection)

        assert result["_sources"]["proj:epsg"] == "file"
        assert result["_sources"]["project:name"] == "collection_default"
