# Current Semantic Inventory

This inventory records semantic values already used by SAMS documents and code.
It is descriptive, not a new runtime contract by itself. The evidence-backed
Phase 1 drift analysis lives in `docs/ontology/phase1_semantic_audit.md`.

## Asset Categories

Source field: `properties.data_category`

Current values:

| Value | Meaning | Current Usage |
| --- | --- | --- |
| `pointcloud` | Point cloud data such as LAS, LAZ, E57, PCD, XYZ, PTS | upload detection, extraction, Explorer filters, preview contract, Project counts |
| `3d_model` | Mesh/model data such as OBJ, FBX, GLTF, GLB, STL, DAE, PLY | upload detection, extraction, preview contract, derivation suggestions |
| `3d_tiles` | OGC 3D Tiles bundle | upload bundle detection, extraction, preview/viewer-needed state |
| `orthoimage` | Orthophoto/GeoTIFF-style raster output | extraction, map/preview contract |
| `image` | Original image or image set | EXIF/GPS extraction, thumbnail, derivation suggestions |
| `panorama` | Panorama imagery | preview contract |
| `video` | Video asset | ffprobe extraction, preview contract |
| `document` | PDF/DOC/HWP/etc. documentation | metadata extraction, describedby suggestions |
| `unknown` | Fallback when category cannot be detected | UI/manual completion fallback |

## Broader Category Groups Needed

These are not current STAC values. They are v0 grouping concepts for search
expansion and UI filtering.

| Concept ID | Includes | Why |
| --- | --- | --- |
| `spatial_asset` | all categories with spatial footprint or manual location | Explorer is a spatial asset discovery surface |
| `three_dimensional_asset` | `pointcloud`, `3d_model`, `3d_tiles` | "3D data" is a user-facing search/filter intent |
| `raster_asset` | `orthoimage`, `image`, `panorama`, `video` | visual media and image-derived assets often share preview/search needs |
| `documentation_asset` | `document` | document subtyping should not pollute core asset category enum |
| `derived_asset` | context-dependent: `3d_model`, `3d_tiles`, preview/converted assets | processing lineage and suggestion rules |

## Relation Types

Source field: `links[].rel`

| Rel | Direction | Inverse | Meaning |
| --- | --- | --- | --- |
| `derived_from` | source item points to input/origin item | `has_derived` | source item was produced from target item |
| `has_derived` | source item points to derived output item | `derived_from` | source item has a derived child |
| `related` | symmetric | `related` | related or jointly acquired item |
| `describedby` | source item points to document | `describes` | target document describes source item |
| `describes` | document points to described item | `describedby` | source document describes target item |
| `prev` | source item points to previous time point | `next` | previous item for same target/time series |
| `next` | source item points to next time point | `prev` | next item for same target/time series |

System STAC links such as `self`, `root`, `parent`, `collection`, `item`, `items`,
and `license` remain outside the user relation vocabulary.

## Status Values

Current fields:

- STAC design document mentions `properties.status`.
- Runtime code primarily uses `properties.sams:status`.

Current values:

| Value | Meaning |
| --- | --- |
| `draft` | registered but incomplete or needing review |
| `published` | usable/searchable item after required-field gate |
| `archived` | preserved but not active |

Collection status values:

| Value | Meaning |
| --- | --- |
| `planning` | project preparation |
| `active` | registration in progress |
| `completed` | registration complete |
| `archived` | long-term archive |

## Processing Levels

Source field: `properties.processing:level`

| Value | Meaning |
| --- | --- |
| `raw` | original or minimally touched input |
| `processed` | processed but not necessarily final |
| `derived` | produced from other asset(s) |
| `final` | final deliverable |

## Target And Site Semantics

Current fields:

- `properties.project:site`
- `properties.target`
- Collection `project:site`
- Collection `id`, `title`, and `extent`

Current behavior:

- Site is inherited from Collection when possible.
- Target may come from user input, filename keyword, or folder name.
- Timeline currently uses same `target + data_category` plus `prev/next` links.

v0 gap:

- No stable target concept ID.
- No alias list for targets.
- No distinction between physical target, project site, survey campaign, and file
  naming keyword.

## Document Type Gap

Current category `document` is too broad for relation/search quality. v0 should
support subtypes without changing `properties.data_category`.

Initial subtype candidates:

| Concept ID | Meaning |
| --- | --- |
| `survey_report` | survey or investigation report |
| `excavation_report` | excavation report |
| `analysis` | analysis document |
| `permit` | permit or administrative approval |
| `plan` | plan document |
| `drawing` | CAD, measured drawing, or plan |
| `bibliography` | bibliography or reference list |
| `specification` | specification document |
| `meeting_minutes` | meeting minutes |
| `photograph_log` | photograph log |
| `quality_report` | QA/QC or accuracy report, SAMS extension candidate |
| `delivery_manifest` | delivery list, handover package, or inventory, SAMS extension candidate |
| `unknown_document` | known document asset with unknown subtype |

## Existing Auto-Suggestion Rules

Current upload suggestion logic:

| Condition | Suggested relation | Approx confidence |
| --- | --- | --- |
| same target, `pointcloud` and `3d_model` | `3d_model derived_from pointcloud` | 0.7 plus target-source adjustment |
| same target, `image` and `3d_model` | `3d_model derived_from image` | 0.7 plus target-source adjustment |
| same target, `3d_model` and `3d_tiles` | `3d_tiles derived_from 3d_model` | 0.7 plus target-source adjustment |
| same target, other different categories | `related` | 0.8 plus target-source adjustment |
| any `document` and non-document item in same batch | `describedby` | 0.5 |

Target-source confidence adjustment:

| Source | Adjustment |
| --- | --- |
| user-entered target | +0.15 |
| filename keyword | 0 |
| folder name | -0.1 |

## Immediate Risks If Not Centralized

- Category grouping logic will diverge between UI, API, and upload suggestion code.
- Alias handling will be reimplemented separately for search and upload.
- Relation label/inverse behavior can drift between frontend and backend.
- New asset categories will require code changes in too many places.
- 3D relationship view can show technically correct lines with weak domain meaning.
