# SAMS 개발 현황 & 향후 계획 (2026-06-12)

> 기획서(`docs/`)와 `design-reference/` 디자인 핸드오프를 기준으로, 코드·런타임을 실제 검증해 정리한 현황과 로드맵.
> 검증 방식: 기획 의도 4개 문서 클러스터 ↔ 실제 구현(backend·frontend·tests/ops)을 병렬 매핑 후 갭 분석·완성도 비평.

---

## 0. 한눈에

> **백엔드 엔진(자동 채움 + STAC + 업로드/관계/이력)은 거의 완성·검증 상태.** 미완은 코어 기능이 아니라
> ① 운영 전환, ② 변경경로(mutation) 안전망, ③ 실데이터로 차별성 증명, ④ 검색보조 API, ⑤ 3D·헤비뷰어 합의다.
> 즉 *"기능을 더 만드는" 단계가 아니라 "실제로 올려 쓰고, 안 깨지게 하고, 차별성을 증명하는" 단계*다.

- 백엔드 테스트: 컨테이너 내부 **186 passed / 3 skipped** 그린 (CLAUDE.md의 "174 passed"는 옛 기재 — 현재 실측 186, skip 3건은 실제 LAS/GeoTIFF/Video 파일 부재 integration).
- 핵심 가치(안전한 보관+검색)·차별성(자동 채움)의 백엔드 엔진은 완성도 높음.

---

## 1. 현재 개발 현황 (영역별)

### ① 자동 채움 파이프라인 — 차별성의 핵심, 가장 강한 영역 ✅
6단계 전부 실구현·단위테스트 완료.

| 단계 | 파일 | 내용 |
|------|------|------|
| bundle | `sams-api/sams/pipeline/bundle.py` | 3D Tiles·OBJ/PLY 번들·이미지셋·비디오 SRT 우선순위 그룹핑 |
| detect | `sams-api/sams/pipeline/detect.py` | 확장자 + 매직바이트, PLY 양면성, GeoTIFF 분기, 파노라마 추정 |
| extract | `sams-api/sams/pipeline/extract.py` (1,319줄, 단위테스트 59개) | laspy·E57 XML 직접파싱·trimesh·rasterio(gsd/eo:bands)·EXIF GPS·DJI SRT LineString·pypdf/docx·CRS 좌표범위 추정 + bbox 4326 변환 |
| inherit | `sams-api/sams/pipeline/inherit.py` | Collection 기본값(title/epsg/license/id) 상속 |
| suggest | `sams-api/sams/pipeline/suggest.py` | target 그룹핑 → derived_from/related/describedby + 무방향 dedup |
| thumbnail | `sams-api/sams/pipeline/thumbnail.py` | 유형별 400×300 PNG |

- `analyze()` 통합 진입점이 bundle→detect→extract→inherit→suggest를 연결, **graceful degradation**(extract 실패해도 등록 진행) 구현.

**잔여 미완 2건:**
- `inherit.py`: 명세(`autofill_pipeline_spec` §5)의 **"같은 Collection Item 최빈값(mode) 자동완성"**(예: `pc:scanner_model='Leica RTC360'` 자동제안) 미구현 → 타이핑 추가 절감 여지.
- `thumbnail.py`: **3d_tiles 썸네일 미지원**, **panorama가 명세상 equirect→flat 변환이어야 하나 단순 image 리사이즈로 처리됨**(divergence).

### ② 백엔드 API — 광범위 실동작 ✅
- `routers/upload.py`: analyze 세션 캐시, register(대용량 staging copy + 이미지셋 병렬 업로드 + 썸네일 동기/비동기 + pgSTAC 등록 + **실패 시 S3 롤백** + 양방향 링크 생성), presigned-url/upload-complete/sessions. path-traversal·세션키 검증 견고.
- `routers/items.py` (859줄): status·related·timeline·links 양방향 추가/삭제·properties 부분수정·location·move(DB+S3)·delete까지 10개 엔드포인트 wired. 모든 갱신은 **pgSTAC 원자적 DELETE+create**. timeline은 `_follow_prev_next_chain`으로 양방향 prev/next 체인 실순회(고복잡 로직).
- `routers/collections.py`: 생성/수정/목록/dashboard/spatial-summary/삭제 전부 구현.
- 서비스: `services/s3.py`(내부/공개 클라이언트 분리), `services/history.py`(8종 event_type 감사로그, 멱등), Celery worker(썸네일 비동기 + 재시도 + pgSTAC 갱신) 완성.
- **정리 대상**: `services/stac.py`의 update/delete/create PUT/DELETE 래퍼는 **dead code** — 라우터가 pgSTAC를 직접 호출(405 회피).

### ③ 프론트엔드 (React + Vite, plain JSX) — 실 API 와이어링 ✅
- **라우트 6개**(Explorer/Detail/MetadataCompletion/Project/Upload + ViewerShell), NavBar Core 3개(Explorer/Project/Upload). 상태관리 라이브러리 없이 useState + UploadTasksContext.
- **비-mock 모드에서 전 페이지 실 API(읽기+쓰기)**: 등록/편집/관계/이동/삭제/상태전환 모두 실 엔드포인트. Mock은 `?mock=1`/`VITE_USE_MOCKS`에서만 조회 전용.
- **검색은 프론트가 stac-fastapi `/stac/search`(cql2-json)를 직접 호출** — SAMS API를 거치지 않음.
- `components/MapView.jsx`(524줄): 실 MapLibre GL — CARTO dark + 네이티브 클러스터 + footprint + flight-path LineString + 드래그 bbox 영역 그리기. Explorer/Project 공용.
- MetadataCompletion(Draft→Published 게이트, 백엔드 `_check_required_for_publish`와 정렬), Detail(메타/관계/시계열 authoring + 양방향 REVERSE_REL), Project(5탭 + Unassigned 배정 + 생성 모달), Upload(단건/벌크 폴더 재귀, ≥100MB presigned 직행, 백그라운드 분석 + localStorage 복구) 전부 실동작.

### ④ 공간 / 3D — 2D 완성, 3D는 Beta 3중 병렬 ⚠️
- **2D 지도는 프로덕션 수준** (flight_path·footprint·coverage·fallback 4종 공간근거 시각화).
- **3D Explorer는 `Explorer3dGisBeta` 아래 렌더러 3개가 모두 라이브**: `map-grounded`(기본, MapLibre+three, 521줄) · `three`(순수 three.js, 654줄) · `pseudo`(CSS 폴백). 합산 ~1,800줄 병렬 유지 부담. 셋 다 "자산 배치 시각화" 수준 Beta(헤비 뷰어 아님).
- 의사결정 합의: Explorer 기본 2D, 3D는 선택형 Beta, **전역 Relationship Graph는 폐기(superseded)**, 관계는 선택 Item 1-depth 오버레이로 격하.
- **단, Explorer 전역 관계 overlay는 mock fixtures 의존** — 실데이터 모드에선 전역 관계선이 안 보임(선택 Item 관계만 실동작).

### ⑤ ViewerShell — chrome·preview 계약은 실동작, 카테고리 표면은 목업 ⚠️
- preview 4상태 계약(available/pending/missing/failed)·원본 다운로드·메타 strip은 실 데이터.
- **카테고리별 `ViewerSurfaces`는 코드 주석에 명시된 "비작동 크롬 목업"**, 헤비 뷰어(Potree/Cesium/pdf.js)는 **Phase 2 의도적 유보**(계획대로 미구현이지 결함 아님).

### ⑥ 테스트 / 운영 — 백엔드 그린, 그 외 공백 ❌
- 백엔드 186 passed지만 **변경경로 테스트 0건**: items의 PUT properties/location, move, delete, delete-link, GET history(prev/next 체인), worker, files, history 서비스, collections update/delete/spatial-summary.
- **프론트엔드 테스트 러너 자체가 없음**(vitest/jest 미설치, 테스트 0건). CLAUDE.md의 "E2E 8개 / 174 passed"는 백엔드 것.
- conftest가 **격리 DB가 아닌 dev DB를 공유** → CI 재현성 약점(186 그린이 dev DB를 오염시키며 돎).
- **운영 미비**: Dockerfile이 `uvicorn --reload`/`npm run dev`(dev server), CORS `allow_origins=['*']`+`allow_credentials=True`(브라우저 거부 조합), 인증 전무, **개발용 test 라우터 상시 등록(인증 없이 임의 업로드 가능)**, TLS 없음, MinIO 콘솔 `/minio/` 노출, 평문 dev 크리덴셜. 동일 호스트에 **compose 2벌**(`sams-hwiyoung-*`, `sams-*`) 동시 가동 — 정식 스택 불명확.

---

## 2. 기획 ↔ 구현 갭

| 영역 | 기획 의도 | 실제 | 종류 |
|---|---|---|---|
| inherit 최빈값 | 같은 Collection 최빈값 자동완성(spec §5) | 기본값 상속만 | partial |
| `/api/search` | autocomplete/facets/field-values | 백엔드 부재, 프론트엔 dead 선언 | missing |
| manifest Excel | template/import 엔드포인트 | 프론트 선언만, 백엔드 부재(wired-but-broken) | missing |
| files.py | Presigned URL 리다이렉트 | S3 1MB 청크 직접 프록시 | diverged |
| panorama 썸네일 | equirect→flat 변환 | 단순 image 리사이즈 | diverged |
| 3d_tiles 썸네일 | 8종 전부 지원 | 미지원(1종 공백) | partial |
| Explorer 관계 overlay | 선택 Item 1-depth 실 STAC links | 전역은 mock-only | partial |
| 3D 렌더러 | map-grounded 채택 방향 | 3종 병렬 라이브 | diverged |
| 변경경로 테스트 | 회귀 방지 | 0건 | missing |
| 프론트 테스트 | E2E 8개(문서 기재) | 러너·테스트 0건 | diverged |
| 운영 구성 | 사내 운영(인증/TLS/CORS 화이트리스트) | 전부 dev 전용 | missing |
| 시스템 비전 | (원본) 보관+검색·자동채움 1순위·4페이지 | (20260607) 3D GIS로 확장·mock-first 회귀 — **문서 간 시간순 모순** | diverged |

---

## 3. 향후 개발 계획

> 우선순위 기준: **핵심 가치(안전한 보관+검색)와 차별성(자동 채움)을 직접 강화/보호하는 것이 먼저.** 새 기능보다 "출시 가능·안 깨짐·차별성 증명"이 앞선다.

### 🚦 P0-게이트 (코드 아님 — 의사결정): v1 비전 합의
원본(보관+검색·자동채움 1순위·4페이지)과 20260607 현재버전(3D GIS 확장·mock-first)이 갈라져 있다. **3D를 v1 "핵심"으로 볼지 "Beta 부가"로 볼지** 먼저 합의해야 아래 P1(3D 단일화) 강도가 정해진다. 착수 전 1줄 결정 필요.

### P0 — v1 출시 차단 항목

**① 운영 배포 하드닝** (M)
*왜: 자동채움/검색이 완성돼도 안전하게 못 올리면 채택 0. 현재 dev 구성은 "임의 업로드 가능"이라 보관 안전성이 무너짐.*
- sams-api Dockerfile → gunicorn+uvicorn worker, 고정 이미지(bind-mount 제거)
- frontend → `npm run build` → nginx 정적 served
- **운영 시 test 라우터 미등록**(env 게이트) — 임의 업로드 차단
- CORS를 사내 도메인 화이트리스트로, credentials 조합 정리
- Basic Auth 또는 사내 신뢰망 + nginx TLS
- **MinIO 콘솔 `/minio/` 노출 차단**, DB/MinIO 운영 시크릿 주입
- **compose 정식 스택 단일화** — 잔여 `sams-*`/`sams-hwiyoung-*` 정리(포트/볼륨/DB 충돌 = 데이터 안전 직결)

**② 실데이터 업로드 사용성 파일럿** (M)
*왜: 차별성은 "실파일로 NAS보다 쉬운가"로만 증명된다. 현재 픽스처 다수가 0바이트 더미라 실파싱·CRS 추출률·대용량 안정성이 미검증. 결정로그 Phase 10D가 "신규 우선"으로 지목.*
- 실 LAS/LAZ/E57·GeoTIFF·드론 이미지셋·동영상·문서로 analyze→register E2E 측정(자동채움 비율, 수동 타이핑 셀 수)
- 대용량(≥100MB) presigned 직행 + 413/chunking 안정성 실측
- CRS 추출 실패율 → Collection default_epsg fallback·경고 동선 검증
- 썸네일 비동기 실파일 생성 시간·실패율 측정
- 사용자 1명 실등록 관찰 → 명세 목표(Item당 수동 2~3셀) 부합 확인

> **①→② 순서**: 배포 하드닝(①)을 먼저 — 파일럿은 실제로 올라간 시스템에서 해야 의미가 있고, ①의 보안 차단은 사람이 만지기 전에 닫혀야 함.

### P1 — 안전망 + 차별성 마무리

**③ inherit 최빈값 + `/api/search` 자동완성·패싯** (M)
차별성(타이핑 절감) + 검색 강화. inherit 최빈값(spec §5) 추가, `/api/search` 라우터 신설(autocomplete/facets/field-values), 프론트 dead 선언을 실제 검색바·facet count에 연결. manifest-template/import는 쓸지 결정 후 구현 또는 dead 선언 제거.

**④ 변경경로 회귀 테스트 보강** (M)
*안전한 보관 직격.* items mutation 6종 + collections update/delete + worker/files/history + **timeline prev/next 체인**(고복잡·미테스트) 통합 테스트. conftest를 **격리 테스트 DB**로 전환(CI 재현성).

**⑤ 3D 렌더러 단일화 + 관계 overlay 실데이터** (M)
map-grounded 단일 채택, three/pseudo는 fallback/archive 강등(~1,800줄 부채 정리). **Explorer 관계 overlay를 선택 Item 1-depth만 실 STAC links(getRelated)로** 연결(전역 그래프 재도입 아님 — 폐기 결정 유지). 30초+ 사람 visual QA 게이트.

### P1.5 — 별도 트랙 (3D Beta 고도화, 헤비뷰어와 구분)

**⑥ Phase 7E: coverage/boundary/LOD**
결정로그가 "map-grounded 위 다음 투트랙"으로 본 항목. 헤비 뷰어(P2)와 성격이 다르므로 분리. 단, 실데이터/운영/안전망(P0·P1) 이후.

### P2 — 완성도 + 명시적 Phase 2 유보

**⑦ files.py Presigned 리다이렉트 전환 + 3d_tiles 썸네일 + stac.py dead 래퍼 정리** (S)
설계 divergence·성능·완성도 정리.

**⑧ Phase 2 쇼케이스(명시적 유보)** (L)
*"쇼케이스할 데이터가 없으면 쇼케이스도 의미 없다"* — P0/P1로 실데이터가 쌓인 뒤 착수.
- 헤비 뷰어(저위험순: image/ortho→pdf.js→video→model-viewer→panorama→Cesium→Potree)
- 경량 변환(LAS→COPC, OBJ→GLB, TIFF→COG)
- 타임라인 자동재생, 외부 공유 링크, OAuth2/OIDC

---

## 4. 리스크 / 기술부채

1. **데이터 유실(핵심가치 직격)** — move/delete/properties + collections delete가 pgSTAC DELETE+create와 양방향 링크 정리를 수반하는데 mutation 테스트 0건. 한 번의 회귀로 보관 데이터 소실 가능.
2. **보안** — test 라우터 상시 노출(인증 없이 임의 업로드), CORS `*`+credentials, 인증·TLS 없음, MinIO 콘솔 노출, 평문 크리덴셜.
3. **차별성 미증명** — 자동채움 엔진은 완성됐으나 실파일 추출률·CRS 성공률·대용량 안정성 미실측.
4. **비전 분기** — 원본 vs 20260607 현재버전이 갈라짐 + implementation_plan_v2(4월 실데이터) vs 6월 mock-first 시간순 모순 → v1 기준 합의 필요.
5. **기술부채** — 3D 렌더러 3중 병렬(~1,800줄), `services/stac.py` dead 래퍼, wired-but-broken 프론트 선언(searchApi/manifest).
6. **런타임 위생** — compose 2벌 동시 가동, conftest dev DB 공유.

---

## 5. 권장 다음 액션

`P0-게이트(v1 비전 합의)` → `① 운영 하드닝` → `② 실데이터 파일럿` 순으로 착수.

### 참조 문서
- `docs/system_structure_design.md` (원본 구조 설계서) / `design-reference/project/uploads/SAMS_시스템_구조_설계서_현재버전_20260607.md` (현재버전)
- `docs/autofill_pipeline_spec.md` (자동 채움 §5 최빈값)
- `docs/system_architecture.md` (§3.2 검색보조, §4.4 파일 서빙, §6 보안)
- `docs/planning/meeting_change_phase_traceability_20260605.md` (최신 회의 결정), `docs/planning/relationship_graph_superseded_decision.md` (전역 그래프 폐기)
- `docs/adr/ADR-3d-gis-map-grounded-renderer.md`, `docs/adr/ADR-preview-asset-delivery-policy.md`
