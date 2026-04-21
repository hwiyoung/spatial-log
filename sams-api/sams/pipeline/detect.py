"""
1단계: 파일 유형 자동 판별

파일 경로를 받아 data_category를 반환한다.
확장자 기반 판별 + PLY 양면성 + GeoTIFF 분기 + 파노라마 추정.

참조: docs/autofill_pipeline_spec.md 섹션 3
"""

from pathlib import Path
from typing import NamedTuple

# 유효한 data_category 값
VALID_CATEGORIES = frozenset([
    "pointcloud", "3d_model", "3d_tiles", "orthoimage",
    "image", "panorama", "video", "document", "unknown",
])

# 확장자 → category 직접 매핑 (추가 확인 불필요한 것들)
_EXT_MAP: dict[str, str] = {
    # 포인트 클라우드
    ".las": "pointcloud",
    ".laz": "pointcloud",
    ".e57": "pointcloud",
    ".pcd": "pointcloud",
    ".xyz": "pointcloud",
    ".pts": "pointcloud",
    # 3D 모델
    ".obj": "3d_model",
    ".fbx": "3d_model",
    ".gltf": "3d_model",
    ".glb": "3d_model",
    ".stl": "3d_model",
    ".dae": "3d_model",
    # 3D Tiles Archive
    ".3tz": "3d_tiles",
    # 동영상
    ".mp4": "video",
    ".mov": "video",
    ".avi": "video",
    ".mkv": "video",
    # 문서
    ".pdf": "document",
    ".hwp": "document",
    ".docx": "document",
    ".xlsx": "document",
    ".pptx": "document",
}

# 추가 확인이 필요한 확장자
_NEEDS_INSPECTION = frozenset([".ply", ".tif", ".tiff", ".jpg", ".jpeg", ".png"])

# 이미지 확장자 (파노라마 추정 대상)
_IMAGE_EXTS = frozenset([".jpg", ".jpeg", ".png"])

# GeoTIFF 확장자
_GEOTIFF_EXTS = frozenset([".tif", ".tiff"])

# 파노라마 추정 기준
_PANO_MIN_WIDTH = 6000
_PANO_RATIO_MIN = 1.8
_PANO_RATIO_MAX = 2.2


class DetectionResult(NamedTuple):
    """파일 유형 판별 결과."""
    category: str
    confidence: float
    warning: str | None = None


def detect_category(filepath: str | Path) -> DetectionResult:
    """파일 경로를 받아 data_category를 판별한다.

    Args:
        filepath: 판별할 파일 경로

    Returns:
        DetectionResult(category, confidence, warning)
    """
    path = Path(filepath)
    ext = path.suffix.lower()

    # 1) 직접 매핑
    if ext in _EXT_MAP:
        return DetectionResult(_EXT_MAP[ext], 1.0)

    # 2) 추가 확인이 필요한 확장자
    if ext == ".ply":
        return _detect_ply(path)

    if ext in _GEOTIFF_EXTS:
        return _detect_geotiff(path)

    if ext in _IMAGE_EXTS:
        return _detect_image(path)

    # 3) 판별 불가
    return DetectionResult("unknown", 0.0, f"확장자 '{ext}'로 유형을 판별할 수 없습니다.")


def _detect_ply(path: Path) -> DetectionResult:
    """PLY 파일의 양면성 처리: face가 있으면 3d_model, 없으면 pointcloud."""
    try:
        with open(path, "rb") as f:
            header = f.read(2048).decode("ascii", errors="ignore")
        has_face = "element face" in header
        return DetectionResult("3d_model" if has_face else "pointcloud", 0.95)
    except OSError:
        return DetectionResult("unknown", 0.0, "PLY 파일을 읽을 수 없습니다.")


def _detect_geotiff(path: Path) -> DetectionResult:
    """GeoTIFF 태그 확인: 있으면 orthoimage, 없으면 image."""
    try:
        import rasterio
        with rasterio.open(str(path)) as ds:
            if ds.crs is not None:
                return DetectionResult("orthoimage", 0.98)
            return DetectionResult("image", 0.7, "TIFF 파일에 좌표계 정보가 없어 일반 이미지로 분류합니다.")
    except ImportError:
        return DetectionResult("image", 0.5, "rasterio 미설치 — GeoTIFF 판별을 건너뜁니다.")
    except Exception:
        return DetectionResult("image", 0.5, "TIFF 파일을 GeoTIFF로 열 수 없어 일반 이미지로 분류합니다.")


def _detect_image(path: Path) -> DetectionResult:
    """이미지 파일의 파노라마 추정: 해상도 비율 2:1 + 너비 6000px 이상."""
    try:
        from PIL import Image
        with Image.open(path) as img:
            w, h = img.size
        if h > 0 and w >= _PANO_MIN_WIDTH:
            ratio = w / h
            if _PANO_RATIO_MIN <= ratio <= _PANO_RATIO_MAX:
                return DetectionResult(
                    "panorama", 0.7,
                    "해상도 비율(≈2:1)과 너비로 파노라마로 추정합니다 — 확인 필요"
                )
        return DetectionResult("image", 1.0)
    except ImportError:
        return DetectionResult("image", 0.8, "Pillow 미설치 — 파노라마 추정을 건너뜁니다.")
    except Exception:
        return DetectionResult("image", 0.8, "이미지 파일을 열 수 없어 기본 image로 분류합니다.")
