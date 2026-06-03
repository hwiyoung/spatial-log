# Phase 2 Draft / Project / Status / Label Result

Date: 2026-06-03

## Change Summary

Phase 2 makes status, project/site context, unassigned state, and display labels consistent across Explorer list rows, map markers, and the right panel.

Implemented:

- Canonical item helpers:
  - `getItemStatus(item)`
  - `getDisplayLabel(item)`
  - `getProjectContext(item, collections?)`
  - `getItemVisibilityFlags(item, collections?)`
- Shared badge components:
  - `StatusBadge`
  - `DraftBadge`
  - `ProjectBadge`
- Status/project count display in mock Explorer filter chips.
- List row display of readable label, original filename, site, project badge, and status badge.
- Map marker status ring logic while keeping markers compact.
- Panel display of label, original filename, status, project, site, collection id, preview status, draft reason, metadata gaps, and relation count.

No DB/API schema changes were made. No 3D implementation or relation overlay was added. Relationship Graph Beta remains outside the default Explorer view.

## Helper Policy Summary

Status fallback:

1. `item.properties.status`
2. `item.properties["sams:status"]`
3. `item.status`
4. `unknown`

Display label fallback:

1. `item.properties.title`
2. `item.properties.display_name`
3. `item.properties["document:title"]`
4. `assets.{key}.title`
5. `item.properties.description`
6. original filename
7. `item.id`

Project context fallback:

1. `item.properties["project:name"]`
2. `item.properties.project_name`
3. collection title/name lookup
4. `item.collection`
5. `Unassigned`

Site fallback:

1. `item.properties["project:site"]`
2. `item.properties.project_site`
3. `collection.properties["project:site"]`
4. `unknown`

Full policy is documented in `docs/design/status_project_label_policy.md`.

## Status Distribution

Validated against mock fixtures with the shared helper:

- `draft`: 9
- `published`: 9
- `archived`: 2
- `unknown`: 4

## Project Distribution

Validated against mock fixtures with the shared helper:

- `성수동 오피스 리노베이션`: 8
- `2024 경주 불국사 정밀실측`: 8
- `Unassigned Inbox`: 8

Unassigned count: 8.

## Screen Check

Open mock mode:

```text
http://localhost:13000/?mock=1
http://localhost:17800/?mock=1
```

Expected:

- Result count is 24 without filters.
- Status chips show counts.
- Project chips show counts.
- List rows show readable label, original filename/site, project badge, and status badge.
- Draft Items are visually distinct.
- Unassigned Items are explicitly marked.
- Panel label/status/project/site match list row meaning.
- Map markers stay compact and use status/category visual meaning.

## Manual Click Test Result

Manual browser clicks were not automated because this checkout does not include a browser test runner.

Code/data validation for the Phase 2 checks passed:

- Draft filter target count: 9.
- Published filter target count: 9.
- Archived filter target count: 2.
- Unknown filter target count: 4.
- Seongsu project target count: 8.
- Bulguksa project target count: 8.
- Unassigned project target count: 8.
- Draft + Seongsu combined filter count: 4.
- Document category target count: 3.
- `no-result-keyword` target count: 0.
- All mock Items resolve to a human-readable label without falling back to item id only.

The browser checklist is updated in `docs/qa/manual_click_test_scenarios.md`.

## Docker Compose Verification

Compose service:

```bash
docker compose ps
```

The running frontend service is `frontend`.

Helper and distribution validation:

```bash
docker compose exec -T frontend node --input-type=module - <<'NODE'
import { mockItems } from './src/mocks/fixtures/mockItems.js'
import { mockCollections } from './src/mocks/fixtures/mockCollections.js'
import { getItemStatus } from './src/features/items/getItemStatus.js'
import { getDisplayLabel } from './src/features/items/getDisplayLabel.js'
import { getProjectContext } from './src/features/items/getProjectContext.js'
import { getItemVisibilityFlags } from './src/features/items/getItemVisibilityFlags.js'
const count = (items, fn) => items.reduce((acc, item) => {
  const key = fn(item)
  acc[key] = (acc[key] || 0) + 1
  return acc
}, {})
console.log(JSON.stringify({
  status: count(mockItems, getItemStatus),
  projects: count(mockItems, item => getProjectContext(item, mockCollections).projectName),
  unassignedCount: mockItems.filter(item => getItemVisibilityFlags(item, mockCollections).isUnassigned).length,
  labelFallbackToIdCount: mockItems.filter(item => getDisplayLabel(item) === item.id).length,
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
- Vite transformed 115 modules.
- Existing warnings remain: Vite CJS API deprecation, dynamic/static import chunking warning, and large bundle warning.
- `node_modules` was not committed or modified.

## Phase 3 Gate

Phase 3 can start when browser checks confirm:

- List and panel labels match.
- Status/project/site meaning is consistent in list and panel.
- Draft and Unassigned states are obvious without opening Detail.
- Filter combinations keep map/list synchronized.
- Empty state clears both list and markers.

Phase 3 should focus on selected Item context panel behavior, not relation overlay or 3D GIS.

## Remaining Issues

- Status/project chip counts are computed from the current visible mock result set. Real API mode may need server-provided facets later.
- Browser click tests are manual only.
- Relationship overlay remains intentionally deferred to Phase 4.
- Detail route still uses its existing API path and is not part of Phase 2 mock mode.
