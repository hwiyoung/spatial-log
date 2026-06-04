# Lightweight Viewer Shell Spec

Date: 2026-06-04

## Phase 6B Goal

Phase 6B adds a lightweight viewer shell that opens from the Context Panel preview action. The shell validates viewer entry UX, category-specific fallback content, and preview-status messaging without integrating production heavy viewers.

This phase keeps Explorer as the existing 2D map + result list + Context Panel workflow. `3D GIS Beta` remains an optional pseudo-3D view. Phase 6B does not add Potree, Cesium, PDF.js, model-viewer, panorama renderer, or other heavy viewer dependencies.

## ViewerShell Information Structure

The shell receives:

- `selectedItem`
- `previewContract`
- `mockMode`
- `onClose`

The shell is organized as:

1. Header: display label, `data_category`, preview status, category color/icon.
2. Body: status callout plus category-specific lightweight viewer body.
3. Footer: close action, Detail handoff, mock/future notice.

The shell is a UI contract surface, not a production asset viewer. It can display thumbnails, posters, status text, failure reasons, and viewer-needed placeholders.

## PreviewActionButton To ViewerShell Policy

`PreviewActionButton` uses `getPreviewContract().actionLabel` as its visible label.

- If `actionState` is `disabled`, it must not open the shell. The disabled reason must be visible through button title/description.
- `available` opens the category-specific lightweight shell.
- `pending` opens a preparation shell.
- `missing` opens a conversion-needed shell.
- `failed` opens a failure shell and shows `failureReason` when available.

Phase 6B updates the action contract so pending, missing, and failed states can open informational shells. These are not heavy viewer actions.

## Data Category Shell Policy

| data_category | Phase 6B shell body |
| --- | --- |
| `pointcloud` | Lightweight preview / conversion-needed / viewer-needed shell. Shows thumbnail when present, otherwise explains that a point cloud renderer is deferred. |
| `3d_model` | Screenshot/placeholder shell. Shows thumbnail or model screenshot when present, otherwise explains that model-viewer integration is deferred. |
| `3d_tiles` | Tileset viewer-needed shell. Shows status and explains that Cesium or another 3D Tiles renderer is deferred. |
| `orthoimage` | Image-style shell. Shows a large image card when `thumbnailUrl` exists, otherwise image placeholder. |
| `image` | Image-style shell. Shows a large image card when `thumbnailUrl` exists, otherwise image placeholder. |
| `panorama` | Panorama placeholder shell. Does not add a panorama renderer. Failed panorama cases show failure reason. |
| `video` | HTML video shell only when a playable mock/local URL exists. Otherwise shows poster/placeholder. No autoplay. |
| `document` | Document placeholder or iframe-candidate shell only. Does not add PDF.js. |

## Preview Status Shell Policy

| previewStatus | Shell behavior |
| --- | --- |
| `available` | Opens the category shell and marks it as a lightweight/mock viewer entry. |
| `pending` | Opens a preparation shell. The body explains that preview generation or conversion is pending. |
| `missing` | Opens a conversion-needed shell. The body explains that preview asset generation has not started or is missing. |
| `failed` | Opens a failure shell. The body shows `failureReason` when available and does not attempt to render the failed asset. |

Unknown or unsupported statuses fall back to `missing`.

## Shell Close / Return Behavior

- Close button dismisses the shell and returns to the current Explorer state.
- Backdrop click and `Escape` also close the shell.
- Detail handoff navigates to the existing Detail route for the selected Item.
- Selecting a different Item closes the open shell. The user can reopen the shell from the new Context Panel action.
- If `selectedItem` is cleared, including a `no-result-keyword` search that removes the selected Item from `visibleItems`, the shell closes.

The close-on-selection-change policy prevents stale viewer context while preserving the existing map/list/Context Panel state.

## Relationship To 2D / 3D Beta

- The default Explorer view remains `2D 지도`.
- `3D GIS Beta` remains an optional pseudo-3D view.
- Both 2D markers/list rows and 3D Beta assets reuse the same `selectedItem` and Context Panel flow.
- The viewer shell opens only from the Context Panel preview action, regardless of whether the Item was selected in 2D or 3D Beta.
- The shell does not replace MapLibre, the result list, Context Panel, or the 3D GIS Beta surface.

## Not In Phase 6B

- Production PDF/PDF.js viewer integration.
- Production HTML video integration beyond optional playable mock URLs.
- `model-viewer` or GLTF/OBJ rendering.
- Potree or point cloud renderer integration.
- Cesium or production 3D Tiles renderer integration.
- Panorama renderer integration.
- DB/API schema changes.
- New heavy viewer dependency.
- Relationship Graph/global graph as Explorer default.
- Making `3D GIS Beta` the Explorer default.

## Hand Off To Phase 6C Or Later

Phase 6C or later should decide production viewer integration after the shell UX is validated:

- Document/PDF viewer dependency and worker strategy.
- Video player source contract and local/offline policy.
- 3D model viewer dependency, model format support, and conversion workflow.
- Point cloud renderer and conversion workflow.
- 3D Tiles renderer, tileset URL policy, and offline basemap/terrain concerns.
- Panorama renderer and equirectangular metadata requirements.
- Real API preview fields if the existing STAC properties/assets contract is insufficient.
