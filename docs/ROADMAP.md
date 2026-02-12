# Spatial Log 개발 로드맵

## 현재 상태 (2026-02-12 기준)

### 완료된 Phase

| Phase | 내용 | 상태 |
|-------|------|------|
| 1-8 | 초기화, UI, 페이지, 3D 뷰어, 데이터 관리, 프로젝트, 어노테이션, 백엔드 | ✅ 완료 |
| 9 | 3D 데이터 변환 파이프라인 (E57→PLY, OBJ→GLB→3D Tiles) | ✅ 완료 |
| 10 | 3D 어노테이션 완성 (레이캐스팅, 카메라 이동) | ✅ 완료 |
| - | 개발/운영 환경 분리, CI/CD 파이프라인 | ✅ 완료 |

### 최근 수정 (2026-02-12)

| 항목 | 내용 |
|------|------|
| 업로드 제한 | 500MB/1GB → **5GB** (프론트엔드 + 백엔드) |
| 운영환경 DB 연결 | Dockerfile `ARG VITE_*` + docker-compose.prod.yml `build.args` 추가 |
| 운영환경 SPA 라우팅 | nginx.conf `try_files` 수정 (403 Forbidden 해결) |

### 검증 완료 (2026-02-03)

| 항목 | 결과 |
|------|------|
| E57 좌표 추출 | ⚠️ 부분 성공 (테스트 파일 좌표 불완전) |
| OBJ Cesium 가시화 | ✅ 성공 (WGS84 좌표 정확) |
| OBJ 텍스처 변환 | ✅ 성공 (MTL/텍스처 정상 처리) |

상세: [verification-report-2026-02-03.md](./verification-report-2026-02-03.md)

---

## 향후 개발 계획

### Phase 11: 3D Tiles 확장 (예정)

| 작업 | 우선순위 | 상태 |
|------|---------|------|
| GLTF/GLB → 3D Tiles 변환 | 높음 | 🔲 예정 |
| FBX → GLB → 3D Tiles 변환 | 중간 | 🔲 예정 |
| PLY/LAS → 3D Tiles (pnts) | 높음 | 🔲 예정 |
| 좌표계 선택 UI (EPSG) | 중간 | 🔲 예정 |

### Phase 12: 사용자 경험 개선 (예정)

| 작업 | 우선순위 |
|------|---------|
| 좌표 검증 UI (지도에서 위치 수정) | 높음 |
| 변환 진행률 개선 (단계별, 취소) | 중간 |
| 에러 메시지 개선 | 낮음 |
| 반응형 UI | 낮음 |

### Phase 13: 성능 최적화 (예정)

- 대용량 파일 변환 최적화 (PDAL 스트리밍)
- 청크 기반 처리 (분할 업로드)
- Web Worker 백그라운드 처리
- 텍스처 LOD

### Phase 14: 인증 시스템 완성 (예정)

| 작업 | 우선순위 |
|------|---------|
| RLS 정책 활성화 | 높음 (프로덕션 필수) |
| 로그인/회원가입 UI | 높음 |
| 소셜 로그인 (Google, GitHub) | 중간 |
| 프로젝트 공유 및 권한 관리 | 중간 |

### Phase 15: 서버 인프라 강화 (예정)

- 현재 서버 인프라 최적화
- Docker 컨테이너 리소스 튜닝
- 백업 및 복구 전략 수립
- CI/CD 파이프라인 완성
- 모니터링 (Sentry, Prometheus/Grafana)

---

## 타임라인 (예상)

| 주차 | 작업 |
|------|------|
| 1 | 검증 완료, 문서화 ✅ |
| 2 | GLTF/GLB → 3D Tiles |
| 3-4 | FBX, PLY/LAS → 3D Tiles |
| 5-6 | 좌표 검증 UI, 진행률 개선 |
| 7-9 | 성능 최적화 |
| 10-12 | 인증 시스템 |
| 13-15 | 서버 인프라 강화 |

---

## 알려진 제한사항

| 기능 | 제한사항 | 해결 방안 |
|------|----------|----------|
| E57 좌표계 | 파일에 올바른 WGS84 좌표 필요 | 좌표계 선택 UI 추가 예정 |
| 파일 크기 | 5GB 이상 업로드 불가 | 프론트엔드(`FileUpload.tsx`) + 백엔드(`FILE_SIZE_LIMIT`) 양쪽 변경 |
| OBJ 관련 파일 | OBJ+MTL+텍스처 동시 업로드 필요 | UI 가이드 추가 예정 |
| 운영환경 배포 | `VITE_*` 변수가 빌드 시 주입되어야 함 | `.env.prod` 변경 후 반드시 `--build` 재빌드 필요 |

---

## 주요 파일 위치

| 기능 | 파일 |
|------|------|
| 3D 변환 로직 | `services/spatial-converter/converter.py` |
| 변환 API | `services/spatial-converter/server.py` |
| Cesium 뷰어 | `src/components/viewer/GeoViewer.tsx` |
| DB 스키마 | `supabase/schema.sql` |
| CI/CD | `.github/workflows/deploy-*.yml` |
| 프론트엔드 Docker | `Dockerfile` (멀티스테이지: dev/build/prod) |
| 운영 Docker Compose | `docker-compose.prod.yml` (VITE_* build args 포함) |
| Nginx 설정 | `nginx.conf` (SPA 라우팅, 정적파일 캐싱) |
| 파일 업로드 컴포넌트 | `src/components/common/FileUpload.tsx` (maxSize 설정) |
