# ADR: 3D GIS True Renderer Spike

Date: 2026-06-05

## Status

Accepted for Phase 7C spike.

## Context

Phase 7B implemented the selected-centered Asset Constellation with React/CSS/SVG pseudo-3D. It passed the functional gate but did not pass the product/design gate for depth and interaction.

Observed limitations:

- no real perspective camera.
- no orbit, parallax, or wheel zoom.
- no ray picking.
- limited depth cues.
- category height and elevation are visual hints rather than true 3D positions.

The product question for Phase 7C is not production migration. The question is whether the selected Item constellation is understandable when rendered in a real 3D scene.

Guardrails:

- Explorer default remains 2D map/list.
- 3D GIS remains optional Beta.
- existing pseudo-3D remains fallback/comparison.
- only selected Item 1-depth relations are shown.
- no global Relationship Graph.
- no backend/API/schema changes.
- no production pointcloud, 3D Tiles, or model viewer.

## Candidates

### Three.js

Pros:

- real perspective camera, orbit-like drag, zoom, and ray picking.
- small enough for a focused spike compared with geospatial engines.
- flexible custom category geometry.
- can reuse current `visibleItems`, selected Item, Context Panel, and relation overlay model.

Cons:

- adds a dependency.
- geospatial projection and camera controls are custom.
- not a production GIS renderer by itself.
- bundle size increases.

### deck.gl + MapLibre

Pros:

- strong path for GeoJSON layers and map-linked 2D/3D transitions.
- good GPU picking/layer story.

Cons:

- adds multiple dependencies.
- larger integration surface.
- better suited after layer/LOD requirements are defined.

### Cesium

Pros:

- strongest long-term fit for terrain, globe, and production 3D Tiles.

Cons:

- too heavy for this spike.
- token/offline/terrain/worker/bundle considerations.
- premature before asset delivery and production viewer policy are settled.

### Existing Pseudo-3D

Pros:

- no dependency.
- proven fallback.
- accessible DOM buttons.

Cons:

- cannot validate true 3D camera/depth expectations.

## Decision

Phase 7C adds a Three.js spike renderer inside the optional 3D GIS Beta.

The existing pseudo-3D renderer remains available as `Pseudo fallback`.

## Dependency Impact

Phase 7C adds:

- `three`

Package impact:

- `frontend/package.json` gains `three`.
- `frontend/package-lock.json` is created by npm because no frontend lockfile existed before this phase.

No other frontend dependency is added. `@react-three/fiber`, `drei`, deck.gl, Cesium, Potree, and model-viewer remain out of scope.

## Bundle Impact

The frontend bundle is expected to grow because Three.js is imported into the app bundle. This is acceptable for a spike but is a migration signal for later code splitting or renderer gating.

## Fallback Strategy

If WebGL renderer creation fails:

- the Three.js component reports WebGL failure.
- the 3D GIS Beta switches back to the existing pseudo-3D fallback.
- selected Item and Context Panel state remain owned by Explorer.

## Not In Phase 7C

- production 3D GIS migration.
- production pointcloud viewer.
- production 3D Tiles renderer.
- production model viewer.
- real terrain, globe, or map camera sync.
- all-Item global relation graph.
- multi-hop relation graph.
- Coverage/Boundary/LOD implementation.
- relation/time-series highlight implementation.
- upload parsing, automatic GIS classification, or parsing failure diagnostics.
- backend/API/schema changes.
