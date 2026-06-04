# Explorer Context Panel Spec

Date: 2026-06-04

## Phase 3 Goal

Phase 3 turns the right-side Explorer panel into a details-on-demand surface. A user can click a map marker or list row and understand the selected Item's preview, identity, project, status, metadata quality, spatial state, and relation summary without leaving Explorer.

Explorer remains a spatial asset discovery screen. Phase 3 does not promote Relationship Graph Beta to the Explorer default view, does not draw relation overlay lines, does not add 3D GIS, and does not change DB/API schema.

## Panel Information Structure

The panel is organized as:

1. Preview summary
2. Identity
3. Project / Status
4. Metadata quality
5. Spatial summary
6. Relation summary
7. Action footer

The existing 2D map, list, filter, and selected Item state remain the primary Explorer workflow.

## Preview Summary Policy

Preview status is normalized to:

- `available`
- `pending`
- `missing`
- `failed`

The panel shows a mock preview card rather than a real viewer.

- `available`: show a thumbnail when available, otherwise show an available placeholder.
- `pending`: show `Preview pending`.
- `missing`: show `Preview missing`.
- `failed`: show `Preview failed`; show `previewFailureReason` when present.

Category-specific preview labels:

- `pointcloud`: `Point cloud preview`
- `3d_model`: `3D model preview`
- `3d_tiles`: `3D Tiles preview`
- `orthoimage`: `Image preview`
- `image`: `Image preview`
- `panorama`: `Panorama preview`
- `video`: `Video preview`
- `document`: `Document preview`

## Identity / Filename / Project / Site Policy

Identity uses the Phase 2 display label policy:

1. `properties.title`
2. `properties.display_name`
3. `properties["document:title"]`
4. first asset title
5. `properties.description`
6. original filename
7. Item id

The panel also shows:

- Item ID
- original filename
- file size
- category-specific counts when available
- project name
- site
- collection ID
- campaign/target when present

## Status / Draft Reason / Metadata Gap Policy

Status uses the Phase 2 canonical status helper:

- `draft`
- `published`
- `archived`
- `unknown`

Draft Items must show `Draft reason` prominently.

Metadata quality displays:

- `draftReason`
- `missingRequiredFields`
- `metadataGaps`
- `previewFailureReason`

Published Items do not show a Draft-specific warning unless a fixture explicitly has draft fields. If a published Item has metadata gaps, the panel still shows the gap list as a quality warning.

## Spatial Summary Policy

The panel mirrors the same marker policy used by the map:

- `Geometry available`: valid geometry can produce a marker.
- `BBox-derived location`: no geometry marker, but bbox center is usable.
- `Fallback project location`: no geometry/bbox, but `properties["mock:fallback_center"]` is available.
- `No spatial marker`: no usable geometry, bbox, or fallback marker.

The panel can show bbox and marker center values for verification, but it must not introduce new map placement behavior.

## Relation Summary Policy

Phase 3 shows relation counts only. It does not render relation overlay lines and does not open a global relationship graph.

The summary includes:

- total relation count
- per-rel count for `derived_from`, `related`, `describedby`, `describes`, `prev`, `next`
- missing target count
- missing target IDs, collapsed when long

Relation data can come from `mockRelations` in mock mode or from STAC `item.links` when relation records are not provided.

## Action Button Policy

The footer keeps `상세 보기 ->`.

In mock mode, the button keeps the existing Detail route handoff. Detail mock routing is not part of Phase 3, so route limitations are documented in the result file.

Draft Items show a disabled `메타데이터 보완` CTA. It communicates the expected later workflow without implementing an edit form.

Project-assigned Items can show a disabled `프로젝트 보기` CTA until a real Project route contract is connected.

## Mock Mode And Real API Mode

Mock mode:

- uses local fixtures for Items, Collections, previews, and relation records
- shows relation summary from `mockRelations`
- validates preview/spatial/metadata edge cases without backend data

Real API mode:

- keeps the same panel sections
- falls back to `item.links` when relation records are not provided
- keeps deletion behavior available in the existing non-mock flow
- does not require DB/API schema changes in Phase 3

## Not In Phase 3

- Relationship Graph as Explorer default
- selected relation overlay lines
- global graph board
- 3D GIS Beta
- real 3D Tiles, point cloud, model, panorama, video, or document viewers
- real metadata edit form
- DB/API schema changes

## Hand Off To Phase 4

Phase 4 should implement selected Item relation overlay only:

- one-depth relation lines or related highlights
- rel legend
- missing target warning policy on the map
- no global graph-first Explorer view

## Hand Off To Phase 6

Phase 6 should replace mock preview cards with category-aware viewer contracts:

- point cloud viewer
- 3D model viewer
- 3D Tiles viewer
- image/ortho preview
- panorama viewer
- video preview
- document preview
