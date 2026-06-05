# 3D GIS Designed Beta Spec

Date: 2026-06-05

## Phase 7B Target

Phase 7B turns the existing optional pseudo-3D GIS Beta into a more deliberate "3D GIS relational asset map" design while preserving the current frontend architecture.

It is still a Beta. It is not a production 3D renderer and does not load point clouds, 3D Tiles, 3D models, PDFs, panoramas, or production video viewers.

## 2D Default / 3D Beta Structure

Explorer remains:

- default: `2D 지도`
- optional: `3D GIS Beta`

The 3D Beta is selected by `ExplorerViewToggle` only. It must not become the route/query default and must not replace the 2D map/list/filter flow.

Both views share:

- `visibleItems`
- selected Item
- Context Panel
- relation overlay enabled state
- selected Item 1-depth relation overlay model
- ViewerShell action path

## 3D GIS Screen Composition

The Phase 7B screen should contain:

1. pseudo-3D spatial surface
2. Beta badge
3. asset marker/card layer
4. selected Item focus card/pin
5. hover tooltip
6. relation SVG overlay when enabled
7. category/status/relation legend
8. missing target warning when applicable
9. empty state
10. reset view control

The result list and filters remain owned by the existing Explorer sidebar.

## Node / Card / Marker Policy

Each visible Item with a map position becomes one scene marker.

Marker requirements:

- stays button-based for click and keyboard access.
- uses category-specific shape, icon, color, and height.
- shows selected state more strongly than related state.
- uses related state only when relation overlay is enabled.
- avoids long always-visible labels in the scene.
- shows readable label in hover tooltip and selected focus card.

## Category Shape / Color / Height / Icon Policy

Use existing category colors and icons as the source of truth. Phase 7B can add shape and height semantics on top:

| data_category | Shape direction | Height direction | Meaning |
| --- | --- | --- | --- |
| `pointcloud` | tall scan tower | tallest | dense spatial survey source |
| `3d_model` | block/model prism | high | model or mesh asset |
| `3d_tiles` | stacked tile block | high | tileset/geospatial 3D asset |
| `orthoimage` | flat map plate | low and wide | aerial/orthographic raster |
| `image` | photo card | low | image set or photo asset |
| `panorama` | rounded dome/card | medium | 360 capture |
| `video` | media card | medium-low | time-based visual media |
| `document` | small document sheet | lowest | non-spatial or supporting document |

If a shape cannot be made clearly with CSS in Phase 7B, keep the shape simple and prioritize readability.

## Draft / Status / Project Policy

Status and Draft must be visible without opening Detail:

- `draft`: warning badge/ring.
- `published`: normal category emphasis.
- `archived`: muted marker.
- `unknown`: neutral marker.

Project context policy:

- always keep full project detail in list and Context Panel.
- show project/site chip only in tooltip and selected focus card.
- do not put long project names on every scene node.

## Relation Line / Legend Policy

Relations stay selected Item scoped.

Rules:

- no selected Item: no relation overlay.
- overlay off: no relation lines.
- overlay on: only selected Item 1-depth visible relations draw lines.
- missing targets are warning rows, not fake scene nodes.
- global all-Item relation graph is forbidden in Explorer.

Relation line design:

- `derived_from`: strongest directional lineage line.
- `related`: softer dashed association line.
- `describedby` / `describes`: document relation line.
- `prev` / `next`: temporal relation line.

Legend must show:

- category visual key.
- status/Draft key.
- active relation style key.
- missing target warning meaning when present.

## Hover Tooltip Policy

Hover tooltip should show:

- display label
- data category
- status
- project/site
- position source when useful: geometry, bbox, fallback
- relation count summary when overlay is enabled

Tooltip must not replace the Context Panel. It is for quick scanning.

## Click Pin / Focus Policy

Clicking a marker:

- calls the same `onSelectItem(item)` flow used by the 2D map/list.
- opens or updates the Context Panel.
- shows selected focus styling in the 3D scene.
- may show a compact selected focus card near the marker.

Clicking the selected marker again may keep the existing toggle-off behavior unless Phase 7B explicitly changes it. If changed, document the selection behavior in the result doc.

## Context Panel Integration

The Context Panel remains the authoritative selected Item detail surface.

It continues to own:

- identity and human-readable label
- project/status/Draft details
- metadata gaps
- preview action
- relation summary and overlay toggle
- Detail handoff

The 3D scene should reinforce selected context, not duplicate the full panel.

## Relation Overlay Toggle Policy

The relation overlay toggle remains controlled from the Context Panel.

Phase 7B can improve visual feedback in the 3D scene, but must keep these semantics:

- no relation Item: toggle disabled as `관계 없음`.
- relation-rich Item: toggle can show/hide selected Item relations.
- selected Item change updates overlay to the new Item.
- filter/search removal clears panel and overlay.
- no global graph board.

## Empty State Policy

When `visibleItems.length === 0`, show:

- `검색 결과 없음`
- short hint that filters/search can be cleared
- no relation lines
- no stale selected focus

## Performance Guardrail

Phase 7B should remain mock-verifiable and lightweight:

- no new dependency.
- no package or lockfile change.
- no heavy viewer load.
- no always-on global relation graph.
- render only current `visibleItems`.
- render only selected Item 1-depth relations.
- avoid expensive layout loops in render.

If the visible Item count grows beyond comfortable DOM rendering, that is a renderer migration signal, not a reason to add a global graph.

## Accessibility / Keyboard Minimum

Phase 7B minimum:

- markers remain real buttons.
- hover tooltip content should also be reachable through focus.
- selected marker has clear focus styling.
- reset view is a real button.
- legend and warning text are readable without relying on color only.
- button labels should expose display label and status through `aria-label` or equivalent.

## Implement In Phase 7B

- designed marker/card variants.
- category/status/Draft visual language polish.
- full legend improvement.
- custom hover/focus tooltip.
- selected Item focus card/pin.
- relation line and related highlight polish.
- missing target warning polish.
- reset view control for local UI state.
- preserve Context Panel integration.
- preserve 2D default and 3D optional toggle.

## Move To Phase 7C Or Later

- real 3D engine.
- deck.gl, three.js, or Cesium migration.
- real camera/zoom/drag/orbit.
- real pointcloud/3D Tiles/3D model viewer.
- terrain/globe.
- multi-hop relation graph.
- relation authoring.
- backend relation query expansion.
