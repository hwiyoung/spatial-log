# Phase 3 Context Panel Result

Date: 2026-06-04

## Change Summary

Phase 3 refines the Explorer right panel into a selected Item context panel. Marker click and list row click still use the same `selectedItem` state, and the panel is cleared when filters remove the selected Item from `visibleItems`.

Implemented:

- Preview / Identity / ProjectStatus / MetadataGap / SpatialSummary / RelationSummary / ActionFooter panel sections.
- Preview status helper for `available`, `pending`, `missing`, and `failed`.
- Category-specific mock preview labels.
- Draft reason, metadata gap, missing required field, and preview failure display.
- Spatial summary helper based on the same geometry/bbox/fallback marker policy used by the map.
- Relation summary helper for total count, rel-specific counts, and missing target IDs.
- Disabled Phase 4 relation overlay CTA.
- Disabled Draft metadata completion CTA.
- Disabled Project CTA until a route contract exists.

Not added:

- Relationship Graph as Explorer default.
- Relation overlay lines on the map.
- 3D GIS Beta.
- real point cloud/model/tiles/panorama/video/document viewers.
- DB/API schema changes.

## Panel Structure

Code structure:

- `PanelPreviewHero.jsx`
- `PanelIdentitySection.jsx`
- `PanelProjectStatusSection.jsx`
- `PanelMetadataGapSection.jsx`
- `PanelSpatialSummarySection.jsx`
- `PanelRelationSummarySection.jsx`
- `PanelActionFooter.jsx`
- `PreviewPanel.jsx` as the orchestrator

Helper structure:

- `getItemPreviewSummary(item)`
- `getItemSpatialSummary(item)`
- `getItemRelationSummary(item, relationRecords?)`

## Mock Data Cases

Useful items for browser checks:

- `bulguksa-pointcloud-dabotap`: available point cloud preview, geometry marker, relation-rich summary, missing relation targets.
- `seongsu-pc-basement-draft`: Draft point cloud with draft reason and metadata gaps.
- `bulguksa-model-dabotap-photogrammetry`: failed 3D model preview and bbox-derived location.
- `seongsu-model-lobby-bim`: pending 3D model preview and bbox-derived location.
- `seongsu-document-permit-draft`: missing document preview and fallback project location.
- `inbox-document-contract-draft`: failed document preview, fallback project location, Unassigned project context, metadata gaps, missing relation target.

## Preview Status Checks

Validated fixture distribution:

- `available`: 10
- `pending`: 4
- `missing`: 5
- `failed`: 5

Browser examples:

- Available: select `다보탑 2024 LiDAR 스캔`.
- Pending: select `1층 로비 리노베이션 BIM`.
- Missing: select `리노베이션 인허가 메모`.
- Failed: select `다보탑 고해상도 메시 초안` or `계약서 초안`.

## Draft / Metadata Gap Checks

Draft examples:

- `seongsu-pc-basement-draft`
- `seongsu-document-permit-draft`
- `inbox-document-contract-draft`

Expected:

- Draft badge is visible.
- Draft reason is highlighted.
- `missingRequiredFields` are shown as chips.
- `metadataGaps` are shown as a readable list.
- Preview failure reason appears when present.

## Spatial Summary Checks

Validated fixture distribution:

- `Geometry available`: 15
- `BBox-derived location`: 3
- `Fallback project location`: 6
- `No spatial marker`: 0

Browser examples:

- Geometry: `다보탑 2024 LiDAR 스캔`.
- BBox-derived: `1층 로비 리노베이션 BIM` or `다보탑 고해상도 메시 초안`.
- Fallback: `리노베이션 인허가 메모` or `계약서 초안`.

## Relation Summary Checks

Validated relation fixture count:

- total mock relation records: 17

Relation-rich examples:

- `bulguksa-pointcloud-dabotap`: total 5, includes `prev`, `next`, `describedby`, inbound `derived_from`, inbound `describes`, and 2 missing targets.
- `seongsu-model-lobby-bim`: total 4, includes inbound/outbound model-document relations.
- `inbox-document-contract-draft`: total 3 and 1 missing target.

The panel shows relation counts only. No relation lines are drawn on the map in Phase 3.

## Action Footer Limits

- `상세 보기 ->` keeps the existing `/detail/:collection/:itemId` route handoff.
- Mock Detail route behavior is not made part of Phase 3.
- `메타데이터 보완` is visible for Draft Items but disabled.
- `프로젝트 보기` is visible for assigned Items but disabled until a route contract is connected.
- Delete remains limited to non-mock mode.

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
console.log(JSON.stringify({
  items: mockItems.length,
  previewStatus: count(mockItems, item => getItemPreviewSummary(item).status),
  spatialSource: count(mockItems, item => getItemSpatialSummary(item).source),
  relationRecords: mockRelations.length,
  relationRich: getItemRelationSummary(
    mockItems.find(item => item.id === 'bulguksa-pointcloud-dabotap'),
    mockRelations
  ),
}, null, 2))
NODE
```

Result:

- Items: 24.
- Preview status distribution: `available 10`, `pending 4`, `missing 5`, `failed 5`.
- Spatial source distribution: `geometry 15`, `bbox 3`, `fallback 6`.
- Relation records: 17.
- Node printed the existing typeless-package warning for ES module fixture imports; command succeeded.

Frontend build:

```bash
docker compose exec -T frontend npm run build -- --outDir /tmp/spatial-log-frontend-build --emptyOutDir
```

Result:

- Build passed inside the running Compose `frontend` service.
- Vite transformed 125 modules.
- Output path was `/tmp/spatial-log-frontend-build` inside the container.
- Existing warnings remain: Vite CJS API deprecation, dynamic/static import chunking warning, and large bundle warning.
- `node_modules` was not committed or modified.

## Phase 4 Gate

Phase 4 can start when browser checks confirm:

- marker click and list click open the same Context Panel.
- panel close works.
- `no-result-keyword` clears the panel and map markers.
- preview status states are visually distinct.
- Draft reason and metadata gaps are clear.
- spatial summary matches marker placement.
- relation summary counts and missing target warnings are visible.
- no global Relationship Graph or map relation overlay appears by default.

## Remaining Issues

- Browser click tests are still manual only.
- Mock Detail route behavior is not guaranteed by Phase 3.
- Project CTA is intentionally disabled until Project route behavior is specified.
- Real API relation records need a later endpoint/adapter contract if richer relation summary is required outside mock mode.
