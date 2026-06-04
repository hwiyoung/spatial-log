# Relation Overlay Policy

Date: 2026-06-04

## Phase 4 Goal

Phase 4 adds a selected Item relation overlay to Explorer's existing 2D asset map. It shows only the selected Item's 1-depth relation lines and related marker highlights.

Explorer remains a spatial asset discovery surface. This phase does not introduce a global Relationship Graph, 3D GIS, real viewers, or DB/API schema changes.

## Selected Item 1-Depth Principle

The overlay is always scoped to the current `selectedItem`.

- If no Item is selected, no relation overlay is shown.
- If overlay toggle is off, no relation overlay is shown.
- If an Item is selected, only relations where the selected Item is the source or target are considered.
- Relations between unrelated Items are never drawn.
- All Item global graph layouts remain out of scope.

## Visible Target Line Policy

Lines are drawn only when the related Item is in the current `visibleItems` result set and both endpoints have a usable map position.

Usable map position follows the Phase 1 policy:

1. geometry-derived center
2. bbox-derived center
3. `properties["mock:fallback_center"]`

The overlay must not create fake markers or lines for targets outside the current search result.

## Missing Target Warning Policy

When the selected Item has a relation whose counterpart is outside the current `visibleItems` result set, the relation is recorded as a missing target.

Missing targets are shown as warnings:

- in the Context Panel relation summary
- in the map overlay warning box when overlay is enabled

Missing target warnings include count and target IDs. They do not create map markers.

## Relation Style Policy

Supported rel values:

- `derived_from`: directional solid line
- `related`: weak dashed line
- `describedby`: document relation dashed line
- `describes`: document relation dashed line
- `prev`: temporal dashed line
- `next`: temporal dashed line

The first implementation preserves direction in the overlay model and line label text. If arrow rendering is not reliable in MapLibre, the legend and label remain the authoritative direction/rel explanation.

## Related Marker Highlight Policy

The selected marker keeps the existing selected emphasis.

Related markers receive a secondary highlight when overlay is enabled:

- relation-colored marker border
- subtle outer ring
- smaller scale than the selected marker

Missing targets do not receive highlights because they are not visible map Items.

## Overlay Toggle Policy

The Context Panel relation CTA controls the map overlay.

- Items with no relations show `관계 없음` and keep the CTA disabled.
- Items with relations can toggle `지도에서 관계 보기` on and off.
- When overlay is enabled and a new relation-rich Item is selected, the overlay updates to the new selected Item.
- When selected Item disappears because of filters or search, the panel and overlay are cleared.
- When the selected Item has no relations, overlay is turned off.

## Context Panel Synchronization

The Context Panel relation summary and map overlay use the same relation source:

- mock mode: `mockRelations`
- real API mode fallback: selected Item `links`

The panel summary shows relation counts. The overlay model decides which of those relations can become map lines based on `visibleItems` and map positions.

## Not In Phase 4

- Relationship Graph as Explorer default
- global relationship graph board
- always-on all-Item relation rendering
- relation lines for targets outside current results
- 3D GIS Beta
- real 3D Tiles, point cloud, model, panorama, video, or document viewers
- DB/API schema changes

## Hand Off To Phase 5

Phase 5 can reuse the selected relation overlay model in an optional 3D GIS Beta surface. The 2D map remains the default Explorer view.

## Hand Off To Phase 6

Phase 6 can connect real preview/viewer contracts for heavy asset categories. Relation overlay styling and selected Item context should remain independent of viewer implementation.
