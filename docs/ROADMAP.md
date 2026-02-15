# Spatial Log 개발 로드맵

## 현재 상태 (2026-02-15 기준)

### 완료된 Phase

| Phase | 내용 | 상태 |
|-------|------|------|
| 1-8 | 초기화, UI, 페이지, 3D 뷰어, 데이터 관리, 프로젝트, 어노테이션, 백엔드 | :white_check_mark: 완료 |
| 9 | 3D 데이터 변환 파이프라인 (E57->PLY, OBJ->GLB) | :white_check_mark: 완료 |
| 10 | 3D 어노테이션 완성 (레이캐스팅, 카메라 이동) | :white_check_mark: 완료 |
| 11-14 | 글로벌 검색, 무결성 검사, Release 보안, 공유 뷰어 | :white_check_mark: 완료 |
| v2 | **3축 아키텍처 전환** (Assets/Story/Publish) | :white_check_mark: 완료 |
| v2.1 | **표현 체계 재설계** (4종 Entry, 항상 Cesium, 말풍선 팝업) | :white_check_mark: 완료 |
| - | 인증 시스템 (Supabase Auth), 개발/운영 환경 분리, CI/CD | :white_check_mark: 완료 |
| v3 | **대규모 리팩토링** (모듈 분할, dead code 정리, 코드 품질) | :white_check_mark: 완료 |

---

### v3 — 대규모 리팩토링 (2026-02-15, 완료)

9,500줄 이상의 대형 파일 9개를 도메인별 모듈로 분할하고, ~1,300줄의 dead code를 제거하며, 코드 품질을 개선한 리팩토링.

#### 파일 분할 결과

| 대상 | Before | After | 신규 파일 |
|------|--------|-------|----------|
| `api.ts` | 3,068줄 | `api/` 디렉토리 (barrel) | 10개 |
| `Assets.tsx` | 1,425줄 | 918줄 (오케스트레이터) | 7개 |
| `ThreeCanvas.tsx` | 915줄 | 374줄 (오케스트레이터) | 7개 |
| `storage.ts` | 907줄 | `storage/` 디렉토리 (barrel) | 6개 |
| `assetStore.ts` | 746줄 | 613줄 | 2개 |
| `modelLoader.ts` | 673줄 | `modelLoader/` 디렉토리 (barrel) | 6개 |
| `SceneDetailPanel.tsx` | 617줄 | 167줄 (오케스트레이터) | 4개 |
| `FileUpload.tsx` | 570줄 | 288줄 (UI only) | 3개 |
| `GeoViewer.tsx` | 485줄 | 246줄 | 1개 |
| **합계** | **~9,400줄** | — | **46개** |

#### 코드 통합 (중복 제거)

| 항목 | 내용 |
|------|------|
| `urlHelpers.ts` | `sanitizeUrl()` 2곳 -> 1곳 통합 |
| `dateHelpers.ts` | `formatDate()` 4종 포맷 파라미터화 + `getRelativeTime()` 통합 |
| `entries.ts` | `ENTRY_TYPE_CONFIG` 5곳 -> 1곳 통합 (아이콘/색상/라벨) |
| `tags.ts` | 태그 접두사 매직 문자열 5곳 -> 상수화 |
| `generateId()` | 3곳 중복 -> `storage/core.ts` 1곳 |

#### Dead code 제거 (~1,300줄)

| 대상 | 삭제 내용 |
|------|----------|
| `api.ts` | Project CRUD 5 + Annotation CRUD 5 + ShareToken 4 + FileProject 3 (17개 함수 + 타입/매퍼) |
| `storage.ts` | Project/Annotation/ProjectLink CRUD (15개 함수) |
| `assetStore.ts` | project linking 액션 3개 + import 3개 |
| `components/project/` | 디렉토리 전체 삭제 (AssetLinkModal, ProjectModal) |
| `mockData.ts` | 전체 삭제 (미사용 목데이터) |
| `annotation.ts` | 전체 삭제 (미사용 상수) |
| `splatLoader.ts` | 전체 삭제 (미사용 Gaussian Splatting 로더) |
| `geoUtils.ts` | 전체 삭제 (미사용 GPS 유틸) |
| `texturePreloader.ts` | 미사용 함수 2개 삭제 |

#### 코드 품질 개선

| 항목 | 내용 |
|------|------|
| 배열 인덱스 key | 5개 파일에서 `key={i}` -> 안정적 ID로 교체 |
| Modal 리스너 | `onClose`를 `useRef`로 감싸 이벤트 리스너 재등록 방지 |
| Cesium `as any` | 4곳 분산 -> `cesiumLoaders.ts` 1곳에 중앙화 |
| silent catch | `.catch(() => {})` -> `.catch(err => console.warn(...))` |
| 경합 조건 | `useGlobalSearch` stale 플래그 추가 |

#### 수치 요약

| 지표 | 값 |
|------|---|
| 신규 파일 | 55개 |
| 삭제된 파일 | 10개 |
| 수정된 파일 | 35개 |
| 순 코드 변경 | -6,841줄 (순감) |
| TSC | 0 errors |

---

### v2 — 3축 아키텍처 전환 (완료)

기존 Projects/Annotations 체계를 **Assets -> Story -> Publish** 3축으로 전환.

| 항목 | 내용 |
|------|------|
| **데이터 모델** | `stories`, `scenes`, `scene_entries`, `releases` 테이블 신규 생성 |
| **DB 마이그레이션** | `001_stories_scenes_releases.sql` |
| **Store** | `storyStore.ts`, `releaseStore.ts` (Zustand) |
| **페이지** | StoryList, StoryWorkspacePage, PublishList, PublishDetail, SharedRelease |
| **컴포넌트** | StoryWorkspace, CesiumWorkspaceCanvas, SceneNavigator, SceneDetailPanel |
| **Release** | Story 스냅샷(JSONB) 기반 불변 발행, 공유 토큰, 버전 관리 |
| **라우팅** | `/story`, `/story/:storyId`, `/publish`, `/publish/:releaseId`, `/shared/:token` |

### v2.1 — 표현 체계 재설계 (완료)

핵심 철학 "모든 것은 공간 위에 존재한다"에 맞게 표현 체계 재설계.

| 항목 | Before | After |
|------|--------|-------|
| Entry 타입 | `asset \| memo` | `spatial \| visual \| document \| note` |
| 캔버스 | cesium/threejs/image 전환 | **항상 Cesium** |
| 마커 클릭 | Entry 선택만 | **말풍선 팝업** (타입별 콘텐츠) |
| GPS | spatial만 | **모든 타입 지원** (자동 추출 + 수동 지정) |
| Entry 추가 | 우측 패널에서만 | **3가지 워크플로우** (패널/드래그/지도클릭) |
| Scene 필드 | title만 | + zoneLabel, summary |
| Publish 범위 | Story 전체 | **Scene 선택** 가능 |

---

### 최근 수정 이력

| 날짜 | 항목 |
|------|------|
| 2026-02-15 | v3 대규모 리팩토링 완료 (모듈 분할, dead code 정리, 코드 품질 개선) |
| 2026-02-14 | 표현 체계 재설계 (v2.1) 완료, DB 마이그레이션 002 적용 |
| 2026-02-13 | 3축 아키텍처 (v2) 구현 완료 |
| 2026-02-12 | 업로드 제한 5GB, 운영환경 DB 연결/SPA 라우팅/API 프록시 수정 |
| 2026-02-03 | 3D 변환 파이프라인 검증 완료 |

### 검증 완료 (2026-02-03)

| 항목 | 결과 |
|------|------|
| E57 좌표 추출 | :warning: 부분 성공 (테스트 파일 좌표 불완전) |
| OBJ Cesium 가시화 | :white_check_mark: 성공 (WGS84 좌표 정확) |
| OBJ 텍스처 변환 | :white_check_mark: 성공 (MTL/텍스처 정상 처리) |

상세: [verification-report-2026-02-03.md](./verification-report-2026-02-03.md)

---

## 미검증 항목 (테스트 필요)

| 기능 | 상태 | 비고 |
|------|------|------|
| E57/LAS -> COPC 변환 | :warning: 미검증 | 정상 좌표 파일로 재검증 필요 |
| OBJ -> GLB 변환 | :warning: 일부 검증 | 다양한 좌표계/텍스처 조합 테스트 필요 |
| PLY -> 3D Tiles 변환 | :warning: 미검증 | |
| Story/Scene/Entry CRUD | :warning: 미검증 | 데이터 입력 후 전 기능 테스트 필요 |
| Release 발행/공유 | :warning: 미검증 | 비밀번호/만료일/공유 링크 |
| 글로벌 검색 | :warning: 미검증 | |
| 무결성 검사 | :warning: 미검증 | |
| v3 리팩토링 | :warning: 런타임 미검증 | TSC 통과, 브라우저 기능 테스트 필요 |

---

## 향후 개발 계획

### UX/UI 보완 (우선)

| 작업 | 우선순위 |
|------|---------|
| 전체 기능 데이터 테스트 (CRUD, 변환, 검색 등) | 높음 |
| 에러 메시지/상태 표시 개선 | 높음 |
| 빈 상태(empty state) UI 개선 | 중간 |
| 로딩/스켈레톤 UI | 중간 |
| 반응형 레이아웃 | 낮음 |

### 3D Tiles 확장 (예정)

| 작업 | 우선순위 | 상태 |
|------|---------|------|
| GLTF/GLB -> 3D Tiles 변환 | 높음 | 예정 |
| FBX -> GLB -> 3D Tiles 변환 | 중간 | 예정 |
| PLY/LAS -> 3D Tiles (pnts) | 높음 | 예정 |

### 사용자 경험 개선 (예정)

| 작업 | 우선순위 |
|------|---------|
| 좌표 검증 UI (지도에서 위치 수정) | 높음 |
| 변환 진행률 개선 (단계별, 취소) | 중간 |
| 좌표계 선택 UI (EPSG) 개선 | 중간 |

### 성능 최적화 (예정)

- 대용량 파일 변환 최적화 (PDAL 스트리밍)
- 청크 기반 처리 (분할 업로드)
- Web Worker 백그라운드 처리
- 텍스처 LOD

### 서버 인프라 강화 (예정)

- Docker 컨테이너 리소스 튜닝
- 백업 및 복구 전략 수립
- CI/CD 파이프라인 완성
- 모니터링 (Sentry, Prometheus/Grafana)

---

## 알려진 제한사항

| 기능 | 제한사항 | 해결 방안 |
|------|----------|----------|
| E57 좌표계 | 파일에 올바른 WGS84 좌표 필요 | 좌표계 선택 UI 추가 예정 |
| 파일 크기 | 5GB 이상 업로드 불가 | `FILE_SIZE_LIMIT` 양쪽 변경 |
| OBJ 관련 파일 | OBJ+MTL+텍스처 동시 업로드 필요 | UI 가이드 추가 예정 |
| GPS 미지정 Entry | Cesium 마커 미표시 | "위치 지정" 버튼으로 수동 지정 |
| 운영환경 배포 | `VITE_SUPABASE_ANON_KEY` 빌드 시 필요 | `.env.prod` 변경 후 `--build` 재빌드 |
| 3D 변환 | OBJ->GLB 외 변환 파이프라인 미검증 | 다양한 포맷 테스트 필요 |

---

## 프로젝트 구조 (v3 기준)

```
src/
  pages/                          # 페이지 컴포넌트
    Assets.tsx                    # 에셋 관리 (오케스트레이터)
    Dashboard.tsx                 # 대시보드
    StoryList.tsx                 # Story 목록
    StoryWorkspacePage.tsx        # Story 편집
    PublishList.tsx               # Release 목록
    PublishDetail.tsx             # Release 상세
    SharedRelease.tsx             # 공유 뷰어 (비인증)

  components/
    assets/                       # Assets 서브 컴포넌트
      AssetCard.tsx, AssetGrid.tsx, AssetList.tsx
      FolderSidebar.tsx, PreviewModal.tsx, DeleteConfirmModal.tsx
    story/                        # Story 관련
      StoryWorkspace.tsx, CesiumWorkspaceCanvas.tsx
      SceneNavigator.tsx, SceneDetailPanel.tsx (오케스트레이터)
      EntryBalloonPopup.tsx, SplitViewport.tsx
      scene/                      # Scene 서브 컴포넌트
        SceneHeader.tsx, EntryForm.tsx, EntryListItem.tsx, RelatedAssetsPanel.tsx
    viewer/                       # 3D 뷰어
      ThreeCanvas.tsx (오케스트레이터), GeoViewer.tsx, cesiumLoaders.ts
      three/                      # Three.js 서브 컴포넌트
        SceneContent.tsx, SceneRaycaster.tsx, ClickPositionMarker.tsx, SceneHelpers.tsx
      ui/                         # 뷰어 UI 오버레이
        CoordinatePanel.tsx, PerformanceStatsPanel.tsx, ModelLoadingOverlay.tsx
    release/                      # Release 관련
      ReleaseCreateDialog.tsx, ReleaseViewer.tsx
    common/                       # 공통 컴포넌트
      Button.tsx, Modal.tsx, Card.tsx, Input.tsx
      FileUpload.tsx, FileUpload.types.ts, EPSGSelector.tsx
    admin/                        # 관리 도구
      DevConsole.tsx, IntegrityChecker.tsx
    layout/                       # 레이아웃
      Header.tsx

  services/
    api/                          # API 추상화 (Supabase + localStorage)
      index.ts (barrel)
      shared/ (types.ts, mappers.ts, utils.ts)
      asset.ts, folder.ts, auth.ts, story.ts, release.ts, search.ts
    conversionService.ts          # 3D 변환 서비스
    integrityService.ts           # 무결성 검사
    zipUploader.ts                # ZIP 업로드

  stores/                         # Zustand 상태 관리
    assetStore.ts, assetStore.types.ts
    storyStore.ts, releaseStore.ts
    helpers/conversionHelpers.ts

  hooks/                          # 커스텀 훅
    useFileUpload.ts, useAssetPreview.ts, useGlobalSearch.ts

  utils/
    storage/                      # IndexedDB 추상화
      index.ts (barrel), core.ts, files.ts, folders.ts, utilities.ts, _legacy.ts
    modelLoader/                  # 3D 모델 로더
      index.ts (barrel), types.ts, formatDetection.ts
      loaders.ts, objLoader.ts, lasLoader.ts
    dateHelpers.ts, urlHelpers.ts, fileClassification.ts
    fileFormatUtils.ts, previewHelpers.ts, texturePreloader.ts

  constants/                      # 상수
    entries.ts, tags.ts, formats.ts

  types/story.ts                  # 핵심 도메인 타입
  contexts/AuthContext.tsx         # 인증 컨텍스트
  lib/database.types.ts           # Supabase DB 타입

services/
  spatial-converter/              # Python 변환 서버
    converter.py, server.py

supabase/                         # DB 설정
  schema.sql
  migrations/ (001~005)
  kong.yml
```

## 주요 파일 위치

| 기능 | 파일 |
|------|------|
| 3D 변환 로직 | `services/spatial-converter/converter.py` |
| 변환 API | `services/spatial-converter/server.py` |
| Story 워크스페이스 | `src/components/story/StoryWorkspace.tsx` |
| Cesium 캔버스 | `src/components/story/CesiumWorkspaceCanvas.tsx` |
| 말풍선 팝업 | `src/components/story/EntryBalloonPopup.tsx` |
| Scene 패널 | `src/components/story/SceneDetailPanel.tsx` |
| Release 뷰어 | `src/components/release/ReleaseViewer.tsx` |
| API 추상화 | `src/services/api/index.ts` (barrel) |
| Story/Entry 타입 | `src/types/story.ts` |
| Story Store | `src/stores/storyStore.ts` |
| Release Store | `src/stores/releaseStore.ts` |
| Asset Store | `src/stores/assetStore.ts` |
| DB 스키마 | `supabase/schema.sql` |
| DB 마이그레이션 | `supabase/migrations/001_*.sql` ~ `005_*.sql` |
| CI/CD | `.github/workflows/deploy-*.yml` |
| 프론트엔드 Docker | `Dockerfile` (멀티스테이지: dev/build/prod) |
| 운영 Docker Compose | `docker-compose.prod.yml` |
| Nginx 설정 | `nginx.conf` (SPA 라우팅, API/Converter 프록시) |
