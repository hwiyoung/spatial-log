# Phase 0 Mock Demo Mode Result

Date: 2026-06-02

## Change Summary

Phase 0 converts Explorer planning from a graph-first direction to a clickable mock-data screen path.

Implemented:

- Local mock fixture set for Explorer.
- `/?mock=1` query-string entry point.
- `VITE_USE_MOCKS=true` local dev entry point.
- Visible `Mock Demo Mode` badge.
- Mock status filter for Draft/Published/Archived/Unknown verification.
- Context/Preview Panel display for preview status, original filename, metadata gaps, Draft reason, relation count, and missing relation target warnings.
- Geometry fallback marker support through `properties["mock:fallback_center"]`.

## Mock Data Counts

- Projects: 3.
- Items: 24.

Status distribution:

- `draft`: 9
- `published`: 9
- `archived`: 2
- `unknown`: 4

Data category distribution:

- `pointcloud`: 3
- `3d_model`: 3
- `3d_tiles`: 3
- `orthoimage`: 3
- `image`: 3
- `panorama`: 3
- `video`: 3
- `document`: 3

Preview status distribution:

- `available`: 10
- `pending`: 4
- `missing`: 5
- `failed`: 5

## How To Open Mock Mode

Local frontend:

```bash
cd frontend
npm run dev
```

Open:

```text
http://localhost:3000/?mock=1
```

Alternative local env:

```bash
cd frontend
VITE_USE_MOCKS=true npm run dev
```

Docker Compose:

```bash
docker compose up -d --build frontend
```

Open:

```text
http://localhost:3000/?mock=1
```

If using nginx from the compose stack:

```bash
docker compose up -d --build frontend nginx
```

Open:

```text
http://localhost:7800/?mock=1
```

If Docker Compose uses feature-stack port overrides, use the configured host ports. The current `sams-hwiyoung` stack was also verified at:

```text
http://localhost:13000/?mock=1
http://localhost:17800/?mock=1
```

## Not Implemented In Phase 0

- Real 3D Tiles rendering.
- Real point cloud/model/document/panorama/video viewers.
- MSW handlers.
- DB/API schema changes.
- Selected relation overlay lines.
- Detail route mock mode.

These are intentionally left for later phases or explicit API contract work.

## Verification

Docker Compose service fixture count check:

```bash
docker compose exec -T frontend node --input-type=module - <<'NODE'
import { mockItems } from './src/mocks/fixtures/mockItems.js'
import { mockCollections } from './src/mocks/fixtures/mockCollections.js'
console.log(mockCollections.length, mockItems.length)
NODE
```

Result:

- Projects: 3
- Items: 24
- Data categories: 3 each across all 8 categories
- Status distribution: `draft` 9, `published` 9, `archived` 2, `unknown` 4
- Preview status distribution: `available` 10, `pending` 4, `missing` 5, `failed` 5
- Fallback-only spatial Items: 6
- Bbox-only Items: 3

Docker Compose service build:

```bash
docker compose exec -T frontend npm run build -- --outDir /tmp/spatial-log-frontend-build --emptyOutDir
```

This verifies the code inside the running Compose `frontend` service. The build output is written to `/tmp` inside the container, so repository `dist` and `node_modules` are not modified.

Build result:

- Vite transformed 105 modules.
- Output written to `/tmp/spatial-log-frontend-build` inside the container.
- Existing warnings: Vite CJS API deprecation, large bundle warning, dynamic import chunking warning for `src/services/api.js`.

Local host note:

- Direct host build with `npm --prefix frontend run build` did not run because the current checked-out `frontend/node_modules` has no `vite` executable.
- `node_modules` was not modified.

Running server check:

```bash
curl -fsS http://localhost:13000/?mock=1
curl -fsS http://localhost:17800/?mock=1
```

Both returned the Vite HTML shell from the currently running stack.

No lint/test script exists in `frontend/package.json`.

## Gate To Phase 1

Phase 1 can start when:

- `/?mock=1` loads 24 Items in the existing Explorer map/list.
- Status/project/category filters are clickable against mock data.
- At least one no-geometry document is visible through fallback placement.
- The default Explorer screen still shows map/list, not a global Relationship Graph.
- Build validation succeeds or the failure is documented with a concrete local environment cause.
