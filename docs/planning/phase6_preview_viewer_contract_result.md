# Phase 6A Preview / Viewer Contract Result

Date: 2026-06-04

## Change Summary

Phase 6A introduces a category-aware preview/viewer contract for the Explorer Context Panel.

Implemented:

- `getPreviewContract(item, previewAssets?, options?)`
- preview category policy table
- category-aware `PreviewRenderer`
- `PreviewStatusBadge`
- `PreviewActionButton`
- Context Panel preview area using the preview contract
- Context Panel footer preview action using the same contract
- Phase 6A manual click test section

Not implemented:

- real 3D Tiles renderer
- real point cloud renderer
- real 3D model viewer
- panorama viewer
- video player
- document/PDF viewer
- new viewer dependency
- DB/API schema changes

## Preview Contract Model

The contract returns:

- `itemId`
- `dataCategory`
- `status`
- `viewerType`
- `title`
- `description`
- `thumbnailUrl`
- `placeholderLabel`
- `failureReason`
- `actionLabel`
- `actionState`
- `canOpenInline`
- `canOpenDetail`
- `needsConversion`
- `isMock`

`canOpenInline` remains false in Phase 6A because heavy viewer modals are intentionally deferred.

## Data Category Preview Policy

| data_category | Phase 6A display |
| --- | --- |
| `pointcloud` | point cloud lightweight preview / viewer-needed placeholder |
| `3d_model` | model screenshot or placeholder |
| `3d_tiles` | 3D Tiles placeholder / viewer-needed state |
| `orthoimage` | image-style preview card |
| `image` | image-style preview card |
| `panorama` | panorama placeholder |
| `video` | video poster/placeholder |
| `document` | document preview placeholder |

Detailed policy is documented in `docs/design/preview_viewer_contract.md`.

## Preview Status Checks

Validated mock distribution:

- `available`: 10
- `pending`: 4
- `missing`: 5
- `failed`: 5

Screen examples:

- available: `다보탑 2024 LiDAR 스캔`, `옥상 정사영상`
- pending: `1층 로비 리노베이션 BIM`, `프로젝트 미할당 원시 스캔`
- missing: `리노베이션 인허가 메모`, `원본 미분류 영상`
- failed: `계약서 초안`, `불국사 현장 점검 영상`

## Mock Preview Asset Coverage

No fixture expansion was required. Existing `mockPreviewAssets` already covers:

- all 8 data categories
- all 4 preview statuses
- thumbnail and no-thumbnail cases
- failed cases with `failureReason`
- pointcloud, 3D Tiles, and 3D model placeholder/screenshot cases

Validated contract coverage:

- total contracts: 24
- category coverage: 3 Items each for all 8 categories
- viewer types:
  - `thumbnail`: 3
  - `model_screenshot`: 3
  - `tileset_placeholder`: 3
  - `image`: 6
  - `panorama`: 3
  - `video`: 3
  - `document`: 3
- thumbnail contracts: 10
- failed contracts with failure reason: 5
- all contracts have action labels and placeholder labels

## Deferred To Real Viewer Phases

Deferred candidates:

- PDF.js for document/PDF viewer
- CesiumJS for real 3D Tiles/globe
- deck.gl for advanced map/3D layers
- Potree or equivalent for point cloud rendering
- model viewer for GLTF/OBJ-style assets
- panorama renderer
- video player integration

No dependency was added in Phase 6A.

## Screen Check

Open mock mode:

```text
http://localhost:13000/?mock=1
http://localhost:17800/?mock=1
```

Expected:

- Select any Item from map/list/3D Beta.
- Context Panel preview area shows a category-aware card.
- Status is visually distinct.
- Failure reason appears for failed previews.
- Footer preview action label matches contract state.
- Preview action does not open a real heavy viewer.

## Manual Click Test Result

Browser clicks were not automated in this checkout.

The Phase 6A manual checklist was added to `docs/qa/manual_click_test_scenarios.md`.

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
import { mockPreviewAssets } from './src/mocks/fixtures/mockPreviewAssets.js'
import { getPreviewContract } from './src/features/preview/getPreviewContract.js'
const contracts = mockItems.map(item => getPreviewContract(item, mockPreviewAssets, { isMock: true }))
const count = (items, fn) => items.reduce((acc, item) => {
  const key = fn(item)
  acc[key] = (acc[key] || 0) + 1
  return acc
}, {})
console.log(JSON.stringify({
  total: contracts.length,
  byCategory: count(contracts, contract => contract.dataCategory),
  byStatus: count(contracts, contract => contract.status),
  byViewerType: count(contracts, contract => contract.viewerType),
  withThumbnail: contracts.filter(contract => Boolean(contract.thumbnailUrl)).length,
  failedWithReason: contracts.filter(contract => contract.status === 'failed' && contract.failureReason).length,
  actionStates: count(contracts, contract => contract.actionState),
  allHaveActionLabel: contracts.every(contract => Boolean(contract.actionLabel)),
  allHavePlaceholder: contracts.every(contract => Boolean(contract.placeholderLabel)),
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
- Vite transformed 141 modules.
- Output path was `/tmp/spatial-log-frontend-build` inside the container.
- Existing warnings remain: Vite CJS API deprecation, dynamic/static import chunking warning, and large bundle warning.
- `node_modules` was not committed or modified.

## Phase 6B Gate

Phase 6B can start when browser checks confirm:

- all data categories show a category-aware preview card.
- available/pending/missing/failed states are visually distinct.
- failed states expose failure reason.
- pending states show processing/ready-later meaning.
- preview action labels match category/status.
- no heavy viewer opens in Phase 6A.
- 2D map/list/Context Panel/3D Beta flows still work.

## Remaining Issues

- Browser click tests are manual only.
- Preview actions use mock/info behavior and do not open real viewers.
- Real viewer dependency choices are deferred.
- Real API mode may need richer preview fields later, but no schema change was made in Phase 6A.
