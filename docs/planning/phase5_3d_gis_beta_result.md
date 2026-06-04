# Phase 5 3D GIS Beta Result

Date: 2026-06-04

## Change Summary

Phase 5 adds an optional 3D GIS Beta view to Explorer while keeping the existing 2D map/list view as the default.

Implemented:

- `2D map` / `3D GIS Beta` view toggle.
- Optional pseudo-3D Beta surface.
- `visibleItems` to pseudo-3D asset projection.
- data-category visual differentiation.
- status/draft ring semantics.
- selected Item highlight.
- 3D asset click reusing the existing Context Panel flow.
- selected relation overlay model reuse in 3D Beta.
- 3D relation lines, related highlight, legend, and missing-target warning.
- empty state for zero visible Items.

Not implemented:

- 3D GIS as default Explorer view.
- global Relationship Graph.
- real 3D Tiles renderer.
- real point cloud renderer.
- real 3D model renderer.
- panorama/video/document viewer.
- DB/API schema changes.

## Selected Renderer

Renderer: Option A, MapLibre-only pseudo-3D / 2.5D using React, CSS transforms, and SVG.

Reason:

- no new dependency
- no bundle/runtime dependency increase beyond source code
- no terrain/token/offline basemap concerns
- keeps the existing 2D MapLibre workflow untouched
- easy fallback by hiding/removing the Beta toggle

Detailed renderer decision is documented in `docs/adr/ADR-3d-gis-beta-renderer.md`.

## Dependency Impact

No new dependency was added.

`frontend/package.json` is unchanged. `node_modules` was not modified or committed.

## 3D Beta Screen Check

Open mock mode:

```text
http://localhost:13000/?mock=1
http://localhost:17800/?mock=1
```

Expected:

- Explorer opens in `2D map` by default.
- `3D GIS Beta` toggle is visible.
- Clicking `3D GIS Beta` shows the Beta surface and `3D GIS Beta` badge.
- SearchSidebar filters remain available.
- Context Panel remains the same right-side panel.

## 2D / 3D Toggle Behavior

The toggle is local UI state:

- default: `2D map`
- optional: `3D GIS Beta`

Switching views does not clear filters, selected Item, or relation overlay state. The 3D Beta receives the same `visibleItems`, `selectedItem`, and `relationOverlayModel`.

## Filter / Selection / Context / Relation Sync

Validated against mock data:

- all mock Items: 24
- all 3D assets: 24
- Draft filter: 9 Items, 9 3D assets
- Seongsu project filter: 8 Items, 8 3D assets
- Document category filter: 3 Items, 3 3D assets
- no-result keyword: 0 Items, 0 3D assets
- Dabotap relation overlay: 3 visible relations, 2 missing targets

Behavior:

- 3D Beta uses `visibleItems`.
- Clicking a pseudo-3D asset calls the same `onSelectItem(item)` path as 2D markers/list rows.
- Context Panel opens for the selected Item.
- relation overlay enabled state is reused.
- related visible assets are highlighted in 3D Beta.
- missing targets are warnings only.

## Not Implemented

- real 3D Tiles, point cloud, or model viewers
- globe/terrain/camera engine
- deck.gl or CesiumJS integration
- new renderer dependency
- global relationship graph
- schema changes

## Build / Docker Verification

Compose service check:

```bash
docker compose ps
```

Result:

- `frontend` service is running in the `sams-hwiyoung` Compose stack.
- Current feature-stack frontend port is `13000`.
- Current feature-stack nginx port is `17800`.

Helper validation:

```bash
docker compose exec -T frontend node --input-type=module - <<'NODE'
import { mockRelations } from './src/mocks/fixtures/mockRelations.js'
import { mockExplorerDataSource } from './src/mocks/mockExplorerDataSource.js'
import { getAsset3dItems } from './src/features/explorer-3d/getAsset3dPosition.js'
import { getSelectedRelationOverlay } from './src/features/relations/getSelectedRelationOverlay.js'
const search = async params => (await mockExplorerDataSource.search(params)).data.features
const all = await search({})
const draft = await search({ status: 'draft' })
const seongsu = await search({ collectionId: 'seongsu-office-renovation' })
const documentItems = await search({ categories: ['document'] })
const none = await search({ keyword: 'no-result-keyword' })
const byId = Object.fromEntries(all.map(item => [item.id, item]))
const overlay = getSelectedRelationOverlay({
  selectedItem: byId['bulguksa-pointcloud-dabotap'],
  visibleItems: all,
  relationRecords: mockRelations,
})
console.log(JSON.stringify({
  allItems: all.length,
  all3dAssets: getAsset3dItems(all).length,
  draftItems: draft.length,
  draft3dAssets: getAsset3dItems(draft).length,
  seongsuItems: seongsu.length,
  seongsu3dAssets: getAsset3dItems(seongsu).length,
  documentItems: documentItems.length,
  document3dAssets: getAsset3dItems(documentItems).length,
  noResultItems: none.length,
  noResult3dAssets: getAsset3dItems(none).length,
  relationOverlay: {
    visible: overlay.visibleRelations.length,
    missing: overlay.missingTargets.length,
  },
}, null, 2))
NODE
```

Result:

- command succeeded inside the running Compose `frontend` service.
- Node printed the existing typeless-package warning for ES module fixture imports.

Frontend build:

```bash
docker compose exec -T frontend npm run build -- --outDir /tmp/spatial-log-frontend-build --emptyOutDir
```

Result:

- Build passed inside the running Compose `frontend` service.
- Vite transformed 136 modules.
- Output path was `/tmp/spatial-log-frontend-build` inside the container.
- Existing warnings remain: Vite CJS API deprecation, dynamic/static import chunking warning, and large bundle warning.
- `node_modules` was not committed or modified.

## Phase 6 Gate

Phase 6 can start when browser checks confirm:

- default Explorer view remains 2D.
- 3D GIS Beta toggle works.
- 3D Beta reflects filters.
- 3D Beta asset click opens the Context Panel.
- selected relation context is visible in 3D Beta.
- `no-result-keyword` shows empty state.
- no global Relationship Graph appears.
- no real heavy asset viewer opens.

## Remaining Issues

- Browser click tests are manual only.
- Pseudo-3D is not a real 3D engine.
- No terrain/camera/3D Tiles support is included.
- Coincident or near-coincident assets can still produce visually short relation lines.
- Real viewer integration is intentionally deferred to Phase 6.
