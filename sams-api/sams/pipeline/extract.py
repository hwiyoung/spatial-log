"""
2단계: 유형별 메타데이터 자동 추출

파일 경로와 data_category를 받아, 해당 유형에 맞는 메타데이터를 추출한다.
각 추출 함수는 실패해도 빈 dict를 반환 — 등록 자체를 막지 않는다.

참조: docs/autofill_pipeline_spec.md 섹션 4
"""

import json
import logging
import os
import subprocess
from pathlib import Path

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Dispatch
# ---------------------------------------------------------------------------

_EXTRACTORS: dict[str, callable] = {}


def extract_metadata(
    filepath: str | Path,
    data_category: str,
    bundled_files: list[str] | None = None,
) -> dict:
    """유형별 메타데이터 추출 디스패치.

    Args:
        filepath: 대상 파일 경로
        data_category: detect.py에서 판별된 카테고리
        bundled_files: bundle.py에서 그룹된 동반 파일 목록 (3D 모델용)

    Returns:
        추출된 메타데이터 dict. 실패 시 빈 dict + 로그.
    """
    extractor = _EXTRACTORS.get(data_category)
    if extractor is None:
        logger.warning("카테고리 '%s'에 대한 추출기가 없습니다: %s", data_category, filepath)
        return _base_meta(filepath)

    try:
        if data_category in ("3d_model", "video", "image"):
            return extractor(filepath, bundled_files=bundled_files)
        return extractor(filepath)
    except Exception:
        logger.exception("메타데이터 추출 실패 (%s): %s", data_category, filepath)
        return _base_meta(filepath)


def _base_meta(filepath: str | Path) -> dict:
    """최소한의 공통 메타데이터 (file:size)."""
    try:
        size = os.path.getsize(filepath)
    except OSError:
        size = None
    return {"file:size": size}


def _bbox_to_4326(bbox: list[float], src_epsg: int) -> list[float] | None:
    """bbox를 EPSG:4326으로 변환한다. 실패 시 None.

    Args:
        bbox: [minx, miny, maxx, maxy] 또는 [minx, miny, minz, maxx, maxy, maxz]
        src_epsg: 원본 EPSG 코드
    Returns:
        [west, south, east, north] in EPSG:4326
    """
    if not src_epsg or src_epsg == 4326:
        return None  # 변환 불필요

    try:
        from rasterio.crs import CRS
        from rasterio.warp import transform_bounds

        src_crs = CRS.from_epsg(src_epsg)
        dst_crs = CRS.from_epsg(4326)

        # 6값 bbox (3D)이면 XY만 사용
        if len(bbox) == 6:
            left, bottom, right, top = bbox[0], bbox[1], bbox[3], bbox[4]
        else:
            left, bottom, right, top = bbox[0], bbox[1], bbox[2], bbox[3]

        west, south, east, north = transform_bounds(src_crs, dst_crs, left, bottom, right, top)
        return [round(west, 7), round(south, 7), round(east, 7), round(north, 7)]
    except Exception:
        logger.warning("bbox 좌표 변환 실패 (EPSG:%s → 4326): %s", src_epsg, bbox)
        return None


def _guess_epsg_from_bbox(bbox: list[float]) -> int | None:
    """bbox 좌표 범위로 CRS를 추정한다. LAS에 CRS 메타데이터가 없을 때 사용.

    한국 투영좌표계(EPSG:5186) 범위:
      X(Easting): 약 100,000 ~ 400,000
      Y(Northing): 약 300,000 ~ 700,000
    """
    if len(bbox) < 4:
        return None

    # 6값 bbox이면 XY만
    minx, miny = bbox[0], bbox[1]
    maxx = bbox[3] if len(bbox) == 6 else bbox[2]
    maxy = bbox[4] if len(bbox) == 6 else bbox[3]

    # 이미 경위도 범위면 4326
    if -180 <= minx <= 180 and -90 <= miny <= 90 and -180 <= maxx <= 180 and -90 <= maxy <= 90:
        # 단, 0 근처의 모델 좌표와 구분: 범위가 한국 부근이면 4326
        if 124 <= minx <= 132 and 33 <= miny <= 39:
            return 4326
        return None  # 경위도이긴 하지만 한국이 아니면 추정 안 함

    # 한국 중부원점 (EPSG:5186) — 가장 흔한 케이스
    if 100_000 <= minx <= 400_000 and 300_000 <= miny <= 700_000:
        return 5186

    # 한국 중부원점 (EPSG:5187) — 동부
    if 400_000 <= minx <= 600_000 and 300_000 <= miny <= 700_000:
        return 5187

    # UTM Zone 52N (EPSG:32652) — 한국 서부
    if 200_000 <= minx <= 800_000 and 3_500_000 <= miny <= 4_500_000:
        return 32652

    return None


# ---------------------------------------------------------------------------
# 포인트 클라우드 (LAS/LAZ/E57/PCD)
# ---------------------------------------------------------------------------

def extract_pointcloud(filepath: str | Path) -> dict:
    """포인트 클라우드 메타데이터 추출. 확장자에 따라 분기."""
    path = Path(filepath)
    ext = path.suffix.lower()

    if ext == ".e57":
        return _extract_pointcloud_e57(path)
    if ext in (".xyz", ".pts"):
        return _extract_pointcloud_text(path, ext)
    return _extract_pointcloud_las(path)


def _extract_pointcloud_las(path: Path) -> dict:
    """LAS/LAZ 메타데이터 추출. laspy 사용."""
    import laspy

    meta: dict = {"file:size": path.stat().st_size}

    las = laspy.read(str(path))
    h = las.header

    meta["pc:count"] = int(h.point_count)
    meta["pc:encoding"] = "LAZ" if path.suffix.lower() == ".laz" else "LAS"
    meta["pc:schemas"] = [
        {
            "name": d.name,
            "size": d.num_bytes,
            "type": d.dtype.name if d.dtype is not None else str(d.kind),
        }
        for d in las.point_format.dimensions
    ]
    meta["pc:has_rgb"] = any(
        d.name.lower() in ("red", "green", "blue")
        for d in las.point_format.dimensions
    )
    meta["pc:has_intensity"] = any(
        d.name.lower() == "intensity"
        for d in las.point_format.dimensions
    )
    meta["pc:las_version"] = f"{h.version.major}.{h.version.minor}"

    # bbox
    if h.mins is not None and h.maxs is not None:
        meta["bbox"] = [
            float(h.mins[0]), float(h.mins[1]), float(h.mins[2]),
            float(h.maxs[0]), float(h.maxs[1]), float(h.maxs[2]),
        ]
        dx = meta["bbox"][3] - meta["bbox"][0]
        dy = meta["bbox"][4] - meta["bbox"][1]
        area = dx * dy
        if area > 0:
            meta["pc:density"] = round(meta["pc:count"] / area, 1)

    # CRS
    epsg = None
    epsg_source = "unknown"
    try:
        crs = las.header.parse_crs()
        if crs and crs.to_epsg():
            epsg = crs.to_epsg()
            epsg_source = "file"
    except Exception:
        pass

    # CRS를 못 읽었으면 좌표 범위로 추정
    if not epsg and "bbox" in meta:
        epsg = _guess_epsg_from_bbox(meta["bbox"])
        if epsg:
            epsg_source = "estimated"
            logger.info("CRS 자동 추정: EPSG:%d (좌표 범위 기반)", epsg)

    meta["proj:epsg"] = epsg
    meta["_epsg_source"] = epsg_source

    # bbox를 EPSG:4326으로 변환
    if epsg and epsg != 4326 and "bbox" in meta:
        bbox_4326 = _bbox_to_4326(meta["bbox"], epsg)
        if bbox_4326:
            meta["bbox_4326"] = bbox_4326

    return meta


def _extract_pointcloud_e57(path: Path) -> dict:
    """E57 메타데이터 추출. XML 헤더 직접 파싱 (pye57 불필요).

    E57 파일(ASTM E2807): 바이너리 파일 끝부분에 XML 섹션이 있고,
    포인트 수는 <points ... recordCount="N"> 속성에,
    필드 정의는 <prototype> 하위 태그 이름에 기록된다.
    """
    import re
    import xml.etree.ElementTree as ET

    meta: dict = {"file:size": path.stat().st_size, "pc:encoding": "E57"}

    xml_text = _read_e57_xml(path)
    if not xml_text:
        logger.warning("E57 XML 헤더를 읽을 수 없습니다: %s", path)
        return meta

    # E57 바이너리에서 추출한 XML에 제어 문자가 섞일 수 있음 — 제거
    xml_text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", xml_text)
    # E57 XML은 네임스페이스를 사용 — 파싱 전에 제거
    xml_clean = re.sub(r'\s+xmlns(?::\w+)?="[^"]*"', "", xml_text)
    # 네임스페이스 접두사 제거 (nor:normalX → normalX 등)
    xml_clean = re.sub(r"<(/?)(\w+):", r"<\1\2_", xml_clean)

    try:
        root = ET.fromstring(xml_clean)
    except ET.ParseError:
        logger.warning("E57 XML 파싱 실패: %s", path)
        return meta

    total_points = 0
    has_rgb = False
    has_intensity = False
    all_fields: set[str] = set()
    bbox_mins = [None, None, None]
    bbox_maxs = [None, None, None]

    # 알려진 포인트 필드 태그
    known_fields = {
        "cartesianX", "cartesianY", "cartesianZ",
        "colorRed", "colorGreen", "colorBlue",
        "intensity", "sphericalRange", "sphericalAzimuth",
        "sphericalElevation", "rowIndex", "columnIndex",
        "returnCount", "returnIndex", "timeStamp",
        "cartesianInvalidState", "nor:normalX", "nor:normalY", "nor:normalZ",
    }

    for elem in root.iter():
        tag = elem.tag

        # <points type="CompressedVector" recordCount="28911204">
        # 포인트 수는 recordCount 속성에 있음
        if tag == "points":
            rc = elem.get("recordCount")
            if rc:
                try:
                    total_points += int(rc)
                except ValueError:
                    pass

            # prototype 하위에서 필드 이름 수집
            for proto in elem.iter("prototype"):
                for child in proto:
                    field_name = child.tag
                    all_fields.add(field_name)

        # cartesianBounds에서 bbox 추출
        if tag == "cartesianBounds":
            for bound_elem in elem:
                bt = bound_elem.tag
                val = bound_elem.text
                if val:
                    try:
                        fval = float(val)
                    except ValueError:
                        continue
                    if bt == "xMinimum":
                        bbox_mins[0] = _min_val(bbox_mins[0], fval)
                    elif bt == "xMaximum":
                        bbox_maxs[0] = _max_val(bbox_maxs[0], fval)
                    elif bt == "yMinimum":
                        bbox_mins[1] = _min_val(bbox_mins[1], fval)
                    elif bt == "yMaximum":
                        bbox_maxs[1] = _max_val(bbox_maxs[1], fval)
                    elif bt == "zMinimum":
                        bbox_mins[2] = _min_val(bbox_mins[2], fval)
                    elif bt == "zMaximum":
                        bbox_maxs[2] = _max_val(bbox_maxs[2], fval)

    # 결과 조합
    if total_points > 0:
        meta["pc:count"] = total_points

    # 필드 기반 RGB/intensity 판정
    for f in all_fields:
        if f in ("colorRed", "colorGreen", "colorBlue"):
            has_rgb = True
        if f == "intensity":
            has_intensity = True

    meta["pc:has_rgb"] = has_rgb
    meta["pc:has_intensity"] = has_intensity
    if all_fields:
        meta["pc:schemas"] = [
            {"name": f, "size": 0, "type": "float"} for f in sorted(all_fields)
        ]

    # bbox
    if all(v is not None for v in bbox_mins + bbox_maxs):
        meta["bbox"] = [
            bbox_mins[0], bbox_mins[1], bbox_mins[2],
            bbox_maxs[0], bbox_maxs[1], bbox_maxs[2],
        ]
        if total_points > 0:
            dx = bbox_maxs[0] - bbox_mins[0]
            dy = bbox_maxs[1] - bbox_mins[1]
            area = dx * dy
            if area > 0:
                meta["pc:density"] = round(total_points / area, 1)

    meta["proj:epsg"] = None
    meta["_epsg_source"] = "unknown"

    return meta


def _min_val(current: float | None, new: float) -> float:
    return new if current is None else min(current, new)


def _max_val(current: float | None, new: float) -> float:
    return new if current is None else max(current, new)


def _read_e57_xml(path: Path) -> str | None:
    """E57 파일에서 XML 헤더를 추출한다.

    E57 포맷 주의사항:
    - 첫 48바이트가 파일 헤더 (시그니처, 버전, XML 위치/크기)
    - 파일 전체가 1024바이트 페이지 단위로 구성됨
    - 각 페이지 끝 4바이트는 CRC32 체크섬 → XML에서 제거해야 함
    - pageSize는 헤더 바이트 40~47에 있음 (기본 1024)
    """
    import struct

    try:
        with open(path, "rb") as f:
            sig = f.read(8)
            if sig != b"ASTM-E57":
                return None

            rest = f.read(40)
            # major(4) + minor(4) + file_length(8) + xml_offset(8) + xml_length(8) + page_size(8)
            major, minor, file_length, xml_offset, xml_length, page_size = struct.unpack(
                "<II Q Q Q Q", rest[:40]
            )
            if page_size == 0:
                page_size = 1024

            # XML을 페이지 단위로 읽으면서 CRC(마지막 4바이트) 제거
            data_per_page = page_size - 4  # 각 페이지에서 실제 데이터 바이트
            xml_parts = []
            remaining = xml_length
            f.seek(xml_offset)

            while remaining > 0:
                # 현재 위치가 페이지 내 어디인지 계산
                current_pos = f.tell()
                page_start = (current_pos // page_size) * page_size
                offset_in_page = current_pos - page_start
                bytes_left_in_page = data_per_page - offset_in_page

                if bytes_left_in_page <= 0:
                    # CRC 영역에 있음 → 다음 페이지로 건너뜀
                    f.seek(page_start + page_size)
                    continue

                to_read = min(remaining, bytes_left_in_page)
                chunk = f.read(to_read)
                if not chunk:
                    break
                xml_parts.append(chunk)
                remaining -= len(chunk)

                # 이 페이지의 데이터를 다 읽었으면 CRC 4바이트 건너뜀
                if f.tell() - page_start >= data_per_page:
                    f.seek(page_start + page_size)

            xml_bytes = b"".join(xml_parts)
            return xml_bytes.decode("utf-8", errors="ignore")
    except (OSError, struct.error):
        return None


def _extract_pointcloud_text(path: Path, ext: str) -> dict:
    """XYZ/PTS 텍스트 포인트 클라우드 메타데이터 추출.

    XYZ 형식: X Y Z [R G B] [Intensity] (공백/탭 구분, 헤더 없음)
    PTS 형식: 첫 줄에 포인트 수, 이후 X Y Z I R G B (공백 구분)
    """
    meta: dict = {"file:size": path.stat().st_size}
    meta["pc:encoding"] = ext.lstrip(".").upper()

    x_min = y_min = z_min = float("inf")
    x_max = y_max = z_max = float("-inf")
    point_count = 0
    has_rgb = False
    has_intensity = False
    header_lines = 0

    try:
        with open(path, "r", errors="ignore") as f:
            for i, line in enumerate(f):
                line = line.strip()
                if not line or line.startswith("//") or line.startswith("#"):
                    header_lines += 1
                    continue

                parts = line.split()

                # PTS: 첫 번째 숫자-only 줄이 포인트 수일 수 있음
                if i == 0 and len(parts) == 1 and ext == ".pts":
                    try:
                        meta["pc:count"] = int(parts[0])
                        header_lines += 1
                        continue
                    except ValueError:
                        pass

                if len(parts) < 3:
                    continue

                try:
                    x, y, z = float(parts[0]), float(parts[1]), float(parts[2])
                except ValueError:
                    if point_count == 0:
                        header_lines += 1
                    continue

                point_count += 1
                x_min, y_min, z_min = min(x_min, x), min(y_min, y), min(z_min, z)
                x_max, y_max, z_max = max(x_max, x), max(y_max, y), max(z_max, z)

                # 첫 100줄에서 필드 수로 RGB/Intensity 판단
                if point_count <= 100:
                    if len(parts) >= 7:
                        has_rgb = True
                        has_intensity = True
                    elif len(parts) >= 6:
                        has_rgb = True
                    elif len(parts) >= 4:
                        has_intensity = True

                # 대용량 파일: 처음 10만줄 + 마지막 1만줄만 샘플링
                if point_count == 100000:
                    # 나머지는 줄 수만 세기
                    remaining = sum(1 for _ in f)
                    point_count += remaining
                    break

    except OSError:
        return {"file:size": meta.get("file:size")}

    if "pc:count" not in meta:
        meta["pc:count"] = point_count
    meta["pc:has_rgb"] = has_rgb
    meta["pc:has_intensity"] = has_intensity

    if point_count > 0 and x_min != float("inf"):
        meta["bbox"] = [x_min, y_min, z_min, x_max, y_max, z_max]

        # 좌표 범위로 CRS 추정
        if -180 <= x_min <= 180 and -180 <= x_max <= 180 and -90 <= y_min <= 90 and -90 <= y_max <= 90:
            meta["proj:epsg"] = 4326
            meta["_epsg_source"] = "estimated"
            meta["bbox_4326"] = [x_min, y_min, x_max, y_max]
        else:
            meta["proj:epsg"] = None
            meta["_epsg_source"] = "unknown"

        dx = x_max - x_min
        dy = y_max - y_min
        area = dx * dy
        if area > 0:
            meta["pc:density"] = round(meta["pc:count"] / area, 1)
    else:
        meta["proj:epsg"] = None
        meta["_epsg_source"] = "unknown"

    return meta


_EXTRACTORS["pointcloud"] = extract_pointcloud


# ---------------------------------------------------------------------------
# 3D 모델 (OBJ/PLY/FBX/glTF/STL)
# ---------------------------------------------------------------------------

def extract_3dmodel(
    filepath: str | Path,
    bundled_files: list[str] | None = None,
) -> dict:
    """3D 모델 메타데이터 추출. trimesh 사용.

    bundled_files가 있으면 텍스처/재질 정보를 번들에서 결정.
    """
    import trimesh

    path = Path(filepath)
    meta: dict = {"file:size": path.stat().st_size}

    mesh = trimesh.load(str(path), force="mesh")

    meta["3dmodel:format"] = path.suffix.lstrip(".").lower()
    meta["3dmodel:vertex_count"] = int(mesh.vertices.shape[0])
    meta["3dmodel:face_count"] = int(mesh.faces.shape[0]) if hasattr(mesh, "faces") and mesh.faces is not None else 0
    meta["3dmodel:has_normals"] = (
        mesh.vertex_normals is not None and len(mesh.vertex_normals) > 0
    )

    # bounding volume + bbox 추출
    if mesh.bounds is not None:
        bmin = mesh.bounds[0].tolist()
        bmax = mesh.bounds[1].tolist()
        meta["3dmodel:bounding_volume"] = {"min": bmin, "max": bmax}

        # vertex 좌표에서 bbox 생성 (XY만)
        meta["bbox"] = [bmin[0], bmin[1], bmax[0], bmax[1]]

        # 좌표 범위로 CRS 추정
        if -180 <= bmin[0] <= 180 and -180 <= bmax[0] <= 180 and -90 <= bmin[1] <= 90 and -90 <= bmax[1] <= 90:
            # 경위도 범위 → EPSG:4326으로 추정
            meta["bbox_4326"] = meta["bbox"]

    # 텍스처/재질 — 번들 정보 우선
    if bundled_files:
        texture_exts = {".jpg", ".jpeg", ".png", ".tga", ".bmp"}
        mtl_exts = {".mtl"}
        textures = [f for f in bundled_files if Path(f).suffix.lower() in texture_exts]
        materials = [f for f in bundled_files if Path(f).suffix.lower() in mtl_exts]
        meta["3dmodel:has_texture"] = len(textures) > 0
        meta["3dmodel:texture_count"] = len(textures)
        meta["3dmodel:material_count"] = len(materials)
    else:
        # 번들 없으면 같은 폴더 탐색
        texture_exts = {".jpg", ".jpeg", ".png", ".tga", ".bmp"}
        textures = [
            f for f in path.parent.iterdir()
            if f.suffix.lower() in texture_exts and path.stem.lower() in f.stem.lower()
        ]
        mtl_files = list(path.parent.glob(f"{path.stem}*.mtl"))
        meta["3dmodel:has_texture"] = len(textures) > 0 or len(mtl_files) > 0
        meta["3dmodel:texture_count"] = len(textures)
        meta["3dmodel:material_count"] = len(mtl_files)

    # 3D 모델은 CRS를 자체 포함하지 않음 — bbox_4326이 있으면 추정됨
    if "bbox_4326" not in meta:
        meta["proj:epsg"] = None
        meta["_epsg_source"] = "unknown"
    else:
        meta["proj:epsg"] = 4326
        meta["_epsg_source"] = "estimated"

    return meta


_EXTRACTORS["3d_model"] = extract_3dmodel


# ---------------------------------------------------------------------------
# 3D Tiles
# ---------------------------------------------------------------------------

def extract_3dtiles(filepath: str | Path) -> dict:
    """3D Tiles의 tileset.json 또는 .3tz(zip archive) 파싱."""
    import zipfile

    path = Path(filepath)
    meta: dict = {"file:size": path.stat().st_size}

    # .3tz는 zip 안에 tileset.json이 있음
    if path.suffix.lower() == ".3tz":
        try:
            with zipfile.ZipFile(path, "r") as zf:
                # tileset.json 찾기
                tileset_name = None
                for name in zf.namelist():
                    if name.endswith("tileset.json"):
                        tileset_name = name
                        break
                if not tileset_name:
                    logger.warning("3tz 파일에서 tileset.json을 찾을 수 없음: %s", path)
                    return meta
                with zf.open(tileset_name) as f:
                    tileset = json.loads(f.read().decode("utf-8"))
        except (zipfile.BadZipFile, OSError):
            logger.warning("3tz 파일을 열 수 없음: %s", path)
            return meta
    else:
        with open(path, encoding="utf-8") as f:
            tileset = json.load(f)

    asset = tileset.get("asset", {})
    meta["3dtiles:version"] = asset.get("version", "1.0")

    root = tileset.get("root", {})
    meta["3dtiles:geometric_error"] = root.get("geometricError")

    # tile format — content의 uri 확장자로 추정
    content = root.get("content", {})
    uri = content.get("uri", content.get("url", ""))
    if uri:
        ext = Path(uri).suffix.lower()
        fmt_map = {".b3dm": "b3dm", ".i3dm": "i3dm", ".pnts": "pnts", ".glb": "glb"}
        meta["3dtiles:tile_format"] = fmt_map.get(ext, ext.lstrip("."))
    else:
        meta["3dtiles:tile_format"] = None

    # bounding volume에서 region 추출 → bbox
    bv = root.get("boundingVolume", {})
    region = bv.get("region")
    if region and len(region) >= 4:
        import math
        meta["bbox"] = [
            math.degrees(region[0]),  # west
            math.degrees(region[1]),  # south
            math.degrees(region[2]),  # east
            math.degrees(region[3]),  # north
        ]
        meta["proj:epsg"] = 4326
        meta["bbox_4326"] = meta["bbox"]
        meta["_epsg_source"] = "file"
    else:
        # box 타입도 시도 (center + halfSize)
        box = bv.get("box")
        if box and len(box) >= 12:
            cx, cy, cz = box[0], box[1], box[2]
            # box는 [cx,cy,cz, x0,x1,x2, y0,y1,y2, z0,z1,z2] — 단순화
            hx = abs(box[3])
            hy = abs(box[7])
            if -180 <= cx <= 180 and -90 <= cy <= 90:
                meta["bbox"] = [cx - hx, cy - hy, cx + hx, cy + hy]
                meta["bbox_4326"] = meta["bbox"]
                meta["proj:epsg"] = 4326
                meta["_epsg_source"] = "estimated"
            else:
                meta["proj:epsg"] = None
                meta["_epsg_source"] = "unknown"
        else:
            meta["proj:epsg"] = None
            meta["_epsg_source"] = "unknown"

    return meta


_EXTRACTORS["3d_tiles"] = extract_3dtiles


# ---------------------------------------------------------------------------
# 정사영상 (GeoTIFF)
# ---------------------------------------------------------------------------

def extract_orthoimage(filepath: str | Path) -> dict:
    """GeoTIFF 메타데이터 추출. rasterio 사용."""
    import rasterio

    path = Path(filepath)
    meta: dict = {"file:size": path.stat().st_size}

    with rasterio.open(str(path)) as ds:
        meta["proj:epsg"] = ds.crs.to_epsg() if ds.crs else None
        meta["_epsg_source"] = "file" if meta["proj:epsg"] else "unknown"
        meta["proj:shape"] = [ds.height, ds.width]
        meta["proj:transform"] = list(ds.transform)[:6]
        meta["bbox"] = [
            ds.bounds.left, ds.bounds.bottom,
            ds.bounds.right, ds.bounds.top,
        ]

        descriptions = ds.descriptions if ds.descriptions else [None] * ds.count
        meta["eo:bands"] = [
            {"name": d or f"band_{i + 1}", "common_name": None}
            for i, d in enumerate(descriptions)
        ]

        meta["ortho:gsd"] = round(abs(ds.res[0]), 4)
        dtype_str = str(ds.dtypes[0])
        meta["ortho:bit_depth"] = 8 if "uint8" in dtype_str else (
            16 if "uint16" in dtype_str or "int16" in dtype_str else 32
        )

    # bbox를 EPSG:4326으로 변환
    epsg = meta.get("proj:epsg")
    if epsg and epsg != 4326 and "bbox" in meta:
        bbox_4326 = _bbox_to_4326(meta["bbox"], epsg)
        if bbox_4326:
            meta["bbox_4326"] = bbox_4326

    return meta


_EXTRACTORS["orthoimage"] = extract_orthoimage


# ---------------------------------------------------------------------------
# 원본 이미지 (JPG/PNG)
# ---------------------------------------------------------------------------

def extract_image(
    filepath: str | Path,
    bundled_files: list[str] | None = None,
) -> dict:
    """이미지 EXIF 메타데이터 추출. Pillow + piexif 사용.

    이미지 세트(bundled_files)가 있으면 image:image_count와
    GPS 좌표들의 ConvexHull Polygon geometry를 생성한다.
    """
    from PIL import Image

    path = Path(filepath)
    meta: dict = {"file:size": path.stat().st_size}

    with Image.open(path) as img:
        meta["image:resolution"] = [img.size[0], img.size[1]]

    # 대표 이미지(primary) EXIF
    exif_data = _read_exif(path)
    if exif_data:
        meta["image:camera_model"] = exif_data.get("camera_model")
        meta["image:focal_length"] = exif_data.get("focal_length")
        meta["image:orientation"] = exif_data.get("orientation")
        meta["image:has_geotag"] = exif_data.get("has_geotag", False)
        meta["datetime"] = exif_data.get("datetime")
        if exif_data.get("geometry"):
            meta["geometry"] = exif_data["geometry"]
    else:
        meta["image:has_geotag"] = False

    # 이미지 세트 처리
    if bundled_files:
        all_images = [str(path)] + bundled_files
        meta["image:image_count"] = len(all_images)

        # 전체 파일 크기 합산
        total_size = meta.get("file:size", 0)
        for bf in bundled_files:
            try:
                total_size += os.path.getsize(bf)
            except OSError:
                pass
        meta["file:size"] = total_size

        # GPS 좌표 + datetime을 한 번에 수집 (샘플링)
        # 대량 이미지 세트에서는 균등 샘플링으로 성능 확보
        max_sample = 100
        if len(all_images) > max_sample:
            step = len(all_images) / max_sample
            sample_indices = [int(i * step) for i in range(max_sample)]
            sampled = [all_images[i] for i in sample_indices]
            # 첫/마지막은 반드시 포함 (datetime 범위용)
            if 0 not in sample_indices:
                sampled.insert(0, all_images[0])
            if len(all_images) - 1 not in sample_indices:
                sampled.append(all_images[-1])
        else:
            sampled = all_images

        gps_coords = []
        datetimes = []
        for img_path in sampled:
            exif = _read_exif(Path(img_path))
            if exif:
                if exif.get("geometry"):
                    gps_coords.append(exif["geometry"]["coordinates"])
                if exif.get("datetime"):
                    datetimes.append(exif["datetime"])

        if len(gps_coords) >= 3:
            meta["geometry"] = _convex_hull_polygon(gps_coords)
            meta["image:has_geotag"] = True
            lngs = [c[0] for c in gps_coords]
            lats = [c[1] for c in gps_coords]
            meta["bbox"] = [min(lngs), min(lats), max(lngs), max(lats)]
            meta["bbox_4326"] = meta["bbox"]
        elif len(gps_coords) == 2:
            meta["geometry"] = {"type": "LineString", "coordinates": gps_coords}
            meta["image:has_geotag"] = True
            lngs = [c[0] for c in gps_coords]
            lats = [c[1] for c in gps_coords]
            meta["bbox"] = [min(lngs), min(lats), max(lngs), max(lats)]
            meta["bbox_4326"] = meta["bbox"]
        elif len(gps_coords) == 1:
            meta["geometry"] = {"type": "Point", "coordinates": gps_coords[0]}
            meta["image:has_geotag"] = True
            meta["bbox"] = [gps_coords[0][0], gps_coords[0][1], gps_coords[0][0], gps_coords[0][1]]
            meta["bbox_4326"] = meta["bbox"]

        if datetimes:
            datetimes.sort()
            meta["start_datetime"] = datetimes[0]
            meta["end_datetime"] = datetimes[-1]
            meta["datetime"] = None

    return meta


_EXTRACTORS["image"] = extract_image


# ---------------------------------------------------------------------------
# 파노라마
# ---------------------------------------------------------------------------

def extract_panorama(filepath: str | Path) -> dict:
    """파노라마 메타데이터 추출."""
    from PIL import Image

    path = Path(filepath)
    meta: dict = {"file:size": path.stat().st_size}

    with Image.open(path) as img:
        w, h = img.size
        meta["panorama:resolution"] = [w, h]

    # 비율로 유형 추정
    if h > 0:
        ratio = w / h
        if 1.8 <= ratio <= 2.2:
            meta["panorama:type"] = "equirectangular"
            meta["panorama:fov_horizontal"] = 360.0
            meta["panorama:fov_vertical"] = 180.0
        else:
            meta["panorama:type"] = "unknown"
            meta["panorama:fov_horizontal"] = None
            meta["panorama:fov_vertical"] = None
    else:
        meta["panorama:type"] = "unknown"

    # EXIF
    exif_data = _read_exif(path)
    if exif_data:
        meta["panorama:camera_model"] = exif_data.get("camera_model")
        meta["datetime"] = exif_data.get("datetime")
        if exif_data.get("geometry"):
            meta["geometry"] = exif_data["geometry"]

    return meta


_EXTRACTORS["panorama"] = extract_panorama


# ---------------------------------------------------------------------------
# 동영상 (MP4/MOV/AVI/MKV)
# ---------------------------------------------------------------------------

def extract_video(
    filepath: str | Path,
    bundled_files: list[str] | None = None,
) -> dict:
    """동영상 메타데이터 추출. ffprobe + SRT 텔레메트리 사용."""
    path = Path(filepath)
    meta: dict = {"file:size": path.stat().st_size}

    cmd = [
        "ffprobe", "-v", "quiet",
        "-print_format", "json",
        "-show_format", "-show_streams",
        str(path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    if result.returncode != 0:
        logger.warning("ffprobe 실행 실패: %s", result.stderr[:200])
        return meta

    info = json.loads(result.stdout)

    video_stream = next(
        (s for s in info.get("streams", []) if s.get("codec_type") == "video"),
        None,
    )
    audio_stream = next(
        (s for s in info.get("streams", []) if s.get("codec_type") == "audio"),
        None,
    )

    if video_stream:
        meta["video:codec"] = video_stream.get("codec_name")
        meta["video:resolution"] = [
            int(video_stream.get("width", 0)),
            int(video_stream.get("height", 0)),
        ]
        fps_str = video_stream.get("r_frame_rate", "0/1")
        parts = fps_str.split("/")
        if len(parts) == 2 and int(parts[1]) != 0:
            meta["video:frame_rate"] = round(int(parts[0]) / int(parts[1]), 2)
        else:
            meta["video:frame_rate"] = 0

    fmt = info.get("format", {})
    meta["video:duration"] = round(float(fmt.get("duration", 0)), 1)
    meta["video:bitrate"] = int(fmt.get("bit_rate", 0))
    meta["video:has_audio"] = audio_stream is not None
    if audio_stream:
        meta["video:audio_codec"] = audio_stream.get("codec_name")

    frame_rate = meta.get("video:frame_rate", 0)
    duration = meta.get("video:duration", 0)
    meta["video:total_frames"] = int(duration * frame_rate)

    # 촬영 시간 + GPS 위치
    tags = fmt.get("tags", {})
    meta["datetime"] = tags.get("creation_time")

    # GPS: DJI 드론 등은 location 태그에 ISO 6709 형식으로 기록
    # 예: "+37.5410+127.0460/" 또는 "+37.5410+127.0460+100.5/"
    location = (
        tags.get("location")
        or tags.get("com.apple.quicktime.location.ISO6709")
    )
    geo = _parse_iso6709(location) if location else None
    if geo:
        meta["geometry"] = geo
        meta["video:has_geotag"] = True
    else:
        meta["video:has_geotag"] = False

    # SRT 텔레메트리: DJI SRT에서 프레임별 GPS → 촬영 경로 (LineString)
    srt_file = _find_srt(bundled_files)
    if srt_file:
        srt_data = _parse_dji_srt(srt_file)
        if srt_data and srt_data["coordinates"]:
            meta["geometry"] = {
                "type": "LineString",
                "coordinates": srt_data["coordinates"],
            }
            meta["video:has_geotag"] = True
            meta["video:track_points"] = len(srt_data["coordinates"])
            if srt_data.get("alt_min") is not None:
                meta["video:altitude_range"] = [
                    srt_data["alt_min"], srt_data["alt_max"],
                ]

    return meta


_EXTRACTORS["video"] = extract_video


# ---------------------------------------------------------------------------
# 문헌정보 (PDF/HWP/DOCX)
# ---------------------------------------------------------------------------

def extract_document(filepath: str | Path) -> dict:
    """문서 메타데이터 추출. PDF(pypdf), DOCX(python-docx)."""
    path = Path(filepath)
    ext = path.suffix.lower()
    meta: dict = {
        "file:size": path.stat().st_size,
        "document:format": ext.lstrip("."),
    }

    if ext == ".pdf":
        try:
            _extract_pdf(path, meta)
        except Exception:
            logger.warning("PDF 메타데이터 추출 실패: %s", path)
    elif ext == ".docx":
        try:
            _extract_docx(path, meta)
        except Exception:
            logger.warning("DOCX 메타데이터 추출 실패: %s", path)

    return meta


def _extract_pdf(path: Path, meta: dict) -> None:
    """PDF 전용 메타데이터 추출."""
    from pypdf import PdfReader

    reader = PdfReader(str(path))
    meta["document:pages"] = len(reader.pages)

    pdf_meta = reader.metadata
    if pdf_meta:
        title = pdf_meta.get("/Title")
        if title:
            meta["document:title"] = str(title)
        author = pdf_meta.get("/Author")
        if author:
            meta["document:authors"] = str(author)
        creation = pdf_meta.get("/CreationDate")
        if creation:
            meta["datetime"] = str(creation)


def _extract_docx(path: Path, meta: dict) -> None:
    """DOCX 전용 메타데이터 추출."""
    from docx import Document

    doc = Document(str(path))

    # 페이지 수: DOCX에서 정확한 페이지 수는 렌더링 없이 알 수 없음
    # 단락 수로 대체 표기
    meta["document:paragraphs"] = len(doc.paragraphs)

    core = doc.core_properties
    if core.title:
        meta["document:title"] = str(core.title)
    if core.author:
        meta["document:authors"] = str(core.author)
    if core.created:
        meta["datetime"] = core.created.isoformat()


_EXTRACTORS["document"] = extract_document


# ---------------------------------------------------------------------------
# EXIF 공통 헬퍼
# ---------------------------------------------------------------------------

def _read_exif(filepath: Path) -> dict | None:
    """Pillow의 EXIF 태그를 읽어 정리된 dict로 반환.

    주의: FocalLength, DateTimeOriginal 등은 IFD0이 아니라 ExifIFD(0x8769)에
    저장된다. getexif()는 IFD0만 반환하므로 get_ifd()로 서브 IFD를 별도 접근.
    """
    try:
        from PIL import Image
        from PIL.ExifTags import Base as ExifBase

        with Image.open(filepath) as img:
            exif_raw = img.getexif()
            if not exif_raw:
                return None

        result: dict = {}

        # ExifIFD (0x8769) — FocalLength, DateTimeOriginal 등이 여기에 있음
        exif_ifd = exif_raw.get_ifd(0x8769)

        # 카메라 모델 — IFD0에 있음
        make = exif_raw.get(ExifBase.Make, "")
        model = exif_raw.get(ExifBase.Model, "")
        camera = f"{make} {model}".strip() if (make or model) else None
        result["camera_model"] = camera

        # 초점 거리 — ExifIFD에 있음 (tag 0x920A = 37386)
        fl = exif_ifd.get(0x920A) if exif_ifd else None
        if fl is None:
            fl = exif_raw.get(ExifBase.FocalLength)
        if fl:
            result["focal_length"] = float(fl)

        # 방향 — IFD0에 있음
        orient = exif_raw.get(ExifBase.Orientation)
        if orient:
            result["orientation"] = int(orient)

        # 촬영 시간 — ExifIFD에 있음 (tag 0x9003 = 36867)
        dt = None
        if exif_ifd:
            dt = exif_ifd.get(0x9003)  # DateTimeOriginal
            if not dt:
                dt = exif_ifd.get(0x9004)  # DateTimeDigitized
        if not dt:
            dt = exif_raw.get(ExifBase.DateTime)  # IFD0 fallback
        if dt:
            result["datetime"] = _exif_datetime_to_iso(str(dt))

        # GPS — GPSInfo IFD (0x8825)
        gps_ifd = exif_raw.get_ifd(0x8825)
        if gps_ifd:
            lat = _gps_to_decimal(gps_ifd.get(2), gps_ifd.get(1))
            lon = _gps_to_decimal(gps_ifd.get(4), gps_ifd.get(3))
            if lat is not None and lon is not None:
                result["has_geotag"] = True
                result["geometry"] = {
                    "type": "Point",
                    "coordinates": [round(lon, 7), round(lat, 7)],
                }
            else:
                result["has_geotag"] = False
        else:
            result["has_geotag"] = False

        return result
    except Exception:
        logger.debug("EXIF 읽기 실패: %s", filepath, exc_info=True)
        return None


def _exif_datetime_to_iso(dt_str: str) -> str:
    """EXIF datetime 형식을 ISO 8601로 변환.
    '2024:10:04 15:16:01' → '2024-10-04T15:16:01Z'
    """
    try:
        dt_str = dt_str.strip()
        if len(dt_str) >= 19 and dt_str[4] == ":":
            return dt_str[:4] + "-" + dt_str[5:7] + "-" + dt_str[8:10] + "T" + dt_str[11:] + "Z"
        return dt_str
    except Exception:
        return dt_str


def _gps_to_decimal(
    dms_tuple: tuple | None,
    ref: str | None,
) -> float | None:
    """GPS DMS 튜플을 십진 도(degree)로 변환."""
    if dms_tuple is None or ref is None:
        return None
    try:
        d, m, s = [float(v) for v in dms_tuple]
        decimal = d + m / 60 + s / 3600
        if ref in ("S", "W"):
            decimal = -decimal
        return decimal
    except (TypeError, ValueError):
        return None


def _collect_gps_from_images(image_paths: list[str]) -> list[list[float]]:
    """여러 이미지에서 GPS 좌표를 수집한다."""
    coords = []
    for img_path in image_paths:
        exif = _read_exif(Path(img_path))
        if exif and exif.get("geometry"):
            coords.append(exif["geometry"]["coordinates"])
    return coords


def _convex_hull_polygon(coords: list[list[float]]) -> dict:
    """2D 좌표 목록으로 ConvexHull Polygon GeoJSON을 생성한다."""
    if len(coords) == 1:
        return {"type": "Point", "coordinates": coords[0]}
    if len(coords) == 2:
        return {"type": "LineString", "coordinates": coords}

    # Graham scan 간이 구현 (numpy 없이)
    points = sorted(set((c[0], c[1]) for c in coords))

    if len(points) < 3:
        # 중복 제거 후 3개 미만이면 최소 형태 반환
        unique = [[p[0], p[1]] for p in points]
        if len(unique) == 1:
            return {"type": "Point", "coordinates": unique[0]}
        return {"type": "LineString", "coordinates": unique}

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    lower = []
    for p in points:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)
    upper = []
    for p in reversed(points):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)

    hull = lower[:-1] + upper[:-1]
    ring = [[round(p[0], 7), round(p[1], 7)] for p in hull]
    ring.append(ring[0])  # 닫기

    return {"type": "Polygon", "coordinates": [ring]}


def _parse_iso6709(location: str) -> dict | None:
    """ISO 6709 위치 문자열을 GeoJSON Point로 변환.

    형식 예시:
      "+37.5410+127.0460/"          (위도+경도)
      "+37.5410+127.0460+100.5/"    (위도+경도+고도)
      "+37.5410-127.0460/"          (음수 경도)
    """
    import re

    if not location:
        return None

    # ISO 6709: (+|-)DD.DDD(+|-)DDD.DDD(+|-DDD.DDD)?/
    m = re.match(
        r"([+-]\d+\.?\d*)"   # 위도
        r"([+-]\d+\.?\d*)"   # 경도
        r"([+-]\d+\.?\d*)?"  # 고도 (선택)
        r"/?$",
        location.strip(),
    )
    if not m:
        return None

    try:
        lat = float(m.group(1))
        lon = float(m.group(2))
    except (ValueError, TypeError):
        return None

    coords = [round(lon, 7), round(lat, 7)]
    if m.group(3):
        try:
            alt = float(m.group(3))
            coords.append(round(alt, 2))
        except ValueError:
            pass

    return {"type": "Point", "coordinates": coords}


# ---------------------------------------------------------------------------
# SRT 텔레메트리 (DJI 드론 동영상 동반 파일)
# ---------------------------------------------------------------------------

def _find_srt(bundled_files: list[str] | None) -> Path | None:
    """번들된 파일에서 SRT 파일을 찾는다."""
    if not bundled_files:
        return None
    for f in bundled_files:
        if Path(f).suffix.lower() == ".srt":
            p = Path(f)
            if p.exists():
                return p
    return None


def _parse_dji_srt(srt_path: Path) -> dict | None:
    """DJI SRT 파일에서 프레임별 GPS를 파싱하여 경로 좌표를 반환.

    DJI SRT 형식 (여러 변종 지원):
      변종 1 (Mini/Air): GPS (127.0460, 37.5410, 100.5)
      변종 2 (Mavic/Phantom): [latitude: 37.5410] [longitude: 127.0460] [altitude: 100.5]
      변종 3 (최신 펌웨어): [latitude : 37.5410] [longtitude : 127.0460] [rel_alt: 100.5]

    Returns:
        {"coordinates": [[lon, lat, alt], ...], "alt_min": float, "alt_max": float}
    """
    import re

    try:
        text = srt_path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return None

    coords: list[list[float]] = []
    alts: list[float] = []

    # 패턴 1: GPS (lon, lat, alt) 또는 GPS(lon, lat, alt)
    pat1 = re.compile(
        r"GPS\s*\(\s*"
        r"([+-]?\d+\.?\d*)\s*,\s*"   # lon
        r"([+-]?\d+\.?\d*)\s*,\s*"   # lat
        r"([+-]?\d+\.?\d*)\s*\)",     # alt
    )

    # 패턴 2: [latitude: N] [longitude: N] [altitude: N] (또는 longtitude, rel_alt)
    pat2 = re.compile(
        r"\[lat(?:itude)?\s*:\s*([+-]?\d+\.?\d*)\]"
        r".*?"
        r"\[long?(?:t?itude)?\s*:\s*([+-]?\d+\.?\d*)\]"
        r"(?:.*?\[(?:rel_)?alt(?:itude)?\s*:\s*([+-]?\d+\.?\d*)\])?",
        re.IGNORECASE,
    )

    seen: set[tuple[float, float]] = set()

    for line in text.split("\n"):
        m = pat1.search(line)
        if m:
            lon, lat, alt = float(m.group(1)), float(m.group(2)), float(m.group(3))
        else:
            m = pat2.search(line)
            if m:
                lat, lon = float(m.group(1)), float(m.group(2))
                alt = float(m.group(3)) if m.group(3) else 0.0
            else:
                continue

        # 중복 좌표 제거 (정지 상태에서 같은 좌표가 반복됨)
        key = (round(lon, 6), round(lat, 6))
        if key in seen:
            continue
        seen.add(key)

        # 유효성 검사
        if -180 <= lon <= 180 and -90 <= lat <= 90:
            coords.append([round(lon, 7), round(lat, 7), round(alt, 2)])
            alts.append(alt)

    if not coords:
        return None

    return {
        "coordinates": coords,
        "alt_min": round(min(alts), 2),
        "alt_max": round(max(alts), 2),
    }
