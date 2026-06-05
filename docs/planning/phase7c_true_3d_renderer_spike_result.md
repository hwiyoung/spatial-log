# Phase 7C True 3D Renderer Spike Result

Date: 2026-06-05

## Implementation Summary

Phase 7C adds a Three.js true 3D renderer spike for the optional 3D GIS Beta.

Implemented:

- `True 3D spike` renderer mode inside 3D GIS Beta.
- existing `Pseudo fallback` renderer mode remains available.
- canvas-based WebGL scene.
- perspective camera.
- drag orbit.
- wheel zoom.
- keyboard rotate/zoom/reset fallback.
- reset camera control.
- category-specific 3D asset geometry.
- selected asset focus highlight.
- related asset relation-colored highlight.
- raycast hover tooltip.
- raycast click selection using the existing Explorer `onSelectItem(item)` flow.
- selected Item 1-depth relation lines using `relationOverlayModel.visibleRelations`.
- missing target warning without fake nodes.
- helper validation for item count, filters, zSource distribution, and relation count.

Not implemented:

- production 3D GIS migration.
- production pointcloud, 3D Tiles, or model viewer.
- deck.gl, Cesium, Potree, model-viewer, `@react-three/fiber`, or drei.
- backend/API/schema change.
- global Relationship Graph.
- all-Item relation rendering.
- multi-hop relation rendering.

## Renderer Choice

Phase 7C uses Three.js because it is the smallest acceptable true 3D renderer spike path for:

- perspective camera.
- orbit-like drag.
- wheel zoom.
- ray picking.
- custom category geometry.

The existing React/CSS/SVG pseudo-3D renderer remains as fallback and comparison.

## Dependency / Package Changes

Added:

- `three`

Package files:

- `frontend/package.json` adds `three`.
- `frontend/package-lock.json` is created by npm because the frontend package did not have a lockfile before Phase 7C.

No other dependency is added.

The build now emits a larger app chunk, which is expected for an un-split spike. Phase 7D or a renderer migration phase should decide whether to code-split or gate the true 3D renderer.

## True 3D Scene Structure

New code is isolated under:

- `frontend/src/features/explorer-3d-three/`

Scene pieces:

- WebGL canvas.
- ambient and directional lights.
- ground grid and fog/depth cues.
- asset object group.
- selected relation line group.
- DOM overlays for controls, legend, focus card, tooltip, and warning text.

Explorer still owns:

- 2D default view.
- selected Item state.
- Context Panel.
- relation overlay enabled state.
- ViewerShell flow.

## Camera / Orbit / Zoom / Reset

Behavior:

- drag rotates the camera around the constellation.
- wheel adjusts camera radius.
- keyboard arrows rotate.
- `+` / `-` zoom.
- `0` resets.
- Reset view button clears local focus centering and returns camera to the spatial layout.

Reset does not clear the selected Item or Context Panel.

## Asset Geometry / Category Policy

| data_category | Geometry |
| --- | --- |
| `pointcloud` | tower with particle-like points |
| `3d_model` | prism/block |
| `3d_tiles` | stacked block layers |
| `orthoimage` | flat map plate |
| `image` | photo card plane |
| `panorama` | dome |
| `video` | media card plane |
| `document` | document sheet |

Status and selection:

- Draft: warning marker.
- Published: category-first material.
- Archived: muted opacity.
- Unknown: neutral category fallback.
- Selected: strong blue focus ring.
- Related: relation-colored ring.
- Unrelated assets dim when selected relation overlay is enabled.

## Z / Elevation Policy

The Three renderer reuses the Phase 7B zSource priority:

1. `bbox-z`
2. `property-elevation`
3. `visual-layer`

Three.js mapping:

- XY is normalized from the current `visibleItems` extent.
- Y is lifted by actual elevation when available.
- category visual layer height remains separate from actual elevation.
- same/near position assets receive small stacking offsets.

Helper validation result:

```json
{
  "zSourceDistribution": {
    "property-elevation": 4,
    "visual-layer": 20
  }
}
```

No mock fixture currently uses 6-value bbox because existing map helpers still assume 4-value bbox ordering.

## Hover / Click / Selection

Hover:

- uses Three.js raycasting.
- shows existing `Explorer3dTooltip`.
- does not change selected Item.

Click:

- uses raycast target.
- calls existing `onSelectItem(item)`.
- preserves Context Panel integration.
- selected focus card updates from the shared 3D summary helper.

## Relation Lines

Relation rendering uses only:

- `relationOverlayModel.visibleRelations`

It does not read or draw all `mockRelations` directly.

Line policy:

- relation type color/dash follows Phase 4 `relationStyles`.
- source endpoint is white.
- target endpoint is relation-colored.
- missing targets are warnings only.

Helper validation result for relation-rich selected Item:

```json
{
  "relationRichSelectedItem": "bulguksa-pointcloud-dabotap",
  "visibleRelationCount": 3,
  "missingTargetCount": 2
}
```

## Pseudo-3D 대비 개선점

Improved:

- real perspective depth.
- camera orbit.
- wheel zoom.
- raycast hover/click picking.
- true 3D object geometry.
- actual elevation and visual layer separation is easier to see.

Still limited:

- no production GIS projection.
- no map-synchronized camera.
- no label collision system.
- no real pointcloud, 3D Tiles, or model renderer.
- accessibility remains spike-level compared with DOM button markers.

## Screen Check Method

Open:

```text
http://localhost:13000/?mock=1
http://localhost:17800/?mock=1
```

Checks:

- Confirm default view is `2D 지도`.
- Toggle `3D GIS Beta`.
- Confirm `True 3D spike` is active.
- Drag canvas to orbit.
- Wheel zoom.
- Reset view.
- Hover assets for tooltip.
- Click an asset and confirm Context Panel.
- Enable `선택 관계 보기` from Context Panel.
- Confirm only selected Item 1-depth relation lines.
- Switch to `Pseudo fallback` for comparison.

## Manual Click Test Result

`docs/qa/manual_click_test_scenarios.md` now includes Phase 7C manual checks.

Manual browser execution remains a human QA step. Helper validation and Docker build were run in this phase.

## Build / Docker Verification

Docker Compose status:

```text
docker compose ps
```

Result:

- frontend, API, STAC API, db, redis, minio, nginx, and worker containers were running.

Frontend build:

```text
docker compose exec -T frontend npm run build -- --outDir /tmp/spatial-log-frontend-build --emptyOutDir
```

Result:

- Pass.
- 170 modules transformed.
- emitted JS chunk: `1,728.29 kB`, gzip `474.64 kB`.
- Vite warns that the app chunk is larger than 500 kB after minification.
- the dynamic/static import warning for `src/services/api.js` remains existing behavior.

Helper validation:

```json
{
  "allThreeAssets": 24,
  "draftThreeAssets": 9,
  "seongsuThreeAssets": 8,
  "noResultThreeAssets": 0,
  "zSourceDistribution": {
    "property-elevation": 4,
    "visual-layer": 20
  },
  "relationRichSelectedItem": "bulguksa-pointcloud-dabotap",
  "visibleRelationCount": 3,
  "missingTargetCount": 2
}
```

Diff/package checks:

- `git diff --check`: Pass for tracked diff.
- explicit trailing whitespace scan for new files: Pass.
- package guardrail: `three` is present and forbidden renderer dependencies are absent.
- `frontend/package-lock.json` is expected because npm created it while adding `three`.

## Phase 7D / Later 판단

Proceed to Phase 7D if product review agrees that true 3D interaction improves the selected Asset Constellation.

Phase 7D should address:

- 3D model boundary.
- drone coverage.
- scale/LOD display rules.

Phase 7E should address:

- richer relation highlights.
- time-series highlights.

Phase 10D / 10E should address:

- GIS format automatic classification.
- parsing failure diagnostics.
- upload/metadata extraction handoff.

## Remaining Issues

- bundle growth from direct Three.js import.
- WebGL accessibility is weaker than DOM pseudo-3D.
- no automated browser interaction test was added.
- no production map camera synchronization.
- no real renderer for pointcloud, 3D Tiles, or models.
