# Meeting Change Phase Traceability

Date: 2026-06-05

This table maps meeting-derived product changes to the current phased Explorer and SAMS roadmap.

| 회의 도출 수정사항(쉬운 용어로) | 개발 phase | 의미 | 완료여부 |
| --- | --- | --- | --- |
| 사람이 읽는 파일명 | Phase 2 | 원본 파일명/id 대신 `assets.*.title`, `properties.title`, display label fallback을 Explorer에 표시한다. | 완료: Mock UX v1에서 label visibility 구현 |
| 프로젝트 정보 표시 | Phase 2 / Phase 3 | Explorer list와 Context Panel에서 project/site/status를 바로 확인한다. | 완료: Mock UX v1에서 표시 |
| Draft 빠른 확인 | Phase 2 | Draft filter와 badge로 보완 필요 항목을 빠르게 찾는다. | 완료: Explorer mock filter/badge 구현 |
| Draft 이유/metadata gaps | Phase 3 | 선택 Item의 Draft 사유와 누락 metadata를 Context Panel에서 보여준다. | 완료: Context Panel 구현 |
| Explorer 지도 중심 탐색 | Phase 1 | Explorer 기본 화면은 공간 기반 map/list/filter 탐색이다. | 완료: 2D map/list 기본 유지 |
| 관계 전체 그래프 금지 | Phase 4 decision | Explorer 기본 화면에 global Relationship Graph board를 두지 않는다. | 완료: superseded decision으로 guardrail 확정 |
| 선택 Item relation overlay | Phase 4 | 선택 Item 1-depth relation만 지도/3D Beta에 overlay로 표시한다. | 완료: 2D overlay, 3D Beta reuse 구현 |
| 3D GIS 관계형 화면 | Phase 5 / Phase 7A / Phase 7B | 3D GIS는 선택형 Beta로 spatial asset discovery와 선택 Item 관계를 보강한다. | 부분 완료: pseudo-3D Beta 구현, designed Beta 명세 진행 |
| preview/viewer contract | Phase 6A / Phase 6B | category/status별 preview action과 lightweight ViewerShell을 정의한다. | 완료: Preview Contract와 ViewerShell 구현 |
| image/ortho preview diagnostics | Phase 6C / Phase 6D | image/ortho preview source, load/fallback/unsupported diagnostics를 표시한다. | 완료: image/ortho diagnostics 구현 |
| Upload 후 Draft/보완 | Upload later | 업로드 완료 후 Draft 보완, Detail 이동, Explorer Draft 보기 CTA를 제공한다. | 미완료: Upload workflow phase 필요 |
| 프로젝트 편집 | Project later | 프로젝트명, 설명, 기간, PM, 좌표계 등 Collection metadata를 편집한다. | 미완료: Project management phase 필요 |
| Project asset 연결 | Project later | 프로젝트 화면에서 asset을 검색/선택하여 연결하고 membership을 관리한다. | 미완료: Project asset association phase 필요 |
| 대용량 업로드 | Upload/backend later | 413, 분할 업로드, 벌크 업로드, 네트워크/용량 정책을 정리한다. | 미완료: upload/backend policy 필요 |
| thumbnail generation backend | Preview/backend later | pointcloud, model, ortho 등 preview thumbnail 생성 job과 storage output을 정의한다. | 미완료: preview generation backend 필요 |
| 사용자 권한 | Auth/backend later | 내부 사용자/향후 외부 공개에 대비해 접근/다운로드 권한을 정의한다. | 미완료: auth/permission phase 필요 |

## Notes

- Explorer relation work is intentionally selected Item scoped.
- Detail may later host richer Item-centered relation graph behavior.
- Project may later host project-level lineage/status dashboards.
- None of the later items require changing Explorer back to a global graph default.
