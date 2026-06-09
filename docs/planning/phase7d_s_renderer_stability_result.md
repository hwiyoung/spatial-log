# Phase 7D-S Map-Grounded Renderer Stability Result

Date: 2026-06-05

## Change Summary

Phase 7D-S stabilizes the MapLibre custom layer + Three.js map-grounded renderer.

Implemented:

- removed repaint request from custom layer `render()`.
- added scene signature guard to avoid unnecessary full rebuilds.
- excluded hover from Three scene rebuild.
- throttled hover and tooltip projection updates with `requestAnimationFrame`.
- named and cleaned map event listeners.
- removed continuous map movement React state.
- added explicit custom layer removal/disposal on unmount.
- added `onRemove()` cleanup on the custom layer.
- adjusted transparent material depth policy.
- adjusted relation line depth/render order.
- reduced map-grounded object scale meters.

Not implemented:

- coverage/boundary/LOD.
- time-series highlight.
- custom-layer ray picking.
- production pointcloud, 3D Tiles, or model viewer.
- new dependency.
- backend/API/schema changes.

## Found Flicker Causes

Most likely causes:

1. `map.triggerRepaint()` inside custom layer `render()` created a continuous repaint loop.
2. hover state could rebuild the Three scene during mousemove.
3. full scene group rebuild happened on every layer `update()`.
4. map movement updated React state continuously through `mapVersion`.
5. transparent object depth writes and relation-line depth testing caused visual ordering artifacts.
6. large object scale increased overlap and depth/transparency instability.

## Lifecycle / Render / Update Policy

Map lifecycle:

- one MapLibre map instance per component mount.
- one custom layer add after map load.
- no remove/add cycle on prop updates.
- unmount removes the layer and disposes Three resources before map removal.

Scene update:

- layer update computes a scene signature.
- rebuild only occurs when asset transforms, selected Item, relation overlay state, or visible relation IDs change.
- hover does not change the scene signature.

Render:

- MapLibre owns render cadence during map interaction.
- custom layer render uses MapLibre projection matrix.
- no repaint request inside render.

## WebGL Shared Context Handling

Policy:

- Three renderer shares MapLibre canvas/context.
- `renderer.autoClear = false`.
- `renderer.resetState()` before and after Three render.
- no clear color/depth call in custom layer render.
- custom layer render does not clear the MapLibre frame.

## Hover / Click Stability

Hover:

- screen-nearest fallback remains the Phase 7D picking strategy.
- hover target calculation is throttled with `requestAnimationFrame`.
- React hover state updates only when target changes.
- tooltip screen projection is separately throttled.
- tooltip updates do not rebuild Three scene.

Click:

- click selection still uses nearest asset within threshold.
- click calls existing `onSelectItem(item)`.
- Context Panel integration is unchanged.

## Depth / Transparency / Scale Tuning

Depth:

- transparent materials now avoid depth writes.
- relation lines and endpoint dots render without depth testing.
- selected/related objects receive higher render order.
- polygon offset is enabled for asset materials.

Scale:

- map-grounded category object scale meters were reduced.
- scale remains clamped by policy to avoid excessive object size.

Relation line:

- line endpoints are lifted higher above asset geometry.
- line render order is higher than asset objects.

## Remaining Issues

- actual browser flicker reduction still requires human visual QA.
- no custom-layer ray picking yet.
- selected/relation changes still rebuild full groups, though only on meaningful changes.
- object-level geometry/material pooling is deferred.
- no terrain/subsurface model.
- no coverage/boundary/LOD.

## Screen Check Method

Open:

```text
http://localhost:13000/?mock=1
http://localhost:17800/?mock=1
```

Checks:

- Confirm default view is `2D 지도`.
- Toggle `3D GIS Beta`.
- Confirm `Map-grounded 3D` is active.
- Pan/zoom/pitch/bearing for at least 30 seconds.
- Hover assets and check tooltip.
- Select `다보탑 2024 LiDAR 스캔`.
- Enable/disable `지도에서 관계 보기`.
- Switch to `True 3D constellation` and `Pseudo fallback`.

## Manual Click / Visual QA Result

`docs/qa/manual_click_test_scenarios.md` now includes Phase 7D-S checks.

Manual browser visual QA remains a human step. Docker build and helper checks were run.

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
- 174 modules transformed.
- emitted JS chunk: `1,743.08 kB`, gzip `478.36 kB`.
- existing Vite large chunk warning remains.
- existing dynamic/static import warning for `src/services/api.js` remains.

Helper validation:

```json
{
  "allMapGroundedAssets": 24,
  "draftMapGroundedAssets": 9,
  "seongsuMapGroundedAssets": 8,
  "noResultMapGroundedAssets": 0,
  "zSourceDistribution": {
    "property-elevation": 4,
    "visual-layer": 20
  },
  "minVisualScaleMeters": 30,
  "maxVisualScaleMeters": 64.07,
  "relationRichSelectedItem": "bulguksa-pointcloud-dabotap",
  "visibleRelationCount": 3,
  "mapGroundedRelationEndpointCount": 3,
  "missingTargetCount": 2
}
```

Diff/package checks:

- `git diff --check`: Pass.
- explicit trailing whitespace scan for new/changed Phase 7D-S files: Pass.
- package/lockfile check: `NO_LOCKFILE_CHANGE`.
- no new dependency was added.

## Phase 7E 판단

Proceed to Phase 7E only after browser QA confirms the map-grounded renderer is visually stable enough for relation highlight work.

Recommended gate:

- no severe flicker during 30-second pan/zoom/pitch/bearing.
- hover tooltip does not cause scene flicker.
- relation overlay on/off is stable.
- renderer mode fallback remains usable.
