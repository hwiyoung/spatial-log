"""
Tests for pipeline detect.py — 파일 유형 자동 판별

참조: docs/autofill_pipeline_spec.md 섹션 3
"""

import pytest
from pathlib import Path
import zipfile

from sams.pipeline.detect import detect_category, DetectionResult, VALID_CATEGORIES

FIXTURES = Path(__file__).parent / "fixtures"


class TestExtensionMapping:
    """확장자 기반 직접 매핑 테스트."""

    @pytest.mark.parametrize("filename,expected", [
        ("sample.las", "pointcloud"),
        ("sample.laz", "pointcloud"),
        ("sample.e57", "pointcloud"),
        ("sample.pcd", "pointcloud"),
        ("sample.obj", "3d_model"),
        ("sample.fbx", "3d_model"),
        ("sample.glb", "3d_model"),
        ("sample.stl", "3d_model"),
        ("sample.mp4", "video"),
        ("sample.mov", "video"),
        ("sample.pdf", "document"),
        ("sample.docx", "document"),
        ("sample.hwp", "document"),
    ])
    def test_direct_mapping(self, filename, expected):
        result = detect_category(FIXTURES / filename)
        assert result.category == expected
        assert result.confidence == 1.0
        assert result.warning is None

    def test_case_insensitive(self):
        """확장자 대소문자 무관 판별."""
        result = detect_category(FIXTURES / "sample.las")
        assert result.category == "pointcloud"


class TestPlyDetection:
    """PLY 양면성 테스트."""

    def test_ply_with_faces_is_3d_model(self):
        result = detect_category(FIXTURES / "sample_mesh.ply")
        assert result.category == "3d_model"
        assert result.confidence > 0.9

    def test_ply_without_faces_is_pointcloud(self):
        result = detect_category(FIXTURES / "sample_pc.ply")
        assert result.category == "pointcloud"
        assert result.confidence > 0.9


class TestUnknown:
    """판별 불가 테스트."""

    def test_unknown_extension(self):
        result = detect_category(FIXTURES / "sample.unknown_ext")
        assert result.category == "unknown"
        assert result.confidence == 0.0
        assert result.warning is not None

    def test_no_extension(self):
        result = detect_category("/tmp/noextfile")
        assert result.category == "unknown"


class TestZipArchiveDetection:
    """ZIP archive contents determine category when possible."""

    def test_zip_with_obj_is_3d_model(self, tmp_path):
        z = tmp_path / "mesh.zip"
        with zipfile.ZipFile(z, "w") as zf:
            zf.writestr("model.obj", "v 0 0 0\n")
            zf.writestr("model.mtl", "newmtl mat\n")
        result = detect_category(z)
        assert result.category == "3d_model"
        assert result.confidence > 0.8

    def test_zip_with_las_is_pointcloud(self, tmp_path):
        z = tmp_path / "scan.zip"
        with zipfile.ZipFile(z, "w") as zf:
            zf.writestr("scan.las", b"fake")
        result = detect_category(z)
        assert result.category == "pointcloud"
        assert result.confidence > 0.8

    def test_zip_with_tileset_is_3d_tiles(self, tmp_path):
        z = tmp_path / "tiles.zip"
        with zipfile.ZipFile(z, "w") as zf:
            zf.writestr("tileset.json", '{"asset":{"version":"1.1"}}')
            zf.writestr("model.obj", "v 0 0 0\n")
        result = detect_category(z)
        assert result.category == "3d_tiles"


class TestDetectionResult:
    """DetectionResult 구조 테스트."""

    def test_result_is_namedtuple(self):
        result = detect_category(FIXTURES / "sample.las")
        assert isinstance(result, DetectionResult)
        assert hasattr(result, "category")
        assert hasattr(result, "confidence")
        assert hasattr(result, "warning")

    def test_all_categories_valid(self):
        """반환값은 항상 VALID_CATEGORIES 중 하나."""
        for filename in FIXTURES.iterdir():
            if filename.is_file():
                result = detect_category(filename)
                assert result.category in VALID_CATEGORIES, f"{filename.name} → {result.category}"


class TestImageDetection:
    """이미지/파노라마 판별 테스트 (Pillow 필요)."""

    def test_regular_jpg(self, tmp_path):
        """일반 JPG → image."""
        try:
            from PIL import Image
        except ImportError:
            pytest.skip("Pillow not installed")
        img = Image.new("RGB", (4000, 3000))
        path = tmp_path / "photo.jpg"
        img.save(path)
        result = detect_category(path)
        assert result.category == "image"

    def test_panorama_jpg(self, tmp_path):
        """2:1 비율 + 너비 6000px 이상 → panorama 추정."""
        try:
            from PIL import Image
        except ImportError:
            pytest.skip("Pillow not installed")
        img = Image.new("RGB", (8000, 4000))
        path = tmp_path / "pano.jpg"
        img.save(path)
        result = detect_category(path)
        assert result.category == "panorama"
        assert result.warning is not None
        assert result.confidence < 1.0


class TestGeotiffDetection:
    """GeoTIFF 판별 테스트 (rasterio 필요)."""

    def test_plain_tiff(self, tmp_path):
        """좌표계 없는 TIFF → image."""
        try:
            from PIL import Image
        except ImportError:
            pytest.skip("Pillow not installed")
        img = Image.new("RGB", (100, 100))
        path = tmp_path / "plain.tif"
        img.save(path)
        result = detect_category(path)
        # rasterio가 있으면 image(CRS 없음), 없으면 image(fallback)
        assert result.category == "image"
