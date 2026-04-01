# SAMS — Spatial Asset Management System

## 이 프로젝트가 무엇인가

공간 데이터(LiDAR 포인트 클라우드, 3D 모델, 정사영상, 파노라마, 동영상)와 비공간 데이터(보고서, 도면, 허가서)를 통합 관리하는 사내 시스템. STAC(SpatioTemporal Asset Catalog) 표준 기반.

## 핵심 가치

**안전한 보관 + 검색.** 모든 프로젝트 산출물이 하나의 시스템에 들어가고, 누구나 검색으로 찾을 수 있다.

## 차별성 — 시스템 채택의 전제 조건

**메타데이터 자동 채움.** 파일을 올리면 시스템이 메타데이터를 최대한 자동으로 채운다. NAS 폴더 복사보다 이 시스템에 올리는 것이 체감적으로 더 쉽지 않으면 아무도 쓰지 않는다. 다른 모든 기능보다 이것이 먼저다.

## 설계 문서 위치

| 문서 | 경로 | 읽어야 할 때 |
|------|------|-------------|
| 시스템 아키텍처 | `docs/system_architecture.md` | 프로젝트 구조, docker-compose, API 설계, 스토리지 전략 |
| 자동 채움 파이프라인 | `docs/autofill_pipeline_spec.md` | 파이프라인 구현 시. 유형별 추출 코드, 라이브러리, 실패 처리 |
| 메타데이터 설계서 | `docs/stac_metadata_design_v4.xlsx` | STAC Item/Collection 필드 정의. 유형별 필드, 필수/선택, 입력 구역(A/B/C) |
| 시스템 구조 설계서 | `docs/system_structure_design.md` | 4페이지 구조, 역할, 요구사항, Phase 계획 |
| 사용 시나리오 | `docs/system_use_scenarios.md` | 사용자 동선, AS-IS vs TO-BE |

## 기술 스택

- **Backend**: Python 3.11, FastAPI, Celery
- **Database**: PostgreSQL 16 + PostGIS 3.4 + pgSTAC
- **STAC API**: stac-fastapi-pgstac
- **Storage**: MinIO (S3 호환)
- **Message Broker**: Redis
- **Frontend**: React, MapLibre GL JS
- **Container**: Docker + docker-compose

---

## ⚠️ 개발 워크플로우 — 모든 작업에 반드시 적용

**이 프로세스는 모든 구현 작업에 예외 없이 적용한다.** 코드 한 줄이든 모듈 하나든, 아래 순서를 건너뛰지 않는다.

### Phase A: 계획

1. **계획 수립**: 요청받은 작업에 대해 구현 계획을 세운다. 무엇을 만들고, 어떤 파일을 생성/수정하며, 어떤 설계 문서를 참조하는지 명시한다.

2. **계획 검토**: 세운 계획이 설계 문서(`docs/`)의 의도와 일치하는지 검토한다. 특히 `CLAUDE.md`의 핵심 규칙과 충돌하지 않는지 확인한다.

3. **검토의 검토**: 2번의 검토가 표면적이지 않았는지 다시 본다. "설계 문서를 실제로 읽고 대조했는가, 아니면 기억에 의존했는가?"를 자문한다.

4. **범위 적정성 확인**: 계획이 과도하지 않은지 검토한다. 요청된 것 이상을 만들려 하고 있지 않은가? 한 번에 너무 많은 것을 바꾸려 하지 않는가? 필요하면 더 작은 단위로 쪼갠다.

### Phase B: 구현

5. **구현**: 계획에 따라 코드를 작성한다.

### Phase C: 검증 (구현 후 반드시 수행)

6. **목적 부합 검증**: 구현한 코드가 원래 요청의 목적에 맞게 작동하는지 검토한다. "사용자가 원한 것이 이것인가?"

7. **버그·보안·크리티컬 이슈 검토**: 잠재적인 버그, 크리티컬 이슈, 보안 문제를 점검한다. 특히:
   - 에러 핸들링이 빠진 곳은 없는가
   - 사용자 입력을 검증하지 않는 곳은 없는가
   - 비밀번호/키가 하드코딩되지 않았는가
   - 파일 경로 조작(path traversal) 위험은 없는가

8. **개선사항 부작용 검토**: 7번에서 수정한 내용이 새로운 문제를 만들지 않았는지 확인한다.

### Phase D: 코드 품질

9. **함수/파일 크기 점검**: 매우 큰 함수(50줄 이상)나 파일(300줄 이상)이 있다면 적절한 크기로 분리한다. 단, 분리가 오히려 가독성을 해치는 경우는 예외.

10. **재사용·통합 검토**: 기존 코드와 통합하거나 재사용할 수 있는 부분이 있는지 확인한다. 같은 로직을 두 곳에서 작성하고 있지 않은가?

11. **사이드 이펙트 확인**: 변경한 코드가 다른 모듈, 다른 엔드포인트, 다른 페이지에 영향을 주지 않는지 확인한다. import 관계, 공유 상태, DB 스키마 변경 등.

12. **전체 변경사항 재검토**: 이번 작업에서 변경된 모든 파일을 한 번 더 훑는다. 의도하지 않은 변경이 섞이지 않았는지.

13. **불필요한 코드 정리**: 구현 과정에서 불필요해진 코드(임시 로그, 주석 처리된 이전 코드, 사용하지 않는 import)를 정리한다.

14. **코드 품질 검토**: 네이밍, 타입 힌트, docstring, 에러 메시지가 충분히 명확한지 확인한다. 6개월 후 다른 사람이 읽어도 이해할 수 있는가?

### Phase E: 사용자 관점

15. **사용자 흐름 검증**: 실제 사용자가 이 기능을 사용하는 흐름에서 어색함이나 막히는 지점이 없는지 확인한다. `docs/system_use_scenarios.md`의 시나리오와 대조한다.

16. **연쇄 검토**: 검증 과정에서 발견된 문제가 있다면, 그 문제와 관련된 다른 부분들을 모두 찾아서 같은 패턴의 문제가 없는지 확인한다. 하나의 버그가 발견되면, 같은 종류의 버그가 다른 곳에도 있을 가능성이 높다.

### Phase F: 최종

17. **배포 품질 확인**: "이대로 배포해도 되는가?"를 기준으로 전체를 다시 한 번 검토한다. 테스트가 통과하는가, 에러 로그가 깨끗한가, 사용자에게 노출되는 메시지가 적절한가.

18. **커밋 및 PR 작성**: 변경사항을 커밋하고, PR 메시지를 작성한다. PR에는 무엇을 왜 변경했는지, 어떤 설계 문서를 참조했는지, 확인 포인트가 무엇인지를 포함한다.

### 워크플로우 적용 예시

```
사용자: "Step 2의 detect.py를 구현해줘"

Claude Code:
[Phase A] 계획: detect.py에 파일 유형 판별 함수를 구현한다.
  docs/autofill_pipeline_spec.md 섹션 3 참조.
  → 계획 검토: 명세의 판별 규칙 표와 대조 완료.
  → 범위: detect.py 하나만. extract.py는 다음 Step.

[Phase B] 구현: 코드 작성.

[Phase C] 검증:
  → 목적 부합: 7개 유형 판별 + PLY 양면성 + 파노라마 추정 → OK
  → 버그: 확장자 없는 파일 처리 누락 → 수정
  → 수정 후 부작용: 없음

[Phase D] 품질:
  → 함수 크기: detect_category() 40줄 → 적정
  → 재사용: 확장자→카테고리 매핑을 dict로 분리하면 다른 곳에서도 참조 가능 → 적용
  → 사이드 이펙트: 없음 (신규 파일)
  → 전체 변경: detect.py 1개 + test_detect.py 1개
  → 불필요 코드: 없음
  → 품질: 타입 힌트, docstring 추가

[Phase E] 사용자:
  → 사용자 흐름: 업로드 시 .ply를 올렸을 때 PC/3D 모델 구분이 정상 작동 → OK
  → 연쇄: 다른 유형에도 양면성이 있는지 확인 → .tif만 (GeoTIFF 여부) → 이미 처리됨

[Phase F] 최종:
  → 테스트 전체 통과, 에러 없음
  → 커밋: "feat: implement file type detection pipeline (Step 2)"
```

---

## 구현 순서 (Phase 1)

아래 순서대로 진행한다. 각 단계가 완료되면 다음 단계로 넘어간다.

### Step 1: 인프라 기동
- docker-compose.yml로 DB + pgSTAC + STAC API + MinIO + Redis 기동
- `docker-compose up -d` 후 STAC API (`http://localhost:8080/`)가 응답하는지 확인
- MinIO 버킷(`sams-archive`) 생성
- 참조: `docs/system_architecture.md` 섹션 2

### Step 2: 자동 채움 파이프라인 ⭐ (최우선)
- `sams-api/sams/pipeline/` 디렉토리에 구현
- detect.py: 파일 유형 자동 판별
- extract.py: 유형별 메타데이터 추출 (laspy, rasterio, trimesh, ffprobe, Pillow, PyPDF)
- inherit.py: Collection 기본값 상속
- suggest.py: 관계 자동 제안
- thumbnail.py: 썸네일 생성 (비동기)
- 참조: `docs/autofill_pipeline_spec.md` (전체)
- 테스트: `tests/fixtures/`의 샘플 파일로 각 유형 추출 결과 확인

### Step 3: SAMS API 뼈대
- FastAPI 앱 (`sams-api/sams/main.py`)
- `/api/upload/analyze`: 파일 받기 → 파이프라인 실행 → 매니페스트 JSON 반환
- `/api/upload/validate`: 매니페스트 필수 필드 검증
- `/api/upload/register`: STAC Item 생성 + S3 업로드
- `/api/collections`: Collection CRUD (SAMS 확장 필드 포함)
- 참조: `docs/system_architecture.md` 섹션 3

### Step 4: S3 업로드 + Presigned URL
- 소용량(<100MB): API 경유 업로드
- 대용량(≥100MB): Presigned URL 직접 업로드
- 경로 규칙: `s3://sams-archive/{collection_id}/{category}/{item_id}/{filename}`
- 참조: `docs/system_architecture.md` 섹션 4

### Step 5: Worker (Celery)
- 썸네일 생성 비동기 처리
- 완료 시 STAC Item의 thumbnail Asset 업데이트

### Step 6: Frontend
- React SPA, 4페이지 (Explorer, Detail, Project, Upload)
- Explorer: 검색 필터 + MapLibre 2D 지도 + 결과 목록 + 미리보기 패널
- Detail: 미리보기 패널(Explorer 내) + 전체 페이지(4탭: 메타데이터/파일/연관관계/시계열 + 편집모드)
- Project: Collection 목록 + 4탭(현황/공간/Draft/전체) + 생성 모달
- Upload: 벌크(3-step) + 단건(4-step) 탭
- 통합 데모 참조: `docs/sams_unified_demo.jsx` (전체 UI 구조와 상호작용 참고)
- 참조: `docs/system_structure_design.md` 섹션 3

## 핵심 규칙

### 자동 채움이 가장 중요하다
구현 시 항상 "사용자가 타이핑하는 양을 줄일 수 있는가?"를 먼저 생각한다. 파이프라인의 어떤 단계가 실패해도 등록 자체는 진행 가능해야 한다 (graceful degradation).

### STAC 표준을 따른다
Item JSON은 STAC 1.0.0 스펙을 따른다. 커스텀 필드는 properties 안에 네임스페이스 접두사를 붙인다 (pc:, 3dmodel:, video: 등). pgSTAC의 JSONB에 그대로 저장된다.

### Collection 기본값 상속
Upload 시 Collection의 default_epsg, project:name, project:site가 Item에 자동 상속된다. 파일에서 추출한 값이 우선, 없으면 Collection 기본값, 없으면 이전 입력값.

### 양방향 링크
A→B `derived_from` 설정 시 B→A `has_derived`도 자동 생성한다. 삭제 시에도 양쪽 정리.

### Asset href는 API 경유 URL
S3 직접 경로가 아닌 `/api/files/{collection}/{category}/{item_id}/{filename}` 형태. API가 Presigned URL로 리다이렉트.

## Phase 2 (지금은 구현하지 않는다)
- 3D 지도 (CesiumJS)
- 타임라인 플레이 (자동 재생)
- 브라우저 내 3D/포인트클라우드 뷰어 (Potree, model-viewer)
- 경량 변환 파이프라인 (LAS→COPC, OBJ→GLB, TIFF→COG)
- 외부 공유 링크
