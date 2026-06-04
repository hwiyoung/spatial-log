# Phase 6D Image / Ortho Viewer Diagnostics Result

Date: 2026-06-04

## Change Summary

Phase 6D improves only the `image` / `orthoimage` ViewerShell and adds preview delivery diagnostics needed before production preview delivery work.

Implemented:

- `docs/design/preview_delivery_diagnostics_policy.md`
- `docs/adr/ADR-preview-asset-delivery-policy.md`
- image/ortho zoom in, zoom out, and reset controls
- preview source diagnostics component
- preview delivery load-state policy helpers
- unsupported MIME handling for `image/tiff`
- `mock://` direct image-source guardrail diagnostics
- Phase 6D manual click checklist

Not implemented:

- GeoTIFF tiled viewer
- `geotiff.js`
- PDF.js
- Potree
- Cesium
- `model-viewer`
- panorama renderer
- production video player policy
- preview generation backend
- signed URL/auth backend
- DB/API schema changes
- package or lockfile changes
- global Relationship Graph as Explorer default

## Image / Ortho Usability Improvements

`ViewerImage` now:

- resolves a normalized preview source with `getPreviewAssetSource`.
- attempts browser image loading only for browser-loadable `image` / `orthoimage` sources.
- shows `이미지 로딩 중...` while the browser loads the image.
- switches to fallback on browser `onError`.
- shows zoom controls only in the image/ortho shell frame.
- enables zoom controls only after the image reaches `loaded`.
- resets image scale when the selected source changes.

The implemented controls are:

- zoom out: minimum `50%`
- zoom in: maximum `300%`
- reset: returns to `100%`

Pan is intentionally not implemented in Phase 6D and remains a later usability item.

## Source Diagnostics Model

The diagnostics helper returns:

```js
{
  sourceLabel,
  sourceKind,
  role,
  mimeType,
  urlScheme,
  loadState,
  loadStateLabel,
  isMock,
  isBrokenMock,
  fallbackReason,
  isMockUriBlocked,
  rows,
}
```

The ViewerShell diagnostics panel displays:

- source label
- `sourceKind`
- role
- MIME
- URL scheme
- load state
- mock state
- broken mock state
- fallback reason when present

## Unsupported / Mock / Broken / Missing Handling

Unsupported MIME:

- `image/tiff` is not treated as browser-loadable in Phase 6D.
- TIFF/GeoTIFF assets require a browser-loadable thumbnail/overview/preview image or a later tiled viewer decision.

`mock://`:

- remains a fixture pointer.
- is never returned as direct `<img src>`.
- diagnostics mark it as blocked/fallback when encountered.

Broken URL:

- broken `/mock-preview/...` paths can be attempted as mock image URLs.
- browser `onError` moves the shell to `error` and shows a fallback card.

Missing URL:

- missing preview sources return `sourceKind: fallback`.
- shell shows a placeholder and fallback reason.

## Mock Asset Changes

Updated `frontend/src/mocks/fixtures/mockPreviewAssets.js`:

- `bulguksa-ortho-main-zone` now carries `mimeType: "image/tiff"` to validate unsupported MIME behavior.
- existing loadable inline SVG cases remain:
  - `seongsu-ortho-rooftop`
  - `seongsu-image-facade-set`
- existing broken URL case remains:
  - `inbox-image-field-photo`
- existing missing URL cases remain:
  - `bulguksa-image-drone-set`
  - `inbox-ortho-no-site`

No binary file was added.

## Real API Delivery Handoff Policy

Real API mode should provide STAC assets with:

- named `assets.thumbnail`, `assets.overview`, or `assets.preview`; or
- asset `roles` containing `thumbnail`, `overview`, or `preview`.

Each preview source should include:

- browser-loadable image URL for image/ortho shell loading.
- MIME type when known.
- role.
- human-readable title/label.
- delivery mode decision: public static, authenticated endpoint, signed URL, or preview proxy.

Signed URL issuing, refresh, auth enforcement, and proxy behavior remain backend handoff items and are not implemented in Phase 6D.

## Screen Check Method

Open mock mode:

```text
http://localhost:13000/?mock=1
http://localhost:17800/?mock=1
```

Checks:

- Select `북측 파사드 보수 전 사진 42장`, click preview action, and verify large image preview plus zoom controls.
- Select `옥상 설비 배치 정사영상`, click preview action, and verify orthoimage preview shell.
- Select `경내 주요 권역 정사영상`, click preview action, and verify `image/tiff` unsupported state.
- Select `업로드자 지정 이름 없는 현장 사진`, click preview action, and verify broken URL fallback.
- Select `사이트명 없는 정사영상`, click preview action, and verify missing URL fallback.
- Inspect diagnostics for source kind, role, MIME, URL scheme, loadState, mock state, and fallback reason.
- Switch to `3D GIS Beta`, select an image Item, and use the same preview action.
- Confirm video/document/panorama/3D model/pointcloud/3D Tiles shells still do not open production heavy viewers.

## Manual Click Test Result

`docs/qa/manual_click_test_scenarios.md` now includes Phase 6D checks.

Manual browser clicks were not completed in this shell session. Previous headless Chrome attempts in this environment failed before Explorer rendered because MapLibre could not create a WebGL context. The Phase 6D checklist should be completed in a real browser.

## Build / Docker Verification

Compose service check:

```bash
docker compose ps
```

Result:

- `frontend` is running in the `sams-hwiyoung` stack.
- frontend port: `13000`.
- nginx port: `17800`.

Preview diagnostics helper validation:

```bash
docker compose exec -T frontend node --input-type=module ...
```

Result:

- total mock Items: 24
- category coverage: 3 Items each for all 8 categories
- image/ortho initial load states:
  - `loading`: 3
  - `unsupported`: 1
  - `fallback`: 2
- `directMockUriImageSrc`: 0
- `unsupportedTiffLoadable`: 0
- `brokenCaseCount`: 1
- `missingCaseCount`: 2

Docker Compose frontend build:

```bash
docker compose exec -T frontend npm run build -- --outDir /tmp/spatial-log-frontend-build --emptyOutDir
```

Result:

- Build passed inside the running Compose `frontend` service.
- Vite transformed 158 modules.
- Output path was `/tmp/spatial-log-frontend-build` inside the container.
- Existing warnings remain: Vite CJS API deprecation, dynamic/static import chunking warning, and large bundle warning.

Local frontend build:

```bash
npm run build --prefix frontend -- --outDir /tmp/spatial-log-frontend-local-build --emptyOutDir
```

Result:

- Failed because local `frontend/node_modules` is not installed: `vite: not found`.
- Compose build is the verified build path for this phase.

Package / lockfile check:

- `package.json` and lockfile diff: none.
- No heavy viewer dependency was added.

`git diff --check`:

- Passed.

## Phase 6E Gate

Phase 6E can start after real-browser checks confirm:

- loadable image and orthoimage preview shells render.
- zoom out / zoom in / reset controls work.
- broken URL fallback is visible and does not break the shell.
- missing URL fallback is visible.
- unsupported `image/tiff` is not treated as browser-loadable.
- diagnostics show source kind, role, MIME, URL scheme, loadState, mock state, and fallback reason.
- non-image production heavy viewers remain deferred.

## Remaining Issues

- Manual browser clicks still need to be completed in a real browser.
- Pan controls are not implemented.
- TIFF/GeoTIFF rendering remains deferred.
- Production preview delivery backend strategy remains open for Phase 6E or later.
- Signed URL expiry/refresh UX remains open.
