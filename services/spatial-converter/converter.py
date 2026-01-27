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

                # 패턴 1: X/Y가 매우 작고 Z가 위도 범위 (좌표 축 뒤바뀜)
                is_swapped_geo = (x_range < 1 and y_range < 1 and
                                  20 <= minz <= 70 and 20 <= maxz <= 70)

                # 패턴 2: 표준 지리 좌표 (-180~180, -90~90)
                is_standard_geo = (-180 <= minx <= 180 and -180 <= maxx <= 180 and
                                   -90 <= miny <= 90 and -90 <= maxy <= 90 and
                                   x_range < 10 and y_range < 10)  # 10도 이내 범위

                is_geographic = is_swapped_geo or is_standard_geo

                logger.info("coordinate_system_detected",
                           is_geographic=is_geographic,
                           is_swapped_geo=is_swapped_geo,
                           x_range=x_range, y_range=y_range, z_range=z_range,
                           bounds=bounds)

                return {
                    "is_geographic": is_geographic,
                    "is_swapped": is_swapped_geo,
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
        point_count = coord_info.get("point_count", 0)

        # 복셀 크기 결정
        if is_geographic:
            # 지리 좌표계: 도(degree) 단위이므로 훨씬 작은 값 사용
            # 0.00001도 ≈ 약 1.1m (적도 기준)
            voxel_size = options.get("voxel_size", 0.00001)
            logger.info("using_geographic_voxel_size", voxel_size=voxel_size)
        else:
            # 투영 좌표계: 미터 단위
            # 0.05m = 5cm 간격
            voxel_size = options.get("voxel_size", 0.05)

        # 좌표계 변환 여부 (Z-up → Y-up, 기본: 활성화)
        # 지리 좌표계의 경우 좌표 변환을 비활성화 (이미 축이 뒤바뀌어 있을 수 있음)
        transform_coords = options.get("transform_coords", not is_geographic)

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
        else:
            # 투영 좌표계: 복셀 그리드 다운샘플링
            pipeline_stages.append({
                "type": "filters.voxeldownsize",
                "cell": voxel_size,
                "mode": "center"
            })

        # 지리 좌표계 정규화 (3D 뷰어용)
        # EPSG:4326 데이터는 X/Y/Z 스케일이 매우 다를 수 있음 (도 단위 vs 미터 등)
        if is_geographic:
            bbox = coord_info.get("bbox")
            if bbox:
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
                # 이렇게 하면 X/Y/Z 스케일 차이가 있어도 균등하게 표시됨
                scale_x = 100.0 / x_range
                scale_y = 100.0 / y_range
                scale_z = 100.0 / z_range

                logger.info("normalizing_geographic_coords",
                           center=(cx, cy, cz),
                           ranges=(x_range, y_range, z_range),
                           scales=(scale_x, scale_y, scale_z))

                # 좌표 정규화: 각 축을 독립적으로 스케일링
                pipeline_stages.append({
                    "type": "filters.assign",
                    "value": [
                        f"X = (X - {cx}) * {scale_x}",
                        f"Y = (Y - {cy}) * {scale_y}",
                        f"Z = (Z - {cz}) * {scale_z}"
                    ]
                })

        # Z-up → Y-up 좌표계 변환 (Three.js는 Y-up 사용)
        # 변환 행렬: X'=X, Y'=Z, Z'=-Y (X축 기준 -90도 회전)
        if transform_coords:
            pipeline_stages.append({
                "type": "filters.transformation",
                "matrix": "1 0 0 0  0 0 1 0  0 -1 0 0  0 0 0 1"
            })

        # 색상 스케일링 (16비트 → 8비트, PLY 파일 호환성)
        # PDAL 2.3에서는 writers.ply가 자동으로 8비트로 변환하지 않음
        pipeline_stages.append({
            "type": "filters.assign",
            "value": [
                "Red = Red / 256",
                "Green = Green / 256",
                "Blue = Blue / 256"
            ]
        })

        # 출력 (바이너리 형식으로 파일 크기 최소화)
        pipeline_stages.append({
            "type": "writers.ply",
            "filename": str(output_path),
            "storage_mode": "little endian"
        })

        pipeline = {"pipeline": pipeline_stages}

        return self._run_pdal_pipeline(pipeline, output_path, progress_callback)

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
        # Supabase 스토리지 형식: "timestamp________{suffix}.{ext}"
        # 예: 삼양비지네스폼10.jpg → 1769489283335________10.jpg
        for tex_name in texture_names:
            tex_found = False
            tex_ext = Path(tex_name).suffix.lower()
            tex_stem = Path(tex_name).stem

            # 텍스처 이름에서 숫자 접미사 추출 (예: "삼양비지네스폼10" → "10")
            # 숫자로 끝나는 경우 해당 숫자를 추출
            import re
            number_match = re.search(r'(\d+)$', tex_stem)
            tex_number_suffix = number_match.group(1) if number_match else None

            for user_dir in storage_user_dir.iterdir():
                if not user_dir.is_dir():
                    continue
                for item in user_dir.iterdir():
                    # 디렉토리명이 같은 확장자로 끝나는지 확인
                    if not (item.is_dir() and item.name.lower().endswith(tex_ext)):
                        continue

                    # 매칭 조건:
                    # 1. 정확히 일치: ________{tex_name}
                    # 2. 숫자 접미사 매칭: ________{number}.{ext}
                    # 3. 확장자만 있는 경우 (첫 번째 텍스처): ________.{ext}
                    item_name = item.name
                    matched = False

                    if item_name.endswith(f'________{tex_name}'):
                        matched = True
                    elif tex_number_suffix and item_name.endswith(f'________{tex_number_suffix}{tex_ext}'):
                        matched = True
                    elif not tex_number_suffix and item_name.endswith(f'________{tex_ext}'):
                        # 숫자 없는 기본 텍스처 (예: 삼양비지네스폼.jpg)
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
        """
        if progress_callback:
            progress_callback(5)

        # OBJ 관련 파일 준비 (MTL, 텍스처를 임시 디렉토리에 모음)
        work_dir = None
        try:
            prepared_obj, work_dir = self._prepare_obj_files(source, options)
            logger.info("obj_files_prepared", work_dir=str(work_dir))
        except Exception as e:
            logger.warning("obj_prepare_failed", error=str(e))
            prepared_obj = source  # 실패 시 원본 사용

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
                    compress_result = subprocess.run(
                        ["npx", "gltf-transform", "webp",
                         str(resize_input), str(temp_glb)
                        ],
                        capture_output=True,
                        text=True,
                        timeout=600
                    )

                    # 중간 파일 정리
                    if temp_resized.exists():
                        temp_resized.unlink()

                    if compress_result.returncode == 0 and temp_glb.exists():
                        converted = True
                        compressed_size = temp_glb.stat().st_size
                        # 압축되지 않은 임시 파일 삭제
                        temp_uncompressed.unlink()
                        logger.info("gltf_transform_compression_success",
                                   original_mb=f"{original_size/1024/1024:.1f}",
                                   compressed_mb=f"{compressed_size/1024/1024:.1f}")
                    else:
                        logger.warning("gltf_transform_compression_failed",
                                      stderr=compress_result.stderr,
                                      stdout=compress_result.stdout)
                        # 압축 실패 시 비압축 파일 사용
                        temp_uncompressed.rename(temp_glb)
                        converted = True
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
                result = subprocess.run(
                    ["gltfpack", "-i", str(prepared_obj), "-o", str(temp_glb),
                     "-cc", "-tc", "-si", "0.5"],
                    capture_output=True,
                    text=True,
                    timeout=300,
                    cwd=str(prepared_obj.parent)
                )

                if result.returncode == 0 and temp_glb.exists():
                    converted = True
                    logger.info("gltfpack_success", output=str(temp_glb))
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

        # GLB 변환 성공 시 → 3D Tiles 생성
        if converted:
            return self._create_glb_tileset(temp_glb, output_dir, source.stem, progress_callback)

        # 모든 변환 실패 시 OBJ 직접 처리
        logger.info("fallback_to_obj_tileset", msg="OBJ 직접 처리 모드")
        return self._create_obj_tileset(source, output_dir, progress_callback)

    def _create_glb_tileset(
        self,
        glb_path: Path,
        output_dir: Path,
        name: str,
        progress_callback: Callable[[int], None] = None
    ) -> ConversionResult:
        """GLB 파일용 tileset.json 생성"""
        if progress_callback:
            progress_callback(80)

        # tileset.json 생성
        tileset = {
            "asset": {
                "version": "1.0",
                "tilesetVersion": "1.0.0"
            },
            "geometricError": 500,
            "root": {
                "boundingVolume": {
                    "box": [0, 0, 0, 100, 0, 0, 0, 100, 0, 0, 0, 100]
                },
                "geometricError": 100,
                "refine": "ADD",
                "content": {
                    "uri": glb_path.name
                }
            }
        }

        tileset_path = output_dir / "tileset.json"
        with open(tileset_path, "w") as f:
            json.dump(tileset, f, indent=2)

        if progress_callback:
            progress_callback(95)

        return ConversionResult(
            success=True,
            output_path=str(output_dir),
            metadata={
                "tileset_path": str(tileset_path),
                "glb_path": str(glb_path),
                "format": "3dtiles_glb"
            }
        )

    def _create_obj_tileset(
        self,
        source: Path,
        output_dir: Path,
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

        return ConversionResult(
            success=True,
            output_path=str(output_dir),
            metadata={
                "tileset_path": str(tileset_path),
                "format": "obj_tileset"
            }
        )

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
            json.dump(pipeline, f)

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
