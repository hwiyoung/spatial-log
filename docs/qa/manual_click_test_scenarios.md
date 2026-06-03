# Manual Click Test Scenarios

Date: 2026-06-02

## Preconditions

Run the frontend and open Explorer with mock mode:

```bash
cd frontend
npm run dev
```

Open:

```text
http://localhost:3000/?mock=1
```

Docker Compose equivalent:

```bash
docker compose up -d --build frontend
```

Open:

```text
http://localhost:3000/?mock=1
```

If Docker Compose uses feature-stack port overrides, use the configured host ports. The current `sams-hwiyoung` stack commonly exposes:

```text
http://localhost:13000/?mock=1
http://localhost:17800/?mock=1
```

Build/fixture verification should be run inside the active Compose service:

```bash
docker compose exec -T frontend npm run build -- --outDir /tmp/spatial-log-frontend-build --emptyOutDir
docker compose exec -T frontend node --input-type=module - <<'NODE'
import { mockItems } from './src/mocks/fixtures/mockItems.js'
import { mockCollections } from './src/mocks/fixtures/mockCollections.js'
console.log(mockCollections.length, mockItems.length)
NODE
```

## Scenarios

| # | Scenario | Click / Input | Expected Result |
| --- | --- | --- | --- |
| 1 | Mock Demo Mode 켜기 | Open `/?mock=1`. | Mock Demo Mode badge is visible; 24 mock results load. |
| 2 | Explorer에서 전체 mock item 확인 | Clear filters. | Sidebar result count is 24; map shows spatial/fallback markers. |
| 3 | Draft만 보기 필터 클릭 | Click `Draft` status chip. | Result count is 9; Draft badges remain visible in list/panel. |
| 4 | 성수동 프로젝트만 보기 | Click `성수동 오피스 리노베이션`. | Result count is 8; only Seongsu Items remain. |
| 5 | 불국사 프로젝트만 보기 | Click `2024 경주 불국사 정밀실측`. | Result count is 8; only Bulguksa Items remain. |
| 6 | Unassigned만 보기 | Click `Unassigned Inbox`. | Result count is 8; missing metadata cases are visible. |
| 7 | 지도 marker 클릭 | Click any marker. | Right Context/Preview Panel opens for the same Item. |
| 8 | 목록 item 클릭 | Click the same or another list row. | Same panel opens and marker selection changes. |
| 9 | geometry 없는 document 확인 | Filter `문헌정보`; click `성수동 리노베이션 인허가 메모` or `불국사 정밀실측 보고서`. | Document appears via fallback marker; panel shows original filename and metadata state. |
| 10 | bbox만 있는 item 확인 | Click `성수동 로비 BIM 모델` or `다보탑 포토그래메트리 모델`. | Marker is derived from bbox center; panel shows `3d_model`. |
| 11 | preview failed item 확인 | Search `failed` or click `대웅전 전면 파노라마` / `불국사 현장 점검 영상`. | Panel shows `Preview failed` and failure reason when available. |
| 12 | Draft 사유 확인 | Click any Draft item with gaps. | Panel shows Draft reason and metadata gaps. |
| 13 | relation이 있는 item 선택 | Click `다보탑 LiDAR 정밀 스캔` or `계약서 초안`. | Panel shows relation count. |
| 14 | relation target이 현재 결과 밖에 있는 warning 확인 | Click `다보탑 LiDAR 정밀 스캔`, `성수동 안전 점검 영상`, or `계약서 초안`. | Panel shows missing relation target warning IDs. |
| 15 | 0건 검색 결과 empty state 확인 | Search `no-result-keyword`. | Result count is 0; list shows empty state and map markers are cleared. |

## Current Scope Notes

- Phase 0 does not implement real selected relation overlay lines.
- Phase 0 does not implement real 3D Tiles, point cloud, model, panorama, video, or document viewers.
- Relationship Graph Beta must not appear as the default Explorer screen.

## Phase 1 Asset Map Checks

Use the same mock entry point:

```text
http://localhost:13000/?mock=1
http://localhost:17800/?mock=1
```

| # | Scenario | Click / Input | Expected Result | Status |
| --- | --- | --- | --- | --- |
| P1-1 | Mock Explorer 열기 | Open `/?mock=1`. | Mock Demo Mode badge appears. | Ready |
| P1-2 | 전체 결과 확인 | Clear all filters. | Result count is 24. | Ready |
| P1-3 | 지도/목록 동시 표시 | Observe map and list. | Markers and list rows are visible from the same result set. | Ready |
| P1-4 | 0건 검색 | Search `no-result-keyword`. | List shows 0 results and map markers are cleared. | Ready |
| P1-5 | 문헌정보 필터 | Click `문헌정보`. | Document item list is shown. | Ready |
| P1-6 | geometry 없는 document | Select a document without geometry/bbox. | It appears as a fallback marker using `mock:fallback_center`. | Ready |
| P1-7 | bbox-only 3D model | Select `성수동 로비 BIM 모델` or `다보탑 포토그래메트리 모델`. | Marker is positioned at bbox center. | Ready |
| P1-8 | marker click | Click a marker. | Right panel opens for that Item. | Ready |
| P1-9 | list row click | Click the same Item in the list. | Same right panel opens. | Ready |
| P1-10 | selected state consistency | Compare marker, row, and panel after selection. | Selected marker scales, row is highlighted, and panel shows the same Item. | Ready |

Phase 1 helper validation:

```bash
docker compose exec -T frontend node --input-type=module - <<'NODE'
import { mockItems } from './src/mocks/fixtures/mockItems.js'
import { itemsToMapMarkers } from './src/features/explorer-map/itemsToMapMarkers.js'
const docs = mockItems.filter(item => item.properties.data_category === 'document')
console.log({
  allItems: mockItems.length,
  allMarkers: itemsToMapMarkers(mockItems).length,
  noResultMarkers: itemsToMapMarkers([]).length,
  documentMarkers: itemsToMapMarkers(docs).length,
})
NODE
```

## Phase 2 Status / Project / Label Checks

Use the same mock entry point:

```text
http://localhost:13000/?mock=1
http://localhost:17800/?mock=1
```

| # | Scenario | Click / Input | Expected Result | Status |
| --- | --- | --- | --- | --- |
| P2-1 | Mock Explorer 열기 | Open `/?mock=1`. | Mock Demo Mode badge appears. | Ready |
| P2-2 | 전체 결과 확인 | Clear all filters. | Result count is 24. | Ready |
| P2-3 | Draft filter | Click `Draft`. | Result count is 9; Draft badges are visible. | Ready |
| P2-4 | Published filter | Click `Published`. | Result count is 9; Published badges are visible. | Ready |
| P2-5 | Archived filter | Click `Archived`. | Result count is 2; Archived badges are visible. | Ready |
| P2-6 | Unknown filter | Click `Unknown`. | Result count is 4; Unknown badges are visible. | Ready |
| P2-7 | 성수동 project filter | Click `성수동 오피스 리노베이션`. | Result count is 8. | Ready |
| P2-8 | 불국사 project filter | Click `2024 경주 불국사 정밀실측`. | Result count is 8. | Ready |
| P2-9 | Unassigned project filter | Click `Unassigned Inbox`. | Result count is 8; Unassigned badge is visible. | Ready |
| P2-10 | Draft + 성수동 조합 | Click `Draft`, then `성수동 오피스 리노베이션`. | Result count reflects the combined filter and map/list remain synced. | Ready |
| P2-11 | 문헌정보 filter | Click `문헌정보`. | Result count is 3. | Ready |
| P2-12 | Human-readable label | Inspect list rows. | Primary row text is a readable title, not only item id. | Ready |
| P2-13 | Panel consistency | Click any list item. | Panel label/status/project/site match the selected row meaning. | Ready |
| P2-14 | Unassigned panel | Click an Unassigned item. | Panel clearly shows `Unassigned Inbox`. | Ready |
| P2-15 | Empty state | Search `no-result-keyword`. | Result count is 0 and map markers are cleared. | Ready |

Phase 2 helper validation:

```bash
docker compose exec -T frontend node --input-type=module - <<'NODE'
import { mockItems } from './src/mocks/fixtures/mockItems.js'
import { mockCollections } from './src/mocks/fixtures/mockCollections.js'
import { getItemStatus } from './src/features/items/getItemStatus.js'
import { getProjectContext } from './src/features/items/getProjectContext.js'
const count = (items, fn) => items.reduce((acc, item) => {
  const key = fn(item)
  acc[key] = (acc[key] || 0) + 1
  return acc
}, {})
console.log({
  status: count(mockItems, getItemStatus),
  projects: count(mockItems, item => getProjectContext(item, mockCollections).projectName),
})
NODE
```
