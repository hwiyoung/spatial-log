# Phase 1 Explorer Asset Map Gate Audit

Date: 2026-06-03

## Scope

Audit whether the current Phase 0 Mock Demo Mode can move into Phase 1: Explorer Asset Map 화면.

Product constraints:

- Explorer remains centered on spatial asset discovery.
- Relationship Graph Beta is not promoted to the default Explorer view.
- Existing 2D map, list, and filter structure stays in place.
- Phase 1 is not a 3D implementation.
- No DB/API schema changes.

## Gate Questions

| # | Question | Audit Answer | Status |
| --- | --- | --- | --- |
| 1 | Explorer의 현재 filteredItems 또는 visibleItems는 어디에서 계산되는가? | Mock mode filtering is computed in `frontend/src/mocks/mockExplorerDataSource.js` by keyword/category/project/status. `Explorer.jsx` stores that result in `items` and now passes the explicit `visibleItems` alias to both list and map. Real API mode still delegates filtering to `/stac/search` params. | Pass after minimal cleanup |
| 2 | SearchSidebar 목록과 MapView marker가 같은 item 배열을 사용하는가? | Yes. `Explorer.jsx` passes the same `visibleItems` array to `SearchSidebar` and `MapView`. | Pass |
| 3 | 검색어 입력 시 list와 map이 동시에 필터링되는가? | Yes. Keyword updates trigger `doSearch()`, then both list and map receive the updated `visibleItems`. | Pass |
| 4 | status filter 클릭 시 list와 map이 동시에 필터링되는가? | Yes in mock mode. `statusFilter` is included in `mockExplorerDataSource.search()`, then the same result feeds list and map. | Pass |
| 5 | project filter 클릭 시 list와 map이 동시에 필터링되는가? | Yes. `selectedCollection` is used in mock search and real API search params, then one result array feeds both surfaces. | Pass |
| 6 | geometry가 있는 item은 어떤 좌표로 표시되는가? | `getItemMapPosition()` now uses GeoJSON geometry first. For Point it uses the point coordinate. For Polygon-like geometry it uses the geometry bounds center. | Pass after helper extraction |
| 7 | bbox만 있는 item은 bbox center로 표시되는가? | Yes. `getItemMapPosition()` falls back to validated bbox bounds center. | Pass |
| 8 | geometry/bbox 없는 item은 `properties["mock:fallback_center"]`로 표시되는가? | Yes. `getItemMapPosition()` falls back to `properties["mock:fallback_center"]` when geometry and bbox are unavailable. | Pass |
| 9 | fallback marker가 문서형 item에도 적용되는가? | Yes. The three document mock Items currently all produce markers, and fallback-only document IDs are `seongsu-document-permit-draft`, `bulguksa-document-precision-report`, `inbox-document-contract-draft`. | Pass |
| 10 | marker 클릭과 list row 클릭이 같은 selectedItem state를 사용하는가? | Yes. `MapView` marker click and `SearchSidebar` row click both call `handleSelectItem()` in `Explorer.jsx`. | Pass |
| 11 | selectedItem이 map/list/panel에서 일관되게 강조되는가? | Yes. `selectedId` is passed to list and map; the panel receives the same selected Item object. If filters remove the selected Item, `Explorer.jsx` now clears `selectedItem`. | Pass after minimal cleanup |
| 12 | 검색 결과 0건이면 list empty state와 marker clear가 동시에 동작하는가? | Yes. Empty `visibleItems` renders the list empty state and `itemsToMapMarkers([])` produces zero markers, causing `MapView` to remove existing markers. | Pass |
| 13 | map initial viewport가 mock item 범위에 맞게 fit 되는가? | Phase 0 did not explicitly fit the full mock range. `MapView` now fits the visible item bounds whenever the visible item set changes. | Pass after minimal cleanup |
| 14 | Relationship Graph Beta가 기본 화면으로 노출되지 않는가? | Yes. Explorer default is still 2D map + list + filters + selected panel. No graph board or graph tab is mounted as the default view. | Pass |

## Gate Conclusion

**B. Phase 1 최소 보완 후 충족**

Phase 0 already satisfied the core data-flow requirement: one filtered result array feeds both list and map. The gaps were implementation hardening items:

- Marker position rules were embedded in `MapView`.
- Visible item bounds were not explicitly fitted.
- Selected panel could remain open if filters removed the selected item.

Those gaps were addressed with small Phase 1-safe changes and no schema/dependency changes.

## Minimal Changes Applied

- Added `frontend/src/features/explorer-map/getItemMapPosition.js`.
- Added `frontend/src/features/explorer-map/itemsToMapMarkers.js`.
- Added `frontend/src/features/explorer-map/getItemsBounds.js`.
- Updated `MapView` to render markers from the helper output and fit visible item bounds.
- Updated `Explorer` to pass a single `visibleItems` array to list and map and clear stale selection after filters.

## Phase 1 Gate Status

Phase 1 can proceed as a mock-data-driven 2D Asset Map stabilization phase.

Do not start 3D GIS, 3D Tiles, point cloud viewer, or Relationship Graph default-view work in Phase 1.

