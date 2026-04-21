"""
5단계: 썸네일 자동 생성

유형별로 대표 이미지를 생성한다. 400×300px PNG.
비동기(Celery)에서 실행되며, 실패해도 Item 등록에 영향 없음.

참조: docs/autofill_pipeline_spec.md 섹션 7
"""

import logging
import subprocess
import tempfile
from pathlib import Path

logger = logging.getLogger(__name__)

THUMB_WIDTH = 400
THUMB_HEIGHT = 300
THUMB_SIZE = (THUMB_WIDTH, THUMB_HEIGHT)


def generate_thumbnail(filepath: str, data_category: str) -> str | None:
    """파일에서 썸네일을 생성한다.

    Args:
        filepath: 원본 파일 경로.
        data_category: 데이터 유형.

    Returns:
        생성된 썸네일 PNG 파일 경로. 실패 시 None.
    """
    generators = {
        "pointcloud": _thumb_pointcloud,
        "3d_model": _thumb_3dmodel,
        "orthoimage": _thumb_orthoimage,
        "image": _thumb_image,
        "panorama": _thumb_image,  # 파노라마도 이미지 리사이즈
        "video": _thumb_video,
        "document": _thumb_document,
    }

    gen = generators.get(data_category)
    if gen is None:
        logger.info("썸네일 미지원 유형: %s", data_category)
        return None

    try:
        return gen(filepath)
    except Exception:
        logger.exception("썸네일 생성 실패 (%s): %s", data_category, filepath)
        return None


def _thumb_pointcloud(filepath: str) -> str | None:
    """포인트 클라우드 → 상위 뷰 산점도."""
    try:
        import laspy
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except ImportError:
        logger.warning("laspy 또는 matplotlib 미설치 — PC 썸네일 건너뜀")
        return None

    las = laspy.read(filepath)
    x, y = las.x, las.y

    # 포인트 수가 많으면 샘플링
    max_points = 50000
    if len(x) > max_points:
        step = len(x) // max_points
        x, y = x[::step], y[::step]

    fig, ax = plt.subplots(1, 1, figsize=(4, 3), dpi=100)
    ax.scatter(x, y, s=0.1, c="steelblue", alpha=0.5)
    ax.set_aspect("equal")
    ax.axis("off")
    fig.tight_layout(pad=0)

    out = _tmp_png()
    fig.savefig(out, dpi=100, bbox_inches="tight", pad_inches=0)
    plt.close(fig)
    return out


def _thumb_3dmodel(filepath: str) -> str | None:
    """3D 모델 → trimesh 렌더링."""
    try:
        import trimesh
    except ImportError:
        logger.warning("trimesh 미설치 — 3D 모델 썸네일 건너뜀")
        return None

    mesh = trimesh.load(filepath, force="mesh")
    if not hasattr(mesh, "vertices") or len(mesh.vertices) == 0:
        return None

    # matplotlib로 와이어프레임 렌더링
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        from mpl_toolkits.mplot3d import Axes3D  # noqa: F401
    except ImportError:
        return None

    verts = mesh.vertices
    fig = plt.figure(figsize=(4, 3), dpi=100)
    ax = fig.add_subplot(111, projection="3d")

    # 샘플링된 포인트 표시
    max_pts = 20000
    if len(verts) > max_pts:
        step = len(verts) // max_pts
        verts = verts[::step]

    ax.scatter(verts[:, 0], verts[:, 1], verts[:, 2], s=0.1, c="gray", alpha=0.5)
    ax.axis("off")
    fig.tight_layout(pad=0)

    out = _tmp_png()
    fig.savefig(out, dpi=100, bbox_inches="tight", pad_inches=0)
    plt.close(fig)
    return out


def _thumb_orthoimage(filepath: str) -> str | None:
    """정사영상 → 중앙 크롭 + 리사이즈."""
    try:
        import rasterio
        from PIL import Image
        import numpy as np
    except ImportError:
        logger.warning("rasterio 또는 Pillow 미설치 — 정사영상 썸네일 건너뜀")
        return None

    with rasterio.open(filepath) as ds:
        # 읽을 밴드 결정 (최대 3밴드)
        band_count = min(ds.count, 3)
        indexes = list(range(1, band_count + 1))

        data = ds.read(
            indexes=indexes,
            out_shape=(band_count, THUMB_HEIGHT, THUMB_WIDTH),
            resampling=rasterio.enums.Resampling.bilinear,
        )

    # (bands, h, w) → (h, w, bands)
    if data.shape[0] >= 3:
        rgb = np.transpose(data[:3], (1, 2, 0))
    else:
        rgb = np.transpose(np.stack([data[0]] * 3), (1, 2, 0))

    # 값 범위 정규화
    if rgb.max() > 255:
        rgb = (rgb / rgb.max() * 255).astype(np.uint8)
    else:
        rgb = rgb.astype(np.uint8)

    img = Image.fromarray(rgb)
    return _save_thumb(img)


def _thumb_image(filepath: str) -> str | None:
    """이미지/파노라마 → 리사이즈."""
    try:
        from PIL import Image
    except ImportError:
        logger.warning("Pillow 미설치 — 이미지 썸네일 건너뜀")
        return None

    img = Image.open(filepath)
    img.thumbnail(THUMB_SIZE)
    return _save_thumb(img)


def _thumb_video(filepath: str) -> str | None:
    """동영상 → ffmpeg으로 중간 프레임 추출."""
    # 먼저 duration 확인
    try:
        probe = subprocess.run(
            ["ffprobe", "-v", "quiet", "-print_format", "json",
             "-show_format", filepath],
            capture_output=True, text=True, timeout=10,
        )
        import json
        info = json.loads(probe.stdout)
        duration = float(info.get("format", {}).get("duration", 10))
    except Exception:
        duration = 10.0

    midpoint = duration / 2
    out = _tmp_png()

    try:
        subprocess.run(
            ["ffmpeg", "-y", "-ss", str(midpoint), "-i", filepath,
             "-vframes", "1", "-vf", f"scale={THUMB_WIDTH}:{THUMB_HEIGHT}:force_original_aspect_ratio=decrease,pad={THUMB_WIDTH}:{THUMB_HEIGHT}:(ow-iw)/2:(oh-ih)/2",
             out],
            capture_output=True, timeout=30,
            check=True,
        )
        return out
    except (subprocess.CalledProcessError, FileNotFoundError):
        logger.warning("ffmpeg 실행 실패 — 동영상 썸네일 건너뜀")
        return None


def _thumb_document(filepath: str) -> str | None:
    """문서(PDF) → 첫 페이지 렌더링."""
    ext = Path(filepath).suffix.lower()
    if ext != ".pdf":
        return None

    # PyMuPDF (fitz) 시도
    try:
        import fitz
        doc = fitz.open(filepath)
        page = doc[0]
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
        out = _tmp_png()
        pix.save(out)
        doc.close()

        # 리사이즈
        from PIL import Image
        img = Image.open(out)
        img.thumbnail(THUMB_SIZE)
        return _save_thumb(img)
    except ImportError:
        pass
    except Exception:
        logger.exception("PyMuPDF PDF 썸네일 실패")

    # pdf2image fallback
    try:
        from pdf2image import convert_from_path
        images = convert_from_path(filepath, first_page=1, last_page=1, size=THUMB_SIZE)
        if images:
            return _save_thumb(images[0])
    except ImportError:
        logger.warning("fitz/pdf2image 미설치 — PDF 썸네일 건너뜀")
    except Exception:
        logger.exception("pdf2image PDF 썸네일 실패")

    return None


# ─────────────────────────────────────────────────────────────────────────
# 헬퍼
# ─────────────────────────────────────────────────────────────────────────

def _tmp_png() -> str:
    """임시 PNG 파일 경로를 생성한다."""
    f = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
    f.close()
    return f.name


def _save_thumb(img) -> str:
    """PIL Image를 400x300 PNG로 저장한다."""
    img = img.convert("RGB")
    img.thumbnail(THUMB_SIZE)
    out = _tmp_png()
    img.save(out, "PNG")
    return out
