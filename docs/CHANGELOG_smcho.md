# SAMS 개발 변경 이력 (smcho 작업분)

## 2026-04-09: 환경 전환 + 업로드 파이프라인 수정

### 1. 개발 환경 전환 (hwiyoung → smcho)

**배경**: hwiyoung 디렉토리(`/media/innopam/InnoPAM-8TB/hwiyoung/code/spatial-log/`)에서 개발·운영 중이던 SAMS를 smcho 디렉토리(`/media/innopam/InnoPAM-8TB/smcho/code/spatial-log/`)로 전환.

**작업 내용**:
- hwiyoung 컨테이너 중지 (`docker compose down`)
- hwiyoung 로컬 Git에서 최신 커밋 fetch 및 merge (Step 4 → Step 13, Fast-forward)
  - Step 5~13: Worker, Frontend 4페이지, API 라우터, S3 서비스, E2E 테스트 등 포함
- smcho 디렉토리에 `.env` 파일 생성 (`COMPOSE_PROJECT_NAME=sams`)
  - hwiyoung 쪽과 동일한 Docker 프로젝트명/볼륨명 사용 → 기존 DB 데이터(6개 아이템) 유지
- 컨테이너 빌드 및 기동 확인

**포트 충돌 해결**: 동일 포트(7800, 8000, 8080, 3000, 7432, 9000, 6379)를 사용하므로 동시 구동 불가. hwiyoung을 내리고 smcho를 올리는 방식 채택.

---

### 2. 업로드 파이프라인 버그 수정: 파일이 S3에 저장되지 않는 문제

**문제**: 
- 분석(analyze) 단계에서 임시 파일을 즉시 삭제하여, 등록(register) 시 S3에 업로드할 파일이 없었음
- 단건 업로드에 "등록" 버튼이 없어서 분석만 가능하고 등록 불가
- 벌크 업로드에서도 session 연결이 없어 등록 시 파일 경로를 못 찾음

**수정 파일**: 
- `sams-api/sams/routers/upload.py`
- `sams-api/sams/models/manifest.py`
- `frontend/src/pages/Upload.jsx`

**수정 내용**:

#### 백엔드 (`upload.py`)
1. **세션 기반 임시 파일 관리**: 분석 시 `session_id`를 발급하고, 임시 파일을 등록 완료 시까지 보존. 등록 후 세션 정리.
2. **S3 실제 업로드**: 등록 시 세션의 임시 디렉토리에서 파일을 찾아 MinIO(S3)에 업로드.
3. **Collection 자동 생성**: 선택한 Collection이 DB에 없으면 pgSTAC `create_collection()` 함수로 자동 생성.
4. **bbox → geometry 자동 변환**: bbox만 있으면 Polygon geometry를 자동 생성. geometry가 전혀 없으면 기본 Point(0,0) 설정 (pgSTAC은 null geometry 불가).

#### 모델 (`manifest.py`)
5. **`session_id` 필드 추가**: `Manifest` 모델에 `session_id: str = ""` 추가. 분석 응답에 세션 ID를 포함시켜 프론트엔드에서 등록 시 전달.

#### 프론트엔드 (`Upload.jsx`)
6. **단건 업로드 등록 플로우 완성**: "Draft로 등록" 버튼 추가, 등록 완료 화면(Explorer/Project 이동, 추가 업로드 버튼) 구현.
7. **벌크 업로드 session_id 전달**: 등록 요청에 `manifest.session_id` 포함.

---

### 3. STAC Item 등록 방식 변경: HTTP API → pgSTAC 직접 호출

**문제**: stac-fastapi-pgstac 컨테이너에 Transaction 확장이 비활성화되어, `POST /collections` 및 `POST /collections/{id}/items`가 405 Method Not Allowed 반환.

**수정**: `_ensure_collection()`과 `_register_stac_item()`을 HTTP 호출에서 psycopg2를 통한 pgSTAC SQL 함수 직접 호출로 변경.
- `pgstac.get_collection()` → 존재 확인
- `pgstac.create_collection()` → Collection 생성
- `pgstac.create_item()` → Item 등록

---

### 저장소 구조 참고

| 저장소 | 역할 | Docker 볼륨 |
|--------|------|------------|
| PostgreSQL (pgSTAC) | STAC Item/Collection 메타데이터 (JSONB) | `sams_pgdata` |
| MinIO (S3 호환) | 실제 파일 (tif, las, obj 등) | `sams_miniodata` |
| Redis | Celery 메시지 브로커 + 세션 | - |

파일 저장 경로: `s3://sams-archive/{collection_id}/{data_category}/{item_id}/{filename}`

---

### 4. datetime 누락 방어 처리

**문제**: 분석 파이프라인에서 datetime을 추출하지 못한 경우, pgSTAC이 `datetime OR (start_datetime AND end_datetime)` 필수 제약으로 등록을 거부.

**수정**: `upload.py`의 register에서 datetime이 없으면 현재 시각(`now`)을 자동 설정.

---

### 5. MapView 좌표 방어 처리 (EPSG:5186 등 투영좌표 대응)

**문제**: 정사영상의 bbox가 EPSG:5186(한국 평면좌표, 예: `[203809, 548465, ...]`)으로 추출되어, MapLibre에 유효하지 않은 좌표값이 전달 → JS 에러로 화면 전체 크래시.

**수정**:
- `frontend/src/components/MapView.jsx`: `isValidLngLat()` 함수 추가. 경위도 범위(-180~180, -90~90) 밖이거나 기본값(0,0)인 좌표는 무시.

---

### 6. bbox EPSG:4326 자동 변환 (extract.py)

**문제**: 파일에서 추출한 bbox가 EPSG:5186 등 투영좌표계인 경우, 지도 표시와 STAC 표준 호환이 안 됨.

**수정**:
- `sams-api/sams/pipeline/extract.py`: `_bbox_to_4326()` 공통 함수 추가 (rasterio.warp 사용)
- 포인트클라우드(`extract_pointcloud`)와 정사영상(`extract_orthoimage`)에 적용
- 추출 결과에 `bbox_4326` 필드 추가 → 등록 시 이 값을 STAC Item의 bbox/geometry로 사용

---

### 7. 썸네일 자동 생성 + S3 업로드

**기존 상태**: `thumbnail.py`에 유형별 생성 함수가 구현되어 있었으나, 등록 플로우에 연결되지 않아 실제로 사용 안 됨.

**수정**:
- `upload.py`의 register에서 S3 파일 업로드 직후 `generate_thumbnail()` 호출
- 생성된 썸네일 PNG를 S3에 업로드하고 STAC Item의 `assets.thumbnail`에 href 등록
- 실패해도 등록 자체는 계속 진행 (graceful degradation)

**유형별 썸네일 방식** (`thumbnail.py` 기존 구현):
| 유형 | 방식 |
|------|------|
| 정사영상 | rasterio 축소 읽기 → RGB PNG |
| 포인트클라우드 | laspy 읽기 → matplotlib 상위 뷰 산점도 |
| 3D 모델 | trimesh 로드 → matplotlib 3D 포인트 산점도 |
| 이미지/파노라마 | Pillow 리사이즈 |
| 동영상 | ffmpeg 중간 프레임 추출 |
| 문서(PDF) | PyMuPDF/pdf2image 첫 페이지 렌더링 |

---

### 8. 파일 서빙 엔드포인트 추가 (`/api/files/`)

**문제**: STAC Item의 asset href가 `/api/files/...` 형태이나, 해당 엔드포인트가 미구현이어서 썸네일/파일 다운로드 불가.

**수정**:
- `sams-api/sams/routers/files.py` 신규 생성
- `GET /api/files/{collection}/{category}/{item_id}/{filename}` → S3에서 파일을 읽어 StreamingResponse로 반환
- `main.py`에 라우터 등록

---

### 9. Explorer 결과 목록 썸네일 표시

**수정**:
- `frontend/src/components/ResultList.jsx`: STAC Item에 `assets.thumbnail`이 있으면 이미지로 표시, 없으면 기존 아이콘 유지
- 썸네일 로드 실패 시 아이콘으로 폴백

---

### 10. 한글 파일명 서빙 에러 수정

**문제**: 한글 파일명(예: `서강대교_3D.png`)의 `Content-Disposition` 헤더에서 latin-1 인코딩 실패 → 500 에러

**수정**: `files.py`에서 `filename*=UTF-8''` RFC 5987 인코딩 사용

---

### 11. 세션 디렉토리 파일 시스템 기반으로 전환

**문제**: 코드 변경 시 uvicorn 리로드 → 메모리의 `_upload_sessions` dict 소실 → 등록 시 임시 파일 못 찾음

**수정**: 세션 ID를 임시 디렉토리명에 포함(`sams_{session_id}_xxx`)하고, `_get_session_dir()`로 파일 시스템에서 검색. 분석 실패 시에도 임시 파일 유지.

---

### 12. 아이템/프로젝트 삭제 기능 추가

**수정 파일**: `items.py`, `collections.py`, `Detail.jsx`, `Project.jsx`, `PreviewPanel.jsx`

- 아이템 삭제: pgSTAC 파티션 직접 DELETE + S3 파일 정리 + 트리거 비활성화/복원
- Collection 삭제: 하위 Item 전체 삭제 + Collection 삭제 + S3 정리
- UI: Detail 페이지, PreviewPanel, Project 페이지에 삭제 버튼 추가

---

### 13. Collection 생성 pgSTAC 직접 호출

**문제**: stac-fastapi Transaction 확장 비활성화로 `POST /collections` 405 에러

**수정**: `collections.py`의 `create_collection()`에서 `pgstac.create_collection()` SQL 함수 직접 호출

---

### 14. 드론 이미지 세트 업로드 지원

**수정 파일**: `extract.py`, `upload.py`, `Upload.jsx`, `ResultList.jsx`, `PreviewPanel.jsx`

- 이미지 5장 초과 → `image_set`으로 자동 번들링 (1개 STAC Item)
- 전체 GPS EXIF → ConvexHull bbox (EPSG:4326), 촬영 일시 범위
- 전체 파일 크기 합산, 카메라 모델 추출
- S3에 전체 파일 업로드 + 대표 사진 썸네일
- Explorer: "2024-10-04 ~ 2024-10-04 · 5.2GB · 26장" 형태 표시
- PPK 보조 파일(`.nav`, `.obs`, `.bin`, `.mrk`) 자동 무시
- 폴더 선택/드래그 지원 (`webkitdirectory`, `webkitGetAsEntry`)

---

### 15. bbox EPSG:4326 변환 강화 (register 단계)

**문제**: 프론트에서 `bbox_4326`이 전달되지 않는 경우가 있음 (3D 모델, 포인트클라우드)

**수정**: `upload.py` register에서 직접 `rasterio.warp.transform_bounds`로 변환. Collection의 `default_epsg`도 폴백으로 사용.

---

### 16. MapView 개선

- 아이템 클릭 시 bbox로 `fitBounds` 줌인
- 유효하지 않은 좌표(투영좌표, 기본값 0,0) 무시
- 맵 로드 완료 후에만 마커 렌더링 (`mapLoaded` state)

---

### 17. 신규 포맷 지원 추가

**3D Tiles Archive (.3tz)**:
- `detect.py`: `.3tz` → `3d_tiles` 카테고리 매핑
- `extract.py`: zip 내부 `tileset.json` 파싱, `boundingVolume.region` → bbox, `box` 타입도 지원

**텍스트 포인트 클라우드 (.xyz, .pts)**:
- `detect.py`: `.xyz`, `.pts` → `pointcloud` 카테고리 매핑
- `extract.py`: 텍스트 파싱으로 포인트 수, bbox, RGB/Intensity 여부 추출. 대용량 파일 10만줄 샘플링. 좌표 범위로 CRS 자동 추정.

---

## 지원 파일 포맷 전체 목록

### 포인트 클라우드
| 확장자 | 포맷 | 추출 라이브러리 | 좌표 추출 | 썸네일 |
|--------|------|----------------|:--------:|:------:|
| .las .laz | LAS/LAZ | laspy | ✅ bbox + CRS | ✅ 상위 뷰 산점도 |
| .e57 | E57 | XML 파싱 | ✅ bbox | ✅ |
| .xyz | XYZ 텍스트 | 텍스트 파싱 | ⚠ CRS 추정 | ✅ |
| .pts | PTS 텍스트 | 텍스트 파싱 | ⚠ CRS 추정 | ✅ |
| .pcd | PCD | 감지만 | ❌ | ❌ |

### 3D 모델
| 확장자 | 포맷 | 추출 라이브러리 | 좌표 추출 | 썸네일 |
|--------|------|----------------|:--------:|:------:|
| .obj | Wavefront OBJ | trimesh | ⚠ vertex bbox | ✅ 와이어프레임 |
| .fbx | FBX | trimesh | ⚠ vertex bbox | ✅ |
| .gltf .glb | glTF | trimesh | ⚠ vertex bbox | ✅ |
| .stl | STL | trimesh | ⚠ vertex bbox | ✅ |
| .dae | COLLADA | trimesh | ⚠ vertex bbox | ✅ |
| .ply | PLY (face 있음) | trimesh | ⚠ vertex bbox | ✅ |

### 3D Tiles
| 확장자 | 포맷 | 추출 라이브러리 | 좌표 추출 | 썸네일 |
|--------|------|----------------|:--------:|:------:|
| tileset.json | 3D Tiles | JSON 파싱 | ✅ region/box | ❌ |
| .3tz | 3D Tiles Archive | zip + JSON | ✅ region/box | ❌ |

### 정사영상
| 확장자 | 포맷 | 추출 라이브러리 | 좌표 추출 | 썸네일 |
|--------|------|----------------|:--------:|:------:|
| .tif .tiff | GeoTIFF | rasterio | ✅ bbox + CRS | ✅ RGB 축소 |

### 이미지 / 파노라마
| 확장자 | 포맷 | 추출 라이브러리 | 좌표 추출 | 썸네일 |
|--------|------|----------------|:--------:|:------:|
| .jpg .jpeg .png | 이미지 | Pillow + EXIF | ✅ GPS (EXIF) | ✅ 리사이즈 |
| .jpg .jpeg .png (2:1, ≥6000px) | 파노라마 | Pillow | ✅ GPS (EXIF) | ✅ 리사이즈 |

### 동영상
| 확장자 | 포맷 | 추출 라이브러리 | 좌표 추출 | 썸네일 |
|--------|------|----------------|:--------:|:------:|
| .mp4 .mov .avi .mkv | 동영상 | ffprobe | ✅ SRT 텔레메트리 | ✅ 중간 프레임 |

### 문서
| 확장자 | 포맷 | 추출 라이브러리 | 좌표 추출 | 썸네일 |
|--------|------|----------------|:--------:|:------:|
| .pdf | PDF | pypdf | ❌ | ✅ 첫 페이지 |
| .docx | Word | python-docx | ❌ | ❌ |
| .hwp | 한글 | 감지만 | ❌ | ❌ |
| .xlsx .pptx | Excel/PPT | 감지만 | ❌ | ❌ |

### 자동 무시 확장자
`.nav`, `.obs`, `.bin`, `.mrk`, `.dat`, `.log`, `.ini`, `.cfg`, `.ds_store`, `.thumbs.db`, 숨김 파일(`.`으로 시작)
