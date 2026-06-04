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

## Phase 3 Context Panel Checks

Use the same mock entry point:

```text
http://localhost:13000/?mock=1
http://localhost:17800/?mock=1
```

| # | Scenario | Click / Input | Expected Result | Status |
| --- | --- | --- | --- | --- |
| P3-1 | Mock Explorer 열기 | Open `/?mock=1`. | Mock Demo Mode badge appears. | Ready |
| P3-2 | 전체 결과 확인 | Clear all filters. | Result count is 24. | Ready |
| P3-3 | pointcloud item panel | Click `다보탑 2024 LiDAR 스캔`. | Panel shows preview, status, project, spatial summary, relation summary. | Ready |
| P3-4 | Draft item panel | Click `지하 기계실 LiDAR 스캔` or another Draft item. | Draft reason and metadata gaps are highlighted. | Ready |
| P3-5 | preview failed item | Click `다보탑 고해상도 메시 초안` or `계약서 초안`. | Panel shows `Preview failed` and failure reason. | Ready |
| P3-6 | preview pending item | Click `1층 로비 리노베이션 BIM`. | Panel shows `Preview pending`. | Ready |
| P3-7 | document fallback item | Click `리노베이션 인허가 메모` or `계약서 초안`. | Document preview placeholder and `Fallback project location` are visible. | Ready |
| P3-8 | bbox-only 3D model | Click `1층 로비 리노베이션 BIM` or `다보탑 고해상도 메시 초안`. | Panel shows `BBox-derived location`. | Ready |
| P3-9 | Unassigned item | Click `계약서 초안` or another Unassigned item. | Panel shows `Unassigned Inbox` and metadata gaps. | Ready |
| P3-10 | relation-rich item | Click `다보탑 2024 LiDAR 스캔`. | Relation counts and missing target warning are visible. | Ready |
| P3-11 | panel close | Click the panel close button. | Context Panel closes. | Ready |
| P3-12 | stale selection clear | Select an item, then search `no-result-keyword`. | Panel closes, result count is 0, and map markers are cleared. | Ready |
| P3-13 | Detail CTA | Select any item and inspect footer. | `상세 보기 ->` CTA is visible. | Ready |
| P3-14 | Draft metadata CTA | Select a Draft item. | Disabled `메타데이터 보완` CTA is visible. | Ready |

Phase 3 helper validation:

```bash
docker compose exec -T frontend node --input-type=module - <<'NODE'
import { mockItems } from './src/mocks/fixtures/mockItems.js'
import { mockRelations } from './src/mocks/fixtures/mockRelations.js'
import { getItemPreviewSummary } from './src/features/items/getItemPreviewSummary.js'
import { getItemSpatialSummary } from './src/features/items/getItemSpatialSummary.js'
import { getItemRelationSummary } from './src/features/items/getItemRelationSummary.js'
const count = (items, fn) => items.reduce((acc, item) => {
  const key = fn(item)
  acc[key] = (acc[key] || 0) + 1
  return acc
}, {})
console.log({
  items: mockItems.length,
  previewStatus: count(mockItems, item => getItemPreviewSummary(item).status),
  spatialSource: count(mockItems, item => getItemSpatialSummary(item).source),
  relationRecords: mockRelations.length,
  relationRich: getItemRelationSummary(
    mockItems.find(item => item.id === 'bulguksa-pointcloud-dabotap'),
    mockRelations
  ),
})
NODE
```

## Phase 4 Selected Relation Overlay Checks

Use the same mock entry point:

```text
http://localhost:13000/?mock=1
http://localhost:17800/?mock=1
```

| # | Scenario | Click / Input | Expected Result | Status |
| --- | --- | --- | --- | --- |
| P4-1 | Mock Explorer 열기 | Open `/?mock=1`. | Mock Demo Mode badge appears. | Ready |
| P4-2 | relation-rich item 선택 | Click `다보탑 2024 LiDAR 스캔`. | Context Panel opens for that Item. | Ready |
| P4-3 | panel relation summary | Inspect Relation Summary. | Relation count and missing target warning are visible. | Ready |
| P4-4 | overlay toggle 켜기 | Click `지도에서 관계 보기`. | Selected Item 1-depth relation overlay appears on the map. | Ready |
| P4-5 | selected-only line scope | Inspect map. | Only selected Item relation lines appear; no global graph board appears. | Ready |
| P4-6 | related marker highlight | Inspect visible related markers. | Related markers have relation highlight while selected marker keeps stronger selected emphasis. | Ready |
| P4-7 | missing target warning | Inspect map warning. | Missing target count is shown; no marker is created for missing targets. | Ready |
| P4-8 | `derived_from` style | Select `1층 로비 리노베이션 BIM` and enable overlay. | `derived_from` appears as the solid style in legend/line. | Ready |
| P4-9 | `related` style | Select `북측 파사드 보수 전 사진 42장` or `계약서 초안`. | `related` appears as the weak dashed style in legend/line. | Ready |
| P4-10 | `describedby/describes` style | Select `1층 로비 리노베이션 BIM` or `계약서 초안`. | Document relation styles appear in legend/line. | Ready |
| P4-11 | `prev/next` warning style | Select `다보탑 2024 LiDAR 스캔`. | `prev` and `next` are counted as missing targets when outside current results. | Ready |
| P4-12 | relation 없는 item | Select `성수동 옥상 정사영상`. | CTA shows `관계 없음` or stays disabled. | Ready |
| P4-13 | 다른 relation-rich item 선택 | Select another relation-rich Item while overlay is on. | Overlay updates to the new selected Item. | Ready |
| P4-14 | related item filter out | Enable overlay, then apply a filter that hides related Items. | Hidden related lines disappear and missing warning count updates. | Ready |
| P4-15 | no-result cleanup | Search `no-result-keyword`. | Result count is 0; markers, panel, and overlay are cleared. | Ready |
| P4-16 | global graph guardrail | Inspect Explorer screen. | Relationship Graph Beta/global graph is not displayed. | Ready |

Phase 4 helper validation:

```bash
docker compose exec -T frontend node --input-type=module - <<'NODE'
import { mockItems } from './src/mocks/fixtures/mockItems.js'
import { mockRelations } from './src/mocks/fixtures/mockRelations.js'
import { getSelectedRelationOverlay } from './src/features/relations/getSelectedRelationOverlay.js'
const byId = Object.fromEntries(mockItems.map(item => [item.id, item]))
const overlay = selectedId => getSelectedRelationOverlay({
  selectedItem: byId[selectedId],
  visibleItems: mockItems,
  relationRecords: mockRelations,
})
console.log({
  relationRecords: mockRelations.length,
  dabotap: {
    visible: overlay('bulguksa-pointcloud-dabotap').visibleRelations.length,
    missing: overlay('bulguksa-pointcloud-dabotap').missingTargets.length,
  },
  seongsuModel: {
    visible: overlay('seongsu-model-lobby-bim').visibleRelations.length,
    missing: overlay('seongsu-model-lobby-bim').missingTargets.length,
  },
  noRelation: overlay('seongsu-ortho-rooftop'),
})
NODE
```
