# Phase 1 Explorer Asset Map Result

Date: 2026-06-03

## Change Summary

Phase 1 Gate Audit found that Phase 0 was close to ready, but needed minimal hardening before starting Asset Map work.

Implemented:

- A shared visible item flow in `Explorer.jsx`.
- Marker position helper functions for geometry, bbox, and fallback markers.
- Marker conversion helper for list/map parity checks.
- Visible item bounds calculation and automatic map fit.
- Stale selected Item clearing when filters remove the selected Item from visible results.

No DB/API schema changes were made. No 3D implementation was added. Relationship Graph Beta remains outside the default Explorer view.

## Phase 1 Items Satisfied

- SearchSidebar list and MapView markers use the same `visibleItems` array.
- Keyword search filters list and map together.
- Status filter filters list and map together in mock mode.
- Project filter filters list and map together.
- 24 mock Items produce 24 marker candidates.
- 0 visible Items produce 0 marker candidates.
- Geometry Items use geometry-derived marker positions.
- Bbox-only Items use bbox center positions.
- Geometry/bbox-missing document Items use `properties["mock:fallback_center"]`.
- Marker click and list row click open the same selected panel.
- Selected Item is highlighted in list and map.
- Selected panel is cleared if filters remove the selected Item.
- Map fits the visible item bounds.
- Relationship Graph Beta is not the default Explorer screen.

## Remaining Items

- No browser automation exists in this repo for click assertions.
- The Phase 1 relation overlay is not implemented; that belongs to Phase 4.
- Real API result normalization is still separate from mock data source behavior.
- The current map uses DOM markers; clustering and WebGL layers are not part of Phase 1.

## Screen Check

Open mock mode:

```text
http://localhost:13000/?mock=1
http://localhost:17800/?mock=1
```

Default local ports, if no feature-stack overrides are active:

```text
http://localhost:3000/?mock=1
http://localhost:7800/?mock=1
```

Expected:

- Mock Demo Mode badge appears.
- Result count is 24 with no filters.
- Map markers and list rows are visible together.
- The map initially fits the visible mock item extent.
- Selecting a marker or row opens the same right panel.

## Manual Click Test Result

Manual browser clicks were not automated in this checkout because the frontend has no browser test runner configured.

Code/data validation for the Phase 1 manual checks passed:

- All mock Items: 24.
- Map marker candidates from all mock Items: 24.
- No-result marker candidates: 0.
- Document Items: 3.
- Document marker candidates: 3.
- Fallback-only document markers:
  - `seongsu-document-permit-draft`
  - `bulguksa-document-precision-report`
  - `inbox-document-contract-draft`
- Bbox-only 3D model markers:
  - `seongsu-model-lobby-bim`
  - `bulguksa-model-dabotap-photogrammetry`
  - `inbox-model-damaged-obj`

Browser checklist is updated in `docs/qa/manual_click_test_scenarios.md`.

## Docker Compose Verification

Compose service:

```bash
docker compose ps
```

The running frontend service is `frontend`.

Fixture and marker helper validation:

```bash
docker compose exec -T frontend node --input-type=module - <<'NODE'
import { mockItems } from './src/mocks/fixtures/mockItems.js'
import { itemsToMapMarkers } from './src/features/explorer-map/itemsToMapMarkers.js'
import { getItemsBounds } from './src/features/explorer-map/getItemsBounds.js'
const docs = mockItems.filter(item => item.properties.data_category === 'document')
console.log(JSON.stringify({
  allItems: mockItems.length,
  allMarkers: itemsToMapMarkers(mockItems).length,
  noResultMarkers: itemsToMapMarkers([]).length,
  documentMarkers: itemsToMapMarkers(docs).length,
  bounds: getItemsBounds(mockItems),
}, null, 2))
NODE
```

Frontend build:

```bash
docker compose exec -T frontend npm run build -- --outDir /tmp/spatial-log-frontend-build --emptyOutDir
```

Result:

- Build passed inside the running Compose `frontend` service.
- Output path was `/tmp/spatial-log-frontend-build` inside the container.
- Existing warnings remain: Vite CJS API deprecation, dynamic/static import chunking warning, and large bundle warning.
- `node_modules` was not committed or modified.

## Phase 2 Gate

Phase 2 can start when the browser checklist confirms:

- `/?mock=1` shows 24 list rows and corresponding map markers.
- `no-result-keyword` clears both list and markers.
- `문헌정보` filter shows document Items and fallback document markers.
- Bbox-only 3D model Items appear at bbox centers.
- Marker click and list row click open the same right panel.
- Selected state is consistent in map, list, and panel.

Phase 2 should focus on Draft / Project / Status / Label visibility and must keep the same 2D map/list foundation.

