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

docker-compose.yml을 확인하고, docker-compose up -d로 인프라를 기동해줘.
다음 서비스가 정상 동작하는지 확인:
1. PostgreSQL (port 5432)
2. STAC API (http://localhost:8080/ 에서 JSON 응답)
3. MinIO (http://localhost:9001/ 콘솔 접근, sams-archive 버킷 존재)
4. Redis (port 6379)

문제가 있으면 수정해줘.
```

### 확인 포인트
- `curl http://localhost:8080/` → STAC Landing Page JSON
- MinIO 콘솔에서 `sams-archive` 버킷 확인
- `docker-compose ps`에서 모든 컨테이너 healthy/running

---

## Step 2: 자동 채움 파이프라인 — detect.py

### 프롬프트
```
Step 2: 자동 채움 파이프라인의 detect.py 구현.
CLAUDE.md 워크플로우(Phase A~F)를 따라서 진행해줘.

docs/autofill_pipeline_spec.md 섹션 3을 읽고, sams-api/sams/pipeline/detect.py를 구현해줘.

기능:
- 파일 경로를 받아 data_category를 반환
- 확장자 기반 판별 + PLY 양면성 처리 + 파노라마 추정
- 판별 실패 시 "unknown" 반환

테스트도 작성해줘 (tests/test_detect.py).
테스트용 샘플 파일이 없으면 빈 파일이나 최소 헤더를 가진 파일을 fixtures에 만들어.

완료 후 Phase C~F(검증, 품질, 사용자 관점, 최종) 수행하고 커밋해줘.
```

### 확인 포인트
- `pytest tests/test_detect.py` 통과
- .laz → pointcloud, .obj → 3d_model, .tif → orthoimage 등 정상 판별

---

## Step 3: 자동 채움 파이프라인 — extract.py

### 프롬프트
```
Step 3: 자동 채움 파이프라인의 extract.py 구현.
CLAUDE.md 워크플로우(Phase A~F)를 따라서 진행해줘.

docs/autofill_pipeline_spec.md 섹션 4를 읽고, sams-api/sams/pipeline/extract.py를 구현해줘.

유형별 추출 함수를 만들어:
- extract_pointcloud(filepath) → dict (laspy 사용)
- extract_3dmodel(filepath) → dict (trimesh 사용)
- extract_orthoimage(filepath) → dict (rasterio 사용)
- extract_image(filepath) → dict (Pillow + piexif 사용)
- extract_video(filepath) → dict (ffprobe 사용)
- extract_panorama(filepath) → dict (Pillow 사용)
- extract_document(filepath) → dict (PyPDF 사용)

그리고 dispatch 함수:
- extract_metadata(filepath, data_category) → dict
  category에 따라 적절한 함수 호출. 실패 시 빈 dict + 에러 로그.

각 함수에서 추출 가능한 필드와 추출 불가능한 필드를 명세 문서의 표와 대조해줘.
테스트도 작성 (tests/test_extract.py). 실제 라이브러리 없이도 돌아가는 
단위 테스트 + 실제 파일이 있을 때 돌아가는 통합 테스트를 분리해줘.

완료 후 Phase C~F(검증, 품질, 사용자 관점, 최종) 수행하고 커밋해줘.
```

### 확인 포인트
- `pytest tests/test_extract.py` 통과
- 실제 LAS/TIFF 파일이 있으면 추출 결과가 명세와 일치하는지 확인

---

## Step 4: 자동 채움 파이프라인 — inherit.py + suggest.py

### 프롬프트
```
Step 4: 파이프라인의 inherit.py와 suggest.py 구현.
CLAUDE.md 워크플로우(Phase A~F)를 따라서 진행해줘.

docs/autofill_pipeline_spec.md 섹션 5, 6을 읽고 구현해줘.

inherit.py:
- apply_collection_defaults(extracted_meta, collection) → merged_meta
- 우선순위: 파일 추출값 > Collection 기본값 > 빈 칸
- Collection에서 상속하는 필드: project:name, project:site, proj:epsg (추출값 없을 때), license

suggest.py:
- suggest_links(files_in_batch, existing_items) → list[suggested_link]
- 파일명 공통 키워드로 같은 target 추정
- 유형 계보 추론 (PC → 3D Model → 3D Tiles)
- 각 제안에 confidence 값 포함

테스트도 작성.

완료 후 Phase C~F(검증, 품질, 사용자 관점, 최종) 수행하고 커밋해줘.
```

---

## Step 5: 파이프라인 통합 — analyze 함수

### 프롬프트
```
Step 5: 파이프라인 통합.
CLAUDE.md 워크플로우(Phase A~F)를 따라서 진행해줘.

sams-api/sams/pipeline/__init__.py에 analyze 함수를 구현해줘.

async def analyze(file_paths: list[str], collection_id: str) -> Manifest:
    1. 각 파일에 대해 detect → extract → inherit 순서로 실행
    2. 전체 파일 목록에 대해 suggest로 관계 제안
    3. 결과를 Manifest 형태로 조합하여 반환

Manifest Pydantic 모델은 sams/models/manifest.py에 정의.
docs/system_architecture.md 섹션 3.2의 /api/upload/analyze 응답 형식을 따라.

auto_extracted의 각 값에 source ("file", "collection_default", "unknown") 표시.
warnings 리스트에 경고 메시지 모음.
required_empty에 사용자가 채워야 할 필수 빈 필드 목록.

완료 후 Phase C~F(검증, 품질, 사용자 관점, 최종) 수행하고 커밋해줘.
```

---

## Step 6: SAMS API — Upload 엔드포인트

### 프롬프트
```
Step 6: SAMS API의 Upload 엔드포인트 구현.
CLAUDE.md 워크플로우(Phase A~F)를 따라서 진행해줘.

docs/system_architecture.md 섹션 3.2를 읽고, sams-api/sams/routers/upload.py를 구현해줘.

3개 엔드포인트:
1. POST /api/upload/analyze
   - multipart/form-data로 파일 + collection_id 받기
   - 파이프라인 analyze() 호출
   - 매니페스트 JSON 반환

2. POST /api/upload/validate
   - 매니페스트 JSON 받기
   - 필수 필드 누락 체크 (data_category별로 필수 필드가 다름)
   - 검증 결과 (errors, warnings) 반환

3. POST /api/upload/register
   - 검증 통과된 매니페스트로 STAC Item JSON 생성
   - 파일을 S3에 업로드 (경로 규칙: docs/system_architecture.md 섹션 4)
   - stac-fastapi에 POST /collections/{id}/items로 Item 등록
   - 썸네일 생성 작업을 Celery 큐에 추가

main.py에 라우터 등록해줘.

완료 후 Phase C~F(검증, 품질, 사용자 관점, 최종) 수행하고 커밋해줘.
```

### 확인 포인트
- `curl -X POST http://localhost:8000/api/upload/analyze -F "file=@sample.laz" -F "collection_id=test"` → 매니페스트 JSON 반환
- 매니페스트에 자동 추출된 필드가 있고, 빈 필드는 required_empty에 나열

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
