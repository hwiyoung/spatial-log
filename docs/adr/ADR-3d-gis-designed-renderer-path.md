# ADR: 3D GIS Designed Renderer Path

Date: 2026-06-05

## Status

Accepted for Phase 7A recommendation. No dependency is added in Phase 7A.

## Context

Phase 5 selected a pseudo-3D React/CSS/SVG renderer to validate the optional 3D GIS Beta without disrupting the Explorer 2D map/list flow.

Phase 7A evaluates whether Phase 7B should keep that path or move toward a real renderer for the designed "3D GIS relational asset map".

Guardrails:

- Explorer default remains 2D map/list.
- 3D GIS remains optional Beta.
- no global Relationship Graph as Explorer default.
- no new dependency in Phase 7A.
- no package or lockfile change.
- no DB/API schema change.

## Option A. Keep Current Pseudo-3D React/CSS/SVG

Pros:

- no dependency added.
- fastest path for design validation.
- preserves current `visibleItems`, selected Item, Context Panel, and relation overlay flow.
- works in mock/local/Docker without tiles, terrain, tokens, workers, or CDN assets.
- easy to revert by hiding the Beta toggle.

Cons:

- no real camera, 3D orbit, zoom, or drag.
- limited label collision handling.
- not suitable for large scenes.
- not suitable for real 3D Tiles, point cloud, model, or terrain rendering.

## Option B. three.js Custom Scene

Pros:

- can approximate the meeting demo and floating 3D interaction more closely.
- supports real 3D camera, object picking, animation, and spatial focus.
- flexible custom visual language.

Cons:

- new dependency and interaction complexity.
- direct geospatial projection and map integration must be built.
- label collision, picking, accessibility, and responsive layout need custom work.
- can drift away from the existing MapLibre 2D map/list workflow.

## Option C. MapLibre + deck.gl

Pros:

- good fit for GeoJSON-backed spatial layers.
- better path for 2D/3D transition layers than pure DOM/SVG.
- supports GPU layer rendering and picking.
- can keep MapLibre spatial context more naturally than a standalone three.js scene.

Cons:

- adds dependencies and bundle weight.
- layer/picking integration must be designed.
- still does not automatically solve production point cloud, 3D Tiles, or model viewer needs.
- requires careful state synchronization with existing Explorer selection/panel flow.

## Option D. Cesium

Pros:

- strongest long-term fit for globe, terrain, and 3D Tiles.
- closer to production geospatial 3D asset rendering.
- useful once real 3D Tiles/terrain requirements are active.

Cons:

- too heavy for Phase 7A/7B design validation.
- token, terrain, offline asset, worker, and bundle concerns.
- larger interaction and styling shift from current Explorer.
- likely premature before preview/viewer delivery and data readiness decisions.

## Decision For Phase 7B

Recommend Option A for Phase 7B.

Phase 7B should keep the current pseudo-3D React/CSS/SVG path and implement designed Beta polish:

- marker/card shape language.
- hover tooltip.
- selected focus card.
- relation legend polish.
- missing target warning polish.
- reset view control.
- accessibility minimum.

This matches Phase 7B's goal: validate designed UX, not production 3D rendering.

## Migration Signals

Revisit Option C or Option B when one or more of these becomes true:

- real camera/zoom/drag/orbit becomes a product requirement.
- visible Item count exceeds comfortable DOM rendering.
- label collision becomes a blocking usability issue.
- 2D/3D transition needs to share MapLibre camera more tightly.
- geospatial picking and dense layer rendering become important.

Revisit Option D when:

- production 3D Tiles/terrain/globe becomes active scope.
- object storage, auth, and offline delivery requirements are ready.
- viewer/backend contracts are stable enough to justify Cesium integration.

## Not In Phase 7A

- no renderer dependency installation.
- no package or lockfile change.
- no code migration.
- no real 3D asset viewer.
- no DB/API schema change.
