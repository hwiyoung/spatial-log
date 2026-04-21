"""
Tests for pipeline extract.py — 유형별 메타데이터 추출

단위 테스트: mock 기반으로 추출 로직 검증
통합 테스트: 실제 파일 + 라이브러리 (pytest -m integration)

참조: docs/autofill_pipeline_spec.md 섹션 4
"""

import json
import os
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from sams.pipeline.extract import (
    extract_metadata,
    extract_3dtiles,
    extract_document,
    _read_exif,
    _gps_to_decimal,
    _parse_iso6709,
    _parse_dji_srt,
    _convex_hull_polygon,
    _EXTRACTORS,
    _base_meta,
)

FIXTURES = Path(__file__).parent / "fixtures"


# ==========================================================================
# Dispatch
# ==========================================================================

class TestExtractMetadataDispatch:
    """extract_metadata 디스패치 테스트."""

    def test_unknown_category_returns_base_meta(self, tmp_path):
        f = tmp_path / "test.xyz"
        f.write_bytes(b"data")
        result = extract_metadata(str(f), "unknown")
        assert result["file:size"] == 4

    def test_nonexistent_category_returns_base_meta(self, tmp_path):
        f = tmp_path / "test.txt"
        f.write_bytes(b"hello")
        result = extract_metadata(str(f), "nonexistent_type")
        assert result["file:size"] == 5

    def test_extractor_exception_returns_base_meta(self, tmp_path):
        f = tmp_path / "test.las"
        f.write_bytes(b"x" * 10)
        original = _EXTRACTORS["pointcloud"]
        _EXTRACTORS["pointcloud"] = MagicMock(side_effect=Exception("boom"))
        try:
            result = extract_metadata(str(f), "pointcloud")
            assert result["file:size"] == 10
        finally:
            _EXTRACTORS["pointcloud"] = original

    def test_3d_model_passes_bundled_files(self, tmp_path):
        f = tmp_path / "model.obj"
        f.write_bytes(b"v 0 0 0\n")
        bundled = [str(tmp_path / "tex.jpg")]
        mock_fn = MagicMock(return_value={"test": True})
        original = _EXTRACTORS["3d_model"]
        _EXTRACTORS["3d_model"] = mock_fn
        try:
            extract_metadata(str(f), "3d_model", bundled_files=bundled)
            mock_fn.assert_called_once_with(str(f), bundled_files=bundled)
        finally:
            _EXTRACTORS["3d_model"] = original

    def test_non_3dmodel_does_not_pass_bundled(self, tmp_path):
        f = tmp_path / "test.pdf"
        f.write_bytes(b"x" * 10)
        mock_fn = MagicMock(return_value={"document:format": "pdf"})
        original = _EXTRACTORS["document"]
        _EXTRACTORS["document"] = mock_fn
        try:
            extract_metadata(str(f), "document", bundled_files=["extra.txt"])
            # bundled_files는 전달되지 않아야 함
            mock_fn.assert_called_once_with(str(f))
        finally:
            _EXTRACTORS["document"] = original


# ==========================================================================
# 3D Tiles (JSON 파싱 — 외부 라이브러리 불필요)
# ==========================================================================

class TestExtract3DTiles:
    """3D Tiles tileset.json 파싱 테스트."""

    def test_basic_tileset(self, tmp_path):
        tileset = {
            "asset": {"version": "1.1"},
            "root": {
                "geometricError": 100.0,
                "content": {"uri": "tile.b3dm"},
                "boundingVolume": {
                    "region": [2.0, 0.5, 2.1, 0.6, 0, 100]
                },
            },
        }
        f = tmp_path / "tileset.json"
        f.write_text(json.dumps(tileset))

        result = extract_3dtiles(str(f))
        assert result["3dtiles:version"] == "1.1"
        assert result["3dtiles:geometric_error"] == 100.0
        assert result["3dtiles:tile_format"] == "b3dm"
        assert result["proj:epsg"] == 4326
        assert result["_epsg_source"] == "file"
        assert "bbox" in result
        assert len(result["bbox"]) == 4

    def test_glb_tile_format(self, tmp_path):
        tileset = {
            "asset": {"version": "1.0"},
            "root": {
                "geometricError": 50.0,
                "content": {"uri": "tile.glb"},
                "boundingVolume": {"box": [0]*12},
            },
        }
        f = tmp_path / "tileset.json"
        f.write_text(json.dumps(tileset))
        result = extract_3dtiles(str(f))
        assert result["3dtiles:tile_format"] == "glb"

    def test_no_region(self, tmp_path):
        tileset = {
            "asset": {"version": "1.0"},
            "root": {
                "geometricError": 50.0,
                "boundingVolume": {"box": [0]*12},
            },
        }
        f = tmp_path / "tileset.json"
        f.write_text(json.dumps(tileset))

        result = extract_3dtiles(str(f))
        assert result["proj:epsg"] is None
        assert "bbox" not in result

    def test_no_content_uri(self, tmp_path):
        tileset = {"asset": {}, "root": {"geometricError": 10}}
        f = tmp_path / "tileset.json"
        f.write_text(json.dumps(tileset))
        result = extract_3dtiles(str(f))
        assert result["3dtiles:tile_format"] is None

    def test_empty_asset(self, tmp_path):
        tileset = {"root": {"geometricError": 5}}
        f = tmp_path / "tileset.json"
        f.write_text(json.dumps(tileset))
        result = extract_3dtiles(str(f))
        assert result["3dtiles:version"] == "1.0"  # default


# ==========================================================================
# 문헌정보 (PDF: pypdf, 나머지: 확장자만)
# ==========================================================================

class TestExtractDocument:
    """문서 추출 테스트."""

    def test_non_pdf_format(self, tmp_path):
        for ext in ("hwp", "docx", "xlsx", "pptx"):
            f = tmp_path / f"report.{ext}"
            f.write_bytes(b"x" * 30)
            result = extract_document(str(f))
            assert result["document:format"] == ext
            assert result["file:size"] == 30
            assert "document:pages" not in result

    def test_pdf_extraction(self, tmp_path):
        """pypdf가 설치되어 있을 때 PDF 메타데이터 추출."""
        try:
            from pypdf import PdfWriter
        except ImportError:
            pytest.skip("pypdf not installed")

        f = tmp_path / "report.pdf"
        writer = PdfWriter()
        writer.add_blank_page(width=612, height=792)
        writer.add_blank_page(width=612, height=792)
        with open(f, "wb") as fp:
            writer.write(fp)

        result = extract_document(str(f))
        assert result["document:format"] == "pdf"
        assert result["document:pages"] == 2
        assert result["file:size"] > 0


# ==========================================================================
# 이미지 (Pillow 필요 — 대부분 환경에 설치됨)
# ==========================================================================

class TestExtractImage:
    """이미지 EXIF 추출 테스트."""

    def test_basic_resolution(self, tmp_path):
        try:
            from PIL import Image
        except ImportError:
            pytest.skip("Pillow not installed")

        from sams.pipeline.extract import extract_image

        f = tmp_path / "photo.jpg"
        img = Image.new("RGB", (4000, 3000))
        img.save(str(f))

        with patch("sams.pipeline.extract._read_exif", return_value=None):
            result = extract_image(str(f))

        assert result["image:resolution"] == [4000, 3000]
        assert result["image:has_geotag"] is False

    def test_with_exif_data(self, tmp_path):
        try:
            from PIL import Image
        except ImportError:
            pytest.skip("Pillow not installed")

        from sams.pipeline.extract import extract_image

        f = tmp_path / "photo.jpg"
        img = Image.new("RGB", (4000, 3000))
        img.save(str(f))

        mock_exif = {
            "camera_model": "DJI FC6520",
            "focal_length": 8.8,
            "orientation": 1,
            "has_geotag": True,
            "datetime": "2024:03:15 10:30:00",
            "geometry": {"type": "Point", "coordinates": [127.0, 37.5]},
        }
        with patch("sams.pipeline.extract._read_exif", return_value=mock_exif):
            result = extract_image(str(f))

        assert result["image:camera_model"] == "DJI FC6520"
        assert result["image:focal_length"] == 8.8
        assert result["image:has_geotag"] is True
        assert result["geometry"]["type"] == "Point"
        assert result["datetime"] == "2024:03:15 10:30:00"


# ==========================================================================
# 파노라마
# ==========================================================================

class TestExtractPanorama:
    """파노라마 추출 테스트."""

    def test_equirectangular(self, tmp_path):
        try:
            from PIL import Image
        except ImportError:
            pytest.skip("Pillow not installed")

        from sams.pipeline.extract import extract_panorama

        f = tmp_path / "pano.jpg"
        img = Image.new("RGB", (8000, 4000))
        img.save(str(f))

        with patch("sams.pipeline.extract._read_exif", return_value={
            "camera_model": "Ricoh Theta",
            "datetime": "2024:06:01 12:00:00",
        }):
            result = extract_panorama(str(f))

        assert result["panorama:resolution"] == [8000, 4000]
        assert result["panorama:type"] == "equirectangular"
        assert result["panorama:fov_horizontal"] == 360.0
        assert result["panorama:fov_vertical"] == 180.0
        assert result["panorama:camera_model"] == "Ricoh Theta"

    def test_non_equirectangular(self, tmp_path):
        try:
            from PIL import Image
        except ImportError:
            pytest.skip("Pillow not installed")

        from sams.pipeline.extract import extract_panorama

        f = tmp_path / "partial.jpg"
        img = Image.new("RGB", (8000, 6000))
        img.save(str(f))

        with patch("sams.pipeline.extract._read_exif", return_value=None):
            result = extract_panorama(str(f))

        assert result["panorama:type"] == "unknown"
        assert result["panorama:fov_horizontal"] is None


# ==========================================================================
# 동영상 (ffprobe mock)
# ==========================================================================

class TestExtractVideo:
    """동영상 추출 — subprocess.run mock."""

    def test_basic_video(self, tmp_path):
        from sams.pipeline.extract import extract_video

        f = tmp_path / "clip.mp4"
        f.write_bytes(b"x" * 500)

        ffprobe_output = {
            "streams": [
                {
                    "codec_type": "video",
                    "codec_name": "h264",
                    "width": 1920,
                    "height": 1080,
                    "r_frame_rate": "30/1",
                },
                {
                    "codec_type": "audio",
                    "codec_name": "aac",
                },
            ],
            "format": {
                "duration": "120.5",
                "bit_rate": "5000000",
                "size": "500",
                "tags": {"creation_time": "2024-03-15T10:00:00.000000Z"},
            },
        }
        with patch("sams.pipeline.extract.subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(
                returncode=0,
                stdout=json.dumps(ffprobe_output),
            )
            result = extract_video(str(f))

        assert result["video:codec"] == "h264"
        assert result["video:resolution"] == [1920, 1080]
        assert result["video:frame_rate"] == 30.0
        assert result["video:duration"] == 120.5
        assert result["video:bitrate"] == 5000000
        assert result["video:has_audio"] is True
        assert result["video:audio_codec"] == "aac"
        assert result["video:total_frames"] == 3615
        assert result["datetime"] == "2024-03-15T10:00:00.000000Z"
        assert result["video:has_geotag"] is False  # location 태그 없음

    def test_video_with_gps(self, tmp_path):
        """DJI 드론 영상 — location 태그에 GPS 좌표."""
        from sams.pipeline.extract import extract_video

        f = tmp_path / "drone.mp4"
        f.write_bytes(b"x" * 300)

        ffprobe_output = {
            "streams": [
                {"codec_type": "video", "codec_name": "h264",
                 "width": 3840, "height": 2160, "r_frame_rate": "30/1"},
            ],
            "format": {
                "duration": "60.0", "bit_rate": "5000000", "size": "300",
                "tags": {
                    "creation_time": "2024-04-24T08:00:00.000000Z",
                    "location": "+37.5410+127.0460+100.5/",
                },
            },
        }
        with patch("sams.pipeline.extract.subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(
                returncode=0, stdout=json.dumps(ffprobe_output),
            )
            result = extract_video(str(f))

        assert result["video:has_geotag"] is True
        assert result["geometry"]["type"] == "Point"
        assert result["geometry"]["coordinates"][0] == pytest.approx(127.046, abs=0.001)
        assert result["geometry"]["coordinates"][1] == pytest.approx(37.541, abs=0.001)
        assert len(result["geometry"]["coordinates"]) == 3  # 고도 포함

    def test_no_audio(self, tmp_path):
        from sams.pipeline.extract import extract_video

        f = tmp_path / "silent.mp4"
        f.write_bytes(b"x" * 100)

        ffprobe_output = {
            "streams": [
                {"codec_type": "video", "codec_name": "h265",
                 "width": 3840, "height": 2160, "r_frame_rate": "60/1"},
            ],
            "format": {"duration": "30.0", "bit_rate": "8000000", "size": "100"},
        }
        with patch("sams.pipeline.extract.subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(
                returncode=0, stdout=json.dumps(ffprobe_output),
            )
            result = extract_video(str(f))

        assert result["video:has_audio"] is False
        assert "video:audio_codec" not in result
        assert result["video:resolution"] == [3840, 2160]

    def test_ffprobe_failure(self, tmp_path):
        from sams.pipeline.extract import extract_video

        f = tmp_path / "bad.mp4"
        f.write_bytes(b"x" * 50)

        with patch("sams.pipeline.extract.subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(returncode=1, stderr="error")
            result = extract_video(str(f))

        assert result["file:size"] == 50
        assert "video:codec" not in result


# ==========================================================================
# 포인트 클라우드 (dispatch로만 테스트 — laspy 미설치 시 graceful)
# ==========================================================================

class TestExtractPointcloudGraceful:
    """laspy 미설치 시에도 graceful degradation."""

    def test_missing_laspy_returns_base_meta(self, tmp_path):
        f = tmp_path / "test.las"
        f.write_bytes(b"x" * 100)
        result = extract_metadata(str(f), "pointcloud")
        assert "file:size" in result

    def test_e57_invalid_file_returns_base(self, tmp_path):
        """유효하지 않은 E57 파일 — graceful degradation."""
        f = tmp_path / "scan.e57"
        f.write_bytes(b"not-an-e57-file")
        result = extract_metadata(str(f), "pointcloud")
        assert "file:size" in result
        assert result["pc:encoding"] == "E57"


class TestExtractPointcloudE57:
    """E57 XML 헤더 파싱 테스트."""

    def _make_e57_file(self, tmp_path, xml_content: str) -> Path:
        """E57 형식의 테스트 파일을 생성한다 (CRC 페이지 구조 포함)."""
        import struct

        page_size = 1024
        data_per_page = page_size - 4  # CRC 4바이트 제외

        xml_bytes = xml_content.encode("utf-8")
        xml_length = len(xml_bytes)

        # 헤더는 첫 페이지에 위치 (48바이트 헤더 + 나머지는 패딩 + CRC)
        # XML은 두 번째 페이지부터 시작
        xml_offset = page_size  # 첫 페이지 이후

        # XML을 페이지 단위로 분할하고 CRC 추가
        xml_pages = []
        offset = 0
        while offset < xml_length:
            chunk = xml_bytes[offset:offset + data_per_page]
            # 페이지 끝까지 0으로 패딩 후 CRC 4바이트 추가
            padded = chunk + b"\x00" * (data_per_page - len(chunk))
            xml_pages.append(padded + b"\x00\x00\x00\x00")  # 더미 CRC
            offset += data_per_page

        xml_section = b"".join(xml_pages)
        file_length = page_size + len(xml_section)

        # 헤더 페이지
        header = b"ASTM-E57"
        header += struct.pack("<II Q Q Q Q", 1, 0, file_length, xml_offset, xml_length, page_size)
        header_page = header + b"\x00" * (data_per_page - len(header)) + b"\x00\x00\x00\x00"

        f = tmp_path / "test.e57"
        f.write_bytes(header_page + xml_section)
        return f

    def test_basic_e57_extraction(self, tmp_path):
        """실제 E57 구조: <points recordCount="N"> + <prototype> 하위에 필드 태그."""
        xml = """<?xml version="1.0" encoding="UTF-8"?>
        <e57Root>
          <data3D>
            <vectorChild>
              <points type="CompressedVector" recordCount="50000">
                <prototype type="Structure">
                  <cartesianX type="Float"/>
                  <cartesianY type="Float"/>
                  <cartesianZ type="Float"/>
                  <colorRed type="Integer"/>
                  <colorGreen type="Integer"/>
                  <colorBlue type="Integer"/>
                  <intensity type="Float"/>
                </prototype>
              </points>
              <cartesianBounds type="Structure">
                <xMinimum type="Float">0.0</xMinimum>
                <xMaximum type="Float">100.0</xMaximum>
                <yMinimum type="Float">0.0</yMinimum>
                <yMaximum type="Float">100.0</yMaximum>
                <zMinimum type="Float">0.0</zMinimum>
                <zMaximum type="Float">50.0</zMaximum>
              </cartesianBounds>
            </vectorChild>
          </data3D>
        </e57Root>"""

        f = self._make_e57_file(tmp_path, xml)
        from sams.pipeline.extract import extract_pointcloud
        result = extract_pointcloud(str(f))

        assert result["pc:encoding"] == "E57"
        assert result["pc:count"] == 50000
        assert result["pc:has_rgb"] is True
        assert result["pc:has_intensity"] is True
        assert any(s["name"] == "cartesianX" for s in result["pc:schemas"])
        assert "bbox" in result
        assert result["bbox"] == [0.0, 0.0, 0.0, 100.0, 100.0, 50.0]

    def test_e57_no_color(self, tmp_path):
        xml = """<?xml version="1.0" encoding="UTF-8"?>
        <e57Root>
          <data3D>
            <vectorChild>
              <points type="CompressedVector" recordCount="1000">
                <prototype type="Structure">
                  <cartesianX type="Float"/>
                  <cartesianY type="Float"/>
                  <cartesianZ type="Float"/>
                </prototype>
              </points>
            </vectorChild>
          </data3D>
        </e57Root>"""

        f = self._make_e57_file(tmp_path, xml)
        from sams.pipeline.extract import extract_pointcloud
        result = extract_pointcloud(str(f))

        assert result["pc:count"] == 1000
        assert result["pc:has_rgb"] is False
        assert result["pc:has_intensity"] is False

    def test_e57_multiple_scans(self, tmp_path):
        xml = """<?xml version="1.0" encoding="UTF-8"?>
        <e57Root>
          <data3D>
            <vectorChild>
              <points type="CompressedVector" recordCount="30000">
                <prototype type="Structure">
                  <cartesianX type="Float"/>
                </prototype>
              </points>
            </vectorChild>
            <vectorChild>
              <points type="CompressedVector" recordCount="20000">
                <prototype type="Structure">
                  <cartesianX type="Float"/>
                </prototype>
              </points>
            </vectorChild>
          </data3D>
        </e57Root>"""

        f = self._make_e57_file(tmp_path, xml)
        from sams.pipeline.extract import extract_pointcloud
        result = extract_pointcloud(str(f))
        assert result["pc:count"] == 50000


# ==========================================================================
# 3D 모델 (dispatch로만 테스트)
# ==========================================================================

class TestExtract3DModelGraceful:
    """trimesh 미설치 시 graceful degradation."""

    def test_missing_trimesh_returns_base_meta(self, tmp_path):
        f = tmp_path / "model.obj"
        f.write_bytes(b"v 0 0 0\n")
        result = extract_metadata(str(f), "3d_model")
        assert "file:size" in result


# ==========================================================================
# 정사영상 (dispatch로만 테스트)
# ==========================================================================

class TestExtractOrthoimageGraceful:
    """rasterio 미설치 시 graceful degradation."""

    def test_missing_rasterio_returns_base_meta(self, tmp_path):
        f = tmp_path / "ortho.tif"
        f.write_bytes(b"x" * 100)
        result = extract_metadata(str(f), "orthoimage")
        assert "file:size" in result


# ==========================================================================
# GPS 변환 헬퍼
# ==========================================================================

class TestGpsToDecimal:
    """GPS DMS → 십진 도 변환 테스트."""

    def test_north_east(self):
        assert _gps_to_decimal((37.0, 30.0, 0.0), "N") == pytest.approx(37.5)
        assert _gps_to_decimal((127.0, 0.0, 0.0), "E") == pytest.approx(127.0)

    def test_south_west(self):
        assert _gps_to_decimal((33.0, 0.0, 0.0), "S") == pytest.approx(-33.0)
        assert _gps_to_decimal((118.0, 15.0, 0.0), "W") == pytest.approx(-118.25)

    def test_none_input(self):
        assert _gps_to_decimal(None, "N") is None
        assert _gps_to_decimal((37.0, 0.0, 0.0), None) is None

    def test_precision(self):
        # 37° 33' 50" N = 37.563889
        result = _gps_to_decimal((37.0, 33.0, 50.0), "N")
        assert result == pytest.approx(37.563889, abs=0.001)


class TestParseIso6709:
    """ISO 6709 위치 문자열 파싱 테스트."""

    def test_lat_lon(self):
        result = _parse_iso6709("+37.5410+127.0460/")
        assert result["type"] == "Point"
        assert result["coordinates"][0] == pytest.approx(127.046, abs=0.001)
        assert result["coordinates"][1] == pytest.approx(37.541, abs=0.001)
        assert len(result["coordinates"]) == 2

    def test_lat_lon_alt(self):
        result = _parse_iso6709("+37.5410+127.0460+100.5/")
        assert len(result["coordinates"]) == 3
        assert result["coordinates"][2] == pytest.approx(100.5)

    def test_negative_coords(self):
        result = _parse_iso6709("-33.8688+151.2093/")
        assert result["coordinates"][0] == pytest.approx(151.2093, abs=0.001)
        assert result["coordinates"][1] == pytest.approx(-33.8688, abs=0.001)

    def test_none_input(self):
        assert _parse_iso6709(None) is None
        assert _parse_iso6709("") is None

    def test_invalid_format(self):
        assert _parse_iso6709("not a location") is None

    def test_no_trailing_slash(self):
        result = _parse_iso6709("+37.5410+127.0460")
        assert result is not None
        assert result["coordinates"][1] == pytest.approx(37.541, abs=0.001)


# ==========================================================================
# base_meta
# ==========================================================================

class TestBaseMeta:
    """_base_meta 테스트."""

    def test_existing_file(self, tmp_path):
        f = tmp_path / "test.bin"
        f.write_bytes(b"x" * 42)
        assert _base_meta(str(f)) == {"file:size": 42}

    def test_nonexistent_file(self):
        result = _base_meta("/nonexistent/file.xyz")
        assert result == {"file:size": None}


# ==========================================================================
# SRT 텔레메트리 파싱
# ==========================================================================

class TestParseDjiSrt:
    """DJI SRT 파싱 테스트."""

    def test_gps_pattern1(self, tmp_path):
        """변종 1: GPS (lon, lat, alt)"""
        srt = tmp_path / "video.srt"
        srt.write_text(
            "1\n00:00:00,000 --> 00:00:01,000\n"
            "F/2.8, SS 500, ISO 100, GPS (127.046, 37.541, 100.5)\n\n"
            "2\n00:00:01,000 --> 00:00:02,000\n"
            "F/2.8, SS 500, ISO 100, GPS (127.047, 37.542, 101.0)\n\n"
            "3\n00:00:02,000 --> 00:00:03,000\n"
            "F/2.8, SS 500, ISO 100, GPS (127.048, 37.543, 99.5)\n"
        )
        result = _parse_dji_srt(srt)
        assert result is not None
        assert len(result["coordinates"]) == 3
        assert result["coordinates"][0][0] == pytest.approx(127.046, abs=0.001)
        assert result["alt_min"] == pytest.approx(99.5)
        assert result["alt_max"] == pytest.approx(101.0)

    def test_gps_pattern2(self, tmp_path):
        """변종 2: [latitude: N] [longitude: N]"""
        srt = tmp_path / "video.srt"
        srt.write_text(
            "1\n00:00:00,000 --> 00:00:01,000\n"
            "[latitude: 37.541] [longitude: 127.046] [altitude: 100.5]\n\n"
            "2\n00:00:01,000 --> 00:00:02,000\n"
            "[latitude: 37.542] [longitude: 127.047] [altitude: 101.0]\n"
        )
        result = _parse_dji_srt(srt)
        assert result is not None
        assert len(result["coordinates"]) == 2

    def test_duplicate_coords_filtered(self, tmp_path):
        """정지 상태에서 반복되는 동일 좌표는 제거."""
        srt = tmp_path / "video.srt"
        lines = ""
        for i in range(10):
            lines += (
                f"{i+1}\n00:00:{i:02d},000 --> 00:00:{i+1:02d},000\n"
                f"GPS (127.046, 37.541, 100.0)\n\n"
            )
        srt.write_text(lines)
        result = _parse_dji_srt(srt)
        assert result is not None
        assert len(result["coordinates"]) == 1  # 모두 같은 좌표

    def test_empty_srt(self, tmp_path):
        srt = tmp_path / "empty.srt"
        srt.write_text("1\n00:00:00,000 --> 00:00:01,000\nno gps here\n")
        result = _parse_dji_srt(srt)
        assert result is None


# ==========================================================================
# 이미지 세트 + ConvexHull
# ==========================================================================

class TestImageSet:
    """이미지 세트(bundled_files) 처리 테스트."""

    def test_image_count(self, tmp_path):
        try:
            from PIL import Image
        except ImportError:
            pytest.skip("Pillow not installed")
        from sams.pipeline.extract import extract_image

        primary = tmp_path / "img001.jpg"
        Image.new("RGB", (100, 100)).save(str(primary))
        bundled = []
        for i in range(5):
            f = tmp_path / f"img{i+2:03d}.jpg"
            Image.new("RGB", (100, 100)).save(str(f))
            bundled.append(str(f))

        with patch("sams.pipeline.extract._read_exif", return_value=None):
            result = extract_image(str(primary), bundled_files=bundled)

        assert result["image:image_count"] == 6


class TestConvexHull:
    """ConvexHull Polygon 생성 테스트."""

    def test_triangle(self):
        coords = [[127.0, 37.0], [127.1, 37.0], [127.05, 37.1]]
        result = _convex_hull_polygon(coords)
        assert result["type"] == "Polygon"
        ring = result["coordinates"][0]
        assert ring[0] == ring[-1]  # 닫힌 링
        assert len(ring) == 4  # 3점 + 닫기

    def test_square(self):
        coords = [
            [127.0, 37.0], [127.1, 37.0],
            [127.1, 37.1], [127.0, 37.1],
        ]
        result = _convex_hull_polygon(coords)
        assert result["type"] == "Polygon"
        ring = result["coordinates"][0]
        assert len(ring) == 5  # 4점 + 닫기

    def test_two_points(self):
        coords = [[127.0, 37.0], [127.1, 37.1]]
        result = _convex_hull_polygon(coords)
        assert result["type"] == "LineString"

    def test_single_point(self):
        coords = [[127.0, 37.0]]
        result = _convex_hull_polygon(coords)
        assert result["type"] == "Point"


# ==========================================================================
# bundle.py — 동영상+SRT 번들
# ==========================================================================

class TestBundleVideoSrt:
    """동영상+SRT 번들 테스트."""

    def test_video_srt_bundle(self, tmp_path):
        from sams.pipeline.bundle import bundle_files
        mp4 = tmp_path / "DJI_001.MP4"
        srt = tmp_path / "DJI_001.SRT"
        mp4.write_bytes(b"video")
        srt.write_text("subtitle")

        groups = bundle_files([str(mp4), str(srt)])
        assert len(groups) == 1
        assert groups[0].group_type == "video_bundle"
        assert str(srt) in groups[0].bundled_files

    def test_video_without_srt(self, tmp_path):
        from sams.pipeline.bundle import bundle_files
        mp4 = tmp_path / "clip.mp4"
        mp4.write_bytes(b"video")

        groups = bundle_files([str(mp4)])
        assert len(groups) == 1
        assert groups[0].group_type == "single"


# ==========================================================================
# 통합 테스트 — 실제 파일 + 실제 라이브러리
# ==========================================================================

REAL_DATA = Path(os.environ.get("SAMS_TEST_DATA", "/tmp/sams-test-data"))


@pytest.mark.integration
class TestIntegrationPointcloud:
    """실제 LAS 파일로 추출 테스트."""

    @pytest.fixture(autouse=True)
    def skip_if_no_data(self):
        las_files = list(REAL_DATA.glob("*.las")) + list(REAL_DATA.glob("*.laz"))
        if not las_files:
            pytest.skip("실제 LAS/LAZ 파일 없음")
        self.las_file = las_files[0]

    def test_real_las(self):
        from sams.pipeline.extract import extract_pointcloud
        result = extract_pointcloud(str(self.las_file))
        assert result["pc:count"] > 0
        assert isinstance(result["pc:schemas"], list)
        assert result["file:size"] > 0


@pytest.mark.integration
class TestIntegrationOrthoimage:
    """실제 GeoTIFF 파일로 추출 테스트."""

    @pytest.fixture(autouse=True)
    def skip_if_no_data(self):
        tif_files = list(REAL_DATA.glob("*.tif")) + list(REAL_DATA.glob("*.tiff"))
        if not tif_files:
            pytest.skip("실제 GeoTIFF 파일 없음")
        self.tif_file = tif_files[0]

    def test_real_geotiff(self):
        from sams.pipeline.extract import extract_orthoimage
        result = extract_orthoimage(str(self.tif_file))
        assert result["proj:shape"][0] > 0
        assert result["ortho:gsd"] > 0


@pytest.mark.integration
class TestIntegrationVideo:
    """실제 비디오 파일로 추출 테스트."""

    @pytest.fixture(autouse=True)
    def skip_if_no_data(self):
        vid_files = list(REAL_DATA.glob("*.mp4")) + list(REAL_DATA.glob("*.mov"))
        if not vid_files:
            pytest.skip("실제 비디오 파일 없음")
        self.video_file = vid_files[0]

    def test_real_video(self):
        from sams.pipeline.extract import extract_video
        result = extract_video(str(self.video_file))
        assert result["video:duration"] > 0
        assert result["video:codec"] is not None
