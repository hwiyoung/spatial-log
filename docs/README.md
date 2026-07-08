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

## Semantic Contracts

- `docs/ontology/field_semantic_audit.md` — 기존 STAC/프로젝트/문헌/타입별 필드 필요성 감사와 concept sibling 추가 기준.
- `docs/ontology/ontology_v0_scope.md` — 온톨로지 v0 범위, 제외 범위, 성공 기준.
- `docs/ontology/phase1_semantic_audit.md` — 현재 의미값 감사, drift 후보, Phase 2 전 결정사항.
- `docs/ontology/phase2_vocabulary_decisions.md` — 추천안 반영 결과와 런타임 PoC 경계.
- `docs/ontology/phase3_read_only_search_poc.md` — read-only 검색 확장 PoC와 opt-in API.
- `docs/ontology/phase4_upload_dry_run_annotations.md` — 업로드 분석 dry-run 온톨로지 annotation.
- `docs/ontology/phase5_concept_write_dry_run.md` — 기존 Item의 site/target concept sibling 쓰기 전 dry-run 리포트.
- `docs/ontology/phase6_real_data_vocabulary_expansion.md` — mock seed 이후 실데이터 site/target vocabulary 확장 결정.
- `docs/ontology/phase7_upload_concept_payload_dry_run.md` — 업로드 확인 후보의 concept 저장 payload dry-run과 비저장 경계.
- `docs/ontology/current_semantic_inventory.md` — 현재 코드/문서에 흩어진 의미값 인벤토리.
- `docs/ontology/sams_vocabulary_v0.md` — 사람용 vocabulary 초안.
- `docs/ontology/stac_mapping_v0.md` — 기존 STAC 필드와 의미 concept 매핑 초안.
- `docs/ontology/seeds/bulguksa_2024_seed.yml` — 첫 실데이터 site/target alias seed.
- `docs/ontology/user_input_template.md` — site/target/document/relation 정책 입력 양식.

## Active ADRs

- `docs/adr/ADR-3d-gis-map-grounded-renderer.md` — v1 Core 3D Spatial Relationship View의 map-grounded 방향.
- `docs/adr/ADR-preview-asset-delivery-policy.md` — preview delivery의 deferred backend 결정.

## Archive

`docs/archive/` keeps only a compact historical summary. Removed archive source documents can be recovered from git history if exact old text is needed. Archive material is useful for rationale, but it is not the current source of truth.

When moving a document into or out of the active set, update this index in the same change.
