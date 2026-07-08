# Phase 1 Semantic Audit

Date: 2026-07-07

## Purpose

Phase 1 audits the semantic values that SAMS already depends on before any
runtime ontology integration. The goal is to identify which values are stable,
which values are duplicated across layers, and which values need user/domain
confirmation before becoming a stronger vocabulary contract.

This is not a migration plan. It is an evidence-backed inventory and drift report.

## Reference Basis

Internal sources:

- `docs/stac_metadata_design_v4.md` for STAC Collection/Item/Asset fields.
- `docs/autofill_pipeline_spec.md` for upload analysis and relation suggestion
  rules.
- `docs/frontend_contracts.md` for Explorer relation overlay and Core 3D Spatial
  Relationship View behavior.
- `docs/system_structure_design.md` for product role boundaries: metadata
  autofill, STAC search, Explorer, Detail, Project, and 3D relationship view.
- Current backend/frontend constants and validators listed below.

External standards used as interpretation references:

- STAC: asset metadata, `assets`, `links`, Item/Collection/API shape.
- SKOS: concept labels, aliases, broader/narrower category groupings.
- CIDOC CRM: later cultural-heritage sanity check for site/target/document/event
  modeling; not adopted in v0.
- PROV-O, GeoSPARQL, SHACL: explicitly deferred by `ontology_v0_scope.md`.

Service/product references:

- No single service is being copied as the product reference.
- Potree/Cesium/model-viewer/pdf.js/Pannellum are viewer integration references,
  not semantic-model references.
- GeoNode/GeoServer are comparison points for geospatial management/serving, not
  the SAMS information architecture.
- The active design reference in this repo is the local Claude Design handoff
  under `design-reference/project/`.

## Audit Method

1. Extract semantic values from the STAC design document.
2. Compare backend detection, validation, registration, and relation constants.
3. Compare frontend category, status, relation, preview, and 3D overlay constants.
4. Identify values with multiple owners.
5. Mark each semantic area as one of:
   - `stable`: can be codified in vocabulary v0.
   - `needs decision`: domain/user decision required before runtime use.
   - `drift risk`: code/document paths disagree or duplicate policy.

## Semantic Surfaces

| Surface | Main values | Evidence | Audit status |
| --- | --- | --- | --- |
| Asset category | `pointcloud`, `3d_model`, `3d_tiles`, `orthoimage`, `image`, `panorama`, `video`, `document`, `unknown` | `docs/stac_metadata_design_v4.md`; `sams-api/sams/pipeline/detect.py`; `frontend/src/constants.js`; `frontend/src/features/explorer/explorerMeta.js` | stable, drift risk from duplication |
| Category grouping | 3D, raster/visual, documentation, derived | currently implicit in preview, 3D view, and user language | needs decision |
| Relation type | `derived_from`, `has_derived`, `related`, `describedby`, `describes`, `prev`, `next` | `docs/stac_metadata_design_v4.md`; `sams-api/sams/routers/items.py`; `frontend/src/features/relations/relationStyles.js`; `frontend/src/features/detail/normalizeRelations.js` | stable, drift risk around reverse rels |
| Upload suggestion relation | `derived_from`, `related`, `describedby` | `docs/autofill_pipeline_spec.md`; `sams-api/sams/pipeline/suggest.py`; `sams-api/sams/routers/upload.py` | stable for current behavior |
| Time series relation | `prev`, `next` | STAC metadata design, Detail timeline, backend timeline chain traversal | needs decision for upload automation |
| Item status | `draft`, `published`, `archived`, `unknown` fallback | STAC metadata design, backend status update, frontend status meta | drift risk around `status` vs `sams:status` |
| Collection status | `planning`, `active`, `completed`, `archived` | STAC metadata design, collection UI/API | stable, lower priority |
| Processing level | `raw`, `processed`, `derived`, `final` | STAC metadata design | stable, currently underused |
| Target/site | text values in `project:site` and `target` | STAC design, upload inheritance, timeline logic, user input template | needs decision |
| Document type | `document:type` candidates exist in STAC design | STAC metadata design, completion required fields | needs decision |
| Preview state | `available`, `pending`, `missing`, `failed` | `frontend/src/features/explorer/explorerMeta.js`; `frontend/src/features/preview/previewCategoryPolicy.js`; `docs/frontend_contracts.md` | adjacent semantic surface, not ontology v0 core |

## Findings

### F1. Asset categories are stable but have too many owners

The core category list is consistent enough for vocabulary v0:

- backend detection validates and emits the same set plus `unknown`.
- STAC design lists the same production categories except `unknown`, which is a
  runtime fallback.
- frontend category order, labels, preview policy, glyphs, and filters repeat the
  same list.

Risk:

- New category work will require touching many files.
- Labels and aliases can drift from backend semantics.
- Broader filters such as "3D data" have no central expansion rule.

v0 action:

- Keep existing `properties.data_category`.
- Treat `vocabulary.yml` as the future central source for labels, aliases, and
  broader groups.

### F2. Required-field policy is intentionally split but not centrally named

There are at least three required-field policies:

1. Upload/analyze manifest required fields:
   - common includes `datetime`, `description`, `data_category`, `project:name`,
     `project:site`, `proj:epsg`.
   - category-specific values include `pc:type` and `eo:bands` in the upload
     validation path.

2. Published transition required fields:
   - `project:name` and `project:site` are intentionally non-blocking.
   - `proj:epsg` is required only for `pointcloud`, `3d_model`, `3d_tiles`, and
     `orthoimage`.
   - category-specific values use the current completion gate, for example
     `3dmodel:format`, `3dtiles:geometric_error`, `ortho:gsd`, and document title
     and authors.

3. Frontend completion spec:
   - explicitly documents that it must match the backend Published gate.

Risk:

- This is not automatically a bug, but the policies need names. Without named
  policy levels, future developers may "fix" one path to match another and break
  the intended Product/Upload/Publish distinction.

v0 action:

- Name the policy levels in future docs/code:
  - `analysis_required`
  - `registration_required`
  - `publish_required`
  - `search_quality_recommended`

### F3. Relation types are stable, but reverse relations are not equally surfaced

Backend user relations include `has_derived` and treats it as a user relation.
Detail normalization treats `has_derived` and `describes` as incoming/read-only
reverse relations. Explorer relation style and overlay list currently name
`derived_from`, `related`, `describedby`, `describes`, `prev`, and `next`, but do
not include `has_derived` in the same style list.

Risk:

- A STAC Item carrying a direct `has_derived` link may be valid backend data but
  not part of some Explorer overlay paths.
- It is unclear whether reverse rels are meant to be stored, displayed, editable,
  or derived on read.

v0 action:

- Decide relation ownership:
  - stored forward + stored reverse, current backend behavior
  - stored forward only + derived reverse in API/UI
  - stored relation record table later
- Until then, keep `has_derived` in vocabulary, but mark it as a reverse/system
  authoring relation rather than a primary UI authoring option.

### F4. `prev` and `next` are both relation vocabulary and timeline behavior

The STAC metadata design includes `prev` and `next` for time series. Detail
timeline treats them separately from the richer relation graph. Upload suggestion
docs mention same-target same-category `prev/next`, but current upload accepted
relations exclude them.

Risk:

- Automatic `prev/next` linking can be noisy unless target concept and acquisition
  datetime quality are strong.

v0 action:

- Keep `prev` and `next` in relation vocabulary.
- Do not enable upload-time auto-suggestion until target concepts and datetime
  normalization are verified on real data.

### F5. Target and site are the highest-value missing concepts

Current relation suggestions and timeline grouping rely on `target` strings or
filename/folder heuristics. Site comes from Collection inheritance, but neither
site nor target has a stable concept ID.

Risk:

- `다보탑`, `Dabotap`, `dabo_tap`, and folder names can fragment search and
  relation suggestions.
- Timeline grouping by `target + data_category` fails when target spelling drifts.
- Same target across multiple collections/sites is ambiguous without a concept ID.

v0 action:

- User must provide a first site/target alias set.
- Do not add runtime concept fields until the first real project vocabulary is
  reviewed.

### F6. Document type exists in the STAC design but not in current vocabulary usage

The STAC metadata design already lists `document:type` candidates such as
`survey_report`, `excavation_report`, `analysis`, `permit`, `plan`, `drawing`,
`bibliography`, `specification`, `meeting_minutes`, and `photograph_log`.
The initial vocabulary draft currently uses a smaller, more product-oriented set.

Risk:

- Document relations remain noisy because every document can become `describedby`
  candidate for every non-document item.
- Searchers cannot ask for "quality report", "drawing", or "delivery manifest"
  reliably if document subtypes are not normalized.

v0 action:

- Align `document_type` candidates with real team document names before runtime
  use.
- Prefer `properties.document:type` if following the current STAC design, unless
  there is a reason to introduce `properties.sams:document_type`.

### F7. Preview state is a semantic contract but not ontology v0 core

Preview state affects user trust and UI flow, but it is about asset delivery
readiness rather than domain meaning. It should stay in frontend/preview contracts
unless later export/search needs require vocabulary treatment.

v0 action:

- Keep preview state out of ontology v0.
- Do not mix preview status with asset category or processing level.

## Phase 1 Decisions Required

Status: resolved or bounded by `docs/ontology/phase2_vocabulary_decisions.md`.

| Decision | Recommendation | Owner |
| --- | --- | --- |
| Central category source | Keep `data_category`; use vocabulary for labels/groups/aliases | engineering |
| Broader category filters | Add `three_dimensional_asset` first, defer UI until PoC | product/engineering |
| Required-field policy names | Document separate analysis/register/publish policies | engineering |
| Reverse relation storage | Keep current behavior for now; mark reverse rels as non-primary authoring | product/engineering |
| `prev/next` automation | Defer upload automation | product |
| Site/target aliases | Need user-provided real examples | user/domain |
| Document type set | Align STAC design candidates with team names | user/domain |
| Runtime ontology fields | Defer until first PoC dataset | engineering |

## Phase 1 Output

Completed by this audit:

- Current values are documented in `current_semantic_inventory.md`.
- Vocabulary draft exists in `sams_vocabulary_v0.md` and
  `sams-api/sams/ontology/vocabulary.yml`.
- Relation rule draft exists in `sams-api/sams/ontology/relation_rules.yml`.
- User input template exists in `user_input_template.md`.

Resolved or carried into Phase 2:

1. First site/target aliases are seeded from the live `bulguksa-2024`
   Collection.
2. Document type field is aligned to `properties.document:type`; final team names
   still need deliverable review before writes.
3. `has_derived` is kept as a stored/read reverse relation, but not a primary
   authoring option.
4. Broader category filtering starts as an API/helper PoC, not an Explorer UI
   control.
