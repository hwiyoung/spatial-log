"""
Spatial Converter Core
PDAL 및 py3dtiles 기반 3D 데이터 변환 로직
"""

import os
import json
import subprocess
import tempfile
import shutil
from enum import Enum
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional, Callable

import structlog

logger = structlog.get_logger()


class ConversionType(str, Enum):
    """변환 타입"""
    E57_TO_PLY = "e57_to_ply"
    E57_TO_LAS = "e57_to_las"
    LAS_TO_COPC = "las_to_copc"
    PLY_TO_COPC = "ply_to_copc"
    LAZ_TO_COPC = "laz_to_copc"
    OBJ_TO_3DTILES = "obj_to_3dtiles"
    GLTF_TO_3DTILES = "gltf_to_3dtiles"
    GLB_TO_3DTILES = "glb_to_3dtiles"
    PLY_TO_3DTILES = "ply_to_3dtiles"
    LAS_TO_3DTILES = "las_to_3dtiles"
    E57_TO_3DTILES = "e57_to_3dtiles"


@dataclass
class ConversionStatus:
    """변환 상태"""
    job_id: str
    file_id: str
    status: str  # pending, converting, ready, failed
    progress: int = 0
    output_path: Optional[str] = None
    error: Optional[str] = None


@dataclass
class ConversionResult:
    """변환 결과"""
    success: bool
    output_path: Optional[str] = None
    error: Optional[str] = None
    metadata: dict = field(default_factory=dict)


class SpatialConverter:
    """3D 데이터 변환기"""

    def __init__(self, storage_path: str = "/var/lib/storage"):
        self.storage_path = Path(storage_path)
        self.output_base = Path(os.getenv("OUTPUT_PATH", "/app/output"))
        self.temp_path = Path(os.getenv("TEMP_PATH", "/app/temp"))

        # 출력 디렉토리 생성
        self.output_base.mkdir(parents=True, exist_ok=True)
        self.temp_path.mkdir(parents=True, exist_ok=True)

    def convert(
        self,
        source_path: str,
        conversion_type: ConversionType,
        options: dict = None,
        progress_callback: Callable[[int], None] = None
    ) -> ConversionResult:
        """변환 실행"""
        options = options or {}
        source = Path(source_path)

        if not source.exists():
            return ConversionResult(
                success=False,
                error=f"원본 파일을 찾을 수 없습니다: {source_path}"
            )

        logger.info(
            "conversion_starting",
            source=str(source),
            conversion_type=conversion_type.value
        )

        try:
            # 변환 타입에 따라 적절한 메서드 호출
            if conversion_type == ConversionType.E57_TO_PLY:
                return self._convert_e57_to_ply(source, options, progress_callback)
            elif conversion_type == ConversionType.E57_TO_LAS:
                return self._convert_e57_to_las(source, options, progress_callback)
            elif conversion_type in [ConversionType.LAS_TO_COPC, ConversionType.LAZ_TO_COPC, ConversionType.PLY_TO_COPC]:
                return self._convert_to_copc(source, options, progress_callback)
            elif conversion_type in [ConversionType.OBJ_TO_3DTILES, ConversionType.GLTF_TO_3DTILES, ConversionType.GLB_TO_3DTILES]:
                return self._convert_to_3dtiles(source, options, progress_callback)
            elif conversion_type in [ConversionType.PLY_TO_3DTILES, ConversionType.LAS_TO_3DTILES]:
                return self._convert_pointcloud_to_3dtiles(source, options, progress_callback)
            elif conversion_type == ConversionType.E57_TO_3DTILES:
                return self._convert_e57_to_3dtiles(source, options, progress_callback)
            else:
                return ConversionResult(
                    success=False,
                    error=f"지원하지 않는 변환 타입: {conversion_type.value}"
                )

        except Exception as e:
            logger.exception("conversion_error", source=str(source))
            return ConversionResult(
                success=False,
                error=str(e)
            )

    def _detect_coordinate_system(self, source: Path, file_format: str = None) -> dict:
        """좌표계 감지 (지리 좌표계 vs 투영 좌표계)

        Args:
            source: 소스 파일 경로
            file_format: 파일 포맷 (e57, las, ply 등) - 확장자 없는 파일용

        Returns:
            dict with keys:
            - is_geographic: True if coordinates appear to be lat/lon
            - point_count: number of points
            - bbox: bounding box (minx, miny, minz, maxx, maxy, maxz)
        """
        temp_link = None
        try:
            # 파일 포맷 결정 (확장자 또는 명시적 지정)
            ext = source.suffix.lower().lstrip('.')
            if not ext and file_format:
                ext = file_format
            elif not ext:
                ext = "e57"  # 기본값

            # 확장자가 없는 파일의 경우 임시 심볼릭 링크 생성
            if not source.suffix:
                temp_link = self.temp_path / f"detect_{source.stem}.{ext}"
                if temp_link.exists():
                    temp_link.unlink()
                temp_link.symlink_to(source)
                info_source = temp_link
                logger.info("created_temp_symlink", source=str(source), link=str(temp_link))
            else:
                info_source = source

            result = subprocess.run(
                ["pdal", "info", "--summary", str(info_source)],
                capture_output=True,
                text=True,
                timeout=120
            )

            if result.returncode == 0:
                info = json.loads(result.stdout)
                summary = info.get("summary", {})
                bounds = summary.get("bounds", {})

                minx = bounds.get("minx", 0)
                maxx = bounds.get("maxx", 0)
                miny = bounds.get("miny", 0)
                maxy = bounds.get("maxy", 0)
                minz = bounds.get("minz", 0)
                maxz = bounds.get("maxz", 0)

                # 지리 좌표계 감지 휴리스틱:
                # - X/Y 범위가 매우 작고 (< 1도)
                # - Z 범위가 위도처럼 보이는 경우 (20-70도 범위)
                # 또는 X/Y가 경위도 범위 내에 있는 경우
                x_range = abs(maxx - minx)
                y_range = abs(maxy - miny)
                z_range = abs(maxz - minz)

                # 유효성 검사: bounds가 0이거나 무한대면 좌표계 감지 불가
                import math
                bounds_valid = (
                    x_range > 0.0001 and y_range > 0.0001 and  # 최소 범위
                    not math.isinf(z_range) and
                    not math.isinf(minx) and not math.isinf(maxx) and
                    not math.isinf(miny) and not math.isinf(maxy) and
                    not math.isinf(minz) and not math.isinf(maxz)
                )

                if not bounds_valid:
                    logger.warning("bounds_invalid_for_coordinate_detection",
                                  x_range=x_range, y_range=y_range, z_range=z_range)
                    is_swapped_geo = False
                    is_standard_geo = False
                    is_korea_tm = False
                    is_projected = False
                else:
                    # 패턴 1: X/Y가 매우 작고 Z가 위도 범위 (좌표 축 뒤바뀜)
                    is_swapped_geo = (x_range < 1 and y_range < 1 and
                                      20 <= minz <= 70 and 20 <= maxz <= 70)

                    # 패턴 2: 표준 지리 좌표 (-180~180, -90~90)
                    is_standard_geo = (-180 <= minx <= 180 and -180 <= maxx <= 180 and
                                       -90 <= miny <= 90 and -90 <= maxy <= 90 and
                                       x_range < 10 and y_range < 10)  # 10도 이내 범위

                    # 패턴 3: 한국 TM 좌표계 (EPSG:5186, 5187 등)
                    # X: 약 100,000 ~ 600,000 (동서 방향, km 단위 × 1000)
                    # Y: 약 100,000 ~ 700,000 (남북 방향)
                    is_korea_tm = (100000 <= minx <= 700000 and 100000 <= maxx <= 700000 and
                                   100000 <= miny <= 700000 and 100000 <= maxy <= 700000 and
                                   z_range < 1000)  # 높이 1km 이내

                    # 패턴 4: UTM 좌표계 (미터 단위)
                    # X: 100,000 ~ 900,000
                    # Y: 0 ~ 10,000,000
                    is_projected = (10000 <= abs(minx) <= 10000000 and
                                   10000 <= abs(miny) <= 10000000 and
                                   z_range < 5000)  # 높이 5km 이내

                is_geographic = is_swapped_geo or is_standard_geo

                logger.info("coordinate_system_detected",
                           is_geographic=is_geographic,
                           is_swapped_geo=is_swapped_geo,
                           is_korea_tm=is_korea_tm,
                           is_projected=is_projected,
                           x_range=x_range, y_range=y_range, z_range=z_range,
                           bounds=bounds)

                return {
                    "is_geographic": is_geographic,
                    "is_swapped": is_swapped_geo,
                    "is_korea_tm": is_korea_tm,
                    "is_projected": is_projected,
                    "point_count": summary.get("num_points", 0),
                    "bbox": (minx, miny, minz, maxx, maxy, maxz)
                }
            else:
                logger.warning("coordinate_detection_pdal_failed",
                              returncode=result.returncode,
                              stderr=result.stderr[:500] if result.stderr else "")
        except Exception as e:
            logger.warning("coordinate_detection_failed", error=str(e))
        finally:
            # 임시 심볼릭 링크 정리
            if temp_link and temp_link.exists():
                try:
                    temp_link.unlink()
                except Exception:
                    pass

        return {"is_geographic": False, "point_count": 0, "bbox": None}

    def _detect_color_info(self, source: Path, file_format: str = None) -> dict:
        """색상 데이터 정보 감지

        Returns:
            dict with keys:
            - has_color: True if RGB dimensions exist
            - is_16bit: True if color values appear to be 16-bit (> 255)
        """
        temp_link = None
        try:
            ext = source.suffix.lower().lstrip('.')
            if not ext and file_format:
                ext = file_format
            elif not ext:
                ext = "e57"

            if not source.suffix:
                temp_link = self.temp_path / f"color_{source.stem}.{ext}"
                if temp_link.exists():
                    temp_link.unlink()
                temp_link.symlink_to(source)
                info_source = temp_link
            else:
                info_source = source

            # 차원 정보 조회
            result = subprocess.run(
                ["pdal", "info", "--metadata", str(info_source)],
                capture_output=True,
                text=True,
                timeout=120
            )

            if result.returncode == 0:
                info = json.loads(result.stdout)
                metadata = info.get("metadata", {})

                # 차원 목록에서 RGB 확인
                dims = []
                if "dimensions" in metadata:
                    dims = metadata["dimensions"]
                elif "schema" in metadata:
                    dims = [d.get("name", "") for d in metadata.get("schema", {}).get("dimensions", [])]

                has_red = any("red" in str(d).lower() for d in dims)
                has_green = any("green" in str(d).lower() for d in dims)
                has_blue = any("blue" in str(d).lower() for d in dims)
                has_color = has_red and has_green and has_blue

                # 통계 정보로 16비트 여부 확인
                is_16bit = False
                if has_color:
                    stats_result = subprocess.run(
                        ["pdal", "info", "--stats", str(info_source)],
                        capture_output=True,
                        text=True,
                        timeout=180
                    )
                    if stats_result.returncode == 0:
                        stats_info = json.loads(stats_result.stdout)
                        stats = stats_info.get("statistics", {}).get("statistic", [])
                        for stat in stats:
                            name = stat.get("name", "").lower()
                            if name in ["red", "green", "blue"]:
                                max_val = stat.get("maximum", 0)
                                if max_val > 255:
                                    is_16bit = True
                                    break

                logger.info("color_info_detected",
                           has_color=has_color,
                           is_16bit=is_16bit,
                           dims=dims[:10] if dims else [])

                return {"has_color": has_color, "is_16bit": is_16bit}
            else:
                logger.warning("color_detection_pdal_failed", stderr=result.stderr[:200] if result.stderr else "")
        except Exception as e:
            logger.warning("color_detection_failed", error=str(e))
        finally:
            if temp_link and temp_link.exists():
                try:
                    temp_link.unlink()
                except Exception:
                    pass

        return {"has_color": False, "is_16bit": False}

    def _extract_obj_spatial_info(self, source: Path) -> dict:
        """OBJ 파일에서 공간 정보(좌표 범위) 추출

        OBJ 파일의 정점(vertex) 좌표를 파싱하여:
        - 바운딩 박스 계산
        - 좌표계 유형 감지 (지리 좌표 vs 투영 좌표 vs 로컬)

        Returns:
            dict with keys:
            - bbox: (minX, minY, minZ, maxX, maxY, maxZ)
            - center: (centerX, centerY, centerZ)
            - is_geographic: True if WGS84 lat/lon range
            - is_korea_tm: True if Korea TM coordinate range
            - epsg: Detected EPSG code (if any)
            - vertex_count: Number of vertices
        """
        import math

        minx = miny = minz = float('inf')
        maxx = maxy = maxz = float('-inf')
        vertex_count = 0

        try:
            with open(source, 'r', encoding='utf-8', errors='ignore') as f:
                for line in f:
                    line = line.strip()
                    if line.startswith('v '):
                        parts = line.split()
                        if len(parts) >= 4:
                            try:
                                x = float(parts[1])
                                y = float(parts[2])
                                z = float(parts[3])

                                minx = min(minx, x)
                                miny = min(miny, y)
                                minz = min(minz, z)
                                maxx = max(maxx, x)
                                maxy = max(maxy, y)
                                maxz = max(maxz, z)
                                vertex_count += 1
                            except ValueError:
                                continue

            if vertex_count == 0:
                logger.warning("obj_no_vertices", source=str(source))
                return {"bbox": None, "vertex_count": 0}

            # 좌표계 감지
            x_range = maxx - minx
            y_range = maxy - miny
            z_range = maxz - minz

            # 유효성 검사
            if math.isinf(minx) or math.isinf(maxx):
                return {"bbox": None, "vertex_count": vertex_count}

            # 패턴 1: WGS84 지리 좌표 (-180~180, -90~90)
            is_geographic = (
                -180 <= minx <= 180 and -180 <= maxx <= 180 and
                -90 <= miny <= 90 and -90 <= maxy <= 90 and
                x_range < 10 and y_range < 10  # 10도 이내
            )

            # 패턴 2: 한국 TM 좌표 (EPSG:5186, 5187)
            # X: 약 100,000 ~ 600,000, Y: 약 100,000 ~ 700,000
            is_korea_tm = (
                100000 <= minx <= 700000 and 100000 <= maxx <= 700000 and
                100000 <= miny <= 700000 and 100000 <= maxy <= 700000 and
                z_range < 1000
            )

            # 패턴 3: UTM/투영 좌표 (미터 단위)
            is_projected = (
                10000 <= abs(minx) <= 10000000 and
                10000 <= abs(miny) <= 10000000 and
                z_range < 5000
            ) and not is_korea_tm

            # EPSG 추정
            epsg = None
            if is_geographic:
                epsg = 4326
            elif is_korea_tm:
                # 한국 중부 기준
                epsg = 5186

            # 중심점 계산
            center_x = (minx + maxx) / 2
            center_y = (miny + maxy) / 2
            center_z = (minz + maxz) / 2

            # 지리 좌표인 경우 위경도로 변환
            center_lon = center_lat = None
            if is_geographic:
                center_lon = center_x
                center_lat = center_y
            elif is_korea_tm:
                # 한국 TM → WGS84 변환 (근사치)
                # EPSG:5186 (Korea 2000 / Central Belt) 기준
                # 정확한 변환은 pyproj 필요하지만, 여기서는 근사 공식 사용
                try:
                    # 중심점 기준 대략적 변환
                    # TM 좌표계 원점: 127.0E, 38.0N (가상 원점)
                    center_lon = 127.0 + (center_x - 200000) / 89000
                    center_lat = 38.0 + (center_y - 500000) / 111000
                except Exception:
                    pass

            result = {
                "bbox": {
                    "minX": minx,
                    "minY": miny,
                    "minZ": minz,
                    "maxX": maxx,
                    "maxY": maxy,
                    "maxZ": maxz
                },
                "center": {
                    "x": center_x,
                    "y": center_y,
                    "z": center_z
                },
                "is_geographic": is_geographic,
                "is_korea_tm": is_korea_tm,
                "is_projected": is_projected,
                "epsg": epsg,
                "vertex_count": vertex_count
            }

            if center_lon is not None and center_lat is not None:
                result["center"]["longitude"] = center_lon
                result["center"]["latitude"] = center_lat
                result["center"]["altitude"] = center_z

            logger.info("obj_spatial_info_extracted",
                       source=str(source),
                       vertex_count=vertex_count,
                       is_geographic=is_geographic,
                       is_korea_tm=is_korea_tm,
                       bbox_x=(minx, maxx),
                       bbox_y=(miny, maxy),
                       bbox_z=(minz, maxz))

            return result

        except Exception as e:
            logger.warning("obj_spatial_info_extraction_failed", error=str(e))
            return {"bbox": None, "vertex_count": 0}

    def _transform_obj_wgs84_to_local(
        self,
        source: Path,
        output: Path,
        spatial_info: dict
    ) -> tuple[bool, dict]:
        """WGS84 좌표계 OBJ를 로컬 미터 좌표계로 변환

        WGS84 좌표(도 단위)를 중심점 기준 로컬 미터 좌표로 변환합니다.
        - X(경도), Y(위도) → 미터 단위로 변환
        - Z(높이) → 그대로 유지 (이미 미터)

        Returns:
            (success, transform_info) 튜플
            transform_info: 변환에 사용된 정보 (center_lon, center_lat, scale 등)
        """
        import math

        if not spatial_info.get('is_geographic'):
            logger.info("obj_not_geographic_skipping_transform")
            return False, {}

        center = spatial_info.get('center', {})
        center_lon = center.get('longitude') or center.get('x', 127.0)
        center_lat = center.get('latitude') or center.get('y', 37.0)

        # WGS84 상수
        EARTH_RADIUS = 6378137.0  # WGS84 장반경 (미터)

        # 위도에 따른 경도 1도당 미터 수
        lat_rad = math.radians(center_lat)
        meters_per_deg_lon = math.cos(lat_rad) * math.pi * EARTH_RADIUS / 180
        meters_per_deg_lat = math.pi * EARTH_RADIUS / 180  # 약 111,320m

        logger.info("transforming_obj_wgs84_to_local",
                   center_lon=center_lon,
                   center_lat=center_lat,
                   meters_per_deg_lon=f"{meters_per_deg_lon:.2f}",
                   meters_per_deg_lat=f"{meters_per_deg_lat:.2f}")

        try:
            transformed_lines = []
            vertex_count = 0

            with open(source, 'r', encoding='utf-8', errors='ignore') as f:
                for line in f:
                    stripped = line.strip()
                    if stripped.startswith('v '):
                        parts = stripped.split()
                        if len(parts) >= 4:
                            try:
                                # OBJ: X=경도, Y=위도, Z=높이
                                lon = float(parts[1])
                                lat = float(parts[2])
                                z = float(parts[3])

                                # 중심점 기준 로컬 미터 좌표로 변환
                                local_x = (lon - center_lon) * meters_per_deg_lon
                                local_y = (lat - center_lat) * meters_per_deg_lat
                                local_z = z  # 이미 미터 단위

                                # 변환된 정점 라인 생성
                                new_line = f"v {local_x:.6f} {local_y:.6f} {local_z:.6f}"
                                if len(parts) > 4:
                                    # 추가 데이터 (색상 등) 보존
                                    new_line += ' ' + ' '.join(parts[4:])
                                transformed_lines.append(new_line + '\n')
                                vertex_count += 1
                            except ValueError:
                                transformed_lines.append(line)
                        else:
                            transformed_lines.append(line)
                    else:
                        transformed_lines.append(line)

            # 변환된 OBJ 파일 저장
            with open(output, 'w', encoding='utf-8') as f:
                f.writelines(transformed_lines)

            logger.info("obj_wgs84_transform_complete",
                       vertex_count=vertex_count,
                       output=str(output))

            return True, {
                'center_lon': center_lon,
                'center_lat': center_lat,
                'meters_per_deg_lon': meters_per_deg_lon,
                'meters_per_deg_lat': meters_per_deg_lat,
                'vertex_count': vertex_count
            }

        except Exception as e:
            logger.error("obj_wgs84_transform_failed", error=str(e))
            return False, {}

    def _convert_e57_to_ply(
        self,
        source: Path,
        options: dict,
        progress_callback: Callable[[int], None] = None
    ) -> ConversionResult:
        """E57 → PLY 변환 (PDAL 사용, 웹 뷰어용 다운샘플링 포함)"""
        output_name = source.stem + ".ply"
        output_path = self.output_base / output_name

        # 좌표계 감지 (E57 파일 포맷 명시)
        coord_info = self._detect_coordinate_system(source, file_format="e57")
        is_geographic = coord_info.get("is_geographic", False)
        is_swapped_geo = coord_info.get("is_swapped", False)  # X/Y가 작고 Z가 위도인 경우
        is_korea_tm = coord_info.get("is_korea_tm", False)
        is_projected = coord_info.get("is_projected", False)
        point_count = coord_info.get("point_count", 0)

        # bounds 유효성 검사 (Infinity, NaN 체크)
        bbox = coord_info.get("bbox")
        has_valid_bounds = False
        if bbox:
            import math
            has_valid_bounds = all(
                not math.isinf(v) and not math.isnan(v)
                for v in bbox
            )
            if not has_valid_bounds:
                logger.warning("invalid_bounds_detected", bbox=bbox)
                bbox = None

        # 색상 정보 감지
        color_info = self._detect_color_info(source, file_format="e57")
        has_color = color_info.get("has_color", False)
        is_16bit_color = color_info.get("is_16bit", False)

        # 복셀 크기 결정
        if is_geographic:
            # 지리 좌표계: 도(degree) 단위이므로 훨씬 작은 값 사용
            # 0.00001도 ≈ 약 1.1m (적도 기준)
            voxel_size = options.get("voxel_size", 0.00001)
            logger.info("using_geographic_voxel_size", voxel_size=voxel_size)
        elif is_korea_tm or is_projected:
            # 한국 TM 또는 UTM 좌표계: 미터 단위
            # 0.05m = 5cm 간격
            voxel_size = options.get("voxel_size", 0.05)
            logger.info("using_projected_voxel_size", voxel_size=voxel_size, is_korea_tm=is_korea_tm)
        else:
            # 기타 좌표계: 미터 단위 가정
            # 0.05m = 5cm 간격
            voxel_size = options.get("voxel_size", 0.05)

        # 좌표계 변환 여부 (Z-up → Y-up)
        # 프론트엔드 PLY 로더에서 별도 회전을 적용하지 않으므로,
        # 한국 TM / 투영 좌표계(명확히 Z-up)만 변환, 나머지는 원본 유지
        # (E57 스캐너 데이터는 이미 Y-up이거나 방향이 다양하여 일괄 변환 시 눕혀짐)
        transform_coords = options.get("transform_coords", is_korea_tm or is_projected)

        # PDAL 파이프라인 구성
        pipeline_stages = [
            {
                "type": "readers.e57",
                "filename": str(source)
            }
        ]

        # 다운샘플링: 지리 좌표계는 decimation, 투영 좌표계는 복셀 다운샘플링
        if is_geographic and point_count > 500000:
            # 지리 좌표계: decimation으로 50만 포인트로 제한
            # (voxel은 도(degree) 단위에서 제대로 작동하지 않음)
            step = max(1, int(point_count / 500000))
            pipeline_stages.append({
                "type": "filters.decimation",
                "step": step
            })
            logger.info("using_decimation_sampling",
                       original_count=point_count,
                       target_count=500000,
                       step=step)
        elif is_geographic:
            # 지리 좌표계지만 포인트 수가 적으면 다운샘플링 생략
            logger.info("skipping_downsampling", reason="geographic_small_pointcount", point_count=point_count)
        elif is_korea_tm or is_projected:
            # 한국 TM / 투영 좌표계: 복셀 그리드 다운샘플링
            pipeline_stages.append({
                "type": "filters.voxeldownsize",
                "cell": voxel_size,
                "mode": "center"
            })
            logger.info("using_voxel_downsampling", voxel_size=voxel_size, coordinate_type="projected")
        elif point_count > 500000:
            # 좌표계 미확인 + 대용량: decimation 사용
            step = max(1, int(point_count / 500000))
            pipeline_stages.append({
                "type": "filters.decimation",
                "step": step
            })
            logger.info("using_decimation_sampling_fallback",
                       original_count=point_count,
                       target_count=500000,
                       step=step)
        else:
            # 기타: 복셀 그리드 다운샘플링
            pipeline_stages.append({
                "type": "filters.voxeldownsize",
                "cell": voxel_size,
                "mode": "center"
            })

        # 좌표 정규화 (3D 뷰어용)
        # 지리 좌표계 또는 투영 좌표계 모두 정규화 필요
        needs_normalization = is_geographic or is_korea_tm or is_projected
        normalization_applied = False
        z_min_normalized = -50
        z_max_normalized = 50

        if needs_normalization and has_valid_bounds and bbox:
                minx, miny, minz, maxx, maxy, maxz = bbox

                # 중심점 계산
                cx = (minx + maxx) / 2
                cy = (miny + maxy) / 2
                cz = (minz + maxz) / 2

                # 범위 계산
                x_range = max(abs(maxx - minx), 1e-10)
                y_range = max(abs(maxy - miny), 1e-10)
                z_range = max(abs(maxz - minz), 1e-10)

                # 각 축을 독립적으로 정규화하여 -50 ~ 50 범위로 맞춤
                scale_x = 100.0 / x_range
                scale_y = 100.0 / y_range
                scale_z = 100.0 / z_range

                logger.info("normalizing_geographic_coords",
                           center=(cx, cy, cz),
                           ranges=(x_range, y_range, z_range),
                           scales=(scale_x, scale_y, scale_z))

                # filters.transformation 사용 - 중심 이동 후 스케일링
                # 4x4 변환 행렬: [scale_x, 0, 0, -cx*scale_x, 0, scale_y, 0, -cy*scale_y, 0, 0, scale_z, -cz*scale_z, 0, 0, 0, 1]
                # 행렬 형식: row-major (행 우선)
                transform_matrix = (
                    f"{scale_x} 0 0 {-cx * scale_x} "
                    f"0 {scale_y} 0 {-cy * scale_y} "
                    f"0 0 {scale_z} {-cz * scale_z} "
                    f"0 0 0 1"
                )
                pipeline_stages.append({
                    "type": "filters.transformation",
                    "matrix": transform_matrix
                })
                normalization_applied = True
        elif not has_valid_bounds:
                logger.warning("skipping_normalization", reason="invalid_bounds")

        # Z-up → Y-up 좌표계 변환 (Three.js는 Y-up 사용)
        # 변환 행렬: X'=X, Y'=Z, Z'=-Y (X축 기준 -90도 회전)
        if transform_coords:
            pipeline_stages.append({
                "type": "filters.transformation",
                "matrix": "1 0 0 0  0 0 1 0  0 -1 0 0  0 0 0 1"
            })

        # 색상 처리 및 출력 dims 결정
        output_has_color = False

        if has_color:
            if is_16bit_color:
                # 16비트 색상 → 8비트 스케일링
                logger.info("applying_color_scaling", reason="16bit_to_8bit")
                pipeline_stages.append({
                    "type": "filters.assign",
                    "value": [
                        "Red = Red / 256",
                        "Green = Green / 256",
                        "Blue = Blue / 256"
                    ]
                })
            else:
                # 이미 8비트 색상 - 스케일링 불필요
                logger.info("skipping_color_scaling", reason="already_8bit")
            output_has_color = True
        elif normalization_applied:
            # 색상 없음 + 정규화 적용됨 - 높이 기반 색상 생성
            logger.info("generating_height_color", reason="no_color_data_normalized")
            # filters.assign으로 직접 RGB 값 생성 (PDAL은 존재하지 않는 차원도 생성 가능)
            # Z 값을 0-255 범위로 매핑하여 색상 생성
            # 정규화 후 Z 범위는 대략 -50 ~ 50
            # Red: 높을수록 강함, Blue: 낮을수록 강함
            pipeline_stages.append({
                "type": "filters.assign",
                "value": [
                    "Red = (Z + 50) * 2 + 55",
                    "Green = 180",
                    "Blue = (50 - Z) * 2 + 55"
                ]
            })
            output_has_color = True
        else:
            # 색상 없음 + 정규화 안됨 - 단색 출력
            logger.info("generating_fallback_color", reason="no_color_no_normalization")
            # filters.assign으로 직접 RGB 값 생성
            pipeline_stages.append({
                "type": "filters.assign",
                "value": [
                    "Red = 150",
                    "Green = 180",
                    "Blue = 210"
                ]
            })
            output_has_color = True

        # 출력 (바이너리 형식으로 파일 크기 최소화)
        output_dims = "X,Y,Z,Red,Green,Blue" if output_has_color else "X,Y,Z"
        pipeline_stages.append({
            "type": "writers.ply",
            "filename": str(output_path),
            "storage_mode": "little endian",
            "dims": output_dims
        })

        pipeline = {"pipeline": pipeline_stages}

        result = self._run_pdal_pipeline(pipeline, output_path, progress_callback)

        # E57 공간 정보를 결과 메타데이터에 추가
        logger.info("e57_spatial_info_check",
                   result_success=result.success,
                   has_valid_bounds=has_valid_bounds,
                   has_bbox=bbox is not None,
                   is_geographic=is_geographic,
                   is_swapped_geo=is_swapped_geo,
                   is_korea_tm=is_korea_tm)

        if result.success and has_valid_bounds and bbox:
            minx, miny, minz, maxx, maxy, maxz = bbox

            # 중심점 계산
            center_x = (minx + maxx) / 2
            center_y = (miny + maxy) / 2
            center_z = (minz + maxz) / 2

            # 지리 좌표인 경우 위경도로 변환
            center_lon = center_lat = None
            if is_geographic:
                if is_swapped_geo:
                    # 좌표가 뒤바뀐 경우: X=lon, Z=lat (Y는 altitude 또는 다른 값)
                    center_lon = center_x
                    center_lat = center_z
                    logger.info("using_swapped_geo_coords",
                               center_lon=center_lon,
                               center_lat=center_lat,
                               original_center_y=center_y)
                else:
                    center_lon = center_x
                    center_lat = center_y
            elif is_korea_tm:
                # 한국 TM → WGS84 변환 (근사치)
                try:
                    center_lon = 127.0 + (center_x - 200000) / 89000
                    center_lat = 38.0 + (center_y - 500000) / 111000
                except Exception:
                    pass

            spatial_info = {
                "epsg": 4326 if is_geographic else (5186 if is_korea_tm else None),
                "isGeographic": is_geographic,
                "isKoreaTM": is_korea_tm,
                "bbox": {
                    "minX": minx,
                    "minY": miny,
                    "minZ": minz,
                    "maxX": maxx,
                    "maxY": maxy,
                    "maxZ": maxz
                },
                "center": {
                    "x": center_x,
                    "y": center_y,
                    "z": center_z
                },
                "pointCount": point_count
            }

            if center_lon is not None and center_lat is not None:
                spatial_info["center"]["longitude"] = center_lon
                spatial_info["center"]["latitude"] = center_lat
                # altitude: swapped인 경우 Y가 altitude일 수 있음, 아니면 Z
                spatial_info["center"]["altitude"] = center_y if is_swapped_geo else center_z

            # 결과 메타데이터에 공간 정보 추가
            result.metadata["spatialInfo"] = spatial_info
            logger.info("e57_spatial_info_added",
                       is_geographic=is_geographic,
                       is_korea_tm=is_korea_tm,
                       center_lon=center_lon,
                       center_lat=center_lat,
                       point_count=point_count)

        return result

    def _convert_e57_to_las(
        self,
        source: Path,
        options: dict,
        progress_callback: Callable[[int], None] = None
    ) -> ConversionResult:
        """E57 → LAS 변환 (PDAL 사용)"""
        output_name = source.stem + ".las"
        output_path = self.output_base / output_name

        # PDAL 파이프라인 구성
        pipeline = {
            "pipeline": [
                {
                    "type": "readers.e57",
                    "filename": str(source)
                },
                {
                    "type": "writers.las",
                    "filename": str(output_path),
                    "compression": "none",
                    "minor_version": 4
                }
            ]
        }

        return self._run_pdal_pipeline(pipeline, output_path, progress_callback)

    def _convert_to_copc(
        self,
        source: Path,
        options: dict,
        progress_callback: Callable[[int], None] = None
    ) -> ConversionResult:
        """포인트 클라우드 → LAZ 변환 (PDAL 사용)

        참고: COPC는 PDAL 2.4+ 필요. 현재는 LAZ(압축 LAS)로 변환합니다.
        LAZ는 LASzip 압축을 사용하여 파일 크기를 크게 줄입니다.
        """
        output_name = source.stem + ".laz"
        output_path = self.output_base / output_name

        # 소스 포맷에 따른 리더 선택 (UUID 파일명일 경우 options에서 가져옴)
        ext = source.suffix.lower()
        if not ext and options.get("original_format"):
            ext = "." + options["original_format"]
            logger.info("using_original_format", format=ext)

        if ext == ".las" or ext == ".laz":
            reader_type = "readers.las"
        elif ext == ".ply":
            reader_type = "readers.ply"
        elif ext == ".e57":
            reader_type = "readers.e57"
        else:
            return ConversionResult(
                success=False,
                error=f"지원하지 않는 포인트 클라우드 포맷: {ext}"
            )

        # PDAL 파이프라인 구성 (LAZ 압축 사용)
        pipeline = {
            "pipeline": [
                {
                    "type": reader_type,
                    "filename": str(source)
                },
                {
                    "type": "writers.las",
                    "filename": str(output_path),
                    "compression": "laszip",  # LASzip 압축
                    "forward": "all"  # 모든 dimension 유지
                }
            ]
        }

        return self._run_pdal_pipeline(pipeline, output_path, progress_callback)

    def _convert_to_3dtiles(
        self,
        source: Path,
        options: dict,
        progress_callback: Callable[[int], None] = None
    ) -> ConversionResult:
        """메쉬 → 3D Tiles 변환 (py3dtiles 또는 gltf-pipeline 사용)

        3D Tiles는 LOD 기반 스트리밍 렌더링을 지원하는 타일 포맷입니다.
        """
        output_dir = self.output_base / (source.stem + "_3dtiles")
        output_dir.mkdir(parents=True, exist_ok=True)

        if progress_callback:
            progress_callback(20)

        try:
            # 파일 포맷 감지 (UUID 파일명일 경우 options에서 가져옴)
            ext = source.suffix.lower()
            if not ext and options.get("original_format"):
                ext = "." + options["original_format"]
                logger.info("using_original_format", format=ext)

            if ext in [".gltf", ".glb"]:
                # GLTF/GLB → 3D Tiles (단순 tileset.json 생성)
                return self._create_simple_tileset(source, output_dir, progress_callback)
            elif ext == ".obj":
                # OBJ → GLTF → 3D Tiles (obj2gltf 필요)
                return self._convert_obj_to_3dtiles(source, output_dir, options, progress_callback)
            else:
                return ConversionResult(
                    success=False,
                    error=f"지원하지 않는 메쉬 포맷: {ext}"
                )

        except Exception as e:
            return ConversionResult(
                success=False,
                error=f"3D Tiles 변환 실패: {str(e)}"
            )

    def _create_simple_tileset(
        self,
        source: Path,
        output_dir: Path,
        progress_callback: Callable[[int], None] = None
    ) -> ConversionResult:
        """단순 tileset.json 생성 (단일 타일)

        대규모 모델의 경우 공간 분할(Octree)이 필요하지만,
        초기 구현에서는 단일 타일로 처리합니다.
        """
        if progress_callback:
            progress_callback(40)

        # 소스 파일을 출력 디렉토리로 복사
        output_model = output_dir / source.name
        shutil.copy2(source, output_model)

        if progress_callback:
            progress_callback(60)

        # tileset.json 생성
        # 참고: 실제 boundingVolume은 모델에서 추출해야 하지만,
        # 여기서는 기본값 사용
        tileset = {
            "asset": {
                "version": "1.0",
                "tilesetVersion": "1.0.0"
            },
            "geometricError": 500,
            "root": {
                "boundingVolume": {
                    "region": [
                        -3.141592653589793,  # west
                        -1.5707963267948966, # south
                        3.141592653589793,   # east
                        1.5707963267948966,  # north
                        0,                    # min height
                        1000                  # max height
                    ]
                },
                "geometricError": 100,
                "refine": "ADD",
                "content": {
                    "uri": source.name
                }
            }
        }

        tileset_path = output_dir / "tileset.json"
        with open(tileset_path, "w") as f:
            json.dump(tileset, f, indent=2)

        if progress_callback:
            progress_callback(90)

        return ConversionResult(
            success=True,
            output_path=str(output_dir),
            metadata={
                "tileset_path": str(tileset_path),
                "model_path": str(output_model),
                "format": "3dtiles"
            }
        )

    def _prepare_obj_files(
        self,
        source: Path,
        options: dict
    ) -> tuple[Path, Path]:
        """OBJ 파일과 관련 파일(MTL, 텍스처)을 임시 디렉토리에 준비

        Supabase 스토리지는 각 파일을 별도 디렉토리에 저장하므로,
        OBJ 변환 전에 관련 파일들을 한 디렉토리에 모아야 합니다.

        Returns:
            tuple[Path, Path]: (준비된 OBJ 파일 경로, 임시 디렉토리 경로)
        """
        import re

        # 임시 작업 디렉토리 생성
        work_dir = self.temp_path / f"obj_prep_{source.stem}"
        if work_dir.exists():
            shutil.rmtree(work_dir)
        work_dir.mkdir(parents=True)

        # 원본 파일명 (options에서 가져오거나 디렉토리명에서 추출)
        original_name = options.get("original_name")
        if not original_name:
            # source.parent가 "1769489281613________.obj" 같은 형태
            parent_name = source.parent.name
            if '________' in parent_name:
                original_name = parent_name.split('________')[-1]
            else:
                original_name = parent_name

        # OBJ 파일명 정리 (확장자 없으면 추가)
        if not original_name.lower().endswith('.obj'):
            original_name = original_name + '.obj'

        # OBJ 파일 복사
        obj_dest = work_dir / original_name
        shutil.copy2(source, obj_dest)
        logger.info("obj_file_prepared", source=str(source), dest=str(obj_dest))

        # OBJ 파일에서 MTL 참조 찾기
        mtl_names = []
        try:
            with open(source, 'r', encoding='utf-8', errors='ignore') as f:
                for line in f:
                    if line.startswith('mtllib '):
                        mtl_name = line.strip().split(' ', 1)[1].strip()
                        mtl_names.append(mtl_name)
        except Exception as e:
            logger.warning("obj_parse_error", error=str(e))

        logger.info("mtl_references_found", mtl_names=mtl_names)

        # 스토리지에서 MTL 파일 찾기
        storage_user_dir = self.storage_path / "spatial-files"
        texture_names = []

        for mtl_name in mtl_names:
            # 스토리지에서 MTL 파일 검색
            mtl_found = False
            for user_dir in storage_user_dir.iterdir():
                if not user_dir.is_dir():
                    continue
                for item in user_dir.iterdir():
                    # 디렉토리명이 .mtl로 끝나는지 확인
                    if item.is_dir() and item.name.endswith('.mtl'):
                        # 디렉토리 내부의 실제 파일 찾기
                        files = list(item.iterdir())
                        if files:
                            mtl_source = files[0]
                            mtl_dest = work_dir / mtl_name
                            shutil.copy2(mtl_source, mtl_dest)
                            logger.info("mtl_file_copied", source=str(mtl_source), dest=str(mtl_dest))
                            mtl_found = True

                            # MTL 파일에서 텍스처 참조 찾기
                            try:
                                with open(mtl_source, 'r', encoding='utf-8', errors='ignore') as f:
                                    for line in f:
                                        # map_Kd, map_Ka, map_Ks 등 텍스처 맵 참조
                                        if line.strip().startswith(('map_', 'bump', 'disp', 'decal')):
                                            parts = line.strip().split()
                                            if len(parts) >= 2:
                                                tex_name = parts[-1]
                                                texture_names.append(tex_name)
                            except Exception as e:
                                logger.warning("mtl_parse_error", error=str(e))
                            break
                if mtl_found:
                    break

        logger.info("texture_references_found", texture_names=texture_names)

        # 스토리지에서 텍스처 파일 찾기
        # Supabase 스토리지 형식: "timestamp_originalname.ext"
        # 예: samyang.jpg → 1769688123384_samyang.jpg
        for tex_name in texture_names:
            tex_found = False
            tex_ext = Path(tex_name).suffix.lower()
            tex_stem = Path(tex_name).stem

            for user_dir in storage_user_dir.iterdir():
                if not user_dir.is_dir():
                    continue
                for item in user_dir.iterdir():
                    # 디렉토리명이 같은 확장자로 끝나는지 확인
                    if not (item.is_dir() and item.name.lower().endswith(tex_ext)):
                        continue

                    # 매칭 조건:
                    # 1. 정확히 일치: timestamp_texname.ext (예: 1769688123384_samyang.jpg)
                    # 2. 텍스처명이 포함됨: *_texname.ext
                    item_name = item.name.lower()
                    tex_name_lower = tex_name.lower()
                    matched = False

                    # timestamp_originalname.ext 형식 매칭
                    if item_name.endswith(f'_{tex_name_lower}'):
                        matched = True
                    # 텍스처명이 디렉토리명에 포함된 경우
                    elif tex_name_lower in item_name:
                        matched = True

                    if matched:
                        files = list(item.iterdir())
                        if files:
                            tex_source = files[0]
                            tex_dest = work_dir / tex_name
                            shutil.copy2(tex_source, tex_dest)
                            logger.info("texture_file_copied", source=str(tex_source), dest=str(tex_dest))
                            tex_found = True
                            break
                if tex_found:
                    break

        return obj_dest, work_dir

    def _convert_obj_to_3dtiles(
        self,
        source: Path,
        output_dir: Path,
        options: dict,
        progress_callback: Callable[[int], None] = None
    ) -> ConversionResult:
        """OBJ → 3D Tiles 변환

        1. 관련 파일(MTL, 텍스처) 수집
        2. OBJ → GLB 변환 (obj2gltf 또는 gltfpack 사용)
        3. GLB → 3D Tiles tileset 생성
        4. 공간 정보 추출 및 메타데이터에 포함
        """
        if progress_callback:
            progress_callback(5)

        # OBJ에서 공간 정보 추출
        spatial_info = self._extract_obj_spatial_info(source)

        # OBJ 관련 파일 준비 (MTL, 텍스처를 임시 디렉토리에 모음)
        work_dir = None
        transform_info = {}
        try:
            prepared_obj, work_dir = self._prepare_obj_files(source, options)
            logger.info("obj_files_prepared", work_dir=str(work_dir))
        except Exception as e:
            logger.warning("obj_prepare_failed", error=str(e))
            prepared_obj = source  # 실패 시 원본 사용

        if progress_callback:
            progress_callback(10)

        # WGS84 좌표계인 경우 로컬 미터 좌표로 변환 (obj2gltf 전에 수행)
        if spatial_info.get('is_geographic'):
            logger.info("wgs84_detected_transforming_coordinates")
            transformed_obj = (work_dir or output_dir) / (source.stem + "_transformed.obj")
            success, transform_info = self._transform_obj_wgs84_to_local(
                prepared_obj, transformed_obj, spatial_info
            )
            if success:
                prepared_obj = transformed_obj
                logger.info("using_transformed_obj", path=str(prepared_obj))
            else:
                logger.warning("wgs84_transform_failed_using_original")

        if progress_callback:
            progress_callback(15)

        # 임시 GLB 파일 생성
        temp_glb = output_dir / (source.stem + ".glb")
        converted = False

        # 방법 1: obj2gltf 사용 (MTL/텍스처 지원이 더 좋음)
        try:
            logger.info("trying_obj2gltf", source=str(prepared_obj))
            # 건축/CAD 소프트웨어는 보통 Z-up 좌표계를 사용
            # --inputUpAxis Z: OBJ가 Z-up인 경우 glTF 표준 Y-up으로 변환
            temp_uncompressed = output_dir / (source.stem + "_uncompressed.glb")
            result = subprocess.run(
                ["obj2gltf", "-i", str(prepared_obj), "-o", str(temp_uncompressed),
                 "--binary", "--inputUpAxis", "Z"],
                capture_output=True,
                text=True,
                timeout=600,
                cwd=str(prepared_obj.parent)  # MTL/텍스처 파일이 있는 디렉토리
            )

            if result.returncode == 0 and temp_uncompressed.exists():
                logger.info("obj2gltf_success", output=str(temp_uncompressed))
                original_size = temp_uncompressed.stat().st_size

                # gltf-transform으로 텍스처 압축 (WebP)
                try:
                    logger.info("compressing_with_gltf_transform", source=str(temp_uncompressed))

                    # 중간 파일 (리사이즈 후)
                    temp_resized = output_dir / (source.stem + "_resized.glb")

                    # Step 1: 텍스처 해상도 축소 (2048px 이하로 제한)
                    resize_result = subprocess.run(
                        ["npx", "gltf-transform", "resize",
                         str(temp_uncompressed), str(temp_resized),
                         "--width", "2048", "--height", "2048"
                        ],
                        capture_output=True,
                        text=True,
                        timeout=300
                    )

                    resize_input = temp_resized if (resize_result.returncode == 0 and temp_resized.exists()) else temp_uncompressed

                    # Step 2: 텍스처를 WebP로 압축
                    temp_compressed = output_dir / (source.stem + "_compressed.glb")
                    compress_result = subprocess.run(
                        ["npx", "gltf-transform", "webp",
                         str(resize_input), str(temp_compressed)
                        ],
                        capture_output=True,
                        text=True,
                        timeout=600
                    )

                    # 중간 파일 정리
                    if temp_resized.exists():
                        temp_resized.unlink()

                    compress_input = temp_compressed if (compress_result.returncode == 0 and temp_compressed.exists()) else resize_input

                    # Step 3: 모델을 원점에 중심 정렬 (Cesium 3D Tiles용)
                    # WGS84 좌표가 그대로 있으면 tileset transform과 충돌
                    logger.info("centering_model_for_3dtiles")
                    temp_centered = output_dir / (source.stem + "_centered.glb")
                    center_result = subprocess.run(
                        ["npx", "gltf-transform", "center",
                         str(compress_input), str(temp_centered)
                        ],
                        capture_output=True,
                        text=True,
                        timeout=300
                    )

                    # 압축된 중간 파일 정리
                    if temp_compressed.exists() and temp_compressed != temp_centered:
                        temp_compressed.unlink()

                    if center_result.returncode == 0 and temp_centered.exists():
                        # 센터링된 파일을 최종 GLB로 사용
                        # (WGS84 스케일링은 obj2gltf 전에 OBJ 좌표 변환으로 처리됨)
                        temp_centered.rename(temp_glb)

                        converted = True
                        final_size = temp_glb.stat().st_size
                        # 압축되지 않은 임시 파일 삭제
                        if temp_uncompressed.exists():
                            temp_uncompressed.unlink()
                        logger.info("gltf_transform_pipeline_success",
                                   original_mb=f"{original_size/1024/1024:.1f}",
                                   final_mb=f"{final_size/1024/1024:.1f}",
                                   centered=True,
                                   wgs84_pretransformed=spatial_info.get('is_geographic', False))
                    else:
                        logger.warning("gltf_transform_center_failed",
                                      stderr=center_result.stderr,
                                      stdout=center_result.stdout)
                        # 센터링 실패 시 압축된 파일 사용 (센터링 없이)
                        if compress_input.exists() and compress_input != temp_glb:
                            compress_input.rename(temp_glb)
                        elif temp_uncompressed.exists():
                            temp_uncompressed.rename(temp_glb)
                        converted = True
                        logger.warning("using_uncentered_glb", msg="3D Tiles에서 위치가 맞지 않을 수 있음")
                except Exception as e:
                    logger.warning("gltf_transform_compression_error", error=str(e))
                    # 압축 실패 시 비압축 파일 사용
                    if temp_uncompressed.exists():
                        temp_uncompressed.rename(temp_glb)
                        converted = True
            else:
                logger.warning("obj2gltf_failed", stderr=result.stderr)

        except FileNotFoundError:
            logger.info("obj2gltf_not_found")
        except subprocess.TimeoutExpired:
            logger.warning("obj2gltf_timeout")
        except Exception as e:
            logger.warning("obj2gltf_error", error=str(e))

        if progress_callback:
            progress_callback(50)

        # 방법 2: gltfpack 시도 (obj2gltf 실패 시)
        if not converted:
            try:
                logger.info("trying_gltfpack", source=str(prepared_obj))
                # gltfpack 최적화 옵션:
                # -cc: 정점 압축 (quantization)
                # -tc: 텍스처 좌표 압축
                # -si: 단순화 비율 (0.5 = 50% 폴리곤)
                temp_gltfpack = output_dir / (source.stem + "_gltfpack.glb")
                result = subprocess.run(
                    ["gltfpack", "-i", str(prepared_obj), "-o", str(temp_gltfpack),
                     "-cc", "-tc", "-si", "0.5"],
                    capture_output=True,
                    text=True,
                    timeout=300,
                    cwd=str(prepared_obj.parent)
                )

                if result.returncode == 0 and temp_gltfpack.exists():
                    # gltfpack 성공 후 센터링 적용
                    logger.info("centering_gltfpack_model")
                    temp_centered = output_dir / (source.stem + "_gltfpack_centered.glb")
                    center_result = subprocess.run(
                        ["npx", "gltf-transform", "center",
                         str(temp_gltfpack), str(temp_centered)
                        ],
                        capture_output=True,
                        text=True,
                        timeout=300
                    )

                    # 중간 파일 정리
                    if temp_gltfpack.exists():
                        temp_gltfpack.unlink()

                    if center_result.returncode == 0 and temp_centered.exists():
                        # 센터링된 파일을 최종 GLB로 사용
                        # (WGS84 스케일링은 gltfpack 전에 OBJ 좌표 변환으로 처리됨)
                        temp_centered.rename(temp_glb)
                        converted = True
                        logger.info("gltfpack_success_centered", output=str(temp_glb))
                    else:
                        # 센터링 실패 시 원본 사용
                        if temp_gltfpack.exists():
                            temp_gltfpack.rename(temp_glb)
                        elif temp_centered.exists():
                            temp_centered.rename(temp_glb)
                        converted = True
                        logger.warning("gltfpack_center_failed", msg="센터링 없이 사용")
                else:
                    logger.warning("gltfpack_failed", stderr=result.stderr)

            except FileNotFoundError:
                logger.info("gltfpack_not_found")
            except Exception as e:
                logger.warning("gltfpack_error", error=str(e))

        if progress_callback:
            progress_callback(60)

        # 임시 작업 디렉토리 정리
        if work_dir and work_dir.exists():
            try:
                shutil.rmtree(work_dir)
                logger.info("work_dir_cleaned", path=str(work_dir))
            except Exception as e:
                logger.warning("work_dir_cleanup_failed", error=str(e))

        if progress_callback:
            progress_callback(70)

        # GLB 변환 성공 시 → 3D Tiles 생성
        if converted:
            return self._create_glb_tileset(temp_glb, output_dir, source.stem, spatial_info, progress_callback)

        # 모든 변환 실패 시 OBJ 직접 처리
        logger.info("fallback_to_obj_tileset", msg="OBJ 직접 처리 모드")
        return self._create_obj_tileset(source, output_dir, spatial_info, progress_callback)

    def _create_glb_tileset(
        self,
        glb_path: Path,
        output_dir: Path,
        name: str,
        spatial_info: dict = None,
        progress_callback: Callable[[int], None] = None
    ) -> ConversionResult:
        """GLB 파일용 tileset.json 생성 (지리 좌표 지원)"""
        import math

        if progress_callback:
            progress_callback(80)

        # 기본 bounding volume (box)
        bounding_volume = {"box": [0, 0, 0, 100, 0, 0, 0, 100, 0, 0, 0, 100]}
        root_transform = None

        # 지리 좌표가 있으면 box와 transform 사용
        # 주의: GLB는 gltf-transform center로 원점에 센터링되어 있음
        # 따라서 region 대신 box 바운딩 볼륨 사용 (로컬 좌표계 기준)
        if spatial_info and spatial_info.get("is_geographic") and spatial_info.get("center"):
            center = spatial_info["center"]
            bbox = spatial_info.get("bbox", {})

            # 중심점 좌표 (경위도)
            lon = center.get("longitude") or center.get("x", 127.0)
            lat = center.get("latitude") or center.get("y", 37.0)
            # 고도는 0으로 설정 (지면 기준)
            # 모델은 gltf-transform center로 Z 중심이 0에 있으므로
            # 건물 높이의 절반만큼 올려서 바닥이 지면에 닿도록 함
            height_range = abs(bbox.get("maxZ", 0) - bbox.get("minZ", 0)) if bbox else 0
            alt = height_range / 2  # 건물 중심을 건물 높이/2 위치에 배치 → 바닥이 지면에

            # bbox에서 크기 계산 (미터 단위로 변환)
            if bbox:
                # 경위도 범위를 미터로 변환 (1도 ≈ 111km at equator)
                lon_range = abs(bbox.get("maxX", 0) - bbox.get("minX", 0))
                lat_range = abs(bbox.get("maxY", 0) - bbox.get("minY", 0))
                height_range = abs(bbox.get("maxZ", 0) - bbox.get("minZ", 0))

                # 실제 미터 크기 계산
                meters_per_degree_lon = 111000 * math.cos(math.radians(lat))
                meters_per_degree_lat = 111000

                width_m = lon_range * meters_per_degree_lon
                depth_m = lat_range * meters_per_degree_lat
                height_m = height_range

                # 센터링된 모델용 box 바운딩 볼륨
                # box: [centerX, centerY, centerZ, xHalf, 0, 0, 0, yHalf, 0, 0, 0, zHalf]
                # 센터링되어 있으므로 center는 (0,0,0)
                half_width = max(width_m / 2, 10)  # 최소 10m
                half_depth = max(depth_m / 2, 10)
                half_height = max(height_m / 2, 10)

                bounding_volume = {
                    "box": [
                        0, 0, 0,  # center (센터링된 모델)
                        half_width, 0, 0,  # x-axis half-length
                        0, half_depth, 0,  # y-axis half-length
                        0, 0, half_height  # z-axis half-length
                    ]
                }

                logger.info("tileset_box_created",
                           lon=lon, lat=lat, alt=alt,
                           width_m=width_m, depth_m=depth_m, height_m=height_m,
                           half_width=half_width, half_depth=half_depth, half_height=half_height)

            # ECEF 변환 행렬 계산 (중심점 기준)
            # Cesium의 Transforms.eastNorthUpToFixedFrame과 동일
            lon_rad = math.radians(lon)
            lat_rad = math.radians(lat)

            # WGS84 타원체 파라미터
            a = 6378137.0  # 적도 반경
            f = 1 / 298.257223563  # 편평률
            e2 = 2 * f - f * f  # 이심률 제곱

            sin_lat = math.sin(lat_rad)
            cos_lat = math.cos(lat_rad)
            sin_lon = math.sin(lon_rad)
            cos_lon = math.cos(lon_rad)

            # 곡률 반경
            N = a / math.sqrt(1 - e2 * sin_lat * sin_lat)

            # ECEF 좌표 (중심점)
            x = (N + alt) * cos_lat * cos_lon
            y = (N + alt) * cos_lat * sin_lon
            z = (N * (1 - e2) + alt) * sin_lat

            # GLB 모델 좌표계 → ECEF 변환 행렬
            #
            # GLB (obj2gltf --inputUpAxis Z 변환 후):
            #   X = East, Y = Up, Z = South (Y-up 좌표계)
            #
            # ENU (East-North-Up) 좌표계:
            #   X = East, Y = North, Z = Up
            #
            # GLB → ENU 회전 행렬 (모델 좌표 → 로컬 ENU):
            #   ENU_X = model_X (East)
            #   ENU_Y = -model_Z (model_Z=South → ENU_Y=North)
            #   ENU_Z = model_Y (model_Y=Up → ENU_Z=Up)
            #
            # 이 회전을 ENU→ECEF 변환에 결합
            #
            # ENU→ECEF 기저 벡터:
            #   East  = [-sin(lon), cos(lon), 0]
            #   North = [-sin(lat)*cos(lon), -sin(lat)*sin(lon), cos(lat)]
            #   Up    = [cos(lat)*cos(lon), cos(lat)*sin(lon), sin(lat)]
            #
            # 결합 변환 (GLB → ECEF):
            #   ECEF = East * model_X + North * (-model_Z) + Up * model_Y
            #        = East * model_X - North * model_Z + Up * model_Y
            #
            # Column-major 4x4 행렬:
            #   col0 = East (model_X 계수)
            #   col1 = Up (model_Y 계수)
            #   col2 = -North (model_Z 계수, South 방향이므로 부호 반전)
            #   col3 = translation

            east = [-sin_lon, cos_lon, 0]
            north = [-sin_lat * cos_lon, -sin_lat * sin_lon, cos_lat]
            up = [cos_lat * cos_lon, cos_lat * sin_lon, sin_lat]

            root_transform = [
                east[0], east[1], east[2], 0,       # column 0: model_X → East
                up[0], up[1], up[2], 0,             # column 1: model_Y → Up
                -north[0], -north[1], -north[2], 0, # column 2: model_Z (South) → -North
                x, y, z, 1                          # column 3: translation
            ]

            logger.info("tileset_transform_created", ecef_x=x, ecef_y=y, ecef_z=z)

        # tileset.json 생성
        tileset = {
            "asset": {
                "version": "1.0",
                "tilesetVersion": "1.0.0"
            },
            "geometricError": 500,
            "root": {
                "boundingVolume": bounding_volume,
                "geometricError": 100,
                "refine": "ADD",
                "content": {
                    "uri": glb_path.name
                }
            }
        }

        # transform 추가 (있는 경우)
        if root_transform:
            tileset["root"]["transform"] = root_transform

        tileset_path = output_dir / "tileset.json"
        with open(tileset_path, "w") as f:
            json.dump(tileset, f, indent=2)

        if progress_callback:
            progress_callback(95)

        # 메타데이터에 공간 정보 포함
        metadata = {
            "tileset_path": str(tileset_path),
            "glb_path": str(glb_path),
            "format": "3dtiles_glb"
        }

        if spatial_info and spatial_info.get("bbox"):
            metadata["spatialInfo"] = {
                "epsg": spatial_info.get("epsg"),
                "isGeographic": spatial_info.get("is_geographic", False),
                "isKoreaTM": spatial_info.get("is_korea_tm", False),
                "bbox": spatial_info.get("bbox"),
                "center": spatial_info.get("center"),
                "vertexCount": spatial_info.get("vertex_count", 0)
            }

        return ConversionResult(
            success=True,
            output_path=str(output_dir),
            metadata=metadata
        )

    def _create_obj_tileset(
        self,
        source: Path,
        output_dir: Path,
        spatial_info: dict = None,
        progress_callback: Callable[[int], None] = None
    ) -> ConversionResult:
        """OBJ 파일용 단순 tileset 생성

        OBJ 파일과 관련 MTL, 텍스처 파일을 함께 복사합니다.
        """
        if progress_callback:
            progress_callback(40)

        # OBJ 파일 복사
        output_obj = output_dir / source.name
        shutil.copy2(source, output_obj)

        # MTL 파일 복사 (있는 경우)
        mtl_path = source.with_suffix(".mtl")
        if mtl_path.exists():
            shutil.copy2(mtl_path, output_dir / mtl_path.name)

        # 텍스처 파일 복사 (OBJ와 같은 디렉토리의 이미지)
        for img_ext in [".jpg", ".jpeg", ".png", ".tif", ".tiff", ".bmp"]:
            for img_file in source.parent.glob(f"*{img_ext}"):
                shutil.copy2(img_file, output_dir / img_file.name)

        if progress_callback:
            progress_callback(70)

        # tileset.json 생성 (OBJ 직접 참조 - 뷰어에서 처리 필요)
        tileset = {
            "asset": {
                "version": "1.0",
                "tilesetVersion": "1.0.0",
                "extras": {
                    "format": "obj",
                    "note": "OBJ 파일은 뷰어에서 별도 로더 필요"
                }
            },
            "geometricError": 500,
            "root": {
                "boundingVolume": {
                    "box": [0, 0, 0, 100, 0, 0, 0, 100, 0, 0, 0, 100]
                },
                "geometricError": 100,
                "refine": "ADD",
                "content": {
                    "uri": source.name
                }
            }
        }

        tileset_path = output_dir / "tileset.json"
        with open(tileset_path, "w") as f:
            json.dump(tileset, f, indent=2)

        if progress_callback:
            progress_callback(90)

        # 메타데이터에 공간 정보 포함
        metadata = {
            "tileset_path": str(tileset_path),
            "format": "obj_tileset"
        }

        if spatial_info and spatial_info.get("bbox"):
            metadata["spatialInfo"] = {
                "epsg": spatial_info.get("epsg"),
                "isGeographic": spatial_info.get("is_geographic", False),
                "isKoreaTM": spatial_info.get("is_korea_tm", False),
                "bbox": spatial_info.get("bbox"),
                "center": spatial_info.get("center"),
                "vertexCount": spatial_info.get("vertex_count", 0)
            }

        return ConversionResult(
            success=True,
            output_path=str(output_dir),
            metadata=metadata
        )

    def _convert_pointcloud_to_3dtiles(
        self,
        source: Path,
        options: dict,
        progress_callback: Callable[[int], None] = None
    ) -> ConversionResult:
        """포인트 클라우드 (PLY/LAS) → 3D Tiles (pnts) 변환

        py3dtiles를 사용하여 포인트 클라우드를 3D Tiles 포맷으로 변환합니다.
        3D Tiles는 CesiumJS에서 LOD 기반 스트리밍 렌더링을 지원합니다.
        """
        output_dir = self.output_base / (source.stem + "_3dtiles")
        output_dir.mkdir(parents=True, exist_ok=True)

        if progress_callback:
            progress_callback(10)

        # 소스 포맷 결정
        ext = source.suffix.lower()
        if not ext and options.get("original_format"):
            ext = "." + options["original_format"]

        # PLY/LAS/LAZ 만 지원
        if ext not in [".ply", ".las", ".laz"]:
            return ConversionResult(
                success=False,
                error=f"포인트 클라우드 3D Tiles 변환에 지원하지 않는 포맷: {ext}"
            )

        # 확장자가 없는 파일의 경우 심볼릭 링크 생성
        temp_link = None
        input_path = source
        if not source.suffix and ext:
            temp_link = self.temp_path / f"pc3dt_{source.stem}{ext}"
            if temp_link.exists():
                temp_link.unlink()
            temp_link.symlink_to(source)
            input_path = temp_link
            logger.info("created_temp_symlink_for_3dtiles", source=str(source), link=str(temp_link))

        if progress_callback:
            progress_callback(20)

        try:
            # 좌표계 정보 감지
            coord_info = self._detect_coordinate_system(source, ext.lstrip('.'))
            color_info = self._detect_color_info(source, ext.lstrip('.'))

            if progress_callback:
                progress_callback(30)

            # py3dtiles 변환 실행
            # py3dtiles convert: 포인트클라우드 → 3D Tiles (pnts)
            cmd = [
                "py3dtiles", "convert",
                str(input_path),
                "--out", str(output_dir),
                "--overwrite",
            ]

            # 색상 데이터가 없으면 RGB 비활성화 (기본은 RGB 포함)
            if not color_info.get("has_color"):
                cmd.extend(["--no-rgb"])

            # EPSG 코드가 옵션으로 제공되었으면 사용
            # py3dtiles는 EPSG 숫자만 받음 (예: 4326, 5186)
            epsg = options.get("epsg")
            if epsg:
                try:
                    epsg_int = int(epsg)
                except (ValueError, TypeError):
                    logger.warning("invalid_epsg_code", epsg=epsg)
                    epsg_int = None

                if epsg_int is not None:
                    cmd.extend(["--srs_in", str(epsg_int)])
                    # WGS84가 아닌 경우 WGS84로 변환
                    if epsg_int != 4326:
                        cmd.extend(["--srs_out", "4326"])
            elif coord_info.get("is_korea_tm"):
                cmd.extend(["--srs_in", "5186", "--srs_out", "4326"])
            elif coord_info.get("is_geographic"):
                cmd.extend(["--srs_in", "4326"])

            logger.info("py3dtiles_convert_starting",
                       cmd=" ".join(cmd),
                       coord_info=coord_info,
                       color_info=color_info)

            if progress_callback:
                progress_callback(40)

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=3600  # 1시간 타임아웃
            )

            if progress_callback:
                progress_callback(80)

            if result.returncode != 0:
                logger.error("py3dtiles_convert_failed",
                           returncode=result.returncode,
                           stderr=result.stderr[:1000] if result.stderr else "",
                           stdout=result.stdout[:1000] if result.stdout else "")
                return ConversionResult(
                    success=False,
                    error=f"3D Tiles 변환 실패: {result.stderr[:500] if result.stderr else 'Unknown error'}"
                )

            # tileset.json 존재 확인
            tileset_path = output_dir / "tileset.json"
            if not tileset_path.exists():
                return ConversionResult(
                    success=False,
                    error="tileset.json이 생성되지 않았습니다."
                )

            if progress_callback:
                progress_callback(95)

            # 메타데이터 구성
            metadata = {
                "tileset_path": str(tileset_path),
                "format": "3dtiles",
                "source_format": ext.lstrip('.'),
                "point_count": coord_info.get("point_count", 0),
            }

            if coord_info.get("bbox"):
                bbox = coord_info["bbox"]
                metadata["spatialInfo"] = {
                    "bbox": {
                        "minX": bbox[0], "minY": bbox[1], "minZ": bbox[2],
                        "maxX": bbox[3], "maxY": bbox[4], "maxZ": bbox[5]
                    },
                    "pointCount": coord_info.get("point_count", 0),
                    "isGeographic": coord_info.get("is_geographic", False),
                    "isKoreaTM": coord_info.get("is_korea_tm", False),
                    "epsg": epsg or (4326 if coord_info.get("is_geographic") else
                                     5186 if coord_info.get("is_korea_tm") else None),
                }

            logger.info("pointcloud_to_3dtiles_success",
                       output_dir=str(output_dir),
                       point_count=coord_info.get("point_count", 0))

            return ConversionResult(
                success=True,
                output_path=str(output_dir),
                metadata=metadata
            )

        except subprocess.TimeoutExpired:
            return ConversionResult(
                success=False,
                error="3D Tiles 변환 타임아웃 (1시간 초과)"
            )
        except Exception as e:
            logger.exception("pointcloud_to_3dtiles_error")
            return ConversionResult(
                success=False,
                error=f"3D Tiles 변환 오류: {str(e)}"
            )
        finally:
            if temp_link and temp_link.exists():
                try:
                    temp_link.unlink()
                except Exception:
                    pass

    def _convert_e57_to_3dtiles(
        self,
        source: Path,
        options: dict,
        progress_callback: Callable[[int], None] = None
    ) -> ConversionResult:
        """E57 → 3D Tiles 변환 (E57 → PLY 임시 변환 후 py3dtiles로 3D Tiles 생성)

        Cesium에서 E57 포인트 클라우드를 지리 가시화하기 위한 파이프라인입니다.
        1단계: PDAL로 E57 → PLY 변환 (좌표 변환 없이 원본 유지)
        2단계: py3dtiles로 PLY → 3D Tiles (pnts) 변환
        """
        if progress_callback:
            progress_callback(5)

        # 1단계: E57 → PLY (임시 파일로)
        logger.info("e57_to_3dtiles_step1", source=str(source))
        temp_ply = self.temp_path / f"e57_3dt_{source.stem}.ply"

        try:
            # E57 → PLY 변환 (좌표 변환 비활성화 — py3dtiles가 좌표계 처리)
            ply_options = {**options, "transform_coords": False}
            ply_result = self._convert_e57_to_ply(
                source, ply_options,
                lambda p: progress_callback(5 + int(p * 0.4)) if progress_callback else None
            )

            if not ply_result.success:
                return ConversionResult(
                    success=False,
                    error=f"E57 → PLY 변환 실패: {ply_result.error}"
                )

            # PLY 결과 파일을 임시 위치로 이동
            ply_output = Path(ply_result.output_path)
            if ply_output != temp_ply:
                shutil.copy2(str(ply_output), str(temp_ply))

            if progress_callback:
                progress_callback(50)

            # 2단계: PLY → 3D Tiles
            logger.info("e57_to_3dtiles_step2", ply_path=str(temp_ply))
            tiles_options = {**options, "original_format": "ply"}
            tiles_result = self._convert_pointcloud_to_3dtiles(
                temp_ply, tiles_options,
                lambda p: progress_callback(50 + int(p * 0.5)) if progress_callback else None
            )

            if not tiles_result.success:
                return ConversionResult(
                    success=False,
                    error=f"PLY → 3D Tiles 변환 실패: {tiles_result.error}"
                )

            # 메타데이터에 원본 포맷 기록
            if tiles_result.metadata:
                tiles_result.metadata["source_format"] = "e57"
                # PLY 단계의 공간 정보 보존
                if ply_result.metadata and "spatialInfo" in ply_result.metadata:
                    tiles_result.metadata["spatialInfo"] = ply_result.metadata["spatialInfo"]

            logger.info("e57_to_3dtiles_success",
                       output=tiles_result.output_path)

            return tiles_result

        except Exception as e:
            logger.exception("e57_to_3dtiles_error")
            return ConversionResult(
                success=False,
                error=f"E57 → 3D Tiles 변환 오류: {str(e)}"
            )
        finally:
            # 임시 PLY 파일 정리
            if temp_ply.exists():
                try:
                    temp_ply.unlink()
                except Exception:
                    pass

    def _run_pdal_pipeline(
        self,
        pipeline: dict,
        output_path: Path,
        progress_callback: Callable[[int], None] = None
    ) -> ConversionResult:
        """PDAL 파이프라인 실행"""
        if progress_callback:
            progress_callback(20)

        # 파이프라인 JSON 파일 생성
        pipeline_file = self.temp_path / "pipeline.json"
        with open(pipeline_file, "w") as f:
            json.dump(pipeline, f, indent=2)

        # 디버깅: 파이프라인 내용 로깅
        logger.info("pdal_pipeline_generated",
                   pipeline_file=str(pipeline_file),
                   pipeline_content=json.dumps(pipeline, indent=2)[:2000])

        if progress_callback:
            progress_callback(30)

        try:
            # PDAL 실행
            result = subprocess.run(
                ["pdal", "pipeline", str(pipeline_file)],
                capture_output=True,
                text=True,
                timeout=3600  # 1시간 타임아웃
            )

            if progress_callback:
                progress_callback(80)

            if result.returncode != 0:
                logger.error("pdal_pipeline_failed",
                           returncode=result.returncode,
                           stderr=result.stderr[:1000] if result.stderr else "",
                           stdout=result.stdout[:1000] if result.stdout else "",
                           pipeline_stages=[s.get("type") for s in pipeline.get("pipeline", [])])
                return ConversionResult(
                    success=False,
                    error=f"PDAL 실행 실패: {result.stderr}"
                )

            if not output_path.exists():
                return ConversionResult(
                    success=False,
                    error=f"출력 파일이 생성되지 않았습니다: {output_path}"
                )

            if progress_callback:
                progress_callback(95)

            # 메타데이터 추출
            metadata = self._get_pdal_metadata(output_path)

            return ConversionResult(
                success=True,
                output_path=str(output_path),
                metadata=metadata
            )

        except subprocess.TimeoutExpired:
            return ConversionResult(
                success=False,
                error="변환 타임아웃 (1시간 초과)"
            )
        except Exception as e:
            return ConversionResult(
                success=False,
                error=f"PDAL 실행 오류: {str(e)}"
            )
        finally:
            # 임시 파일 정리
            if pipeline_file.exists():
                pipeline_file.unlink()

    def _get_pdal_metadata(self, file_path: Path) -> dict:
        """PDAL로 파일 메타데이터 추출"""
        try:
            result = subprocess.run(
                ["pdal", "info", "--summary", str(file_path)],
                capture_output=True,
                text=True,
                timeout=60
            )

            if result.returncode == 0:
                return json.loads(result.stdout)
        except Exception as e:
            logger.warning("metadata_extraction_failed", error=str(e))

        return {}
