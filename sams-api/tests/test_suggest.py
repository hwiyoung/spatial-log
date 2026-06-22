"""
Tests for pipeline suggest.py — 관계 자동 제안

참조: docs/autofill_pipeline_spec.md 섹션 6
"""

import pytest

from sams.pipeline.suggest import (
    suggest_links,
    BatchItem,
    SuggestedLink,
    _extract_keyword,
    _resolve_target_key,
    _build_target_groups,
)


# ==========================================================================
# _extract_keyword
# ==========================================================================

class TestExtractKeyword:
    """파일명에서 키워드 추출."""

    def test_simple_name(self):
        assert _extract_keyword("dabotap_scan_01") == "dabotap"

    def test_removes_type_suffix(self):
        assert _extract_keyword("building_pc") == "building"

    def test_removes_number_suffix(self):
        assert _extract_keyword("dabotap_123") == "dabotap"

    def test_too_short_returns_none(self):
        assert _extract_keyword("a") is None

    def test_number_only_returns_none(self):
        assert _extract_keyword("001") is None

    def test_model_suffix(self):
        assert _extract_keyword("dabotap_model") == "dabotap"

    def test_no_suffix(self):
        assert _extract_keyword("dabotap") == "dabotap"

    def test_complex_name(self):
        result = _extract_keyword("site_a_building_scan_02")
        assert result is not None
        assert "site_a_building" in result


# ==========================================================================
# _resolve_target_key
# ==========================================================================

class TestResolveTargetKey:
    """target 키 결정."""

    def test_user_target_takes_priority(self):
        item = BatchItem(0, "/data/dabotap.laz", "pointcloud", target="다보탑")
        assert _resolve_target_key(item) == ("다보탑", "user")

    def test_filename_keyword(self):
        item = BatchItem(0, "/data/dabotap_scan.laz", "pointcloud")
        assert _resolve_target_key(item) == ("dabotap", "filename")

    def test_folder_name_fallback(self):
        item = BatchItem(0, "/data/dabotap/scan_001.laz", "pointcloud")
        assert _resolve_target_key(item) == ("dabotap", "folder")

    def test_category_folder_ignored(self):
        """유형 폴더명은 target으로 사용하지 않는다."""
        item = BatchItem(0, "/data/pointcloud/001.laz", "pointcloud")
        # "pointcloud"는 무시, "001"은 너무 짧아 None
        key, _source = _resolve_target_key(item)
        assert key != "pointcloud"


# ==========================================================================
# suggest_links — 유형 계보 (derived_from)
# ==========================================================================

class TestSuggestDerivations:
    """유형 계보 기반 derived_from 제안."""

    def test_pc_to_3dmodel(self):
        """같은 target의 PC → 3D Model은 derived_from 제안."""
        items = [
            BatchItem(0, "/data/dabotap_scan.laz", "pointcloud"),
            BatchItem(1, "/data/dabotap_model.obj", "3d_model"),
        ]
        links = suggest_links(items)

        derived = [l for l in links if l.rel_type == "derived_from"]
        assert len(derived) >= 1
        # 3D Model이 PC에서 파생
        d = derived[0]
        assert d.source_idx == 1  # 3d_model
        assert d.target_idx == 0  # pointcloud
        assert d.confidence == pytest.approx(0.7)

    def test_image_to_3dmodel(self):
        """Image → 3D Model도 derived_from."""
        items = [
            BatchItem(0, "/data/dabotap_photo.jpg", "image"),
            BatchItem(1, "/data/dabotap_mesh.obj", "3d_model"),
        ]
        links = suggest_links(items)

        derived = [l for l in links if l.rel_type == "derived_from"]
        assert len(derived) >= 1

    def test_3dmodel_to_3dtiles(self):
        """3D Model → 3D Tiles도 derived_from."""
        items = [
            BatchItem(0, "/data/dabotap.obj", "3d_model"),
            BatchItem(1, "/data/dabotap/tileset.json", "3d_tiles"),
        ]
        links = suggest_links(items)

        derived = [l for l in links if l.rel_type == "derived_from"]
        assert len(derived) >= 1


# ==========================================================================
# suggest_links — 같은 target 다른 유형 (related)
# ==========================================================================

class TestSuggestRelated:
    """같은 target 다른 유형 → related 제안."""

    def test_ortho_and_video_related(self):
        """정사영상과 동영상은 related."""
        items = [
            BatchItem(0, "/data/dabotap_ortho.tif", "orthoimage"),
            BatchItem(1, "/data/dabotap_flight.mp4", "video"),
        ]
        links = suggest_links(items)

        related = [l for l in links if l.rel_type == "related"]
        assert len(related) >= 1
        assert related[0].confidence == pytest.approx(0.8)


# ==========================================================================
# suggest_links — document describedby
# ==========================================================================

class TestSuggestDescribedby:
    """document → describedby 제안."""

    def test_document_describedby(self):
        """문서는 다른 아이템에 describedby로 연결."""
        items = [
            BatchItem(0, "/data/scan.laz", "pointcloud"),
            BatchItem(1, "/data/report.pdf", "document"),
        ]
        links = suggest_links(items)

        desc = [l for l in links if l.rel_type == "describedby"]
        assert len(desc) >= 1
        d = desc[0]
        assert d.source_idx == 0  # pointcloud가 source
        assert d.target_idx == 1  # document가 target
        assert d.confidence == pytest.approx(0.5)


# ==========================================================================
# suggest_links — 엣지 케이스
# ==========================================================================

class TestSuggestEdgeCases:
    """엣지 케이스."""

    def test_single_item_no_suggestions(self):
        """아이템이 1개면 제안 없음."""
        items = [BatchItem(0, "/data/scan.laz", "pointcloud")]
        assert suggest_links(items) == []

    def test_empty_list_no_suggestions(self):
        assert suggest_links([]) == []

    def test_same_category_no_related(self):
        """같은 유형끼리는 related 제안하지 않음."""
        items = [
            BatchItem(0, "/data/dabotap_01.laz", "pointcloud"),
            BatchItem(1, "/data/dabotap_02.laz", "pointcloud"),
        ]
        links = suggest_links(items)
        related = [l for l in links if l.rel_type == "related"]
        assert len(related) == 0

    def test_no_duplicates(self):
        """같은 쌍에 대해 중복 제안이 없다."""
        items = [
            BatchItem(0, "/data/dabotap_scan.laz", "pointcloud"),
            BatchItem(1, "/data/dabotap_model.obj", "3d_model"),
        ]
        links = suggest_links(items)
        pairs = [(l.source_idx, l.target_idx) for l in links]
        assert len(pairs) == len(set(pairs))

    def test_different_targets_no_link(self):
        """다른 target의 아이템 간에는 유형 계보 제안이 없다."""
        items = [
            BatchItem(0, "/data/dabotap_scan.laz", "pointcloud", target="다보탑"),
            BatchItem(1, "/data/bulguksa_model.obj", "3d_model", target="불국사"),
        ]
        links = suggest_links(items)
        derived = [l for l in links if l.rel_type == "derived_from"]
        assert len(derived) == 0

    def test_multiple_derivation_chain(self):
        """PC → 3D Model → 3D Tiles 전체 계보."""
        items = [
            BatchItem(0, "/data/dabotap_scan.laz", "pointcloud"),
            BatchItem(1, "/data/dabotap.obj", "3d_model"),
            BatchItem(2, "/data/dabotap/tileset.json", "3d_tiles"),
        ]
        links = suggest_links(items)
        derived = [l for l in links if l.rel_type == "derived_from"]
        # PC→3DModel, 3DModel→3DTiles 두 개
        assert len(derived) >= 2


# ==========================================================================
# target 판정 근거별 confidence 보정
# ==========================================================================

class TestConfidenceBasis:
    """사용자 입력 target 은 가산, 폴더명 추정은 감산."""

    def test_user_target_boosts_confidence(self):
        items = [
            BatchItem(0, "/data/a.tif", "orthoimage", target="다보탑"),
            BatchItem(1, "/data/b.mp4", "video", target="다보탑"),
        ]
        links = suggest_links(items)
        related = [l for l in links if l.rel_type == "related"]
        assert len(related) == 1
        assert related[0].confidence == pytest.approx(0.95)   # 0.8 + 0.15
        assert "사용자 입력" in related[0].reason

    def test_folder_basis_lowers_confidence(self):
        items = [
            BatchItem(0, "/data/dabotap/001.tif", "orthoimage"),
            BatchItem(1, "/data/dabotap/002.mp4", "video"),
        ]
        links = suggest_links(items)
        related = [l for l in links if l.rel_type == "related"]
        assert len(related) == 1
        assert related[0].confidence == pytest.approx(0.7)    # 0.8 - 0.1
        assert "폴더명" in related[0].reason

    def test_mixed_basis_uses_weakest(self):
        """한쪽이 폴더 추정이면 쌍 전체가 약한 근거를 따른다."""
        items = [
            BatchItem(0, "/data/x/dabotap_scan.laz", "pointcloud"),   # filename → 'dabotap'
            BatchItem(1, "/data/dabotap/001.obj", "3d_model"),        # 숫자 stem → folder → 'dabotap'
        ]
        links = suggest_links(items)
        derived = [l for l in links if l.rel_type == "derived_from"]
        assert len(derived) == 1
        assert derived[0].confidence == pytest.approx(0.6)   # 0.7 - 0.1
        assert "폴더명" in derived[0].reason

    def test_suggestions_order_independent(self):
        """배치 내 파일 순서가 바뀌어도 같은 제안 집합이 나온다 (무방향 dedup)."""
        a = [
            BatchItem(0, "/data/dabotap_report.pdf", "document"),
            BatchItem(1, "/data/dabotap_ortho.tif", "orthoimage"),
        ]
        b = [
            BatchItem(0, "/data/dabotap_ortho.tif", "orthoimage"),
            BatchItem(1, "/data/dabotap_report.pdf", "document"),
        ]
        rels_a = sorted(l.rel_type for l in suggest_links(a))
        rels_b = sorted(l.rel_type for l in suggest_links(b))
        assert rels_a == rels_b
