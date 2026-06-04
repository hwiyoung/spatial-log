# Preview Asset Source Contract

Date: 2026-06-04

## Phase 6C Goal

Phase 6C defines how Explorer resolves preview asset URLs from mock preview fixtures and STAC Item assets. It also pilots real image-style loading for `image` and `orthoimage` viewer shells only.

This phase does not make every viewer production-ready. Video, document, panorama, 3D model, point cloud, and 3D Tiles categories keep the Phase 6B lightweight/fallback shell behavior.

## Preview Asset Source Priority

Source lookup order:

1. `mockPreviewAssets[item.id].thumbnailUrl` or `mockPreviewAssets[item.id].previewUrl`
2. `item.assets.thumbnail.href`
3. `item.assets.overview.href`
4. `item.assets.preview.href`
5. First `item.assets.*` entry whose `roles` include `thumbnail`, `overview`, or `preview`
6. Fallback placeholder

Compatibility aliases are allowed for existing fixtures:

- `thumbnailHref` behaves like `thumbnailUrl`
- `previewHref` behaves like `previewUrl`

The returned source is normalized before any shell tries to render it.

## STAC Assets Source Lookup

Real API mode should work from standard STAC `assets` without schema changes.

Preferred named asset keys:

- `assets.thumbnail`
- `assets.overview`
- `assets.preview`

If named keys are absent, the resolver checks `asset.roles` in this order:

1. `thumbnail`
2. `overview`
3. `preview`

The original `data` asset is not automatically used as a browser preview source in Phase 6C. It may be a GeoTIFF, ZIP, LAS, tileset JSON, PDF, video file, or other data object that needs a dedicated viewer or conversion pipeline.

## mockPreviewAssets Source Lookup

Mock mode may provide source fields in `mockPreviewAssets[item.id]`.

Supported fields:

- `thumbnailUrl`
- `previewUrl`
- `thumbnailHref`
- `previewHref`
- `mimeType`
- `label`
- `isBrokenMock`

`thumbnailUrl` and `previewUrl` are preferred names for Phase 6C. Existing `thumbnailHref` and `previewHref` remain supported so older fixtures do not break.

## Image / Orthoimage Source Policy

Only `image` and `orthoimage` can become `isLoadableImage: true` in Phase 6C.

Allowed image source examples:

- `data:image/svg+xml,...`
- `/mock-preview/example.svg`
- `https://.../preview.jpg`
- `http://.../preview.png`

Browser-loadable MIME types:

- `image/avif`
- `image/gif`
- `image/jpeg`
- `image/jpg`
- `image/png`
- `image/svg+xml`
- `image/webp`

`image/tiff` is not considered browser-loadable for Phase 6C. A GeoTIFF or ortho original should produce a thumbnail/overview/preview image asset before it is rendered in the shell.

## Broken URL / Missing URL Fallback Policy

Missing URL:

- returns `sourceKind: fallback`
- sets `url: null`
- sets `isLoadableImage: false`
- shows the shell placeholder

Broken URL:

- may return `isLoadableImage: true` when the scheme and MIME type are otherwise browser-loadable
- the shell attempts `<img>` loading
- `onError` switches to the fallback card
- the shell must not crash or leave an empty viewer

Mock fixtures can mark intentional broken cases with `isBrokenMock: true`.

## URL Scheme Policy

| Scheme | Phase 6C policy |
| --- | --- |
| `data:` | Allowed for image preview tests when the URI starts with `data:image/`. |
| `/mock-preview/...` | Allowed for mock image preview tests. It can also be used for intentional 404/broken URL fallback tests. |
| `mock://` | Not used directly as `<img src>`. It is a mock pointer only and falls back to placeholder. |
| `http(s)` | Allowed for image/ortho preview URLs when MIME type is missing or browser-loadable image MIME. |

Unknown schemes fall back to placeholder.

## Real API Mode Expected Asset Roles

Expected roles:

- `thumbnail`: small browser-loadable preview image.
- `overview`: larger browser-loadable preview image.
- `preview`: viewer-ready lightweight preview image.
- `data`: original data object; not automatically used as Phase 6C image preview.

Real API mode should prefer named assets or roles and should not require DB/API schema changes.

## Normalized Source Model

The source helper returns:

```js
{
  itemId,
  dataCategory,
  sourceKind,
  url,
  mimeType,
  role,
  label,
  isMock,
  isLoadableImage,
  isBrokenMock,
  fallbackReason,
}
```

Missing fields are normalized to safe null/default values.

## Not In Phase 6C

- Production PDF.js viewer.
- Production video player policy.
- `model-viewer` or real model rendering.
- Potree or real point cloud rendering.
- Cesium or real 3D Tiles rendering.
- Panorama renderer.
- DB/API schema changes.
- New heavy dependency.
- Relationship Graph/global graph as Explorer default.
- Making `3D GIS Beta` the Explorer default.

## Hand Off To Phase 6D Or Later

Later phases should decide:

- public/static preview asset serving path.
- signed URL and auth policy for preview assets.
- preview generation job outputs.
- image zoom/pan or ortho-specific viewer behavior.
- PDF.js worker and document preview strategy.
- production video source/range/codec/poster policy.
- model, point cloud, 3D Tiles, and panorama viewer dependency decisions.
