# SAMS 메타데이터 자동 채움 파이프라인 명세

## 1. 이 문서의 위치

이 파이프라인은 SAMS의 **시스템 채택 전제 조건**이다. NAS 폴더 복사보다 이 시스템에 올리는 것이 체감적으로 더 쉽지 않으면 아무도 쓰지 않는다. 다른 모든 기능(검색, 대시보드, 시계열)은 데이터가 시스템에 들어온 후에야 의미가 있다.

목표: **사용자가 실제로 타이핑해야 하는 필드를 전체의 20~30% 이하로 줄인다.**

---

## 2. 파이프라인 전체 흐름

```
사용자가 파일을 업로드
       │
       ▼
┌──────────────────┐
│  0단계: 파일 그룹핑│  동반 파일/폴더 구조를 분석하여 Item 단위로 묶음
│  (동기, <1초)     │  → OBJ+MTL+텍스처, 이미지 세트, 3D Tiles 등 번들링
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  1단계: 파일 감지  │  확장자 + 매직바이트로 데이터 유형 판별
│  (동기, <1초)     │  → data_category 자동 설정
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  2단계: 메타 추출  │  유형별 라이브러리로 파일 헤더/메타 파싱
│  (동기, 1~30초)   │  → 구역 A 필드 채움
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  3단계: 상속 채움  │  Collection 기본값 + 이전 입력값 적용
│  (동기, <1초)     │  → 구역 B 일부 필드 채움
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  4단계: 관계 제안  │  파일명 매칭 + 유형 계보로 links 후보 생성
│  (동기, <1초)     │  → links 초안 생성 (사용자 확인 필요)
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  5단계: 썸네일     │  간이 렌더링으로 미리보기 이미지 생성
│  (비동기, 10~60초) │  → thumbnail Asset 등록
└──────┬───────────┘
       │
       ▼
  매니페스트 (자동 채움 완료 상태)
  → 사용자에게 전달: 빈 칸만 채우세요
```

### 동기 vs 비동기

0~4단계는 **동기**로 처리한다. 사용자가 파일을 올리면 수 초 이내에 매니페스트 초안이 나타나야 한다. 대용량 파일(수 GB LAS)이라도 헤더만 읽으면 되므로 파일 전체를 파싱하지 않는다.

5단계(썸네일)는 **비동기**로 처리한다. Worker가 백그라운드에서 생성하고, 완료되면 Asset에 추가한다. 썸네일이 없어도 등록은 진행 가능하다.

---

### 2.1 0단계: 파일 그룹핑 (Bundling)

파일 그룹핑은 1단계(파일 유형 판별) **이전에** 실행된다. 업로드된 파일/폴더 구조를 분석하여, 논리적으로 하나의 Item을 구성하는 파일들을 묶는다. 그룹핑이 완료된 후 각 그룹(= Item 후보) 단위로 1단계 이후 파이프라인이 진행된다.

#### 그룹핑 규칙

| 패턴 | 감지 조건 | 번들 결과 | 비고 |
|------|----------|----------|------|
| **OBJ + 동반 파일** | 같은 폴더에 `.obj`와 `.mtl`, 텍스처(`.jpg`/`.png`/`.tga`)가 존재하며, 파일명 prefix가 일치 | 하나의 3d_model Item, 다수의 Asset | 예: `bridge.obj` + `bridge.mtl` + `bridge_diffuse.png` → 1 Item, 3 Assets |
| **PLY + 텍스처** | 같은 폴더에 `.ply`와 텍스처 파일이 존재하며, 파일명 prefix가 일치 | OBJ와 동일하게 하나의 Item으로 번들 | PLY가 mesh(face 있음)인 경우에만 텍스처 번들링 적용 |
| **이미지 폴더** | 폴더 내 이미지 파일(`.jpg`/`.jpeg`/`.png`/`.tif`) 수가 5개 초과 | 하나의 image set Item, `image:image_count` 필드에 전체 수 기록 | 대표 이미지 1장의 EXIF를 메타데이터 대표값으로 사용 |
| **3D Tiles** | 폴더 내에 `tileset.json` 파일 존재 | 폴더 전체를 하나의 3d_tiles Item으로 번들 | 하위의 `.b3dm`/`.pnts`/`.i3dm` 파일은 개별 Asset으로 등록하지 않음 |

#### 감지 세부 규칙

**파일명 prefix 매칭**: 같은 폴더 내 파일들의 확장자를 제외한 이름(stem)에서 공통 prefix를 추출한다. 예를 들어 `model_A.obj`, `model_A.mtl`, `model_A_color.png`는 모두 `model_A` prefix를 공유하므로 하나의 그룹으로 묶인다.

**같은 폴더 원칙**: 그룹핑은 동일 폴더 내 파일에 대해서만 수행한다. 하위 폴더의 파일은 별도 그룹핑 대상이다 (3D Tiles는 예외: 하위 폴더 포함).

**우선순위**: 하나의 파일이 여러 규칙에 매칭될 경우, 3D Tiles > OBJ/PLY 번들 > 이미지 폴더 순으로 우선 적용한다.

**단독 파일**: 어떤 그룹에도 속하지 않는 파일은 1 파일 = 1 Item으로 처리한다 (기존 동작과 동일).

---

## 3. 1단계: 파일 유형 자동 판별

### 판별 규칙

| 확장자 | 추가 확인 | data_category | 비고 |
|--------|----------|---------------|------|
| .las, .laz | — | pointcloud | |
| .e57 | — | pointcloud | |
| .pcd | — | pointcloud | |
| .obj | — | 3d_model | .mtl, 텍스처 동반 확인 |
| .ply | 헤더에 vertex 있는지 | 3d_model 또는 pointcloud | 정점만 있으면 PC, 면이 있으면 3D |
| .fbx, .gltf, .glb, .stl, .dae | — | 3d_model | |
| .tif, .tiff | GeoTIFF 태그 확인 | orthoimage (태그 있으면) 또는 image (없으면) | rasterio.open() 성공 여부 |
| .jpg, .jpeg, .png | EXIF 확인 | image 또는 panorama | 해상도 비율 2:1이면 panorama 추정 |
| .mp4, .mov, .avi, .mkv | — | video | |
| .pdf | — | document | |
| .hwp, .docx, .xlsx, .pptx | — | document | |
| 폴더 (images/) | 내부 파일 수 | image (다수 이미지) | 이미지 세트로 처리 |

### .ply 파일 양면성

PLY는 포인트 클라우드(정점만)일 수도 있고 3D 모델(정점+면)일 수도 있다. PLY 헤더의 `element face` 존재 여부로 판별한다.

```python
def detect_ply_type(filepath):
    with open(filepath, 'rb') as f:
        header = f.read(2048).decode('ascii', errors='ignore')
        has_face = 'element face' in header
        return '3d_model' if has_face else 'pointcloud'
```

### 파노라마 추정

JPG/PNG의 해상도 비율이 1.8:1 ~ 2.2:1이고 너비가 6000px 이상이면 equirectangular 파노라마로 추정한다. 추정값이므로 "파노라마로 추정 — 확인 필요" 태그를 붙인다.

### 판별 실패 시

확장자로 판별 불가한 파일은 `data_category: unknown`으로 설정하고, 사용자에게 직접 선택하도록 한다. 매니페스트에 노란색 경고로 표시.

**Upload 매니페스트 UI에서의 unknown 타입 처리**:
- unknown 타입 행은 **노란 배경**으로 강조 표시된다.
- 타입 셀에 드롭다운이 표시되며, 7가지 표준 타입 중 하나를 선택할 수 있다: `pointcloud`, `3d_model`, `orthoimage`, `image`, `panorama`, `video`, `document`.
- 사용자가 타입을 선택하기 전까지 해당 행의 타입 셀에 **빨간 테두리**가 표시되며, 등록(registration) 단계로 진행할 수 없다.
- 타입을 선택하면 해당 유형의 2단계(메타 추출)가 재실행되어, 선택한 유형에 맞는 필드가 자동 채워진다.

---

## 4. 2단계: 유형별 메타데이터 자동 추출

### 4.1 포인트 클라우드 (LAS/LAZ)

**라이브러리**: laspy (LAS/LAZ), pye57 (E57)

**추출 가능 필드**:

| 필드 | 추출 방법 | 정확도 | 비고 |
|------|----------|--------|------|
| pc:count | `las.header.point_count` | 100% | |
| pc:encoding | 확장자 (.las/.laz) | 100% | |
| pc:schemas | `las.point_format.dimensions` | 100% | X,Y,Z 외 속성 목록 |
| pc:density | count / bbox_area | ~95% | bbox 면적으로 나눔 |
| pc:has_rgb | 'red' in dimensions | 100% | |
| pc:has_intensity | 'intensity' in dimensions | 100% | |
| pc:las_version | `las.header.version` | 100% | |
| proj:epsg | `las.header.parse_crs()` | **~60%** | ⚠ 헤더에 없는 경우 빈번 |
| bbox | `las.header.mins/maxs` | ~95% | 로컬 좌표계이면 WGS84 변환 필요 |
| datetime | — | **0%** | LAS 헤더에 시간 정보 없음 |
| file:size | `os.path.getsize()` | 100% | |

**핵심 주의사항**:
- `proj:epsg`: LAS 헤더에 CRS가 기록되지 않은 파일이 실무에서 매우 빈번하다. 이 경우 Collection의 `default_epsg`를 적용하고, "⚠ 파일에서 좌표계를 확인할 수 없었습니다. Collection 기본값(EPSG:5186)을 적용했습니다. 확인해주세요." 경고를 표시한다.
- `datetime`: LAS 파일에는 취득 시점 정보가 없다. Collection의 사업 기간이나 파일 수정일을 참고값으로 제시하되, 사용자 입력 필수.
- `bbox`: 로컬 좌표계(proj:epsg 없음)인 경우 bbox를 WGS84로 변환할 수 없다. 이 경우 bbox는 로컬 좌표값 그대로 저장하고, geometry는 null로 둔다.

```python
import laspy
import os

def extract_pointcloud_metadata(filepath):
    las = laspy.read(filepath)
    h = las.header

    meta = {
        "pc:count": int(h.point_count),
        "pc:encoding": "LAZ" if filepath.lower().endswith('.laz') else "LAS",
        "pc:schemas": [{"name": d.name, "size": d.size, "type": d.dtype.name}
                       for d in las.point_format.dimensions],
        "pc:has_rgb": any(d.name.lower() in ('red','green','blue') for d in las.point_format.dimensions),
        "pc:has_intensity": any(d.name.lower() == 'intensity' for d in las.point_format.dimensions),
        "pc:las_version": f"{h.version.major}.{h.version.minor}",
        "file:size": os.path.getsize(filepath),
    }

    # bbox
    if h.mins is not None and h.maxs is not None:
        meta["bbox"] = [
            float(h.mins[0]), float(h.mins[1]), float(h.mins[2]),
            float(h.maxs[0]), float(h.maxs[1]), float(h.maxs[2])
        ]

    # density
    if "bbox" in meta:
        dx = meta["bbox"][3] - meta["bbox"][0]
        dy = meta["bbox"][4] - meta["bbox"][1]
        area = dx * dy
        if area > 0:
            meta["pc:density"] = round(meta["pc:count"] / area, 1)

    # CRS
    epsg = None
    try:
        crs = las.header.parse_crs()
        if crs and crs.to_epsg():
            epsg = crs.to_epsg()
    except:
        pass

    meta["proj:epsg"] = epsg  # None이면 Collection 기본값 적용 대상
    meta["_epsg_source"] = "file" if epsg else "unknown"

    return meta
```

### 4.2 3D 모델 (OBJ/PLY/FBX/glTF)

**라이브러리**: trimesh (OBJ, PLY, STL, glTF), open3d (보조)

| 필드 | 추출 방법 | 정확도 |
|------|----------|--------|
| 3dmodel:format | 확장자 | 100% |
| 3dmodel:vertex_count | `mesh.vertices.shape[0]` | 100% |
| 3dmodel:face_count | `mesh.faces.shape[0]` | 100% |
| 3dmodel:has_texture | .mtl 참조 + 텍스처 파일 존재 확인 | ~90% |
| 3dmodel:has_normals | `mesh.vertex_normals is not None` | 100% |
| 3dmodel:texture_count | 텍스처 파일 수 | ~90% |
| 3dmodel:material_count | .mtl 내 material 수 | ~90% |
| 3dmodel:bounding_volume | `mesh.bounds` | 100% |
| proj:epsg | — | **0%** | 3D 모델에는 좌표계 개념 없음 |
| datetime | — | **0%** | |

**동반 파일 감지**: OBJ 파일 업로드 시 같은 폴더의 .mtl, .jpg/.png(텍스처)를 자동 감지하여 하나의 Item으로 묶는다.

```python
import trimesh
from pathlib import Path

def extract_3dmodel_metadata(filepath):
    mesh = trimesh.load(filepath)
    p = Path(filepath)

    meta = {
        "3dmodel:format": p.suffix.lstrip('.').lower(),
        "3dmodel:vertex_count": int(mesh.vertices.shape[0]),
        "3dmodel:face_count": int(mesh.faces.shape[0]) if hasattr(mesh, 'faces') else 0,
        "3dmodel:has_normals": mesh.vertex_normals is not None and len(mesh.vertex_normals) > 0,
        "file:size": p.stat().st_size,
    }

    # Texture detection
    texture_exts = {'.jpg','.jpeg','.png','.tga','.bmp'}
    textures = [f for f in p.parent.iterdir()
                if f.suffix.lower() in texture_exts and p.stem.lower() in f.stem.lower()]
    mtl_files = list(p.parent.glob(f"{p.stem}*.mtl"))

    meta["3dmodel:has_texture"] = len(textures) > 0 or len(mtl_files) > 0
    meta["3dmodel:texture_count"] = len(textures)
    meta["3dmodel:material_count"] = len(mtl_files)

    # Bounding volume
    if mesh.bounds is not None:
        meta["3dmodel:bounding_volume"] = {
            "min": mesh.bounds[0].tolist(),
            "max": mesh.bounds[1].tolist()
        }

    meta["proj:epsg"] = None  # 항상 Collection 기본값 적용
    meta["_epsg_source"] = "unknown"

    return meta
```

### 4.3 정사영상 (GeoTIFF)

**라이브러리**: rasterio

| 필드 | 추출 방법 | 정확도 |
|------|----------|--------|
| proj:epsg | `ds.crs.to_epsg()` | **~98%** | GeoTIFF는 거의 항상 CRS 포함 |
| proj:shape | `[ds.height, ds.width]` | 100% |
| proj:transform | `list(ds.transform)` | 100% |
| bbox | `ds.bounds` | 100% |
| eo:bands | `ds.descriptions` / count | 100% |
| ortho:gsd | `ds.res[0]` | ~95% | 단위가 m인 CRS일 때 |
| ortho:bit_depth | `ds.dtypes` | 100% |
| file:size | `os.path.getsize()` | 100% |

**정사영상은 자동 추출이 가장 잘 되는 유형이다.** GeoTIFF 포맷 자체에 좌표계, 범위, 해상도가 모두 포함되어 있기 때문이다.

```python
import rasterio

def extract_orthoimage_metadata(filepath):
    with rasterio.open(filepath) as ds:
        meta = {
            "proj:epsg": ds.crs.to_epsg() if ds.crs else None,
            "proj:shape": [ds.height, ds.width],
            "proj:transform": list(ds.transform)[:6],
            "bbox": [ds.bounds.left, ds.bounds.bottom, ds.bounds.right, ds.bounds.top],
            "eo:bands": [{"name": d or f"band_{i+1}", "common_name": None}
                         for i, d in enumerate(ds.descriptions or range(ds.count))],
            "ortho:gsd": round(abs(ds.res[0]), 4),
            "ortho:bit_depth": 8 if 'uint8' in str(ds.dtypes[0]) else 16,
            "file:size": os.path.getsize(filepath),
        }
        meta["_epsg_source"] = "file" if meta["proj:epsg"] else "unknown"
        return meta
```

### 4.4 원본 이미지 (JPG/PNG)

**라이브러리**: Pillow + piexif (또는 exifread)

| 필드 | 추출 방법 | 정확도 |
|------|----------|--------|
| image:camera_model | EXIF Make + Model | ~85% | EXIF 없는 이미지 존재 |
| image:focal_length | EXIF FocalLength | ~85% | |
| image:resolution | `img.size` | 100% | |
| image:has_geotag | EXIF GPS 태그 존재 | ~85% | |
| image:orientation | EXIF Orientation | ~80% | |
| datetime | EXIF DateTimeOriginal | ~85% | |
| geometry | EXIF GPS 좌표 → Point | ~70% | GPS 태그 있을 때만 |
| file:size | `os.path.getsize()` | 100% |

**이미지 세트 처리**: 폴더 안에 여러 이미지가 있을 때, 첫 번째 이미지의 EXIF를 대표값으로 사용하고, `image:image_count`에 전체 수를 기록한다. geometry는 GPS 태그가 있는 이미지들의 좌표를 모아 ConvexHull로 Polygon을 생성한다.

### 4.5 동영상 (MP4/MOV)

**라이브러리**: ffprobe (ffmpeg 패키지)

| 필드 | 추출 방법 | 정확도 |
|------|----------|--------|
| video:duration | `stream.duration` | 100% |
| video:codec | `stream.codec_name` | 100% |
| video:resolution | `[width, height]` | 100% |
| video:frame_rate | `stream.r_frame_rate` | 100% |
| video:total_frames | duration × fps | ~98% |
| video:bitrate | `stream.bit_rate` | 100% |
| video:has_audio | audio stream 존재 | 100% |
| video:audio_codec | `audio_stream.codec_name` | 100% |
| datetime | 메타데이터 creation_time | ~70% | 장비에 따라 다름 |
| file:size | `os.path.getsize()` | 100% |

**ffprobe는 파일 전체를 읽지 않고 헤더만 파싱하므로 수 GB 파일에도 빠르다.**

```python
import subprocess, json

def extract_video_metadata(filepath):
    cmd = ['ffprobe', '-v', 'quiet', '-print_format', 'json',
           '-show_format', '-show_streams', filepath]
    result = subprocess.run(cmd, capture_output=True, text=True)
    info = json.loads(result.stdout)

    video_stream = next((s for s in info['streams'] if s['codec_type'] == 'video'), None)
    audio_stream = next((s for s in info['streams'] if s['codec_type'] == 'audio'), None)

    meta = {}
    if video_stream:
        meta["video:codec"] = video_stream.get("codec_name")
        meta["video:resolution"] = [int(video_stream.get("width", 0)),
                                     int(video_stream.get("height", 0))]
        # frame rate
        fps_str = video_stream.get("r_frame_rate", "30/1")
        num, den = map(int, fps_str.split('/'))
        meta["video:frame_rate"] = round(num / den, 2) if den else 0

    fmt = info.get('format', {})
    meta["video:duration"] = round(float(fmt.get("duration", 0)), 1)
    meta["video:bitrate"] = int(fmt.get("bit_rate", 0))
    meta["video:has_audio"] = audio_stream is not None
    if audio_stream:
        meta["video:audio_codec"] = audio_stream.get("codec_name")

    meta["video:total_frames"] = int(meta["video:duration"] * meta.get("video:frame_rate", 0))
    meta["file:size"] = int(fmt.get("size", 0))

    # datetime from metadata
    tags = fmt.get("tags", {})
    meta["datetime"] = tags.get("creation_time")

    return meta
```

### 4.6 파노라마

이미지와 동일한 EXIF 추출 + 파노라마 특화 필드 추가.

| 필드 | 추출 방법 | 정확도 |
|------|----------|--------|
| panorama:resolution | `img.size` | 100% |
| panorama:type | 비율 2:1이면 equirectangular 추정 | ~80% |
| panorama:fov_horizontal | 비율에서 추정 (2:1 → 360°) | ~80% |
| panorama:fov_vertical | 비율에서 추정 (2:1 → 180°) | ~80% |
| panorama:camera_model | EXIF | ~85% |
| datetime | EXIF | ~85% |

### 4.7 문서 (PDF/HWP/DOCX)

**라이브러리**: PyPDF (PDF), python-docx (DOCX)

| 필드 | 추출 방법 | 정확도 |
|------|----------|--------|
| document:format | 확장자 | 100% |
| document:pages | PDF 페이지 수 | 100% (PDF) |
| file:size | `os.path.getsize()` | 100% |
| document:title | PDF metadata Title | ~30% | 대부분 비어있음 |
| document:authors | PDF metadata Author | ~30% | |
| datetime | PDF metadata CreationDate | ~50% | |

**문서는 자동 추출이 가장 적은 유형이다.** 파일 내부에 의미 있는 메타데이터가 거의 없기 때문이다. document:type, document:title, document:authors, geometry는 모두 사용자 입력에 의존한다.

---

## 5. 3단계: Collection 기본값 상속

### 상속 규칙

사용자가 Upload에서 Collection을 선택하면, 해당 Collection의 기본값이 Item에 자동 적용된다.

| Collection 필드 | → Item 필드 | 상속 방식 |
|----------------|------------|----------|
| title | project:name | 그대로 복사 |
| project:site | project:site | 그대로 복사 |
| project:default_epsg | proj:epsg | 파일 추출값이 없을 때만 적용 |
| license | license | 그대로 복사 |
| id | collection | 그대로 복사 |

### 우선순위

```
파일 추출값 (구역 A) > Collection 기본값 > 이전 입력값 > 빈 칸
```

파일에서 추출한 값이 있으면 그것이 최우선이다. 파일에서 알 수 없는 필드는 Collection 기본값을 적용한다. Collection에도 없으면 같은 Collection에서 이전에 입력한 값을 후보로 제시한다.

### 이전 입력값 자동완성

같은 Collection에 이미 등록된 Item의 값을 기반으로 자동완성 후보를 제시한다.

예시: 첫 번째 포인트 클라우드에 `pc:scanner_model: "Leica RTC360"`을 입력하면, 두 번째 포인트 클라우드의 pc:scanner_model 필드에 "Leica RTC360"이 자동완성 후보로 뜬다.

구현: Collection 내 Item들의 properties를 집계하여, 각 필드별 최빈값(mode)을 캐싱한다.

---

## 6. 4단계: 관계 자동 제안

### 제안 규칙

| 조건 | 제안하는 관계 | 신뢰도 |
|------|-------------|--------|
| 같은 배치 내 같은 target의 PC→3D Model | derived_from | ~70% |
| 같은 배치 내 같은 target의 Image→3D Model | derived_from | ~70% |
| 같은 배치 내 같은 target의 다른 유형 | related | ~80% |
| 같은 target의 기존 Item과 새 Item (같은 cat) | prev/next | ~60% |
| 같은 배치 내 document와 나머지 | describedby (역방향) | ~50% |

### target 매칭

"같은 target"은 다음 기준으로 판단한다.

1. 매니페스트의 target 필드가 동일 (사용자가 이미 입력한 경우)
2. 파일명의 공통 키워드 (dabotap_scan.laz와 dabotap.obj → "dabotap" 공통)
3. 같은 하위 폴더 (pointcloud/dabotap/와 3dmodel/dabotap/)

### 제안 UI

관계 제안은 **확인 필요**로 표시한다. "이 3D 모델은 이 포인트 클라우드에서 파생된 것이 아닌가요? [예] [아니오]" 형태. 사용자가 [예]를 누르면 derived_from 링크가 설정된다.

---

## 7. 5단계: 썸네일 자동 생성

### 유형별 생성 방법

| 유형 | 방법 | 라이브러리 | 예상 시간 |
|------|------|-----------|----------|
| 포인트 클라우드 | 상위 뷰 포인트 렌더링 | open3d + matplotlib | 10~30초 |
| 3D 모델 | 45° 앵글 렌더링 | open3d 또는 trimesh | 5~15초 |
| 정사영상 | 중앙 영역 크롭 + 리사이즈 | rasterio + Pillow | 3~10초 |
| 원본 이미지 | 대표 이미지 리사이즈 | Pillow | <1초 |
| 파노라마 | equirect → flat 변환 리사이즈 | Pillow | <1초 |
| 동영상 | 중간 프레임 추출 | ffmpeg | <3초 |
| 문서(PDF) | 첫 페이지 렌더링 | pdf2image / PyMuPDF | <3초 |

### 썸네일 사양

- 크기: 400×300px (4:3)
- 포맷: PNG
- 저장: S3에 원본과 같은 경로에 `_thumb.png` 접미사

### 비동기 처리

썸네일 생성은 Celery worker(또는 유사 작업큐)에서 비동기로 처리한다. 대기열에 넣고 사용자에게는 즉시 매니페스트를 보여준다. 썸네일이 완성되면 Item의 thumbnail Asset에 href를 업데이트한다.

---

## 8. 벌크 업로드에서의 파이프라인 적용

### 흐름

```
사용자가 폴더를 업로드
       │
       ▼
서버가 폴더 트리를 스캔
       │
       ▼
각 파일/파일그룹에 대해 1~4단계 실행 (병렬 가능)
       │
       ▼
매니페스트 초안 생성 (자동 채움 상태)
       │
       ▼
사용자에게 매니페스트 표시
 ├── 화면에서 직접 편집 (웹 테이블)
 └── Excel 다운로드 → 편집 → 재업로드
       │
       ▼
서버가 매니페스트 검증 (필수 필드 누락 체크)
       │
       ▼
파일을 S3에 업로드 + STAC Item 일괄 생성
       │
       ▼
5단계 (썸네일) 비동기 실행
```

### 매니페스트 셀 색상 규칙

| 색상 | 의미 | 사용자 행동 |
|------|------|-----------|
| 파란 배경 | 파일에서 자동 추출된 값 | 확인만 (수정 가능) |
| 연한 파란 배경 | Collection 기본값으로 채워진 값 | 확인만 (수정 가능) |
| 노란 배경 | 추출 시도했으나 불확실 (⚠ 경고) | 반드시 확인 |
| 빈 칸 (흰색) | 자동 채움 불가 | 직접 입력 필요 |
| 빨간 테두리 | 필수 필드인데 비어있음 | 입력 전까지 등록 불가 |

### 일반적인 벌크 업로드에서의 수동 입력 필드

프로젝트 전체가 같은 사이트, 같은 좌표계라고 가정할 때:

| 필드 | 자동 채움 | 비고 |
|------|----------|------|
| project:name | ✅ Collection 상속 | |
| project:site | ✅ Collection 상속 | |
| proj:epsg | ✅ (파일) 또는 ✅ (Collection) | 경고 시 확인 필요 |
| datetime | ✅ (이미지/영상) 또는 ❌ (PC/모델) | PC/모델은 수동 |
| description | ❌ | **반드시 수동** |
| target (세부 대상) | ❌ | **반드시 수동** (파일명 추론 시 후보 제시) |
| 유형별 수동 필드 | ❌ | pc:type, capture_type 등 |
| links | △ 제안 | 사용자 확인 필요 |

→ **15개 Item 기준, 사용자가 타이핑하는 셀: 약 30~45개** (Item당 2~3개). 나머지 100+ 셀은 자동.

---

## 9. 실패 처리

| 상황 | 처리 |
|------|------|
| 파일 파싱 라이브러리 오류 (손상된 파일 등) | 해당 파일 추출 건너뛰고, 모든 필드를 수동 입력으로 전환. 경고 메시지 표시. |
| CRS 추출 실패 (LAS 헤더 없음) | Collection default_epsg 적용 + 노란 경고 |
| EXIF 없는 이미지 | datetime, camera, GPS 필드를 수동으로 전환 |
| ffprobe 미설치 | 동영상 메타 추출 건너뛰고, 기본 필드(file:size)만 채움 |
| 썸네일 생성 실패 | 기본 아이콘 사용. 나중에 수동 업로드 가능. |
| 메모리 초과 (매우 큰 파일) | 헤더만 읽도록 제한. 전체 파싱하지 않음. |

핵심 원칙: **파이프라인의 어떤 단계가 실패해도, 등록 자체는 진행 가능해야 한다.** 자동 채움은 "편의"이지 "전제"가 아니다. 추출 실패 시 수동 입력으로 graceful degradation.

---

## 10. 의존성 요약

| 라이브러리 | 용도 | pip 설치 |
|-----------|------|---------|
| laspy | LAS/LAZ 헤더 파싱 | `pip install laspy[lazrs]` |
| rasterio | GeoTIFF 파싱 | `pip install rasterio` |
| trimesh | 3D 모델 파싱 | `pip install trimesh` |
| Pillow | 이미지 EXIF, 리사이즈 | `pip install Pillow` |
| piexif | EXIF 상세 파싱 | `pip install piexif` |
| open3d | PC/모델 썸네일 렌더링 | `pip install open3d` |
| ffmpeg/ffprobe | 동영상 메타 추출 | 시스템 패키지 |
| PyPDF | PDF 메타 추출 | `pip install pypdf` |
| pdf2image | PDF 썸네일 | `pip install pdf2image` (+ poppler) |

Docker 이미지에 위 패키지를 모두 사전 설치한다. 시스템 아키텍처 문서의 worker 컨테이너에 반영.
