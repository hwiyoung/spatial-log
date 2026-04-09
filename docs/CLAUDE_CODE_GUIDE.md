# Claude Code 단계별 진행 가이드

이 문서는 Claude Code에서 SAMS를 구현할 때 **복사하여 붙여넣을 수 있는 프롬프트**를 단계별로 제공합니다.

각 Step이 완료되면 동작을 확인하고, 다음 Step으로 넘어가세요.

> **중요**: 모든 구현 작업에는 CLAUDE.md의 "개발 워크플로우"(Phase A~F, 18단계)가 적용됩니다.
> Claude Code가 이미 CLAUDE.md를 읽고 있으므로 자동으로 따르지만, 
> 프롬프트에서 "CLAUDE.md 워크플로우를 따라서"라고 명시적으로 언급하면 더 확실합니다.

---

## 사전 준비

```bash
# 프로젝트 압축 해제
tar -xzf sams-project.tar.gz
cd sams-project

# Git 초기화
git init && git add -A && git commit -m "Initial scaffold from design docs"

# Claude Code 실행
claude
```

---

## Step 1: 인프라 기동

### 프롬프트
```
Step 1: 인프라 기동.

docker-compose.yml을 확인하고, docker compose up -d로 인프라를 기동해줘.
포트 충돌이 있을 수 있으니 먼저 `ss -tlnp`로 사용 중인 포트를 확인해줘.
주요 포트: DB→7432, Nginx→7800, 나머지는 표준 포트 사용.

참고 사항:
- stac-fastapi 이미지는 `latest` 태그 사용
- pgstac-migrate는 ghcr.io 이미지가 아니라 `pypgstac` pip install 방식으로 마이그레이션
- .env에 `COMPOSE_PROJECT_NAME=sams`가 설정되어 있음

다음 서비스가 정상 동작하는지 확인:
1. PostgreSQL (port 7432)
2. STAC API (http://localhost:8080/ 에서 JSON 응답)
3. SAMS API (http://localhost:8000/health 에서 health check)
4. MinIO (http://localhost:9001/ 콘솔 접근, sams-archive 버킷 존재)
5. Nginx (http://localhost:7800/)
6. Redis (port 6379)

문제가 있으면 수정해줘.
```

### 확인 포인트
- `docker compose ps` → 컨테이너 이름이 `sams-*`로 표시, 모두 healthy/running
- `curl http://localhost:8080/` → STAC Landing Page JSON
- `curl http://localhost:8000/health` → SAMS API health check 응답
- `http://localhost:7800/api/test` → 테스트 페이지 확인
- MinIO 콘솔 `http://localhost:9001/`에서 `sams-archive` 버킷 확인

---

## Step 2: 자동 채움 파이프라인 — bundle.py + detect.py (COMPLETED)

> **이 단계는 완료되었습니다.**

### 구현 내용

**bundle.py (Stage 0: 파일 그룹핑)**
- OBJ → MTL → texture 참조 파싱으로 3D 모델 번들 구성
- 이미지 세트 (>5장) 자동 그룹핑
- 3D Tiles (tileset.json) 번들 인식
- 동영상 + SRT 텔레메트리 번들 (같은 파일명 매칭)

**detect.py (Stage 1: 유형 판별)**
- 확장자 매핑 기반 data_category 판별
- PLY 양면성 처리 (포인트클라우드 vs 3D 모델)
- GeoTIFF 판별
- 파노라마 추정

### 확인 포인트
- `pytest tests/test_bundle.py tests/test_detect.py` → 33개 테스트 통과
- `http://localhost:7800/api/test` → 실제 데이터 테스트 페이지에서 확인

---

## Step 3: 자동 채움 파이프라인 — extract.py (COMPLETED)

> **이 단계는 완료되었습니다.**

### 구현 내용

**extract.py (Stage 2: 유형별 메타데이터 추출)**
- `extract_metadata()`: 디스패치 함수 (category별 적절한 추출기 호출, bundled_files 전달)
- `extract_pointcloud()`: LAS/LAZ(laspy) + E57(XML 헤더 파싱) — point count, bbox, CRS, schemas, density
- `extract_3dmodel()`: OBJ/PLY/FBX/glTF — trimesh로 vertex/face count, bounding volume, 번들 기반 텍스처 정보
- `extract_3dtiles()`: tileset.json 파싱 — version, geometric_error, tile_format, region→bbox
- `extract_orthoimage()`: GeoTIFF — rasterio로 CRS, shape, GSD, bands, bbox
- `extract_image()`: JPG/PNG — Pillow EXIF(IFD0 + ExifIFD)로 카메라, focal_length, GPS, 촬영 시간
  - 이미지 세트: bundled_files → image:image_count + GPS ConvexHull → Polygon geometry
- `extract_panorama()`: 비율 기반 equirectangular 추정 + EXIF
- `extract_video()`: ffprobe로 codec, resolution, fps, duration, audio + ISO 6709 GPS
  - DJI SRT 텔레메트리: 프레임별 GPS → LineString 촬영 경로 + 고도 범위
- `extract_document()`: PDF(pypdf) 페이지/제목/저자 + DOCX(python-docx) 제목/저자/생성일
- `_read_exif()`: image/panorama 공통 EXIF 헬퍼 (ExifIFD 서브 IFD 접근)
- Graceful degradation: 라이브러리 미설치/파일 손상 시에도 file:size 반환

### 확인 포인트
- `pytest tests/ -m "not integration"` → 82개 통과 (+ 1 skipped: pypdf 로컬 미설치)
- `http://localhost:7800/api/test`에서 추출된 메타데이터 확인 (접기/펼치기 UI)
- 실제 파일 검증: DJI 이미지(focal_length, GPS), E57(28M points, 13 fields), LAS(schemas, bbox)

---

## Step 4: 자동 채움 파이프라인 — inherit.py + suggest.py (COMPLETED)

> **이 단계는 완료되었습니다.**

### 구현 내용

**inherit.py (Stage 3: Collection 기본값 상속)**
- `apply_collection_defaults(extracted_meta, collection_defaults)` → merged dict
- 우선순위: 파일 추출값 > Collection 기본값 > 빈 칸
- 상속 필드: title→project:name, project:site, project:default_epsg→proj:epsg, license, id→collection
- `_sources` dict로 각 값의 출처 추적 ("file", "collection_default")

**suggest.py (Stage 4: 관계 자동 제안)**
- `suggest_links(items: list[BatchItem])` → list[SuggestedLink]
- target 매칭: 사용자 입력 > 파일명 키워드 추출 > 상위 폴더명
- 파일명 키워드 추출: 숫자/유형 접미사(scan, model, ortho, flight 등) 제거 후 공통 부분
- 유형 계보: PC→3D Model, Image→3D Model, 3D Model→3D Tiles (derived_from, 70%)
- 같은 target 다른 유형: related (80%)
- document→나머지: describedby (50%)
- 중복 제거 + confidence 내림차순 정렬

### 확인 포인트
- `pytest tests/test_inherit.py tests/test_suggest.py -v` → 38개 테스트 통과
- `pytest tests/ -m "not integration"` → 전체 120개 통과 (기존 테스트 영향 없음)

---

## Step 5: 파이프라인 통합 — analyze 함수 (COMPLETED)

> **이 단계는 완료되었습니다.**

### 구현 내용

**sams/models/manifest.py (Pydantic 모델)**
- `MetadataValue`: 값 + source("file"/"collection_default"/"unknown") + warning
- `SuggestedLinkItem`: rel, target_file, confidence, reason
- `ManifestItem`: 파일별 분석 결과 (auto_extracted, inherited, suggested_links, required_empty, warnings)
- `ManifestSummary`: total_files, detected_types, auto_filled_percentage, manual_required_fields
- `Manifest`: manifest(항목 리스트) + summary

**sams/pipeline/__init__.py (analyze 통합 함수)**
- `analyze(file_paths, collection_defaults)` → Manifest
- 흐름: bundle → detect → extract → inherit → suggest
- auto_extracted / inherited 분리: _sources dict 기반
- required_empty: 공통 필수(datetime, description 등) + category별 필수 중 빈 필드
- graceful degradation: extract 실패 시 warnings에 기록, 매니페스트는 반환

### 확인 포인트
- `pytest tests/test_analyze.py -v` → 16개 테스트 통과
- `pytest tests/ -m "not integration"` → 전체 136개 통과 (기존 테스트 영향 없음)

---

## Step 6: SAMS API — Upload 엔드포인트 (COMPLETED)

> **이 단계는 완료되었습니다.**

### 구현 내용

**sams/routers/upload.py (3개 엔드포인트)**
- `POST /api/upload/analyze`: multipart/form-data(파일 + collection_id) → analyze() → Manifest JSON
  - 임시 디렉토리에 파일 저장 → 파이프라인 실행 → 임시 경로를 원본 파일명으로 치환
  - collection_id가 있으면 STAC API에서 Collection 기본값 조회 (실패 시 graceful skip)
- `POST /api/upload/validate`: 매니페스트 필수 필드 검증
  - 공통 필수 + 카테고리별 필수 + datetime null시 start/end_datetime 필요
- `POST /api/upload/register`: STAC Item 생성 + S3 업로드
  - Item ID 자동 생성, STAC Item JSON 구성, stac-fastapi POST 호출
  - 개별 Item 실패 시 에러 기록하고 나머지 계속 진행

**sams/services/s3.py (S3 서비스 헬퍼)**
- `upload_file()`, `generate_presigned_url()`, `build_asset_href()`
- 경로 규칙: `{collection_id}/{data_category}/{item_id}/{filename}`

**sams/main.py**: upload 라우터 등록 (`/api/upload` prefix)

### 확인 포인트
- `curl -X POST http://localhost:8000/api/upload/analyze -F "files=@sample.laz" -F "collection_id="` → 매니페스트 JSON 반환
- `pytest tests/test_upload.py -v` → 14개 테스트 통과
- `pytest tests/ -m "not integration"` → 전체 150개 통과

---

## Step 7: SAMS API — Collection + Items 엔드포인트

### 프롬프트
```
Step 7: Collection과 Items 엔드포인트.
CLAUDE.md 워크플로우(Phase A~F)를 따라서 진행해줘.

docs/system_architecture.md 섹션 3.2를 읽고 구현해줘.

sams/routers/collections.py:
- POST /api/collections: SAMS 확장 필드(expected_deliverables, default_epsg 등) 포함 생성
  내부적으로 STAC Collection 형식으로 변환하여 stac-fastapi에 등록
- GET /api/collections/{id}/dashboard: 예상 vs 실제 등록 현황 집계
- GET /api/collections/{id}/spatial-summary: 유형별 bbox 목록

sams/routers/items.py:
- PUT /api/items/{id}/status: Draft→Published 전환 (필수 필드 검증)
- GET /api/items/{id}/related: links 양방향 해석하여 관련 Item 목록
- GET /api/items/{id}/timeline: 같은 target+category의 시점별 Item 목록
- POST /api/items/{id}/links: 관계 추가 (양방향 자동 생성)

sams/services/stac.py에 stac-fastapi 호출 래퍼를 만들어줘.

완료 후 Phase C~F(검증, 품질, 사용자 관점, 최종) 수행하고 커밋해줘.
```

---

## Step 8: Worker — 썸네일 생성

### 프롬프트
```
Step 8: Celery Worker의 썸네일 생성 태스크.
CLAUDE.md 워크플로우(Phase A~F)를 따라서 진행해줘.

docs/autofill_pipeline_spec.md 섹션 7을 읽고, sams/pipeline/thumbnail.py와 
sams/worker.py를 구현해줘.

유형별 썸네일 생성:
- 포인트 클라우드: matplotlib로 상위 뷰 산점도
- 3D 모델: trimesh로 렌더링
- 정사영상: 중앙 크롭 + 리사이즈
- 이미지: 대표 이미지 리사이즈
- 동영상: ffmpeg으로 중간 프레임 추출
- 문서(PDF): 첫 페이지 렌더링

크기: 400x300, PNG
S3 업로드 후 STAC Item의 thumbnail Asset 업데이트.
실패해도 에러 로그만 남기고 Item 등록에는 영향 없음.

완료 후 Phase C~F(검증, 품질, 사용자 관점, 최종) 수행하고 커밋해줘.
```

---

## Step 9: Frontend — Explorer

### 프롬프트
```
Step 9: Frontend Explorer 페이지.
CLAUDE.md 워크플로우(Phase A~F)를 따라서 진행해줘.

docs/sams_unified_demo.jsx의 Explorer 부분과 
docs/system_structure_design.md 섹션 3 "페이지 1: Explorer"를 참조해서
frontend/src/pages/Explorer.jsx를 구현해줘.

구성:
- 왼쪽 사이드바: 키워드 검색, 유형 필터(8개 체크박스), 프로젝트 필터, 시간 범위 슬라이더
- 가운데 상단: MapLibre 2D 지도 (Item의 bbox/geometry를 마커로 표시)
- 가운데 하단: 검색 결과 목록
- 오른쪽: 미리보기 패널 (Item 클릭 시 슬라이드)

검색은 /stac/search POST (CQL2 필터).
지도 마커와 결과 목록이 연동 (hover 시 강조).
미리보기 패널에 "상세 보기 →" 버튼 → /detail/:id로 이동.

frontend/src/services/api.js의 searchApi, itemApi를 사용해줘.

완료 후 Phase C~F(검증, 품질, 사용자 관점, 최종) 수행하고 커밋해줘.
```

---

## Step 10: Frontend — Detail

### 프롬프트
```
Step 10: Frontend Detail 페이지.
CLAUDE.md 워크플로우(Phase A~F)를 따라서 진행해줘.

docs/sams_unified_demo.jsx의 Detail 부분과
docs/system_structure_design.md "페이지 2: Detail — 2-B 전체 페이지"를 참조해서
frontend/src/pages/Detail.jsx를 구현해줘.

구성:
- 상단: 히어로 헤더 (유형 뱃지, 제목, 설명, 태그)
- 탭 4개: 메타데이터(2x2 그리드), 파일(다운로드), 연관관계(그래프+목록), 시계열(타임라인)
- 편집 모드: 탭 전환으로 메타데이터 수정 가능, Draft→Published 전환

"← Explorer로 돌아가기" 버튼으로 이전 검색 상태 유지 복귀.
관련 데이터 클릭 시 /detail/:id로 이동.

API 호출: itemApi.get, itemApi.getRelated, itemApi.getTimeline

완료 후 Phase C~F(검증, 품질, 사용자 관점, 최종) 수행하고 커밋해줘.
```

---

## Step 11: Frontend — Project

### 프롬프트
```
Step 11: Frontend Project 페이지.
CLAUDE.md 워크플로우(Phase A~F)를 따라서 진행해줘.

docs/sams_unified_demo.jsx의 Project 부분과
docs/system_structure_design.md "페이지 3: Project"를 참조해서
frontend/src/pages/Project.jsx를 구현해줘.

구성:
- 왼쪽 사이드바: Collection 목록 (상태 필터, 진행률 바)
- 오른쪽: 프로젝트 헤더 + 4탭
  - 📊 현황: 예상 vs 실제 등록 표
  - 🗺 공간: MapLibre 2D 지도에 유형별 마커 + 레이어 토글 + 클릭 팝업
  - ⚠ Draft: 미완성 Item 목록 + "편집하여 완성 →" 버튼
  - 📋 전체: Item 테이블 (클릭 → Detail)
- "+ 새 프로젝트" 버튼 → Collection 생성 모달

API 호출: collectionApi.list, collectionApi.dashboard, collectionApi.spatialSummary

완료 후 Phase C~F(검증, 품질, 사용자 관점, 최종) 수행하고 커밋해줘.
```

---

## Step 12: Frontend — Upload

### 프롬프트
```
Step 12: Frontend Upload 페이지.
CLAUDE.md 워크플로우(Phase A~F)를 따라서 진행해줘.

docs/sams_unified_demo.jsx의 Upload 부분과
docs/system_structure_design.md "페이지 4: Upload"를 참조해서
frontend/src/pages/Upload.jsx를 구현해줘.

벌크 탭 (3-step):
1. Collection 선택 + 폴더 드래그앤드롭 → /api/upload/analyze 호출 → 매니페스트 수신
2. 매니페스트 테이블 편집 (자동 채움된 셀은 파란 배경, 빈 필수 셀은 빨간 테두리)
   + Excel 다운로드/업로드 옵션
3. 검토 화면 + Published/Draft 선택 → /api/upload/register 호출

단건 탭 (4-step):
1. Collection 선택 + 파일 드롭 → 유형 자동 판별
2. 메타데이터 입력 (구역 A 자동 + 구역 B 필수 + 구역 C 선택)
3. 연관관계 설정 (기존 Item 검색+선택)
4. 검토 + 제출

API 호출: uploadApi.analyze, uploadApi.validate, uploadApi.register
Collection 선택 시 기본값 상속이 적용되어야 함.

완료 후 Phase C~F(검증, 품질, 사용자 관점, 최종) 수행하고 커밋해줘.
```

---

## Step 13: 통합 테스트

### 프롬프트
```
Step 13: 전체 흐름 통합 테스트.
CLAUDE.md 워크플로우(Phase A~F)를 따라서 진행해줘.

실제 데이터 파일(LAS, TIFF, JPG, MP4 등)이 없어도 테스트할 수 있도록
fixtures에 최소한의 샘플 파일을 만들고, 다음 시나리오를 E2E로 테스트해줘:

1. Collection 생성 (POST /api/collections)
2. 벌크 업로드: 여러 파일 분석 → 매니페스트 → 등록
3. 검색: 등록된 Item이 /stac/search에서 검색되는지
4. Detail: Item의 메타데이터, 관계, 파일 조회
5. Draft→Published 전환

각 단계별로 assertions 작성.

완료 후 Phase C~F(검증, 품질, 사용자 관점, 최종) 수행하고 커밋해줘.
```

---

## 트러블슈팅 프롬프트

### Docker 관련 문제
```
docker-compose logs [서비스명]으로 에러를 확인하고 수정해줘.
```

### 파이프라인 추출 실패
```
[유형]의 메타데이터 추출이 실패하고 있어. 
에러 메시지: [에러 내용]
docs/autofill_pipeline_spec.md의 해당 유형 섹션을 참조해서 수정해줘.
graceful degradation 원칙을 따라야 해 — 추출 실패해도 등록은 가능해야 함.
```

### API 응답 형식 불일치
```
/api/upload/analyze의 응답이 docs/system_architecture.md 섹션 3.2의 
예상 형식과 다른데, 문서 기준으로 맞춰줘.
```

### Frontend-API 연동 문제
```
Frontend에서 [엔드포인트]를 호출하는데 [에러/문제].
frontend/src/services/api.js의 해당 함수와 backend의 라우터를 함께 확인해줘.
```
