# Preview / Viewer Contract

Date: 2026-06-04

## Phase 6A Goal

Phase 6A defines the preview/viewer contract before any heavy production viewer is added. The Context Panel must clearly show category-aware preview state, action state, and viewer-readiness using mock data.

This phase does not implement real 3D Tiles, point cloud, 3D model, panorama, video, or PDF viewers.

## Preview Status Policy

Supported `previewStatus` values:

- `available`: preview asset exists or a lightweight preview contract is ready.
- `pending`: preview generation, conversion, or inspection is still in progress.
- `missing`: preview asset is missing or conversion has not started.
- `failed`: preview generation failed; `failureReason` should be shown when available.

Unsupported or missing status values fall back to `missing`.

## Data Category Preview / Viewer Policy

| data_category | Phase 6A preview policy | Later viewer direction |
| --- | --- | --- |
| `pointcloud` | lightweight placeholder or thumbnail contract | point cloud renderer |
| `3d_model` | model screenshot or placeholder contract | 3D model viewer |
| `3d_tiles` | tileset placeholder / viewer-needed contract | 3D Tiles renderer |
| `orthoimage` | image-style preview card | image/ortho viewer |
| `image` | image-style preview card | image viewer |
| `panorama` | panorama placeholder card | panorama viewer |
| `video` | video poster/placeholder card | video player |
| `document` | document preview placeholder card | document/PDF viewer |

## viewerType Candidates

Normalized `viewerType` values:

- `thumbnail`
- `image`
- `document`
- `video`
- `panorama`
- `model_screenshot`
- `pointcloud_placeholder`
- `tileset_placeholder`
- `unsupported`

Aliases such as `image-set`, `model-screenshot`, and `3d-tiles-placeholder` are normalized by the preview contract helper.

## Action Policy

Preview actions are contract actions, not production viewer actions.

- `미리보기 열기`: available lightweight preview contract exists, but real heavy viewer is not opened in Phase 6A.
- `썸네일 보기`: thumbnail/poster exists; Phase 6A treats it as mock preview only.
- `변환 필요`: preview is missing and needs conversion or preview generation.
- `뷰어 준비 중`: preview is pending.
- `실패 사유 보기`: preview failed and failure reason should be visible.

The action model includes:

- `actionLabel`
- `actionState`
- `canOpenInline`
- `canOpenDetail`
- `needsConversion`

`canOpenInline` remains false in Phase 6A because heavy viewer modals are not implemented.

## Mock Mode And Real API Mode

Mock mode:

- may use `mockPreviewAssets` to enrich status, preview type, thumbnail URL, and failure reason.
- guarantees category/status coverage for clickable screen validation.

Real API mode:

- reads Item `properties.previewStatus`, `properties.previewType`, `properties.previewFailureReason`, and `assets.thumbnail`.
- falls back safely when fields are absent.
- does not require DB/API schema changes in Phase 6A.

## Not In Phase 6A

- PDF.js integration
- CesiumJS integration
- deck.gl integration
- Potree or point cloud renderer integration
- real 3D Tiles renderer
- real model viewer
- panorama viewer
- video player
- document/PDF viewer
- DB/API schema changes
- global Relationship Graph

## Hand Off To Phase 6B Or Later

Later phases should implement production viewer entry points behind this contract:

- point cloud viewer candidate: Potree or equivalent
- 3D Tiles candidate: CesiumJS or equivalent
- 3D model viewer candidate: lightweight GLTF/model viewer
- panorama viewer candidate: panorama-specific renderer
- video player integration
- document/PDF viewer candidate: PDF.js or server-rendered previews

The Explorer 2D/3D discovery flow should remain independent from those heavy viewer dependencies.
