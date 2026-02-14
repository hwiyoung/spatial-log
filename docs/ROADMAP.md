# Spatial Log 개발 로드맵

## 현재 상태 (2026-02-14 기준)

### 완료된 Phase

| Phase | 내용 | 상태 |
|-------|------|------|
| 1-8 | 초기화, UI, 페이지, 3D 뷰어, 데이터 관리, 프로젝트, 어노테이션, 백엔드 | ✅ 완료 |
| 9 | 3D 데이터 변환 파이프라인 (E57→PLY, OBJ→GLB) | ✅ 완료 |
| 10 | 3D 어노테이션 완성 (레이캐스팅, 카메라 이동) | ✅ 완료 |
| v2 | **3축 아키텍처 전환** (Assets/Story/Publish) | ✅ 완료 |
| v2.1 | **표현 체계 재설계** (4종 Entry, 항상 Cesium, 말풍선 팝업) | ✅ 완료 |
| - | 인증 시스템 (Supabase Auth), 개발/운영 환경 분리, CI/CD | ✅ 완료 |

### v2 — 3축 아키텍처 전환 (완료)

기존 Projects/Annotations 체계를 **Assets → Story → Publish** 3축으로 전환.

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

**수정 파일**:
- DB: `002_entry_type_refactor.sql` (entry_type 4종, scene zone_label/summary, entry url)
- 타입: `story.ts` (SceneEntryType 4종, SceneData + zoneLabel/summary, SceneEntryData + url)
- API: `api.ts` (detectEntryTypeFromFormat, 매퍼/CRUD 확장, localStorage 마이그레이션)
- Store: `storyStore.ts` (시그니처 확장)
- 신규: `EntryBalloonPopup.tsx` (마커 클릭 말풍선 팝업)
- 수정: `StoryWorkspace.tsx` (항상 Cesium, 드롭 수신, 지도 클릭 추가)
- 수정: `CesiumWorkspaceCanvas.tsx` (타입별 마커 색상, 드롭 GPS 계산)
- 수정: `SceneNavigator.tsx` (zoneLabel 표시, 드래그 지원)
- 수정: `SceneDetailPanel.tsx` (4종 UI, Scene 메타 편집, GPS 상태)
- 수정: `ReleaseCreateDialog.tsx` (Scene 선택 체크박스)
- 수정: `ReleaseViewer.tsx` (4종 타입 표시, 말풍선 팝업, readOnly)

### 최근 수정 이력

| 날짜 | 항목 |
|------|------|
| 2026-02-14 | 표현 체계 재설계 (v2.1) 완료, DB 마이그레이션 002 적용 |
| 2026-02-13 | 3축 아키텍처 (v2) 구현 완료 |
| 2026-02-12 | 업로드 제한 5GB, 운영환경 DB 연결/SPA 라우팅/API 프록시 수정 |
| 2026-02-03 | 3D 변환 파이프라인 검증 완료 |

### 검증 완료 (2026-02-03)

| 항목 | 결과 |
|------|------|
| E57 좌표 추출 | ⚠️ 부분 성공 (테스트 파일 좌표 불완전) |
| OBJ Cesium 가시화 | ✅ 성공 (WGS84 좌표 정확) |
| OBJ 텍스처 변환 | ✅ 성공 (MTL/텍스처 정상 처리) |

상세: [verification-report-2026-02-03.md](./verification-report-2026-02-03.md)

---

## 향후 개발 계획

### 3D Tiles 확장 (예정)

| 작업 | 우선순위 | 상태 |
|------|---------|------|
| GLTF/GLB → 3D Tiles 변환 | 높음 | 🔲 예정 |
| FBX → GLB → 3D Tiles 변환 | 중간 | 🔲 예정 |
| PLY/LAS → 3D Tiles (pnts) | 높음 | 🔲 예정 |
| 좌표계 선택 UI (EPSG) | 중간 | 🔲 예정 |

### 사용자 경험 개선 (예정)

| 작업 | 우선순위 |
|------|---------|
| 좌표 검증 UI (지도에서 위치 수정) | 높음 |
| 변환 진행률 개선 (단계별, 취소) | 중간 |
| 에러 메시지 개선 | 낮음 |
| 반응형 UI | 낮음 |

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

---

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
| API 추상화 | `src/services/api.ts` |
| Story/Entry 타입 | `src/types/story.ts` |
| Story Store | `src/stores/storyStore.ts` |
| Release Store | `src/stores/releaseStore.ts` |
| DB 스키마 | `supabase/schema.sql` |
| DB 마이그레이션 | `supabase/migrations/001_*.sql`, `002_*.sql` |
| CI/CD | `.github/workflows/deploy-*.yml` |
| 프론트엔드 Docker | `Dockerfile` (멀티스테이지: dev/build/prod) |
| 운영 Docker Compose | `docker-compose.prod.yml` |
| Nginx 설정 | `nginx.conf` (SPA 라우팅, API/Converter 프록시) |
