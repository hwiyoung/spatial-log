# Explorer 3D GIS Beta Spec

Date: 2026-06-04

## Phase 5 Goal

Phase 5 adds an optional 3D GIS Beta view that reuses the Explorer screen contracts already proven in 2D:

- `visibleItems`
- filters
- selected Item
- Context Panel
- selected relation overlay model

The 2D map/list Explorer remains the default.

## 2D Default / 3D Beta Selection

Explorer provides a `2D map` / `3D GIS Beta` toggle.

- Default is always `2D map`.
- `3D GIS Beta` is opt-in local UI state.
- Returning to `2D map` must preserve filters, list, selection, and Context Panel behavior.
- The route/query default must not make 3D the operational default.

## 3D Beta Information Structure

The Beta view contains:

1. pseudo-3D spatial surface
2. category/status differentiated asset columns
3. selected Item emphasis
4. related Item emphasis when relation overlay is enabled
5. relation line/legend/warning when relation overlay is enabled
6. empty state for zero visible Items
7. Beta badge

The result list and filters remain in the existing left sidebar.

## visibleItems To 3D Asset Layer

The 3D Beta receives the same `visibleItems` used by the 2D map and list.

Each visible Item becomes one pseudo-3D asset when `getItemMapPosition(item)` can resolve a location. The mock fixture currently resolves all 24 Items.

## Data Category Display

Category color/icon uses the existing `getCategoryInfo()` policy.

Height is approximate:

- pointcloud: tallest column
- 3D model / 3D Tiles: high column
- panorama / video: medium column
- image / orthoimage: low plate
- document: small card

This is not a real viewer or a real 3D asset renderer.

## Status / Draft / Project Meaning

Status semantics remain shared with Phase 2:

- Draft: warning status ring
- Published: category/status normal ring
- Archived: muted ring
- Unknown: neutral ring

Project meaning stays in the list and Context Panel. The 3D Beta does not place long project labels directly in the scene.

## selectedItem / Context Panel Reuse

Clicking a 3D Beta asset calls the same `onSelectItem(item)` flow used by 2D markers and list rows.

The existing Context Panel opens for the selected Item. Selection is shared across 2D and 3D views.

## Selected Relation Overlay Reuse

The 3D Beta consumes the same `relationOverlayModel` used by the 2D relation overlay.

When overlay is enabled:

- visible relations become SVG lines in the pseudo-3D surface
- related visible assets receive a highlight
- missing targets show a warning
- global graph board is not shown

## Geometry / BBox / Fallback Policy

3D Beta location uses the Phase 1 helper chain:

1. geometry center
2. bbox center
3. `properties["mock:fallback_center"]`

No new placement schema is introduced.

## Loading / Empty / Error / Unsupported

Loading remains owned by Explorer.

Empty state:

- if `visibleItems.length === 0`, the 3D Beta shows `검색 결과 없음`.

Unsupported state:

- real heavy viewers are unsupported in Phase 5.
- unsupported assets still appear as pseudo-3D markers/cards when they have a map position.

## Not In Phase 5

- Relationship Graph as Explorer default
- global relationship graph
- real 3D Tiles renderer
- real point cloud renderer
- real 3D model renderer
- panorama/video/document viewer
- DB/API schema changes
- new renderer dependency

## Hand Off To Phase 6

Phase 6 should define viewer contracts for real asset previews and viewers. It can replace category placeholders with real viewer entry points without changing the Explorer filter/selection/context contracts.
