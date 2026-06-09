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

## Phase 7B Designed 3D GIS Beta Checks

Use the same mock entry point:

```text
http://localhost:13000/?mock=1
http://localhost:17800/?mock=1
```

| # | Scenario | Click / Input | Expected Result | Status |
| --- | --- | --- | --- | --- |
| P7B-1 | Mock Explorer 열기 | Open `/?mock=1`. | Explorer opens in the default `2D 지도` view with map/list/filter visible. | Ready |
| P7B-2 | 3D GIS Beta 선택 | Click `3D GIS Beta`. | Optional pseudo-3D view opens; 2D remains the default when reloading. | Ready |
| P7B-3 | mock item count | Inspect Beta badge and scene. | 24 mock assets are represented in the 3D scene. | Ready |
| P7B-4 | category visual language | Inspect all categories. | pointcloud/model/tiles are tall/volumetric; image/ortho/document are low card/plate; icons differ by category. | Ready |
| P7B-5 | Draft visual | Select or inspect Draft Items. | Draft Items show warning accent/ring/badge. | Ready |
| P7B-6 | hover tooltip | Hover or keyboard-focus an asset marker. | Tooltip appears without changing selected Item. | Ready |
| P7B-7 | zSource meaning | Inspect tooltip. | Tooltip shows whether Z is actual elevation property/bbox Z or visual layer. | Ready |
| P7B-8 | asset click focus | Click an asset marker. | Existing `onSelectItem` flow opens Context Panel and selected focus card/frame appears in 3D. | Ready |
| P7B-9 | relation-rich selected Item | Select `다보탑 2024 LiDAR 스캔`, then click `지도에서 관계 보기` / selected relation CTA in Context Panel. | Only selected Item 1-depth relations appear in 3D. | Ready |
| P7B-10 | relation line/legend | Inspect active relation lines and legend. | Relation style matches Phase 4 relation types; legend says selected relation view, not global graph. | Ready |
| P7B-11 | missing target warning | Use a relation-rich Item with missing targets. | Missing target warning appears in the 3D legend/warning area without fake nodes. | Ready |
| P7B-12 | Reset view | Click `Reset view`. | Scene returns to spatial layout while Context Panel selection remains available. | Ready |
| P7B-13 | Draft filter | Click Draft filter. | 9 results and 9 3D assets remain. | Ready |
| P7B-14 | project filter | Click `성수동 오피스 리노베이션` or another project filter. | 8 results and 8 3D assets remain. | Ready |
| P7B-15 | no-result cleanup | Search `no-result-keyword`. | 3D empty state appears; panel/focus/overlay are cleared. | Ready |
| P7B-16 | 2D/3D continuity | Select an Item in 3D, then switch to 2D. | Same selected Item and Context Panel remain. | Ready |
| P7B-17 | no global graph | Inspect Explorer. | No global Relationship Graph board appears. | Ready |
| P7B-18 | heavy viewer guardrail | Click around 3D assets without using preview action. | No production heavy viewer opens from the 3D scene itself. | Ready |

Phase 7B helper validation:

```bash
docker compose exec -T frontend node --input-type=module - <<'NODE'
import { mockRelations } from './src/mocks/fixtures/mockRelations.js'
import { mockExplorerDataSource } from './src/mocks/mockExplorerDataSource.js'
import { getAsset3dItems } from './src/features/explorer-3d/getAsset3dPosition.js'
import { getSelectedRelationOverlay } from './src/features/relations/getSelectedRelationOverlay.js'
const count = (items, fn) => items.reduce((acc, item) => {
  const key = fn(item)
  acc[key] = (acc[key] || 0) + 1
  return acc
}, {})
const search = async params => (await mockExplorerDataSource.search(params)).data.features
const all = await search({})
const draft = await search({ status: 'draft' })
const seongsu = await search({ collectionId: 'seongsu-office-renovation' })
const none = await search({ keyword: 'no-result-keyword' })
const all3d = getAsset3dItems(all)
const focused3d = getAsset3dItems(all, { selectedId: 'bulguksa-pointcloud-dabotap', focusSelected: true })
const byId = Object.fromEntries(all.map(item => [item.id, item]))
const overlay = getSelectedRelationOverlay({
  selectedItem: byId['bulguksa-pointcloud-dabotap'],
  visibleItems: all,
  relationRecords: mockRelations,
})
const focusedSelected = focused3d.find(asset => asset.itemId === 'bulguksa-pointcloud-dabotap')
console.log({
  allItems: all.length,
  all3dAssets: all3d.length,
  draftItems: draft.length,
  draft3dAssets: getAsset3dItems(draft).length,
  seongsuItems: seongsu.length,
  seongsu3dAssets: getAsset3dItems(seongsu).length,
  noResultItems: none.length,
  noResult3dAssets: getAsset3dItems(none).length,
  zSourceDistribution: count(all3d, asset => asset.elevation.zSource),
  shapeDistribution: count(all3d, asset => asset.visualPolicy.shape),
  focusedSelectedPosition: focusedSelected ? { x: Math.round(focusedSelected.x), y: Math.round(focusedSelected.y) } : null,
  relationRichSelected: {
    visible: overlay.visibleRelations.length,
    missing: overlay.missingTargets.length,
  },
})
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

## Phase 5 3D GIS Beta Checks

Use the same mock entry point:

```text
http://localhost:13000/?mock=1
http://localhost:17800/?mock=1
```

| # | Scenario | Click / Input | Expected Result | Status |
| --- | --- | --- | --- | --- |
| P5-1 | Mock Explorer 열기 | Open `/?mock=1`. | Mock Demo Mode badge appears. | Ready |
| P5-2 | 기본 view 확인 | Observe the main map area. | Default view is `2D 지도`. | Ready |
| P5-3 | 3D Beta 열기 | Click `3D GIS Beta`. | 3D GIS Beta surface and Beta badge appear. | Ready |
| P5-4 | 전체 24건 표시 | Clear all filters in 3D Beta. | 24 mock assets appear as pseudo-3D assets. | Ready |
| P5-5 | Draft filter sync | Click `Draft`. | 9 assets remain in 3D Beta. | Ready |
| P5-6 | Project filter sync | Click `성수동 오피스 리노베이션`. | 8 assets remain in 3D Beta. | Ready |
| P5-7 | Category filter sync | Click a category filter such as `문헌정보`. | 3D Beta reflects the same filtered result set. | Ready |
| P5-8 | 3D asset click | Click any pseudo-3D asset. | Existing Context Panel opens for that Item. | Ready |
| P5-9 | Relation overlay reuse | Select `다보탑 2024 LiDAR 스캔`, click `지도에서 관계 보기`, then switch to 3D Beta. | 3D Beta shows selected relation context with lines/highlights/warning. | Ready |
| P5-10 | Empty state | Search `no-result-keyword`. | 3D Beta shows empty state. | Ready |
| P5-11 | Return to 2D | Click `2D 지도`. | Existing 2D map/list/panel flow remains available. | Ready |
| P5-12 | Global graph guardrail | Inspect 3D Beta. | No global Relationship Graph board appears. | Ready |
| P5-13 | Viewer guardrail | Click pointcloud/model/tiles assets. | No real 3D Tiles, point cloud, or model viewer opens. | Ready |

Phase 5 helper validation:

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
const none = await search({ keyword: 'no-result-keyword' })
const byId = Object.fromEntries(all.map(item => [item.id, item]))
const overlay = getSelectedRelationOverlay({
  selectedItem: byId['bulguksa-pointcloud-dabotap'],
  visibleItems: all,
  relationRecords: mockRelations,
})
console.log({
  all3dAssets: getAsset3dItems(all).length,
  draft3dAssets: getAsset3dItems(draft).length,
  seongsu3dAssets: getAsset3dItems(seongsu).length,
  noResult3dAssets: getAsset3dItems(none).length,
  relationOverlay: {
    visible: overlay.visibleRelations.length,
    missing: overlay.missingTargets.length,
  },
})
NODE
```

## Phase 6A Preview / Viewer Contract Checks

Use the same mock entry point:

```text
http://localhost:13000/?mock=1
http://localhost:17800/?mock=1
```

| # | Scenario | Click / Input | Expected Result | Status |
| --- | --- | --- | --- | --- |
| P6A-1 | Mock Explorer 열기 | Open `/?mock=1`. | Mock Demo Mode badge appears. | Ready |
| P6A-2 | pointcloud available | Click `다보탑 2024 LiDAR 스캔`. | Point cloud preview contract and available state are visible. | Ready |
| P6A-3 | pointcloud draft/pending | Click `지하 기계실 LiDAR 스캔` and `프로젝트 미할당 원시 스캔`. | Draft metadata and pointcloud pending/available contract states are visible. | Ready |
| P6A-4 | 3d_model preview | Click `1층 로비 리노베이션 BIM` or `다보탑 고해상도 메시 초안`. | Model screenshot/placeholder contract is visible. | Ready |
| P6A-5 | 3d_tiles placeholder | Click `성수동 외피 3D Tiles 초안` or `경내 주변 지형 3D Tiles`. | 3D Tiles placeholder / viewer-needed state is visible. | Ready |
| P6A-6 | orthoimage preview | Click `옥상 정사영상`. | Image-style preview card is visible. | Ready |
| P6A-7 | image preview | Click `북측 파사드 보수 전 사진 42장`. | Image-style preview card is visible. | Ready |
| P6A-8 | panorama placeholder | Click `대웅전 전면 파노라마` or `로비 360 파노라마`. | Panorama preview placeholder or failure state is visible. | Ready |
| P6A-9 | video placeholder | Click `불국사 현장 점검 영상` or another video Item. | Video preview placeholder or poster state is visible. | Ready |
| P6A-10 | document placeholder | Click `리노베이션 인허가 메모` or `계약서 초안`. | Document preview placeholder is visible. | Ready |
| P6A-11 | failed preview | Click a failed Item such as `계약서 초안`. | Failure reason is visible. | Ready |
| P6A-12 | pending preview | Click `1층 로비 리노베이션 BIM`. | Pending/processing state is visible. | Ready |
| P6A-13 | missing preview | Click `리노베이션 인허가 메모`. | Missing preview state is visible. | Ready |
| P6A-14 | preview action label | Inspect panel footer. | Preview action button text matches category/status contract. | Ready |
| P6A-15 | heavy viewer guardrail | Click preview action if enabled. | No real heavy viewer modal opens; mock/future state is clear. | Ready |
| P6A-16 | 2D/3D consistency | Toggle 2D/3D Beta after selecting an Item. | Same preview contract remains in Context Panel. | Ready |

Phase 6A helper validation:

```bash
docker compose exec -T frontend node --input-type=module - <<'NODE'
import { mockItems } from './src/mocks/fixtures/mockItems.js'
import { mockPreviewAssets } from './src/mocks/fixtures/mockPreviewAssets.js'
import { getPreviewContract } from './src/features/preview/getPreviewContract.js'
const contracts = mockItems.map(item => getPreviewContract(item, mockPreviewAssets, { isMock: true }))
const count = (items, fn) => items.reduce((acc, item) => {
  const key = fn(item)
  acc[key] = (acc[key] || 0) + 1
  return acc
}, {})
console.log({
  total: contracts.length,
  byCategory: count(contracts, contract => contract.dataCategory),
  byStatus: count(contracts, contract => contract.status),
  byViewerType: count(contracts, contract => contract.viewerType),
  failedWithReason: contracts.filter(contract => contract.status === 'failed' && contract.failureReason).length,
  actionStates: count(contracts, contract => contract.actionState),
})
NODE
```

## Phase 6B Lightweight Viewer Shell Checks

Use the same mock entry point:

```text
http://localhost:13000/?mock=1
http://localhost:17800/?mock=1
```

| # | Scenario | Click / Input | Expected Result | Status |
| --- | --- | --- | --- | --- |
| P6B-1 | Mock Explorer 열기 | Open `/?mock=1`. | Mock Demo Mode badge appears; default view is `2D 지도`. | Ready |
| P6B-2 | image shell | Click an `image` Item such as `북측 파사드 보수 전 사진 42장`, then click `썸네일 보기` or the preview action. | Image-style ViewerShell opens with a large image card or image placeholder. | Ready |
| P6B-3 | orthoimage shell | Click `옥상 정사영상` or another `orthoimage` Item, then click preview action. | Image-style ViewerShell opens for the orthoimage. | Ready |
| P6B-4 | video shell | Click a `video` Item such as `성수동 안전 점검 영상`, then click preview action. | Video shell opens with HTML video only if a playable mock URL exists; otherwise poster/placeholder appears. No autoplay. | Ready |
| P6B-5 | document shell | Click `불국사 정밀실측 보고서` or `리노베이션 인허가 메모`, then click preview action. | Document placeholder shell opens. PDF.js does not load. | Ready |
| P6B-6 | panorama failed shell | Click `대웅전 전면 파노라마` or another failed panorama, then click `실패 사유 보기`. | Failure shell opens and shows failure reason. | Ready |
| P6B-7 | 3d_model pending shell | Click `1층 로비 리노베이션 BIM`, then click `뷰어 준비 중`. | Pending shell opens and explains viewer preparation state. | Ready |
| P6B-8 | 3d_model failed shell | Click `다보탑 고해상도 메시 초안`, then click `실패 사유 보기`. | Failure shell opens and shows failure reason. | Ready |
| P6B-9 | pointcloud shell | Click `다보탑 2024 LiDAR 스캔` or another pointcloud Item, then click preview action. | Point cloud lightweight / viewer-needed shell opens. Potree does not load. | Ready |
| P6B-10 | 3d_tiles missing shell | Click `성수동 외피 3D Tiles 초안`, then click `변환 필요`. | Conversion-needed / tileset viewer-needed shell opens. Cesium or 3D Tiles renderer does not load. | Ready |
| P6B-11 | shell close | Click `닫기`, backdrop, or press `Escape`. | ViewerShell closes and Explorer state remains. | Ready |
| P6B-12 | selected item change cleanup | Open a shell, then select another map marker/list row. | Open shell closes because Phase 6B uses close-on-selection-change. | Ready |
| P6B-13 | no-result cleanup | Open a shell, then search `no-result-keyword`. | ViewerShell and Context Panel close; result list and map/3D assets clear. | Ready |
| P6B-14 | 3D GIS Beta entry | Switch to `3D GIS Beta`, select an asset, then click Context Panel preview action. | Same ViewerShell opens from the shared selected Item flow. | Ready |
| P6B-15 | heavy viewer guardrail | Inspect shell behavior for document, model, pointcloud, 3D Tiles, and panorama. | No PDF.js, model-viewer, Potree, Cesium, or panorama renderer opens. | Ready |

Phase 6B helper validation:

```bash
docker compose exec -T frontend node --input-type=module - <<'NODE'
import { mockItems } from './src/mocks/fixtures/mockItems.js'
import { mockPreviewAssets } from './src/mocks/fixtures/mockPreviewAssets.js'
import { getPreviewContract } from './src/features/preview/getPreviewContract.js'
const contracts = mockItems.map(item => getPreviewContract(item, mockPreviewAssets, { isMock: true }))
const count = (items, fn) => items.reduce((acc, item) => {
  const key = fn(item)
  acc[key] = (acc[key] || 0) + 1
  return acc
}, {})
console.log({
  total: contracts.length,
  shellOpenable: contracts.filter(contract => contract.canOpenInline).length,
  byCategory: count(contracts, contract => contract.dataCategory),
  byStatus: count(contracts, contract => contract.status),
  actionStates: count(contracts, contract => contract.actionState),
  failedWithReason: contracts.filter(contract => contract.status === 'failed' && contract.failureReason).length,
})
NODE
```

## Phase 6C Preview Asset Source / Image-Ortho Pilot Checks

Use the same mock entry point:

```text
http://localhost:13000/?mock=1
http://localhost:17800/?mock=1
```

| # | Scenario | Click / Input | Expected Result | Status |
| --- | --- | --- | --- | --- |
| P6C-1 | Mock Explorer 열기 | Open `/?mock=1`. | Mock Demo Mode badge appears; default view is `2D 지도`. | Ready |
| P6C-2 | image loadable source | Click `북측 파사드 보수 전 사진 42장`, then click preview action. | ViewerShell opens and loads a large image preview from a normalized source. | Ready |
| P6C-3 | orthoimage loadable source | Click `옥상 정사영상`, then click preview action. | ViewerShell opens and loads a large orthoimage-style preview. | Ready |
| P6C-4 | image broken URL fallback | Click `업로드자 지정 이름 없는 현장 사진`, then click preview action. | Shell attempts the broken mock image URL, then shows fallback card without breaking the shell. | Ready |
| P6C-5 | orthoimage missing URL fallback | Click `사이트명 없는 정사영상`, then click preview action. | Shell shows fallback placeholder because no preview URL is available. | Ready |
| P6C-6 | source metadata | Inspect image/ortho shell footer metadata. | Source label, role, MIME type, source kind, and load state are visible. | Ready |
| P6C-7 | video unchanged | Click a video Item and open shell. | Existing video poster/placeholder shell remains; no production video policy is added. | Ready |
| P6C-8 | document unchanged | Click a document Item and open shell. | Document placeholder remains; PDF.js does not load. | Ready |
| P6C-9 | heavy viewer guardrail | Open pointcloud, 3D Tiles, 3D model, and panorama shells. | Existing viewer-needed shells remain; no heavy viewer opens. | Ready |
| P6C-10 | shell close | Click `닫기`, backdrop, or press `Escape`. | ViewerShell closes. | Ready |
| P6C-11 | selected item cleanup | Open a shell, then select another item. | Open shell closes. | Ready |
| P6C-12 | no-result cleanup | Open a shell, then search `no-result-keyword`. | Shell, Context Panel, list, map, and 3D assets clear. | Ready |
| P6C-13 | 3D GIS Beta source path | Switch to `3D GIS Beta`, select an image Item, then click preview action. | Same normalized image shell opens from the shared selected Item flow. | Ready |
| P6C-14 | package guardrail | Inspect package files. | `package.json` and lockfiles are unchanged; `node_modules` is not committed. | Ready |

Phase 6C helper validation:

```bash
docker compose exec -T frontend node --input-type=module - <<'NODE'
import { mockItems } from './src/mocks/fixtures/mockItems.js'
import { mockPreviewAssets } from './src/mocks/fixtures/mockPreviewAssets.js'
import { getPreviewContract } from './src/features/preview/getPreviewContract.js'
import { getPreviewAssetSource } from './src/features/preview/getPreviewAssetSource.js'
const contracts = mockItems.map(item => ({
  item,
  contract: getPreviewContract(item, mockPreviewAssets, { isMock: true }),
}))
const sources = contracts.map(({ item, contract }) => getPreviewAssetSource(item, contract, mockPreviewAssets))
const imageSources = sources.filter(source => source.dataCategory === 'image')
const orthoSources = sources.filter(source => source.dataCategory === 'orthoimage')
console.log({
  total: sources.length,
  image: imageSources.map(source => ({
    itemId: source.itemId,
    sourceKind: source.sourceKind,
    role: source.role,
    mimeType: source.mimeType,
    isLoadableImage: source.isLoadableImage,
    isBrokenMock: source.isBrokenMock,
  })),
  orthoimage: orthoSources.map(source => ({
    itemId: source.itemId,
    sourceKind: source.sourceKind,
    role: source.role,
    mimeType: source.mimeType,
    isLoadableImage: source.isLoadableImage,
    isBrokenMock: source.isBrokenMock,
  })),
  mockUriDirectImageSrc: sources.filter(source => String(source.url || '').startsWith('mock://')).length,
})
NODE
```

## Phase 6D Image / Ortho Viewer Diagnostics Checks

Use the same mock entry point:

```text
http://localhost:13000/?mock=1
http://localhost:17800/?mock=1
```

| # | Scenario | Click / Input | Expected Result | Status |
| --- | --- | --- | --- | --- |
| P6D-1 | Mock Explorer 열기 | Open `/?mock=1`. | Mock Demo Mode badge appears; default view is `2D 지도`. | Ready |
| P6D-2 | image loadable item | Click `북측 파사드 보수 전 사진 42장`, then click preview action. | Image ViewerShell opens and shows a large browser-loaded image preview. | Ready |
| P6D-3 | image zoom controls | In the image shell, click `+`, `-`, and `Reset`. | Scale percentage changes, image preview scales, and reset returns to 100%. | Ready |
| P6D-4 | orthoimage loadable item | Click `옥상 설비 배치 정사영상`, then click preview action. | Orthoimage ViewerShell opens with the same image-style preview shell. | Ready |
| P6D-5 | source diagnostics | Inspect the diagnostics panel in an image/ortho shell. | `sourceKind`, role, MIME, URL scheme, loadState, mock state, and broken state are visible. | Ready |
| P6D-6 | broken URL fallback | Click `업로드자 지정 이름 없는 현장 사진`, then click preview action. | Broken mock URL attempts to load, then shows fallback card and fallback reason. | Ready |
| P6D-7 | missing URL fallback | Click `사이트명 없는 정사영상`, then click preview action. | Missing source shows placeholder/fallback and fallback reason. | Ready |
| P6D-8 | unsupported MIME | Click `경내 주요 권역 정사영상`, then click preview action. | `image/tiff` is shown as unsupported or conversion-needed; it is not treated as browser-loadable. | Ready |
| P6D-9 | mock URI guardrail | Inspect image/ortho diagnostics and browser DOM if needed. | `mock://` is not used directly as an `<img src>` and appears as blocked/fallback when selected. | Ready |
| P6D-10 | shell close | Click `닫기`, backdrop, or press `Escape`. | ViewerShell closes. | Ready |
| P6D-11 | selected item cleanup | Open a shell, then select another Item. | Open shell closes according to the current cleanup policy. | Ready |
| P6D-12 | no-result cleanup | Open a shell, then search `no-result-keyword`. | Shell, Context Panel, list, map, and 3D assets clear. | Ready |
| P6D-13 | 3D GIS Beta consistency | Switch to `3D GIS Beta`, select an image Item, then click preview action. | Same image/ortho preview shell opens from the shared selected Item flow. | Ready |
| P6D-14 | non-image categories unchanged | Open video, document, 3D model, pointcloud, 3D Tiles, and panorama shells. | Existing placeholder/viewer-needed shells remain; no production heavy viewer opens. | Ready |
| P6D-15 | package guardrail | Inspect package files. | `package.json` and lockfiles are unchanged; `node_modules` is not committed. | Ready |

Phase 6D diagnostics helper validation:

```bash
docker compose exec -T frontend node --input-type=module - <<'NODE'
import { mockItems } from './src/mocks/fixtures/mockItems.js'
import { mockPreviewAssets } from './src/mocks/fixtures/mockPreviewAssets.js'
import { getPreviewContract } from './src/features/preview/getPreviewContract.js'
import { getPreviewAssetSource } from './src/features/preview/getPreviewAssetSource.js'
import { getInitialPreviewLoadState } from './src/features/preview/previewDeliveryPolicy.js'
import { getPreviewSourceDiagnostics } from './src/features/preview/getPreviewSourceDiagnostics.js'
const rows = mockItems.map(item => {
  const contract = getPreviewContract(item, mockPreviewAssets, { isMock: true })
  const source = getPreviewAssetSource(item, contract, mockPreviewAssets)
  const loadState = getInitialPreviewLoadState(source)
  return { item, contract, source, loadState, diagnostics: getPreviewSourceDiagnostics(source, loadState) }
})
console.log({
  total: rows.length,
  imageOrtho: rows
    .filter(row => ['image', 'orthoimage'].includes(row.source.dataCategory))
    .map(row => ({
      itemId: row.item.id,
      dataCategory: row.source.dataCategory,
      sourceKind: row.diagnostics.sourceKind,
      role: row.diagnostics.role,
      mimeType: row.diagnostics.mimeType,
      urlScheme: row.diagnostics.urlScheme,
      loadState: row.diagnostics.loadState,
      isLoadableImage: row.source.isLoadableImage,
      isBrokenMock: row.diagnostics.isBrokenMock,
      fallbackReason: row.diagnostics.fallbackReason,
    })),
  directMockUriImageSrc: rows.filter(row => String(row.source.url || '').startsWith('mock://')).length,
})
NODE
```

## Phase 7C True 3D Renderer Spike Checks

Use the mock entry point:

```text
http://localhost:13000/?mock=1
http://localhost:17800/?mock=1
```

| # | Scenario | Click / Input | Expected Result | Status |
| --- | --- | --- | --- | --- |
| P7C-1 | Default Explorer view | Open `/?mock=1`. | Explorer opens in the 2D map/list view, not 3D. | Ready |
| P7C-2 | Enter 3D Beta | Click `3D GIS Beta`. | Optional 3D GIS Beta opens. | Ready |
| P7C-3 | True renderer mode | Confirm `True 3D spike` mode is active or click it. | Canvas-based Three.js scene is visible; pseudo fallback remains selectable. | Ready |
| P7C-4 | Asset count | Inspect the scene. | 24 mock assets appear as 3D objects. | Ready |
| P7C-5 | Orbit drag | Drag on the canvas. | Camera rotates around the asset constellation. | Ready |
| P7C-6 | Wheel zoom | Use mouse wheel on the canvas. | Camera zooms in/out without changing selection. | Ready |
| P7C-7 | Reset camera | Click `Reset view`. | Camera resets and local focus centering clears while selected Item state remains. | Ready |
| P7C-8 | Category geometry | Compare pointcloud, 3D model, 3D Tiles, orthoimage, image, panorama, video, document. | Categories use distinct true 3D geometry. | Ready |
| P7C-9 | Z/elevation | Inspect tall/raised items and hover tooltip. | Actual elevation vs visual layer is visible in object height/position and tooltip. | Ready |
| P7C-10 | Hover tooltip | Hover a 3D object. | Tooltip appears with label, category, project, status, preview status, relation count, and zSource. | Ready |
| P7C-11 | Click selection | Click a 3D object. | Existing Context Panel opens/updates for that Item. | Ready |
| P7C-12 | Selected focus | Select a relation-rich Item. | Selected object receives strong focus and focus card updates. | Ready |
| P7C-13 | Relation overlay | In Context Panel, enable `선택 관계 보기`. | Only selected Item 1-depth relation lines appear. | Ready |
| P7C-14 | Missing target warning | Select an Item with outside-result relations. | Warning appears; no fake missing target nodes are created. | Ready |
| P7C-15 | Draft filter | Set status filter to Draft. | 9 3D assets remain. | Ready |
| P7C-16 | Project filter | Select the Seongsu project collection. | 8 3D assets remain. | Ready |
| P7C-17 | no-result cleanup | Search `no-result-keyword`. | Scene empty state appears and panel/focus/overlay are cleared. | Ready |
| P7C-18 | 2D continuity | Return to `2D 지도`. | Selection/Context Panel continuity remains owned by Explorer. | Ready |
| P7C-19 | Global graph guardrail | Inspect 3D view. | No global Relationship Graph or all-Item relation board appears. | Ready |
| P7C-20 | Heavy viewer guardrail | Use preview actions from Context Panel. | Production pointcloud/3D Tiles/model/PDF/panorama viewers do not open. | Ready |
| P7C-21 | Dependency guardrail | Inspect package changes. | Only `three` is added; no deck.gl, Cesium, Potree, model-viewer, fiber, or drei. | Ready |

## Phase 7D Map-Grounded 3D GIS Checks

Use the mock entry point:

```text
http://localhost:13000/?mock=1
http://localhost:17800/?mock=1
```

| # | Scenario | Click / Input | Expected Result | Status |
| --- | --- | --- | --- | --- |
| P7D-1 | Default Explorer view | Open `/?mock=1`. | Explorer opens in the 2D map/list view. | Ready |
| P7D-2 | Enter 3D Beta | Click `3D GIS Beta`. | Optional 3D GIS Beta opens. | Ready |
| P7D-3 | Map-grounded mode | Confirm `Map-grounded 3D` mode is active or click it. | MapLibre base map is visible with 3D asset objects above it. | Ready |
| P7D-4 | Georeferenced placement | Compare object positions with the map background and 2D marker geography. | Asset objects appear anchored to their lng/lat positions. | Ready |
| P7D-5 | Map pan/zoom/pitch | Pan, zoom, rotate, and pitch the map. | 3D objects remain aligned with the map. | Ready |
| P7D-6 | Asset click | Click near a 3D asset object. | Existing Context Panel opens/updates for that Item using screen-nearest selection fallback. | Ready |
| P7D-7 | Hover tooltip | Hover near a 3D asset object. | Tooltip appears with label, category, project, status, preview status, relation count, and zSource. | Ready |
| P7D-8 | Selected relation overlay | Select `다보탑 2024 LiDAR 스캔`, then click `지도에서 관계 보기`. | Only selected Item 1-depth relation lines render in the map-grounded 3D layer. | Ready |
| P7D-9 | Missing target warning | Use a relation-rich Item with missing targets. | Warning appears; no fake missing target object is created. | Ready |
| P7D-10 | Fallback modes | Switch to `True 3D constellation`, then `Pseudo fallback`, then back to `Map-grounded 3D`. | All renderer modes remain available for comparison/fallback. | Ready |
| P7D-11 | no-result cleanup | Search `no-result-keyword`. | Map-grounded empty state appears and panel/focus/overlay are cleared. | Ready |
| P7D-12 | Global graph guardrail | Inspect all renderer modes. | No global Relationship Graph or all-Item relation board appears. | Ready |
| P7D-13 | Heavy viewer guardrail | Use preview actions from Context Panel. | Production pointcloud/3D Tiles/model/PDF/panorama viewers do not open. | Ready |
| P7D-14 | Dependency guardrail | Inspect package files. | No package or lockfile change in Phase 7D; existing `three` is reused. | Ready |

## Phase 7D-S Map-Grounded Renderer Stability Checks

Use the mock entry point:

```text
http://localhost:13000/?mock=1
http://localhost:17800/?mock=1
```

| # | Scenario | Click / Input | Expected Result | Status |
| --- | --- | --- | --- | --- |
| P7DS-1 | Default Explorer view | Open `/?mock=1`. | Explorer opens in the 2D map/list view. | Ready |
| P7DS-2 | Enter 3D Beta | Click `3D GIS Beta`. | Optional 3D GIS Beta opens. | Ready |
| P7DS-3 | Map-grounded mode | Confirm `Map-grounded 3D` mode is active. | MapLibre base map and 3D asset objects are visible. | Ready |
| P7DS-4 | 30-second map interaction | Pan, zoom, pitch, and bearing for at least 30 seconds. | Object flicker is materially reduced versus Phase 7D. | Ready |
| P7DS-5 | Hover stability | Hover across several asset objects. | Tooltip appears without scene rebuild/flicker. | Ready |
| P7DS-6 | Asset click | Click near a 3D asset object. | Existing Context Panel opens/updates for that Item. | Ready |
| P7DS-7 | Relation overlay stability | Select `다보탑 2024 LiDAR 스캔`, then toggle `지도에서 관계 보기` on/off. | Relation lines update without repeated flicker. | Ready |
| P7DS-8 | Selected-only relation scope | Inspect active relation lines. | Only selected Item 1-depth relations render. | Ready |
| P7DS-9 | Renderer modes | Switch to `True 3D constellation`, `Pseudo fallback`, and back to `Map-grounded 3D`. | All fallback modes remain available. | Ready |
| P7DS-10 | no-result cleanup | Search `no-result-keyword`. | Empty state appears and panel/focus/overlay are cleared. | Ready |
| P7DS-11 | Global graph guardrail | Inspect all renderer modes. | No global Relationship Graph or all-Item relation board appears. | Ready |
| P7DS-12 | Heavy viewer guardrail | Use preview actions from Context Panel. | Production pointcloud/3D Tiles/model/PDF/panorama viewers do not open. | Ready |
| P7DS-13 | Dependency guardrail | Inspect package files. | No package or lockfile change in Phase 7D-S. | Ready |
