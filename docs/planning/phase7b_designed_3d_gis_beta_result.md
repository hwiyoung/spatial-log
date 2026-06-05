# Phase 7B Designed 3D GIS Beta Result

Date: 2026-06-05

## Change Summary

Phase 7B implements Option A: Selected Asset Constellation on the existing React/CSS/SVG pseudo-3D renderer.

Implemented:

- selected-centered pseudo-3D constellation layout.
- category-specific marker shape/height/icon policy.
- status/Draft/archived/unknown visual state policy.
- Z/elevation source policy with `bbox-z`, `property-elevation`, and `visual-layer`.
- hover/focus tooltip.
- selected focus card / click pin.
- relation focus line styling for selected Item 1-depth relations.
- improved category/status/Z/relation legend.
- Reset view control.
- mock elevation examples for property-based Z validation.
- Phase 7B manual click test section.

Not implemented:

- real 3D engine.
- three.js, deck.gl, Cesium, Potree, or model-viewer.
- production pointcloud/3D Tiles/model viewer.
- global Relationship Graph.
- all-Item always-on relation rendering.
- multi-hop relation graph.
- DB/API schema changes.

## Option A: Selected Asset Constellation

The 3D GIS Beta now treats the selected Item as the scene focus when an Item is selected.

Behavior:

- selecting an asset enables local scene focus.
- the selected asset is shifted near the scene center.
- related visible assets remain in their relative pseudo-spatial positions and receive stronger relation highlights.
- unrelated assets remain as muted background assets when relation overlay is enabled.
- Reset view turns off local scene centering while keeping the selected Item and Context Panel state.

This keeps the 3D GIS Beta as a spatial asset map, not a global relation board.

## Category / Status / Draft Visual Policy

Added `asset3dVisualPolicy.js`.

Category shape policy:

| data_category | Shape | Meaning |
| --- | --- | --- |
| `pointcloud` | scan tower | tall volumetric scan |
| `3d_model` | model prism | high model block |
| `3d_tiles` | tile stack | high stacked tileset |
| `orthoimage` | map plate | low wide raster plate |
| `image` | photo card | low image card |
| `panorama` | dome card | medium 360 capture |
| `video` | media card | medium-low media card |
| `document` | document sheet | low document asset |

Status policy:

- Draft: warning badge and warning accent.
- Published: category-first visual.
- Archived: muted marker.
- Unknown: neutral marker.
- Selected: strongest focus ring and pin.
- Related: relation-colored ring.
- Hovered/focused: lightweight focus ring without changing selection.

## Z / Elevation Policy

Added `getAsset3dElevation.js`.

Priority:

1. 6-value bbox, interpreted as STAC bbox z center/range.
2. elevation-like properties such as `elevation`, `altitude`, `acquisition_height`, `sensor:altitude`.
3. category-based visual layer height.

Returned distinction:

- `zSource: "bbox-z"` means actual bbox Z was found.
- `zSource: "property-elevation"` means actual elevation-like property was found.
- `zSource: "visual-layer"` means no actual elevation source exists and category visual layer height is used.

Mock data changes:

- `seongsu-pc-basement-draft`: `elevation: -4.2`
- `seongsu-model-lobby-bim`: `elevation: 5.8`
- `seongsu-ortho-rooftop`: `acquisition_height: 82`
- `bulguksa-pointcloud-dabotap`: `elevation: 11.5`

The 6-value bbox path is implemented but not used in mock fixtures because the existing 2D bbox helper currently assumes 4-value bbox ordering.

## Hover Tooltip

Added `Explorer3dTooltip`.

Tooltip shows:

- display label
- data category
- project
- status
- preview status
- relation count
- Z source
- Z/elevation detail

Hover and keyboard focus do not change selected Item. Selection still happens only through click.

## Selected Focus / Click Pin

Added `Explorer3dFocusCard`.

Clicking a marker still calls the existing `onSelectItem(item)` flow from Explorer. The same Context Panel opens or updates.

The 3D scene now also shows:

- selected marker focus ring.
- selected pin.
- fixed selected focus card with title, category, project, status, preview status, relation count, visible/missing relation counts, and Z source.

If the selected Item disappears through filters/search, existing Explorer cleanup clears selected state, Context Panel, overlay, and 3D focus.

## Relation Focus Mode

`Relation3dOverlay` now focuses on line readability:

- only draws when relation overlay is enabled.
- only draws `relationOverlayModel.visibleRelations`.
- preserves Phase 4 relation colors/dashes via `relationStyles`.
- adds source/target endpoint marks.
- shows relation label and inbound/outbound direction label.
- does not draw missing target fake nodes.
- does not draw all relations across all Items.
- does not draw multi-hop relations.

`Explorer3dLegend` shows missing target warnings when relation overlay is enabled.

## Legend / Controls

Added:

- `Explorer3dLegend`
- `Explorer3dControls`

Legend shows:

- category legend.
- status/Draft legend.
- actual elevation vs visual layer meaning.
- selected relation styles when overlay is enabled.
- missing target warning copy.

Controls show:

- Reset view.
- current focus state.
- selected relation view state.

The UI uses "선택 관계 보기" wording and does not introduce "전체 관계 표시".

## 2D / 3D Selection Continuity

Explorer still owns selected Item state.

Confirmed implementation:

- 2D remains default: `useState('2d')` in `Explorer.jsx`.
- 3D Beta remains optional through `ExplorerViewToggle`.
- 3D receives the same `visibleItems`, `selectedItem`, `relationOverlayModel`, `relationRecords`, `collections`, and `mockMode`.
- 3D asset click calls the same `handleSelectItem`.
- Context Panel and ViewerShell flow remain unchanged.
- no-result search still clears selected Item through the existing `visibleItems` cleanup effect.

## Self-Review Result

Checklist:

| Check | Result |
| --- | --- |
| 2D map/list is default | Pass |
| 3D GIS is optional Beta | Pass |
| all relations are not always displayed | Pass |
| only selected Item 1-depth relations display | Pass |
| hover tooltip does not change selection | Pass |
| Context Panel integration remains | Pass |
| Draft/status/project meaning appears in 3D | Pass |
| zSource distinguishes actual vs visual layer | Pass |
| no-result cleanup remains owned by Explorer | Pass |
| package/lockfile unchanged | Pass |
| no new dependency | Pass |

Fix made during self-review:

- changed new `constants` imports to explicit `.js` paths so Node ESM helper validation works.

## Screen Check Method

Open:

```text
http://localhost:13000/?mock=1
http://localhost:17800/?mock=1
```

Checks:

- Confirm Explorer opens in `2D 지도`.
- Toggle `3D GIS Beta`.
- Confirm 24 assets and category-specific shapes.
- Hover a marker and inspect tooltip.
- Select an asset and inspect focus card + Context Panel.
- Select `다보탑 2024 LiDAR 스캔`, enable relation overlay from Context Panel, and verify only selected Item 1-depth relations.
- Confirm missing target warning appears in the 3D legend.
- Click Reset view and confirm Context Panel selection remains.
- Search `no-result-keyword` and confirm empty state and cleanup.

## Manual Click Test Result

`docs/qa/manual_click_test_scenarios.md` now includes Phase 7B checks.

Manual browser clicks were not completed in this shell session. The checklist should be executed in a real browser because previous headless Chrome attempts in this environment failed before Explorer rendered due to MapLibre WebGL context creation.

## Build / Docker Verification

Compose service check:

```bash
docker compose ps
```

Result:

- `frontend` is running in the `sams-hwiyoung` stack.
- frontend port: `13000`.
- nginx port: `17800`.

Helper validation:

```bash
docker compose exec -T frontend node --input-type=module ...
```

Result:

- all Items: 24
- all 3D assets: 24
- Draft filter: 9 Items, 9 3D assets
- Seongsu project filter: 8 Items, 8 3D assets
- no-result keyword: 0 Items, 0 3D assets
- zSource distribution:
  - `property-elevation`: 4
  - `visual-layer`: 20
- shape distribution:
  - 3 assets each for scan tower, model prism, tile stack, map plate, photo card, dome card, media card, document sheet
- focused selected position for `bulguksa-pointcloud-dabotap`: x 50, y 58
- relation-rich selected Item:
  - visible relations: 3
  - missing targets: 2

Docker Compose frontend build:

```bash
docker compose exec -T frontend npm run build -- --outDir /tmp/spatial-log-frontend-build --emptyOutDir
```

Result:

- Build passed.
- Vite transformed 164 modules.
- Output path: `/tmp/spatial-log-frontend-build`.
- Existing warnings remain: Vite CJS API deprecation, dynamic/static import chunking warning, and large bundle warning.

Diff/package checks:

- `git diff --check`: passed.
- package/lockfile diff: none.

## Phase 7C / Next Phase Judgment

Phase 7C can evaluate renderer migration only if the designed Beta proves the interaction and the product needs real camera/layer/picking behavior.

Recommended next step before renderer migration:

- run manual browser click checks for Phase 7B.
- decide whether Phase 7C is renderer migration planning or whether Project/Upload/backend items should be prioritized.

## Remaining Issues

- Manual browser click validation remains.
- Reset view does not implement a real camera reset; it only turns off local selected-centering.
- Z values are pseudo-visual in the current renderer and not spatially accurate 3D terrain height.
- 6-value bbox support exists in the 3D elevation helper, but mock fixtures avoid it to protect the current 2D bbox path.
- Label collision and dense-scene performance remain future renderer migration signals.
