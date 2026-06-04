# Phase 4 Selected Relation Overlay Result

Date: 2026-06-04

## Change Summary

Phase 4 adds a selected Item 1-depth relation overlay to the existing Explorer 2D map. The overlay is controlled from the Context Panel and uses the same relation source as the panel summary.

Implemented:

- Selected relation overlay helper model.
- Relation target resolver with inbound/outbound direction preservation.
- rel-specific style policy.
- MapLibre GeoJSON relation overlay layer.
- Relation legend.
- Missing relation target map warning.
- Related marker highlight.
- Context Panel `지도에서 관계 보기` toggle.
- Automatic overlay cleanup when selected Item disappears or has no relations.

Not implemented:

- global Relationship Graph board.
- always-on all-Item relation rendering.
- relation markers or lines for targets outside the current visible result set.
- 3D GIS Beta.
- real asset viewers.
- DB/API schema changes.

## Relation Overlay Model

The helper `getSelectedRelationOverlay({ selectedItem, visibleItems, relationRecords })` returns:

- `selectedItemId`
- `relatedItemIds`
- `visibleRelations`
- `missingTargets`

Rules:

- Only relations where the selected Item is the source or target are considered.
- Direction is preserved as `outbound` or `inbound`.
- Visible map lines require the related Item to exist in `visibleItems`.
- Both endpoints must have usable map positions.
- Missing targets remain warnings and do not create markers or lines.
- Duplicate relations are deduped by rel/source/target/counterpart key.

## Relation Styles

Implemented style policy:

| rel | Style |
| --- | --- |
| `derived_from` | solid green line |
| `related` | weak gray dashed line |
| `describedby` | document relation dashed line |
| `describes` | document relation dashed line |
| `prev` | temporal dashed line |
| `next` | temporal dashed line |

The overlay model preserves direction, and line labels include rel and direction text. The legend is the primary rel style guide.

## Marker Highlight Policy

- Selected marker keeps the strongest existing selected scale.
- Related markers get relation-colored border and a subtle outer ring.
- Related marker scale is smaller than selected marker scale.
- Missing targets are not highlighted because they are not visible map Items.

## Missing Target Warning Policy

Missing targets are shown in two places:

- Context Panel Relation Summary.
- Map warning box when overlay is enabled.

Missing targets are not forced into the map. This keeps the overlay scoped to visible search results.

## Panel CTA

The Context Panel Relation Summary CTA now controls overlay state:

- Relation-rich Item: `지도에서 관계 보기` toggles the overlay on.
- Overlay on: CTA changes to `지도 관계 숨기기`.
- No-relation Item: CTA shows `관계 없음` and remains disabled.
- Selected Item changes: overlay model updates to the new selected Item.
- Selected Item cleared by filter/search: overlay is turned off.

## Screen Check

Open mock mode:

```text
http://localhost:13000/?mock=1
http://localhost:17800/?mock=1
```

Useful browser examples:

- `다보탑 2024 LiDAR 스캔`: relation-rich point cloud with 3 visible relation lines and 2 missing targets.
- `1층 로비 리노베이션 BIM`: derived/document relation lines with no missing targets.
- `계약서 초안`: unassigned document with document/related relations and 1 missing target.
- `성수동 옥상 정사영상`: no relation CTA disabled.

## Manual Click Test Result

Browser clicks were not automated in this checkout.

The manual checklist was added to `docs/qa/manual_click_test_scenarios.md` and is ready for browser verification.

Code/data validation confirms:

- `mockRelations`: 17 records.
- `bulguksa-pointcloud-dabotap`: 3 visible relations, 2 missing targets.
- `seongsu-model-lobby-bim`: 4 visible relations, 0 missing targets.
- `inbox-document-contract-draft`: 2 visible relations, 1 missing target.
- Filtered Dabotap pointcloud-only view: 0 visible relations, 5 missing targets.
- `seongsu-ortho-rooftop`: no relations.

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
import { getSelectedRelationOverlay } from './src/features/relations/getSelectedRelationOverlay.js'
const byId = Object.fromEntries(mockItems.map(item => [item.id, item]))
const overlay = selectedId => getSelectedRelationOverlay({
  selectedItem: byId[selectedId],
  visibleItems: mockItems,
  relationRecords: mockRelations,
})
console.log(JSON.stringify({
  relationRecords: mockRelations.length,
  dabotap: {
    visible: overlay('bulguksa-pointcloud-dabotap').visibleRelations.length,
    missing: overlay('bulguksa-pointcloud-dabotap').missingTargets.length,
  },
  seongsuModel: {
    visible: overlay('seongsu-model-lobby-bim').visibleRelations.length,
    missing: overlay('seongsu-model-lobby-bim').missingTargets.length,
  },
  contract: {
    visible: overlay('inbox-document-contract-draft').visibleRelations.length,
    missing: overlay('inbox-document-contract-draft').missingTargets.length,
  },
  noRelation: overlay('seongsu-ortho-rooftop'),
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
- Vite transformed 131 modules.
- Output path was `/tmp/spatial-log-frontend-build` inside the container.
- Existing warnings remain: Vite CJS API deprecation, dynamic/static import chunking warning, and large bundle warning.
- `node_modules` was not committed or modified.

## Phase 5 Gate

Phase 5 can start when browser checks confirm:

- selected Item relation overlay toggles on/off from the Context Panel.
- only selected Item 1-depth relations are drawn.
- visible related markers are highlighted.
- missing targets are warnings only.
- relation legend appears for active rel styles.
- `no-result-keyword` clears markers, panel, and overlay.
- Relationship Graph Beta/global graph is still not the Explorer default.

## Remaining Issues

- Browser click tests are manual only.
- Direction arrows are not implemented; direction is preserved in the model and line labels.
- Coincident endpoints can produce very short lines when two related Items share the same map center.
- Real API mode still needs a relation endpoint/adapter if inbound relations are required beyond selected Item `links`.
