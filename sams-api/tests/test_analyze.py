"""
Tests for pipeline analyze() — 파이프라인 통합 함수

bundle → detect → extract → inherit → suggest 전체 흐름 검증.
실제 파일 없이 mock 기반으로 각 단계 연결을 확인.

참조: docs/system_architecture.md 섹션 3.2
"""

import tempfile
import os
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest

from sams.pipeline import analyze
from sams.models.manifest import Manifest, ManifestItem, MetadataValue


# ==========================================================================
# 헬퍼: 임시 파일 생성
# ==========================================================================

def _create_temp_files(tmpdir: str, names: list[str]) -> list[str]:
    """임시 디렉토리에 빈 파일들을 생성하고 경로를 반환."""
    paths = []
    for name in names:
        p = os.path.join(tmpdir, name)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        Path(p).touch()
        paths.append(p)
    return paths


# ==========================================================================
# analyze() — 기본 동작
# ==========================================================================

class TestAnalyzeBasic:
    """analyze 기본 동작."""

    def test_empty_files_returns_empty_manifest(self):
        result = analyze([], None)
        assert isinstance(result, Manifest)
        assert result.manifest == []
        assert result.summary.total_files == 0

    def test_single_file_returns_one_item(self, tmp_path):
        """단일 파일 → ManifestItem 1개."""
        laz = tmp_path / "scan.laz"
        laz.write_bytes(b"\x00" * 100)

        result = analyze([str(laz)], None)

        assert len(result.manifest) == 1
        item = result.manifest[0]
        assert item.file_path == str(laz)
        assert item.detected_category == "pointcloud"
        assert item.category_confidence == 1.0
        assert result.summary.total_files == 1
        assert result.summary.detected_types.get("pointcloud") == 1

    def test_multiple_types_detected(self, tmp_path):
        """여러 유형 파일 → 각각 올바른 category."""
        laz = tmp_path / "scan.laz"
        pdf = tmp_path / "report.pdf"
        mp4 = tmp_path / "flight.mp4"
        for f in [laz, pdf, mp4]:
            f.write_bytes(b"\x00" * 10)

        result = analyze([str(laz), str(pdf), str(mp4)], None)

        assert len(result.manifest) == 3
        categories = {item.detected_category for item in result.manifest}
        assert categories == {"pointcloud", "document", "video"}
        assert result.summary.detected_types["pointcloud"] == 1
        assert result.summary.detected_types["document"] == 1
        assert result.summary.detected_types["video"] == 1


# ==========================================================================
# analyze() — Collection 상속
# ==========================================================================

class TestAnalyzeInherit:
    """Collection 기본값 상속 통합."""

    def test_collection_defaults_inherited(self, tmp_path):
        """Collection 기본값이 inherited에 반영."""
        laz = tmp_path / "scan.laz"
        laz.write_bytes(b"\x00" * 100)

        collection = {
            "id": "proj-001",
            "title": "다보탑 보수",
            "project:site": "경주",
            "project:default_epsg": 5186,
            "license": "proprietary",
        }

        result = analyze([str(laz)], collection)
        item = result.manifest[0]

        # inherited에 Collection 값이 있어야 함
        assert "project:name" in item.inherited
        assert item.inherited["project:name"].value == "다보탑 보수"
        assert item.inherited["project:name"].source == "collection_default"

        assert "project:site" in item.inherited
        assert item.inherited["project:site"].value == "경주"

    def test_no_collection_no_inherited(self, tmp_path):
        """Collection 없으면 inherited 비어있음."""
        laz = tmp_path / "scan.laz"
        laz.write_bytes(b"\x00" * 100)

        result = analyze([str(laz)], None)
        item = result.manifest[0]

        assert len(item.inherited) == 0


# ==========================================================================
# analyze() — 관계 제안
# ==========================================================================

class TestAnalyzeSuggest:
    """관계 자동 제안 통합."""

    def test_same_target_derives_suggestion(self, tmp_path):
        """같은 target의 PC + 3D Model → derived_from 제안."""
        laz = tmp_path / "dabotap_scan.laz"
        obj = tmp_path / "dabotap_model.obj"
        laz.write_bytes(b"\x00" * 10)
        obj.write_text("# empty obj")

        result = analyze([str(laz), str(obj)], None)

        # 적어도 하나의 suggested_link가 있어야
        all_links = []
        for item in result.manifest:
            all_links.extend(item.suggested_links)

        derived = [l for l in all_links if l.rel == "derived_from"]
        assert len(derived) >= 1

    def test_document_describedby(self, tmp_path):
        """document는 describedby 제안."""
        laz = tmp_path / "scan.laz"
        pdf = tmp_path / "report.pdf"
        laz.write_bytes(b"\x00" * 10)
        pdf.write_bytes(b"\x00" * 10)

        result = analyze([str(laz), str(pdf)], None)

        all_links = []
        for item in result.manifest:
            all_links.extend(item.suggested_links)

        desc = [l for l in all_links if l.rel == "describedby"]
        assert len(desc) >= 1


# ==========================================================================
# analyze() — 필수 빈 필드
# ==========================================================================

class TestAnalyzeRequiredEmpty:
    """필수 빈 필드 계산."""

    def test_required_empty_includes_datetime(self, tmp_path):
        """datetime은 PC에서 자동 추출 불가 → required_empty에 포함."""
        laz = tmp_path / "scan.laz"
        laz.write_bytes(b"\x00" * 100)

        result = analyze([str(laz)], None)
        item = result.manifest[0]

        assert "datetime" in item.required_empty

    def test_required_empty_includes_description(self, tmp_path):
        """description은 항상 수동 → required_empty에 포함."""
        laz = tmp_path / "scan.laz"
        laz.write_bytes(b"\x00" * 100)

        result = analyze([str(laz)], None)
        item = result.manifest[0]

        assert "description" in item.required_empty

    def test_collection_reduces_required_empty(self, tmp_path):
        """Collection 상속으로 일부 필수 필드가 채워지면 required_empty에서 빠짐."""
        laz = tmp_path / "scan.laz"
        laz.write_bytes(b"\x00" * 100)

        collection = {
            "id": "proj-001",
            "title": "테스트",
            "project:site": "경주",
            "project:default_epsg": 5186,
        }

        result_without = analyze([str(laz)], None)
        result_with = analyze([str(laz)], collection)

        # Collection 있을 때 required_empty가 더 적어야
        assert len(result_with.manifest[0].required_empty) < len(result_without.manifest[0].required_empty)


# ==========================================================================
# analyze() — 번들 파일
# ==========================================================================

class TestAnalyzeBundle:
    """번들 파일 통합."""

    def test_obj_bundle_grouped(self, tmp_path):
        """OBJ + MTL → 하나의 ManifestItem으로 묶임."""
        obj = tmp_path / "model.obj"
        mtl = tmp_path / "model.mtl"
        obj.write_text("mtllib model.mtl\nv 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n")
        mtl.write_text("newmtl default\nKd 1 1 1\n")

        result = analyze([str(obj), str(mtl)], None)

        # 번들로 묶이면 ManifestItem 1개
        assert len(result.manifest) == 1
        item = result.manifest[0]
        assert item.file_path == str(obj)
        assert item.bundled_files is not None
        assert str(mtl) in item.bundled_files


# ==========================================================================
# analyze() — 요약 (summary)
# ==========================================================================

class TestAnalyzeSummary:
    """ManifestSummary 생성."""

    def test_summary_counts(self, tmp_path):
        """요약의 total_files, detected_types 정확성."""
        files = []
        for name in ["a.laz", "b.laz", "c.pdf"]:
            f = tmp_path / name
            f.write_bytes(b"\x00" * 10)
            files.append(str(f))

        result = analyze(files, None)

        assert result.summary.total_files == 3
        assert result.summary.detected_types["pointcloud"] == 2
        assert result.summary.detected_types["document"] == 1

    def test_auto_filled_percentage(self, tmp_path):
        """auto_filled_percentage가 0~100 범위."""
        laz = tmp_path / "scan.laz"
        laz.write_bytes(b"\x00" * 100)

        result = analyze([str(laz)], None)
        pct = result.summary.auto_filled_percentage

        assert 0.0 <= pct <= 100.0

    def test_manual_required_fields_count(self, tmp_path):
        """manual_required_fields가 required_empty 합산."""
        files = []
        for name in ["a.laz", "b.pdf"]:
            f = tmp_path / name
            f.write_bytes(b"\x00" * 10)
            files.append(str(f))

        result = analyze(files, None)

        expected = sum(len(item.required_empty) for item in result.manifest)
        assert result.summary.manual_required_fields == expected


# ==========================================================================
# analyze() — Graceful degradation
# ==========================================================================

class TestAnalyzeGraceful:
    """실패 시 graceful degradation."""

    def test_nonexistent_file_still_returns_manifest(self, tmp_path):
        """존재하지 않는 파일도 매니페스트에 포함 (extract 실패해도)."""
        fake = str(tmp_path / "nonexistent.laz")

        result = analyze([fake], None)

        assert len(result.manifest) == 1
        item = result.manifest[0]
        assert item.detected_category == "pointcloud"
        # warnings에 실패 메시지가 있을 수 있음

    def test_unknown_extension(self, tmp_path):
        """알 수 없는 확장자 → unknown category."""
        f = tmp_path / "data.xyz123"
        f.write_bytes(b"\x00" * 10)

        result = analyze([str(f)], None)

        assert result.manifest[0].detected_category == "unknown"
