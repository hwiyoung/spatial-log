# Phase 6B Lightweight Viewer Shell Result

Date: 2026-06-04

## Change Summary

Phase 6B adds a lightweight ViewerShell opened from the Context Panel preview action.

Implemented:

- `ViewerShell` overlay with header, body, and footer.
- Category-specific lightweight viewer bodies.
- Preview action button wiring to ViewerShell.
- `available`, `pending`, `missing`, and `failed` shell entry behavior.
- Failure reason display inside the shell.
- Shell close by close button, backdrop, and `Escape`.
- Close-on-selected-Item-change policy.
- No-result cleanup through the existing selected Item clearing flow.
- Phase 6B spec, viewer candidate ADR, and manual click checklist.

Not implemented:

- production heavy viewer integration.
- PDF.js, model-viewer, Potree, Cesium, panorama renderer, or new runtime dependency.
- DB/API schema changes.
- Relationship Graph/global graph.
- `3D GIS Beta` as default Explorer view.

## ViewerShell Structure

Files:

- `frontend/src/components/ViewerShell.jsx`
- `frontend/src/components/ViewerShellHeader.jsx`
- `frontend/src/components/ViewerShellBody.jsx`
- `frontend/src/components/ViewerShellFooter.jsx`

The shell receives:

- selected Item
- preview contract
- `mockMode`
- close callback

The header shows:

- display label
- category label/raw `data_category`
- preview status badge

The body shows:

- status callout
- category-specific lightweight body
- failure reason when `previewStatus` is `failed`

The footer shows:

- close action
- Detail handoff
- mock/future notice

## Category Shell Behavior

| data_category | Phase 6B behavior |
| --- | --- |
| `image` | Large image-style shell when `thumbnailUrl` exists, otherwise image placeholder. |
| `orthoimage` | Same image-style shell as image. |
| `video` | Uses native `<video controls>` only for playable mock/local URLs. Current mock `mock://` URLs show poster/placeholder. No autoplay. |
| `document` | Document placeholder shell only. PDF.js is not added. |
| `panorama` | Panorama placeholder/failure shell only. No panorama renderer is added. |
| `3d_model` | Screenshot/placeholder/failure shell only. `model-viewer` is not added. |
| `pointcloud` | Lightweight/conversion-needed/viewer-needed shell only. Potree is not added. |
| `3d_tiles` | Tileset viewer-needed shell only. Cesium/3D Tiles renderer is not added. |

## Preview Status Behavior

| previewStatus | Phase 6B behavior |
| --- | --- |
| `available` | Opens lightweight category shell. |
| `pending` | Opens preparation shell with pending message. |
| `missing` | Opens conversion-needed shell with missing preview message. |
| `failed` | Opens failure shell and shows `failureReason` when available. |

Phase 6B changes pending/missing action states from disabled to informational shell actions. This lets the user inspect the state without launching a production viewer.

## Action Button Wiring

`PanelActionFooter` computes `getPreviewContract(item, mockPreviewAssets, { isMock: true })` in mock mode and passes the contract to `PreviewActionButton`.

`PreviewActionButton`:

- displays `contract.actionLabel`.
- does not open anything when `actionState` is `disabled`.
- calls the shell opener for non-disabled states.
- colors the action by preview status.

`Explorer` owns `viewerShell` state and renders `ViewerShell` above the existing Explorer layout. If the selected Item changes or is cleared, the open shell closes.

## Deferred To Real Viewer Phases

Deferred candidates are documented in `docs/adr/ADR-viewer-integration-candidates.md`:

- PDF.js for document/PDF viewer.
- Native HTML video production source policy.
- `model-viewer` or equivalent for 3D models.
- Potree or equivalent for point clouds.
- Cesium or equivalent for 3D Tiles.
- Panorama viewer TBD.

## Screen Check Method

Open mock mode:

```text
http://localhost:13000/?mock=1
http://localhost:17800/?mock=1
```

Expected:

- Explorer starts in `2D 지도`.
- `3D GIS Beta` remains optional.
- Select an Item from the list/map/3D Beta.
- Context Panel opens.
- Click the preview action.
- ViewerShell opens with category/status-specific body.
- Close button, backdrop, and `Escape` close the shell.
- Selecting another Item closes the shell.
- Searching `no-result-keyword` clears panel and shell.
- No production heavy viewer opens.

## Manual Click Test Result

`docs/qa/manual_click_test_scenarios.md` now includes the Phase 6B checklist.

Manual browser clicks were not completed in this shell session.

Automated click smoke was attempted with a temporary `/tmp` `puppeteer-core` install and system Chrome, but headless Chrome failed before Explorer rendered because MapLibre could not create a WebGL context in this environment. The app endpoint itself responded with HTTP 200.

The remaining browser confirmation should be done manually in a real browser using the Phase 6B checklist.

## Build / Docker Verification

Compose service check:

```bash
docker compose ps
```

Result:

- `frontend` is running in the `sams-hwiyoung` stack.
- feature-stack frontend port: `13000`.
- feature-stack nginx port: `17800`.

Viewer shell contract validation:

```bash
docker compose exec -T frontend node --input-type=module ...
```

Result:

- total contracts: 24
- category coverage: 3 Items each for all 8 categories
- preview status coverage:
  - `available`: 10
  - `pending`: 4
  - `missing`: 5
  - `failed`: 5
- action states:
  - `mock_only`: 10
  - `info_only`: 14
- shell-openable contracts: 24
- pending shell-openable: 4
- missing shell-openable: 5
- failed shell-openable: 5
- failed contracts with failure reason: 5
- all contracts have action labels and display labels

The command succeeded inside the running Compose `frontend` service. Node printed the existing typeless-package ES module warning.

Docker Compose frontend build:

```bash
docker compose exec -T frontend npm run build -- --outDir /tmp/spatial-log-frontend-build --emptyOutDir
```

Result:

- Build passed inside the running Compose `frontend` service.
- Vite transformed 152 modules.
- Output path was `/tmp/spatial-log-frontend-build` inside the container.
- Existing warnings remain: Vite CJS API deprecation, dynamic/static import chunking warning, and large bundle warning.

Local frontend build:

```bash
npm run build --prefix frontend -- --outDir /tmp/spatial-log-frontend-local-build --emptyOutDir
```

Result:

- Failed because local `frontend/node_modules` is not installed: `vite: not found`.
- Compose build is the verified build path for this run.

Diff hygiene:

```bash
git diff --check
```

Result:

- Passed with no whitespace errors.
- `frontend/package.json` and lockfiles were not modified.
- Heavy viewer names only appear in placeholder/ADR text, not as installed dependencies or imports.

## Phase 6C Gate

Phase 6C can start after manual browser checks confirm:

- ViewerShell opens for all categories.
- pending/missing/failed shell states are understandable.
- shell close/selection cleanup/no-result cleanup works.
- 2D map/list/Context Panel flow is unchanged.
- 3D GIS Beta selection still opens the same Context Panel and shell action.
- no heavy viewer dependency is loaded.

## Remaining Issues

- Manual browser clicks still need to be executed in a real browser because headless Chrome could not initialize MapLibre WebGL in this environment.
- Real production viewer choices remain deferred.
- Real API mode may need richer preview URLs later, but Phase 6B did not change schema.
