# ADR: 3D GIS Map-Grounded Renderer

Date: 2026-06-05

## Status

Accepted for Phase 7D spike.

## Context

Phase 7C added a standalone Three.js true 3D renderer spike. It validated camera orbit, zoom, ray picking, category geometry, selected focus, and selected Item 1-depth relation lines.

The remaining product gap is GIS grounding:

- the Phase 7C scene is an independent canvas.
- the base map is not visible.
- asset objects do not feel anchored to real geography.
- pan/zoom/pitch are not MapLibre map interactions.

Phase 7D checks whether Three.js asset objects can be rendered as georeferenced objects above a MapLibre background map.

## Option A. MapLibre Custom Layer + Three.js

This path uses MapLibre's custom layer API:

- MapLibre owns the map camera, pan, zoom, pitch, bearing, and tile background.
- Three.js uses the MapLibre WebGL canvas/context.
- custom layer render receives MapLibre's projection matrix.
- asset objects are placed in Mercator coordinates.

Pros:

- no new dependency beyond existing MapLibre and Phase 7C `three`.
- stronger GIS grounding than standalone Three.js.
- keeps Explorer 2D map/list and selected Item flow intact.
- useful spike before deciding deck.gl or Cesium migration.

Cons:

- custom layer math is more fragile than standalone Three.js.
- screen-space picking is harder than standalone raycasting.
- label/tooltip placement needs DOM projection fallback.
- not a production pointcloud, 3D Tiles, or model renderer.

## Option B. deck.gl + MapLibre

Pros:

- mature map-layer model.
- better picking and GeoJSON layer patterns.
- good future candidate for coverage, boundary, and LOD layers.

Cons:

- adds dependency.
- requires layer architecture work.
- too early before Phase 7D proves the product value of map-grounded 3D objects.

Phase 7D treats deck.gl as a comparison candidate only.

## Option C. Cesium

Pros:

- strong production direction for 3D Tiles, terrain, and globe.

Cons:

- too heavy for Phase 7D.
- token/offline/terrain/worker/bundle concerns.
- premature before preview delivery and production 3D asset requirements are settled.

Cesium is excluded from this phase.

## Decision

Phase 7D implements a MapLibre custom layer + Three.js grounding spike.

The 3D GIS Beta renderer modes become:

- Map-grounded 3D
- True 3D constellation
- Pseudo fallback

Default 3D Beta mode for Phase 7D is Map-grounded 3D. Explorer default remains 2D map/list.

## Dependency Impact

No new dependency is added.

Phase 7D reuses:

- `maplibre-gl`
- `three`

`frontend/package.json` and `frontend/package-lock.json` must not change in this phase.

## Fallback Strategy

If the MapLibre custom layer fails:

- switch to the Phase 7C standalone `True 3D constellation` mode.
- keep pseudo fallback available.
- keep selected Item, relation overlay state, and Context Panel owned by Explorer.

## Not In Phase 7D

- production renderer migration.
- deck.gl implementation.
- Cesium implementation.
- production pointcloud, 3D Tiles, or model viewer.
- coverage/boundary/LOD implementation.
- relation/time-series highlight implementation.
- Upload/Project/Metadata changes.
- backend/API/schema changes.
- global Relationship Graph.
- all-Item relation rendering.
