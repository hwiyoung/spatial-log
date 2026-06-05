# Three GIS Constellation Spike Spec

Date: 2026-06-05

## Goal

Phase 7C adds a true 3D renderer spike for the optional 3D GIS Beta. The target screen is a selected Item centered 3D Asset Constellation that can validate depth, elevation, orbit, zoom, hover picking, click selection, and selected 1-depth relation lines.

This is not a production renderer migration.

## Scene Structure

The scene contains:

- WebGL canvas.
- perspective camera.
- ground grid.
- light/fog/depth cues.
- asset object group.
- selected Item 1-depth relation line group.
- DOM overlays for controls, legend, focus card, tooltip, and warnings.

Explorer continues to own:

- current result set.
- selected Item.
- Context Panel.
- selected relation overlay model.
- ViewerShell flow.

## Camera / Orbit / Zoom / Reset

Camera policy:

- use a perspective camera.
- initial camera shows the visible asset extent.
- drag rotates the camera around the scene target.
- wheel zoom adjusts camera radius.
- keyboard arrows rotate the camera.
- `+`, `-`, and `0` provide keyboard zoom/reset fallback.
- Reset camera clears local focus centering but does not clear Explorer selected Item.

## Asset Object Design

Each visible Item with a usable map position becomes one Three.js object. The object is a category marker, not a production viewer.

Always-visible labels are avoided. Label and metadata appear in hover tooltip and selected focus card.

## Category Geometry

| data_category | Spike geometry | Meaning |
| --- | --- | --- |
| `pointcloud` | point cloud tower / particle-like column | dense volumetric scan |
| `3d_model` | box/prism | model or mesh |
| `3d_tiles` | stacked tile blocks | tiled 3D geospatial context |
| `orthoimage` | flat map plane | ortho raster footprint |
| `image` | photo card plane | still image set |
| `panorama` | sphere/dome | 360 capture |
| `video` | media plane | time-based media |
| `document` | document sheet | supporting document |

Draft/status/project meaning:

- Draft: warning marker/accent.
- Published: category-first material.
- Archived: muted opacity.
- Unknown: neutral styling.
- Selected: strong focus ring.
- Related: relation-colored highlight.

## Z / Elevation Policy

The Three renderer reuses the Phase 7B elevation priority:

1. 6-value bbox as `bbox-z`.
2. elevation-like properties as `property-elevation`.
3. category visual height as `visual-layer`.

The renderer separates:

- actual elevation source: lifted by bbox/property value.
- visual layer source: lifted by category semantics.

The tooltip and focus card show the zSource meaning.

## Selected Focus

When an Item is selected:

- the scene can center that Item by shifting the local constellation.
- the selected object receives the strongest ring.
- the selected focus card remains a compact scene overlay.
- Context Panel remains the authoritative detail view.

Reset view disables local focus centering but keeps the selected Item state.

## Hover Tooltip

Ray picking identifies hovered assets.

Tooltip shows:

- display label.
- data category.
- project.
- status.
- preview status.
- relation count.
- zSource and elevation detail.

Hover never changes selection.

## Relation Lines

Rules:

- draw only when relation overlay is enabled.
- draw only `relationOverlayModel.visibleRelations`.
- do not draw all relation records.
- do not draw multi-hop relations.
- do not create fake nodes for missing targets.

Line policy:

- relation type color/dash follows Phase 4 `relationStyles`.
- line endpoint markers show relation source and target.
- missing targets are shown as warning text in overlays/legend.

## Fallback

If WebGL creation fails:

- switch to pseudo-3D fallback.
- keep selected Item and Context Panel state.
- keep 2D map/list as Explorer default.

## Phase 7D Handoff

Move these items to Phase 7D:

- 3D model boundary/footprint visualization.
- drone data coverage footprint.
- scale/LOD-based asset display.
- true map/camera extent coordination.

## Phase 7E Handoff

Move these items to Phase 7E:

- richer relation highlight choreography.
- time-series highlight and prev/next animation.
- temporal layer controls.

## Phase 10D / 10E Handoff

Move these items to Upload/Metadata phases:

- GIS format automatic classification.
- upload parsing failure reason display.
- metadata extraction diagnostics.
- backend preview generation or signed delivery policy.

## Not In Phase 7C

- production 3D GIS renderer migration.
- production pointcloud/3D Tiles/model viewer.
- PDF/video/panorama viewer integration.
- backend/API/schema changes.
- global Relationship Graph.
- all-Item relation graph.
