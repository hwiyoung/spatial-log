# Preview Delivery Diagnostics Policy

Date: 2026-06-04

## Phase 6D Goal

Phase 6D improves the `image` / `orthoimage` ViewerShell usability and defines preview delivery diagnostics needed before production preview asset delivery work begins.

This phase stays inside the frontend UI contract. It does not implement preview generation, signed URL backends, auth backends, GeoTIFF tiling, or heavy production viewers.

## Image / Ortho Viewer Usability Scope

Phase 6D applies only to:

- `image`
- `orthoimage`

Allowed UI improvements:

- large image preview for browser-loadable preview assets.
- loading and fallback states.
- zoom in / zoom out / reset controls.
- source diagnostics inside the shell.

Not included:

- pan interaction.
- tiled ortho or GeoTIFF viewer.
- geospatial measurement tools.
- image annotation.
- image editing.

Pan remains a later TODO because Phase 6D is only validating basic preview inspection and delivery diagnostics.

## Source Diagnostics Display Policy

The image/ortho shell should show a compact diagnostics panel with:

- source label
- `sourceKind`
- role
- MIME type
- URL scheme
- `loadState`
- `isMock`
- `isBrokenMock`
- fallback reason

Diagnostics are user-facing enough to support QA and handoff conversations, but they are not a replacement for backend observability.

## loadState Policy

Supported `loadState` values:

| loadState | Meaning |
| --- | --- |
| `idle` | No load attempt has started yet. Reserved for later async flows. |
| `loading` | Browser image loading is in progress. |
| `loaded` | Browser image loading succeeded. |
| `error` | Browser image loading failed after a load attempt. |
| `fallback` | No loadable image source exists, or the source is intentionally blocked. |
| `unsupported` | A source exists but is not supported as browser-loadable image preview in this phase. |

`error`, `fallback`, and `unsupported` must keep the shell usable and must not leave an empty viewer frame.

## URL Scheme Policy

| Scheme | Phase 6D policy |
| --- | --- |
| `data:` | Allowed when the URI is an image MIME supported by the browser. |
| `/mock-preview/...` | Allowed for mock/local image previews and intentional broken URL tests. |
| `mock://` | Mock pointer only. Never used directly as `<img src>`. Diagnostics must show that it was blocked. |
| `http(s)` | Allowed for browser-loadable image preview assets, subject to CORS/auth constraints. |

Unknown schemes are fallback/unsupported.

## MIME Policy

Browser-loadable image MIME types:

- `image/avif`
- `image/gif`
- `image/jpeg`
- `image/jpg`
- `image/png`
- `image/svg+xml`
- `image/webp`

`image/tiff` is unsupported in Phase 6D. TIFF/GeoTIFF previews require conversion to a browser-loadable preview image or a later tiled/GeoTIFF viewer decision.

## Signed URL / Auth / Expiry Policy

Phase 6D documents delivery needs only. It does not implement:

- signed URL issuing.
- signed URL refresh.
- auth backend.
- preview proxy backend.
- preview generation backend.

The UI should expose enough diagnostics to distinguish missing, unsupported, expired/broken, and blocked sources once backend delivery work starts.

## CORS / Canvas Notes

Phase 6D uses standard `<img>` rendering and does not draw image pixels to canvas.

Future zoom/pan/canvas tools must account for:

- CORS headers.
- `crossOrigin` image loading.
- tainted canvas rules.
- object storage response headers.
- signed URL expiry while the viewer is open.

## Real API Handoff Requirements

Real API mode should provide STAC assets with one of:

- named `assets.thumbnail`
- named `assets.overview`
- named `assets.preview`
- asset `roles` containing `thumbnail`, `overview`, or `preview`

Each preview source should include:

- browser-loadable image URL.
- MIME type when known.
- role.
- human-readable title/label.
- stable delivery mode: public, authenticated endpoint, signed URL, or proxy.

Original `data` assets remain raw data and are not automatically rendered as image preview in Phase 6D.

## Not In Phase 6D

- GeoTIFF tiled viewer.
- `geotiff.js`.
- PDF.js.
- Potree.
- Cesium.
- `model-viewer`.
- Panorama renderer.
- Production video player policy.
- Preview generation backend.
- Signed URL/auth backend.
- DB/API schema changes.
- Relationship Graph/global graph as Explorer default.
- Making `3D GIS Beta` the Explorer default.

## Hand Off To Phase 6E Or Later

Later phases should decide:

- preview asset delivery backend pattern.
- signed URL refresh and expiry UX.
- authenticated preview endpoint contract.
- server-rendered preview proxy strategy.
- image pan controls.
- tiled ortho/GeoTIFF viewer strategy.
- preview generation job outputs and object storage layout.
