# Phase 7D Map-Grounded 3D GIS Result

Date: 2026-06-05

## Implementation Summary

Phase 7D adds a MapLibre custom layer + Three.js map-grounded renderer spike inside the optional 3D GIS Beta.

Implemented:

- `Map-grounded 3D` renderer mode.
- MapLibre base map inside 3D GIS Beta.
- Three.js custom layer sharing the MapLibre WebGL canvas/context.
- category placeholder objects placed from Item lng/lat.
- altitude/elevation transform policy.
- selected Item highlight.
- related Item relation-colored highlight.
- selected Item 1-depth relation lines.
- missing target warnings without fake nodes.
- hover tooltip using screen-nearest fallback.
- click selection using screen-nearest fallback.
- fallback modes: `True 3D constellation` and `Pseudo fallback`.

Not implemented:

- production renderer migration.
- deck.gl implementation.
- Cesium implementation.
- production pointcloud, 3D Tiles, or model viewer.
- coverage/boundary/LOD implementation.
- time-series or long-edge relation highlight.
- backend/API/schema changes.
- global Relationship Graph.

## MapLibre Custom Layer + Three.js Approach

New code:

- `frontend/src/features/explorer-3d-map/MapGroundedThreeGisBeta.jsx`
- `frontend/src/features/explorer-3d-map/MapGroundedThreeLayer.js`
- `frontend/src/features/explorer-3d-map/itemToMercatorTransform.js`
- `frontend/src/features/explorer-3d-map/mapGroundedVisualPolicy.js`

Flow:

1. `MapGroundedThreeGisBeta` creates a MapLibre map with raster OSM base map.
2. A `MapGroundedThreeLayer` custom layer is added with `renderingMode: "3d"`.
3. Three.js renderer reuses MapLibre canvas/context.
4. The custom layer renders from MapLibre's projection matrix.
5. Prop changes rebuild only the asset and relation groups.

## Coordinate Transform / Georeferencing Policy

Input position:

- `getItemMapPosition(item)`
- source order remains geometry center, bbox center, mock fallback center.

Transform:

- convert lng/lat/altitude to `maplibregl.MercatorCoordinate`.
- use `meterInMercatorCoordinateUnits()` to scale Three.js category objects.
- same-location assets receive small meter offsets before placement.

This ties object placement to map pan/zoom/pitch instead of an independent Three.js scene extent.

## Altitude / Elevation Policy

Reused zSource priority:

1. `bbox-z`
2. `property-elevation`
3. `visual-layer`

Map-grounded rule:

- positive actual elevation can become Mercator altitude.
- negative elevation is clamped to the map surface because no terrain/subsurface model exists.
- visual-layer assets remain on the map surface and express category height through object geometry/scale.

## Category Object Expression

The map-grounded layer reuses the Phase 7C category placeholder geometry through a Mercator wrapper:

- pointcloud: tower / particle-like column.
- 3D model: prism/block.
- 3D Tiles: stacked block.
- orthoimage: map plate.
- image: photo card.
- panorama: dome.
- video: media card.
- document: document sheet.

These are asset markers, not production viewers.

## Selected / Relation Behavior

Selection:

- map-grounded click calls existing `onSelectItem(item)`.
- Context Panel remains the authoritative selected Item surface.
- selected object receives a strong focus style.

Relation:

- uses only `relationOverlayModel.visibleRelations`.
- renders selected Item 1-depth relation lines only.
- missing targets remain warnings only.
- no global graph or all-Item relation rendering.

## Phase 7C Standalone 대비 개선점

Improved:

- visible MapLibre base map.
- map pan/zoom/pitch controls.
- asset objects are tied to lng/lat positions.
- relation lines move with map camera.
- stronger georeferenced product direction signal.

Still weaker than standalone:

- click/hover uses screen-nearest fallback, not custom-layer ray picking.
- object labels remain DOM overlays projected from lng/lat, not true 3D labels.
- custom layer line dash/width is limited by WebGL line behavior.
- no production coverage/footprint/LOD layer.

## deck.gl / Cesium Follow-Up Judgment

deck.gl remains a strong future candidate when Phase 7E/LOD work needs:

- better picking.
- GeoJSON layer composition.
- coverage/footprint polygons.
- scale-based layer switching.

Cesium remains deferred until:

- production 3D Tiles/terrain/globe requirements become active.
- data delivery/auth/offline policy is ready.

Phase 7D does not justify adding either dependency yet.

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
- Pan/zoom/pitch the map.
- Click near an asset and confirm Context Panel.
- Select `다보탑 2024 LiDAR 스캔`.
- Enable `지도에서 관계 보기`.
- Confirm only selected 1-depth relation lines.
- Switch to `True 3D constellation` and `Pseudo fallback`.

## Manual Click Test Result

`docs/qa/manual_click_test_scenarios.md` now includes Phase 7D manual checks.

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
- 174 modules transformed.
- emitted JS chunk: `1,740.90 kB`, gzip `477.61 kB`.
- Vite large chunk warning remains expected after Phase 7C Three.js.
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
  "relationRichSelectedItem": "bulguksa-pointcloud-dabotap",
  "visibleRelationCount": 3,
  "mapGroundedRelationEndpointCount": 3,
  "missingTargetCount": 2
}
```

Diff/package checks:

- `git diff --check`: Pass for tracked diff.
- explicit trailing whitespace scan for new files: Pass.
- package/lockfile check: `NO_LOCKFILE_CHANGE`.
- no new dependency was added in Phase 7D.

## Phase 7E 판단

Phase 7D is sufficient to proceed to Phase 7E if product review accepts MapLibre-grounded 3D as the right direction.

Recommended next work:

- relation highlight choreography.
- time-series/prev-next highlight.
- long relation readability.

Coverage/boundary/LOD should remain a separate follow-up because it requires geometry type and scale policy decisions.

## Remaining Issues

- no custom-layer ray picking yet.
- no terrain or subsurface handling.
- negative actual elevation is clamped to map surface.
- no map-grounded 3D labels.
- no automated browser interaction test.
- no production pointcloud, 3D Tiles, or model renderer.
