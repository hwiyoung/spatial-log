"""
Tests for pipeline thumbnail.py — 썸네일 생성

라이브러리 의존 테스트는 mock 기반.
참조: docs/autofill_pipeline_spec.md 섹션 7
"""

import os
import tempfile
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest

from sams.pipeline.thumbnail import (
    generate_thumbnail,
    _thumb_image,
    _thumb_video,
    THUMB_WIDTH,
    THUMB_HEIGHT,
)


def _pillow_available() -> bool:
    try:
        from PIL import Image
        return True
    except ImportError:
        return False


# ==========================================================================
# generate_thumbnail — 디스패치
# ==========================================================================

class TestGenerateThumbnail:

    def test_unsupported_category_returns_none(self):
        """미지원 유형 → None."""
        assert generate_thumbnail("/fake/file", "unknown") is None
        assert generate_thumbnail("/fake/file", "3d_tiles") is None

    def test_nonexistent_file_returns_none(self):
        """존재하지 않는 파일 → None (에러 없이)."""
        result = generate_thumbnail("/nonexistent/file.jpg", "image")
        assert result is None

    @pytest.mark.skipif(
        not _pillow_available(), reason="Pillow 미설치"
    )
    def test_image_thumbnail(self, tmp_path):
        """이미지 → 썸네일 PNG 생성."""
        from PIL import Image
        img = Image.new("RGB", (800, 600), color="red")
        src = str(tmp_path / "test.jpg")
        img.save(src)

        result = generate_thumbnail(src, "image")

        assert result is not None
        assert os.path.exists(result)
        thumb = Image.open(result)
        assert thumb.size[0] <= THUMB_WIDTH
        assert thumb.size[1] <= THUMB_HEIGHT
        os.unlink(result)

    @pytest.mark.skipif(
        not _pillow_available(), reason="Pillow 미설치"
    )
    def test_panorama_uses_image_generator(self, tmp_path):
        """파노라마 → 이미지 리사이즈와 동일."""
        from PIL import Image
        img = Image.new("RGB", (7200, 3600), color="blue")
        src = str(tmp_path / "pano.jpg")
        img.save(src)

        result = generate_thumbnail(src, "panorama")

        assert result is not None
        os.unlink(result)


# ==========================================================================
# _thumb_video
# ==========================================================================

class TestThumbVideo:

    @patch("sams.pipeline.thumbnail.subprocess.run")
    def test_video_ffmpeg_called(self, mock_run):
        """ffmpeg가 올바른 인자로 호출되는지 확인."""
        mock_run.return_value = MagicMock(
            stdout='{"format":{"duration":"60.0"}}',
            returncode=0,
        )

        result = _thumb_video("/fake/video.mp4")

        # ffprobe + ffmpeg 두 번 호출
        assert mock_run.call_count == 2
        # ffmpeg 호출에 -ss 30.0 (midpoint)
        ffmpeg_call = mock_run.call_args_list[1]
        args = ffmpeg_call[0][0]
        assert "ffmpeg" in args[0]
        assert "-ss" in args
        ss_idx = args.index("-ss")
        assert float(args[ss_idx + 1]) == pytest.approx(30.0)

    @patch("sams.pipeline.thumbnail.subprocess.run", side_effect=FileNotFoundError)
    def test_video_no_ffmpeg_returns_none(self, mock_run):
        """ffmpeg 미설치 → None."""
        result = _thumb_video("/fake/video.mp4")
        assert result is None


