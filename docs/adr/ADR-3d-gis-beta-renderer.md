# ADR: 3D GIS Beta Renderer

Date: 2026-06-04

## Status

Accepted for Phase 5 Beta.

## Context

Phase 5 adds an optional 3D GIS Beta view to Explorer while keeping the existing 2D map/list workflow as the default. The goal is to validate screen contracts: `visibleItems`, filters, selected Item, Context Panel, and selected relation overlay semantics.

Phase 5 is not the real 3D Tiles, point cloud, model, panorama, video, or document viewer phase. Those viewer contracts move to Phase 6.

## Options

### Option A. MapLibre-only pseudo-3D / 2.5D

Pros:

- No new dependency.
- Keeps the existing Explorer state and MapLibre-centered flow intact.
- Low bundle and local development impact.
- Easy to remove or replace after the Beta proves the workflow.

Cons:

- Not a true 3D scene.
- No real terrain, camera, 3D Tiles, point cloud, or model rendering.
- Visual depth is approximate.

### Option B. deck.gl overlay on MapLibre

Pros:

- Reuses GeoJSON point/line/polygon layer concepts.
- Good path toward 2D/3D transition layers.
- Better large-layer rendering story than DOM markers.

Cons:

- Adds dependencies and bundle weight.
- Requires more renderer and interaction integration work.
- Still does not solve real 3D Tiles/model/viewer requirements by itself.

### Option C. CesiumJS standalone beta

Pros:

- Closest direction to a real 3D globe and 3D Tiles future.
- Strong long-term fit for terrain, camera, and heavy spatial assets.

Cons:

- Heavy for current Phase 5 goals.
- Introduces terrain/token/offline/basemap concerns.
- Would split Explorer behavior from the existing 2D MapLibre flow too early.

## Decision

Choose Option A: MapLibre-only pseudo-3D / 2.5D using React, CSS transforms, and SVG overlays.

## Reason

The current phase needs a selectable Beta screen that proves shared data/filter/selection/context/relation contracts. It does not need a production 3D engine yet.

Option A lets the team validate:

- 2D remains the default Explorer view.
- 3D Beta uses the same `visibleItems`.
- selected Item opens the same Context Panel.
- selected relation overlay semantics carry over.
- empty/filter states work the same way.

## Dependency Impact

No new runtime dependency is added.

`frontend/package.json` remains unchanged. `node_modules` is not modified or committed.

## Offline / Local Development Impact

The pseudo-3D Beta does not require external tiles, terrain, access tokens, worker assets, or CDN resources. It runs in the same local and Docker Compose frontend context as Explorer.

## Integration With Existing 2D MapLibre

The 3D Beta is a sibling view selected by an Explorer view toggle:

- default: `2D map`
- optional: `3D GIS Beta`

Both views receive the same `visibleItems`, `selectedItem`, `relationOverlayEnabled`, and `relationOverlayModel`. The 2D MapLibre implementation is not replaced.

## Phase 6 Viewer Boundary

Phase 5 uses pseudo-3D markers/columns only. It does not open real viewers for:

- point clouds
- 3D models
- 3D Tiles
- panoramas
- videos
- documents

Phase 6 should define and integrate viewer contracts independently from the Explorer 2D/3D view toggle.

## Fallback Strategy

The fallback is immediate:

- Keep the default Explorer view as 2D.
- Hide or remove the `3D GIS Beta` toggle.
- Preserve all Phase 1-4 helpers and panel contracts.

Because no dependency is added and no schema changes are made, the Beta can be reverted without affecting the core 2D Explorer workflow.
