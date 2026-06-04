# Phase 6C Preview Asset Source + Image/Ortho Viewer Pilot Result

Date: 2026-06-04

## Change Summary

Phase 6C adds a normalized preview asset source resolver and uses it only for the `image` / `orthoimage` ViewerShell pilot.

Implemented:

- `docs/design/preview_asset_source_contract.md`
- `getPreviewAssetSource(item, previewContract, previewAssets)`
- preview asset source policy helpers
- mock image/ortho source coverage for loadable, broken, and missing cases
- image/ortho shell loading state
- image load error fallback
- source metadata display inside the shell
- Phase 6C manual click checklist

Not implemented:

- production PDF.js viewer
- production video player policy
- production 3D model viewer
- production point cloud viewer
- production 3D Tiles renderer
- panorama renderer
- DB/API schema changes
- package or lockfile changes
- global Relationship Graph as Explorer default

## Preview Asset Source Model

The normalized helper returns:

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

Source priority:

1. `mockPreviewAssets[item.id].thumbnailUrl` or `previewUrl`
2. `item.assets.thumbnail.href`
3. `item.assets.overview.href`
4. `item.assets.preview.href`
5. first asset whose roles include `thumbnail`, `overview`, or `preview`
6. fallback placeholder

Existing fixture aliases remain supported:

- `thumbnailHref`
- `previewHref`

## Image / Orthoimage Viewer Pilot

Only `image` and `orthoimage` can become `isLoadableImage: true` in Phase 6C.

`ViewerImage` now:

- reads `getPreviewAssetSource`.
- attempts `<img>` only for loadable image sources.
- shows `이미지 로딩 중...` while loading.
- switches to a fallback card on `onError`.
- shows source label, kind, role, MIME type, and load state.
- keeps broken and missing cases contained inside the shell.

Other categories continue using the Phase 6B shell components.

## Broken / Missing Fallback Behavior

Broken URL:

- `inbox-image-field-photo` uses `/mock-preview/broken-field-photo.svg`.
- The shell attempts image loading.
- Browser `onError` switches to fallback.
- The shell remains usable.

Missing URL:

- `inbox-ortho-no-site` has no preview URL.
- The helper returns `sourceKind: fallback`.
- The shell shows placeholder/fallback.

`mock://`:

- remains a mock pointer.
- is never returned as a loadable `<img src>`.

## Mock Asset Changes

Updated `frontend/src/mocks/fixtures/mockPreviewAssets.js`:

- `seongsu-ortho-rooftop`: added `thumbnailUrl` and `mimeType` for a loadable ortho image.
- `seongsu-image-facade-set`: added `previewUrl` and `mimeType` for a loadable image preview.
- `inbox-image-field-photo`: changed to intentional broken mock preview URL with `isBrokenMock: true`.
- `inbox-ortho-no-site`: remains the missing ortho URL case.

No binary file was added. The loadable previews use inline SVG data URIs.

## Real API Handoff Policy

Real API mode should provide STAC assets with one of:

- named `assets.thumbnail`
- named `assets.overview`
- named `assets.preview`
- asset `roles` containing `thumbnail`, `overview`, or `preview`

Expected role meaning:

- `thumbnail`: small browser-loadable preview image.
- `overview`: larger browser-loadable preview image.
- `preview`: viewer-ready browser-loadable image.
- `data`: original asset, not automatically used as the image preview in Phase 6C.

No DB/API schema change is required for Phase 6C.

## Screen Check Method

Open mock mode:

```text
http://localhost:13000/?mock=1
http://localhost:17800/?mock=1
```

Checks:

- Select `북측 파사드 보수 전 사진 42장` and click preview action.
  - Expected: image shell loads a large SVG preview.
- Select `옥상 설비 배치 정사영상` and click preview action.
  - Expected: orthoimage shell loads a large SVG preview.
- Select `업로드자 지정 이름 없는 현장 사진` and click preview action.
  - Expected: broken mock source falls back safely.
- Select `사이트명 없는 정사영상` and click preview action.
  - Expected: missing source shows fallback placeholder.
- Switch to `3D GIS Beta`, select an image Item, and use the same preview action.
  - Expected: same shell behavior.

## Manual Click Test Result

`docs/qa/manual_click_test_scenarios.md` now includes Phase 6C checks.

Manual browser clicks were not completed in this shell session. Previous headless Chrome attempts in this environment failed before Explorer rendered because MapLibre could not create a WebGL context. The Phase 6C checks should be completed in a real browser.

## Build / Docker Verification

Compose service check:

```bash
docker compose ps
```

Result:

- `frontend` is running in the `sams-hwiyoung` stack.
- feature-stack frontend port: `13000`.
- feature-stack nginx port: `17800`.

Preview asset source validation:

```bash
docker compose exec -T frontend node --input-type=module ...
```

Result:

- total sources: 24
- category coverage: 3 Items each for all 8 categories
- source kinds:
  - `mock_preview_asset`: 19
  - `fallback`: 5
- image:
  - total: 3
  - loadable: 2
  - broken mock: 1
  - fallback: 1
- orthoimage:
  - total: 3
  - loadable: 2
  - fallback: 1
- `mock://` URLs returned as direct image src: 0

The command succeeded inside the running Compose `frontend` service. Node printed the existing typeless-package ES module warning.

Real API source lookup smoke:

- synthetic `assets.thumbnail` with `image/jpeg`: loadable.
- synthetic `assets.overview` with `image/webp`: loadable.
- synthetic `assets.preview` with `image/png`: loadable.
- synthetic role-based `roles: ["preview"]` with `image/svg+xml`: loadable.
- synthetic `mock://` thumbnail pointer: blocked and returned as fallback.

Docker Compose frontend build:

```bash
docker compose exec -T frontend npm run build -- --outDir /tmp/spatial-log-frontend-build --emptyOutDir
```

Result:

- Build passed inside the running Compose `frontend` service.
- Vite transformed 154 modules.
- Output path was `/tmp/spatial-log-frontend-build` inside the container.
- Existing warnings remain: Vite CJS API deprecation, dynamic/static import chunking warning, and large bundle warning.

Local frontend build:

```bash
npm run build --prefix frontend -- --outDir /tmp/spatial-log-frontend-local-build --emptyOutDir
```

Result:

- Failed because local `frontend/node_modules` is not installed: `vite: not found`.
- Compose build is the verified build path for this run.

## Phase 6D Gate

Phase 6D can start after manual browser checks confirm:

- loadable image shell renders for `image`.
- loadable image shell renders for `orthoimage`.
- broken image fallback works.
- missing source fallback works.
- source metadata is visible.
- video/document/panorama/3D model/pointcloud/3D Tiles shells remain lightweight.
- package and lockfiles remain unchanged.

## Remaining Issues

- Manual browser checks still need to be completed in a real browser.
- Image/ortho pilot does not include zoom, pan, tiling, GeoTIFF rendering, or signed URL policy.
- Production viewer dependency decisions remain deferred.
