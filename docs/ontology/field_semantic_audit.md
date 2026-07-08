# Field Semantic Audit

Date: 2026-07-08

## Purpose

This audit checks whether current STAC Item and Collection fields are still
needed before adding ontology-backed fields such as `sams:site_concept`,
`sams:target_concept`, and `document:type`.

The result is intentionally conservative:

- no live STAC data migration
- no UI behavior change
- no removal of existing fields
- concept fields are added only as siblings of existing human labels after a
  dry-run review

## Reference Basis

External standards and modeling references:

- OGC STAC Community Standard 1.1:
  <https://docs.ogc.org/cs/25-004/25-004.html>
- STAC Projection Extension:
  <https://github.com/stac-extensions/projection>
- SKOS Reference:
  <https://www.w3.org/TR/skos-reference/>
- CIDOC CRM 7.1.3:
  <https://cidoc-crm.org/html/cidoc_crm_v7.1.3.html>

How these references are used:

- STAC is the storage and search contract. Item top-level `geometry`, `bbox`,
  `collection`, `links`, `assets`, and temporal properties stay authoritative.
- STAC extensions are preferred for technical geospatial metadata where a shared
  extension exists.
- SKOS informs stable concept IDs, labels, aliases, and broader/narrower search
  expansion. It does not require storing every label as a new STAC field.
- CIDOC CRM is used as a cultural-heritage sanity check: identifiers, names,
  free notes, and type classifications should not be collapsed into one string.

Internal evidence:

- Live local STAC API snapshot: 30 Items, 10 Collections.
- `docs/stac_metadata_design_v4.md`
- `docs/autofill_pipeline_spec.md`
- `sams-api/sams/routers/upload.py`
- `sams-api/sams/routers/items.py`
- `frontend/src/pages/Explorer.jsx`
- `frontend/src/features/detail/buildDetailMetadata.js`
- `frontend/src/features/items/getProjectContext.js`
- `frontend/src/features/items/getItemStatus.js`
- `frontend/src/features/items/getDisplayLabel.js`

## Live Snapshot

### Collections

Local SAMS API reported 10 Collections.

| Field surface | Count | Notes |
| --- | ---: | --- |
| top-level `id`, `type`, `links`, `title`, `extent`, `license`, `description`, `stac_version` | 10 | STAC Collection core surface |
| `summaries` | 6 | Project-managed Collections only |
| `summaries.sams:status` | 6 | active project state |
| `summaries.project:site` | 6 | human site label |
| `summaries.project:client` | 6 | project context |
| `summaries.project:default_epsg` | 6 | inherited Item default |
| `summaries.expected_deliverables` | 5 | dashboard/planning context |

Observed Collection site labels include `서강대교`, `경주 불국사`, `본기숙사`,
`성수(삼양)`, `성수`, and `을지로`. Three upload Collections currently have no
site/status summaries.

### Items

Local stac-fastapi reported 30 Items.

| Surface | Count |
| --- | ---: |
| top-level `id`, `bbox`, `type`, `links`, `assets`, `geometry`, `collection`, `properties`, `stac_version` | 30 |
| missing top-level `geometry` | 0 |
| missing top-level `bbox` | 0 |

`data_category` distribution:

| Category | Count |
| --- | ---: |
| `image` | 10 |
| `pointcloud` | 5 |
| `3d_model` | 4 |
| `orthoimage` | 3 |
| `document` | 3 |
| `video` | 3 |
| `panorama` | 2 |

Important Item property counts:

| Property | Count | Example |
| --- | ---: | --- |
| `file:size` | 30 | `531762691` |
| `description` | 30 | `서강대교_3D_2.obj` |
| `sams:status` | 30 | `draft` |
| `data_category` | 30 | `3d_model` |
| `created`, `updated` | 24 | registration timestamps |
| `datetime` | 23 | acquisition or fallback timestamp |
| `project:name` | 22 | `드론상용화` |
| `bbox_4326` | 20 | `[126.922812, 37.533535, 126.922965, 37.533661]` |
| `project:site` | 16 | `서강대교` |
| `proj:epsg` | 15 | `4326` |
| `license` | 10 | `proprietary` |
| property-level `collection` | 10 | `드론상용화` |
| `target` | 7 | `전체` |
| `document:title` | 2 | document title text |
| `document:authors` | 2 | author text |
| `document:pages` | 1 | `156` |
| `document:format` | 1 | `pdf` |
| `document:type` | 0 | not yet populated |
| `sams:site_concept` | 0 | not yet populated |
| `sams:target_concept` | 0 | not yet populated |
| `sams:category_concept` | 0 | not yet populated |

Observed relation links:

| Link rel | Count | Role |
| --- | ---: | --- |
| `collection`, `parent`, `root`, `self` | 30 each | STAC navigation |
| `derived_from`, `has_derived` | 3 each | derivation lineage |
| `describes`, `describedby` | 3 each | document/reference relation |
| `prev`, `next` | 1 each | time series |

## Field Role Taxonomy

| Role | Meaning | Default action |
| --- | --- | --- |
| STAC core | Required or common STAC search/navigation field | keep |
| STAC extension | Shared extension or extension-like technical metadata | keep, normalize gradually |
| SAMS operational | Workflow, publish gate, upload, UI state | keep |
| Human label/context | User-facing names and descriptions | keep as labels |
| Ontology sibling candidate | Human label needs stable ID or alias expansion | add later as sibling |
| Duplicate/normalization candidate | Same meaning exists in two places or with older naming | do not remove yet, define source of truth |
| Derived/transient | Useful for extraction or display but should not become an ontology key | derive or hide |

## Audit Decisions

| Field or group | Current role | Current consumers | Decision | Rationale |
| --- | --- | --- | --- | --- |
| top-level `id` | STAC core | STAC API, Detail, links, S3 path references | keep | Stable Item identity. Ontology IDs must not replace Item IDs. |
| top-level `collection` | STAC core | Explorer project facet, move flow, STAC relation hrefs | keep | Authoritative project grouping in STAC. |
| top-level `geometry`, `bbox` | STAC core | map position, bbox search, spatial summary | keep | All 30 live Items have both; this is the spatial index. |
| top-level `links` | STAC core/SAMS relation graph | relation overlay, Detail relations, timeline | keep | Relationship semantics are already represented as STAC link rels. Ontology should validate/label rels, not replace links. |
| top-level `assets` | STAC core | preview, download/viewer, file delivery | keep | STAC asset map is the correct place for file references. |
| `properties.datetime`, `start_datetime`, `end_datetime` | STAC temporal metadata | STAC search, Explorer date facet, timeline | keep | Core temporal search surface. Concept fields do not help here. |
| `properties.description` | human label/context | keyword search, Detail Identity, fallback label | keep | Required operational text. It can remain free text. |
| `properties.title`, `display_name`, `file:name`, `document:title`, asset `title` | human label/context | display label fallback | keep, document precedence | These are labels/appellations. Do not collapse them into concept IDs. |
| `properties.data_category` | SAMS operational category | upload validation, Explorer filter, preview policy, publish gate | keep as authoritative | Current category enum is stable and used everywhere. |
| `sams:category_concept` | ontology candidate | none | derive only for v0 | It would duplicate `data_category` until category concepts diverge from enum values. Use API/runtime mapping instead of persistence for now. |
| `properties.sams:status` | SAMS operational status | status update API, Explorer status facet, Detail status | keep as canonical | Live data has `sams:status` in all 30 Items. |
| `properties.status` | legacy/alternate status | frontend fallback only | read fallback only | Live count is 0. New writes should continue using `sams:status`. |
| Collection `summaries.sams:status` | SAMS operational status | Collection/project management | keep | Separate Collection lifecycle from Item publication status. |
| `properties.project:name` | human/project context | Detail Project, upload inheritance, S3 move context | keep | Denormalized display and workflow value. Future cleanup can derive from Collection but should not block ontology work. |
| `properties.project:site` | human site label | Detail Project, upload inheritance, project context | keep; add `sams:site_concept` later | This is the label users recognize. Concept sibling should hold stable site ID. |
| Collection `summaries.project:site` | human site label/default | upload inheritance, project context | keep; align with `sams:site_concept` later | Collection-level site is the default source for Items. |
| `properties.target` | human target label/grouping | timeline grouping, relation suggestions, Detail Project | keep; add `sams:target_concept` later | `target` is an appellation-like user label. Stable ID is needed for aliases and cross-project consistency. |
| `sams:site_concept` | ontology sibling candidate | none | add only after dry-run match confidence | Existing uploaded data has no field. Backfill should be reviewed before writes. |
| `sams:target_concept` | ontology sibling candidate | none | add only after dry-run match confidence | Same target strings can be ambiguous without site context. |
| `document:type` | document subtype | planned metadata design, currently not live | add for document Items after UI label/support | It is the right subtype field, but live count is 0 and raw display should not surprise users. |
| `document:format`, `document:pages`, `document:title`, `document:authors` | document metadata | display label, publish gate, extraction | keep | Existing document fields are useful and not replaced by `document:type`. |
| `properties.proj:epsg` | projection metadata | upload validation, publish gate, Detail type-specific display | keep; plan `proj:code` migration separately | Current code relies on `proj:epsg`. Projection extension has moved toward `proj:code`, but this is a future compatibility migration, not ontology work. |
| `properties.bbox_4326` | extraction/duplicate spatial value | upload/analysis traces, no core STAC need | normalization candidate | Top-level `bbox` is authoritative. Keep until consumers are proven not to depend on it. |
| property-level `collection` | inherited display/default | upload inheritance artifact | normalization candidate | Top-level Item `collection` is authoritative. Avoid new dependencies. |
| Item `properties.license` | inherited license/context | Detail type-specific display if not hidden | derive or keep as item override | Collection license is already present. Item property should mean an override, not automatic duplication. |
| `gsd` and `ortho:gsd` | raster resolution | Detail labels, publish gate uses `ortho:gsd` | normalize to `ortho:gsd` | Live data has both names. `ortho:gsd` should be canonical for orthoimage. |
| `pc:*` | pointcloud technical metadata | publish gate, Detail type-specific, preview decisions | keep | These are technical asset facts, not ontology concepts. |
| `3dmodel:*` | 3D model technical metadata | publish gate, Detail type-specific | keep; fix UI labels separately | Detail currently labels `model:format`, but live fields use `3dmodel:format`. |
| `image:*`, `panorama:*`, `video:*` | media technical metadata | Detail type-specific, preview decisions | keep | These are automatic extraction outputs and useful for inspection. |
| `processing:level` | process state/category | design only, low live use | keep as future operational enum | Useful later, but not needed for first ontology write. |
| `sams:location_source` | provenance | spatial confidence/display | keep | Indicates how geometry was obtained. This is provenance, not a concept. |

## What Should Not Happen Yet

Do not remove or rename current live fields as part of ontology v0.

Do not backfill `sams:site_concept` or `sams:target_concept` directly into all
existing Items until the dry-run report shows:

- matched concept ID
- source label
- confidence
- whether Collection context was used
- ambiguous candidates
- fields that would be changed

Do not persist `sams:category_concept` in v0 unless a real use case appears where
the concept ID differs from `data_category`.

Do not write `null` concept fields. If a concept is unknown, omit the field.

## Recommended Next Work

1. Add a read-only field registry derived from this document.
2. Use `POST /api/ontology/concept-write-dry-run` to review existing Item
   proposals before any persisted backfill:
   `item_id`, `collection`, `project:site`, proposed `sams:site_concept`,
   `target`, proposed `sams:target_concept`, confidence, ambiguity.
3. Add UI labels for ontology fields before any persisted concept fields appear
   in Detail.
4. Enable future uploads to store concept siblings only when confidence is high
   and the source label remains unchanged.
5. Defer cleanup of duplicate fields (`bbox_4326`, property-level `collection`,
   item-level inherited `license`, `gsd`) until after concept siblings are proven.

## Expected Effect

This audit changes the next implementation decision:

- `project:site` and `target` remain human-readable labels.
- `sams:site_concept` and `sams:target_concept` become optional stable IDs next
  to those labels, not replacements.
- `document:type` is valid and useful, but should be introduced with UI support.
- `data_category` remains the category source of truth.
- duplicate spatial/project fields are cleanup candidates, not ontology blockers.
