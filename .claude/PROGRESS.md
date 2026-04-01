# SAMS 개발 진행 상황

## 프로젝트 개요
- **브랜치**: `feat/spatial-asset-mgmt`
- **기존 코드**: `main` 브랜치에 보존 (spatial-log v3)
- **참조 문서**: `docs/` 디렉토리 (6개 설계 문서)

---

## Phase 0: 프로젝트 전환 및 설계 점검

### 0-1. 브랜치 생성 및 SAMS 구조 배치
- [x] main에서 기존 uncommitted 변경 커밋 (Signed URL 다운로드 수정)
- [x] `feat/spatial-asset-mgmt` 브랜치 생성
- [x] sams-project.tar.gz 기반으로 코드 전면 교체
- [x] .gitignore 정리, 빌드 산출물 제외
- [x] 커밋: `ad8fc81`

### 0-2. 설계 문서 정합성 점검
- [x] 5개 docs + 데모 JSX + 코드 뼈대 교차 검증
- [x] 9개 빈틈 발견 및 수정
  - B-1: 파이프라인 0단계(파일 그룹핑) 추가
  - B-2: unknown 유형 UI 처리 명시
  - B-3: Collection 확장 필드 JSON 스키마
  - B-4: upload-complete 엔드포인트
  - B-5: field-values API 함수
  - B-6: manifest template/import API 함수
  - B-8: docker-compose에 frontend + nginx 추가
  - C-1: 삭제 API
  - C-2: Item 메타데이터 수정 API
- [x] 검증 단계에서 추가 3건 발견 및 수정
  - removeLink 함수 누락
  - field-values 경로 불일치
  - Collection 스키마 created/updated 누락
  - analyze 응답 bundled_files 필드 누락
- [x] 커밋: `9da414c`, `2103217`
- [x] 브랜치 publish 완료

---

## Phase 1: 구현 (Step 1~13)

각 Step의 상세 프롬프트는 `docs/CLAUDE_CODE_GUIDE.md` 참조.
CLAUDE.md의 개발 워크플로우(Phase A~F) 적용.

### Step 1: 인프라 기동
- [ ] docker-compose up -d
- [ ] PostgreSQL + pgSTAC 마이그레이션 확인
- [ ] STAC API (localhost:8080) 응답 확인
- [ ] MinIO 콘솔 (localhost:9001) + sams-archive 버킷 확인
- [ ] Redis (localhost:6379) 확인
- [ ] Frontend + Nginx 기동 확인

### Step 2: 파이프라인 — detect.py
- [ ] 파일 유형 자동 판별 함수 구현
- [ ] PLY 양면성, 파노라마 추정, unknown 처리
- [ ] 테스트 작성 (tests/test_detect.py)

### Step 3: 파이프라인 — extract.py
- [ ] 유형별 메타데이터 추출 (laspy, rasterio, trimesh, ffprobe, Pillow, PyPDF)
- [ ] dispatch 함수 (extract_metadata)
- [ ] 테스트 작성 (tests/test_extract.py)

### Step 4: 파이프라인 — inherit.py + suggest.py
- [ ] Collection 기본값 상속
- [ ] 관계 자동 제안 (파일명 매칭, 유형 계보)
- [ ] 테스트 작성

### Step 5: 파이프라인 통합 — analyze
- [ ] 0단계(그룹핑) + 1~4단계 통합
- [ ] Manifest Pydantic 모델
- [ ] analyze 응답 형식 (bundled_files 포함)

### Step 6: SAMS API — Upload 엔드포인트
- [ ] POST /api/upload/analyze
- [ ] POST /api/upload/validate
- [ ] POST /api/upload/register
- [ ] POST /api/upload/upload-complete
- [ ] GET /api/upload/presigned-url
- [ ] manifest-template, manifest-import

### Step 7: SAMS API — Collection + Items
- [ ] Collection CRUD + 대시보드 + 공간 요약
- [ ] Item 수정, 상태 전환, 관계 관리, 삭제
- [ ] 검색 보조 (autocomplete, facets, field-values)
- [ ] stac.py (STAC API 호출 래퍼)

### Step 8: Worker — 썸네일 생성
- [ ] 유형별 썸네일 생성 (Celery 비동기)
- [ ] S3 업로드 + STAC Item thumbnail Asset 업데이트

### Step 9: Frontend — Explorer
- [ ] 검색 필터 + MapLibre 2D 지도 + 결과 목록
- [ ] 미리보기 패널 (슬라이드)

### Step 10: Frontend — Detail
- [ ] 전체 페이지 (메타데이터/파일/연관관계/시계열 탭)
- [ ] 편집 모드 + Draft→Published

### Step 11: Frontend — Project
- [ ] Collection 목록 + 4탭 대시보드
- [ ] Collection 생성 모달

### Step 12: Frontend — Upload
- [ ] 벌크 업로드 (3-step)
- [ ] 단건 업로드 (4-step)

### Step 13: 통합 테스트
- [ ] E2E 시나리오 테스트
- [ ] Collection 생성 → 업로드 → 검색 → 상세 → 상태 전환
