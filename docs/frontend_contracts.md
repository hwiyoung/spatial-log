# Frontend Contracts

This document is the compact source for Explorer, preview/viewer, mock-mode, and manual UI check contracts.

Current product priority comes from `docs/planning/dev_status_and_roadmap_20260612.md`: operational hardening, real-data upload proof, mutation safety, search support, and 3D renderer simplification come before more mock-first feature expansion.

## Explorer Role

Explorer is a spatial asset discovery surface.

- Default surface: 2D map, filters, list, selected item context.
- 3D GIS remains optional Beta and must not become the route/query/default view.
- Global Relationship Graph must not become the Explorer default.
- Detail is the better home for richer item-centered relation graph behavior.

## Labels, Status, And Project Context

Explorer list rows, map markers, and selected item context should expose enough context before opening full Detail:

- readable item label: prefer `assets.*.title`, `properties.title`, original filename, then item id.
- status: `draft`, `published`, `archived`, unknown fallback.
- project/site context from Collection or item properties.
- unassigned state should be explicit.
- category should stay visible in rows, markers, preview shells, and diagnostics.

## Selected Item Context

Selecting a marker or list item opens a details-on-demand panel without changing the route.

The panel should show:

- readable title and data category.
- project/site/status.
- preview status and action.
- original filename or asset identity when available.
- spatial summary: geometry, bbox, fallback location, or missing spatial data.
- metadata gaps or Draft reason when available.
- relation summary and Detail handoff.

The panel is not a full metadata edit form and should not introduce backend schema changes by itself.

## Relation Overlay

Explorer relation UI is selected item scoped.

- Show only the selected item 1-depth relations.
- Draw lines only when both endpoints are in the current visible result set and have usable map positions.
- Do not create fake nodes or lines for related targets outside the current results.
- For missing targets, show a warning/count in the panel.
- Relation styles should distinguish `derived_from`, `related`, `describedby`, `describes`, `prev`, and `next`.
- Real API mode may use selected item STAC `links`; mock mode may use local relation fixtures.

## Preview And Viewer Contract

Preview state is a contract separate from production heavy viewers.

Supported preview states:

- `available`: user can open a lightweight shell or thumbnail/preview surface.
- `pending`: preview is expected but not ready.
- `missing`: no preview exists.
- `failed`: preview generation/loading failed; expose reason when available.

Preview actions are contract actions. They must not imply that Potree, Cesium, PDF.js, model-viewer, panorama rendering, or production video delivery is already integrated.

Data-category policy:

| Category | Current contract | Later production direction |
| --- | --- | --- |
| `image` | load image preview when source is browser-loadable | original/overview image preview |
| `orthoimage` | load thumbnail/overview image, not raw GeoTIFF by default | COG/tile/overview pipeline |
| `document` | shell or thumbnail/fallback | PDF.js or safe document preview |
| `video` | shell, optional native video only for playable local/mock URL | range/codec/poster policy |
| `panorama` | placeholder/fallback shell | equirectangular/cubemap viewer |
| `3d_model` | screenshot/placeholder shell | GLB/model-viewer or equivalent |
| `pointcloud` | conversion/viewer-needed shell | Potree/COPC or equivalent |
| `3d_tiles` | viewer-needed shell | Cesium or equivalent 3D Tiles renderer |

## Preview Source And Diagnostics

Source priority:

1. explicit preview/thumbnail/overview asset role.
2. normalized mock preview source in mock mode.
3. safe placeholder/fallback.

Rules:

- Raw `data` assets are not automatically browser previews.
- `mock://` values are mock pointers only and must not become direct `<img src>` values.
- `/mock-preview/...` paths are allowed only for local/mock validation.
- Unsupported MIME, broken URL, missing URL, auth/signed URL, and CORS/canvas issues should be diagnosable in the shell.
- Production preview delivery remains a backend decision covered by `docs/adr/ADR-preview-asset-delivery-policy.md`.

## 3D GIS Beta

Active 3D direction is map-grounded: MapLibre custom layer plus Three.js, covered by `docs/adr/ADR-3d-gis-map-grounded-renderer.md`.

Contract:

- 2D map/list remains default.
- 3D Beta uses the same visible items, selected item, context panel, and selected relation overlay model.
- Map-grounded mode should anchor objects to real map coordinates.
- No new heavy renderer dependency without a new ADR.
- No production point cloud, 3D Tiles, or model viewer inside the Explorer overview.
- Coverage/boundary/LOD is a later optional 3D Beta hardening track and should follow P0/P1 work.

## Mock Mode

Mock mode exists to verify screen behavior when backend data is unavailable.

- Query flag: `?mock=1`.
- Environment flag: `VITE_USE_MOCKS`.
- The UI should visibly show mock mode.
- Mock and real data adapters should return the same screen-boundary shape where possible.
- Replacement rule: normalize missing real API fields in the data adapter, not deep inside UI components.

The old phase-by-phase mock documents were removed. Fixtures in `frontend/src/mocks/` are the implementation reference.

## Manual Runtime Checklist

Use this checklist for focused browser checks. Do not rerun old phase checklists by default.

Prerequisites:

- Start the intended stack.
- Open the configured Nginx URL, not hard-coded legacy mock ports.
- Confirm browser console has no new runtime errors for the flow under test.

Core checks:

- Explorer opens in 2D map/list by default.
- Search/filter/list/map selection remain synchronized.
- Draft/project/status/category/readable labels are visible.
- Selecting an item opens the context panel with preview, spatial summary, metadata gaps, and relation summary.
- Relation overlay is selected-item scoped and does not render a global graph.
- Missing relation targets are reported without fake markers.
- Preview shells clearly separate available, pending, missing, and failed states.
- Image/ortho previews expose source diagnostics when loading fails.
- 3D GIS Beta is manually selectable and returning to 2D preserves selection/context.
- Map-grounded 3D can pan/zoom/pitch/bearing for at least 30 seconds without obvious flicker, blank canvas, or broken selection.

P0/P1 hardening checks:

- Non-mock mode uses real API paths for read/write flows.
- Upload/register, item mutation, move/delete, status changes, and relation edits should be covered by backend tests before relying on manual UI checks.
- Real-data upload pilot should record extraction success, CRS fallback, thumbnail timing/failure, and user manual-input burden.
