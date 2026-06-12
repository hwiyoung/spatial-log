# SAMS Docs Index

이 문서는 `docs/`의 현재 기준 문서와 보존용 문서를 구분한다.

현재 개발 판단의 최상위 문서는 `docs/planning/dev_status_and_roadmap_20260612.md`이다. 새 작업을 시작할 때는 이 문서를 먼저 보고, 필요한 경우 아래 canonical 문서만 추가로 확인한다.

## Current Roadmap

- `docs/planning/dev_status_and_roadmap_20260612.md` — 현재 구현 상태, 갭, P0/P1/P2 우선순위.
- `docs/planning/relationship_graph_superseded_decision.md` — Explorer 전역 Relationship Graph 폐기 결정.

## Product And Architecture

- `docs/system_structure_design.md` — 원본 제품 구조, 4페이지 역할, Phase 1/2 기준.
- `docs/system_architecture.md` — 컴포넌트, API, 스토리지, 보안/운영 설계.
- `docs/stac_metadata_design_v4.md` — STAC metadata 필드 기준.
- `docs/autofill_pipeline_spec.md` — 자동 채움 파이프라인 명세.
- `docs/frontend_contracts.md` — Explorer, preview/viewer, mock mode, manual UI check 계약.

## Active ADRs

- `docs/adr/ADR-3d-gis-map-grounded-renderer.md` — 현재 3D Beta의 map-grounded 방향.
- `docs/adr/ADR-preview-asset-delivery-policy.md` — preview delivery의 deferred backend 결정.

## Archive

`docs/archive/` keeps only a compact historical summary. Removed archive source documents can be recovered from git history if exact old text is needed. Archive material is useful for rationale, but it is not the current source of truth.

When moving a document into or out of the active set, update this index in the same change.
