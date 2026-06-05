# Phase 7B Designed 3D GIS Beta Candidate Scope

Date: 2026-06-05

## Phase 7B Goal

Phase 7B should improve the existing optional pseudo-3D GIS Beta into a more readable designed asset-map screen.

It should not add a new renderer dependency and should not make 3D the Explorer default.

## Must

- 현재 3D GIS Beta 디자인 정리.
- legend 개선.
- category/status/draft visual language 정리.
- selected item focus.
- hover tooltip.
- click pin 또는 selected focus.
- relation toggle 의미 유지.
- Context Panel 연동 유지.
- no global graph.

Implementation notes:

- keep `ExplorerViewToggle` default as `2D 지도`.
- keep `Explorer3dGisBeta` as optional sibling view.
- keep selected Item and Context Panel path shared with 2D map/list.
- keep relation overlay selected Item 1-depth only.
- add no dependency.

## Should

- reset view.
- relation style 개선.
- related item highlight 개선.
- missing target warning 개선.
- 2D/3D selection continuity polish.

Implementation notes:

- reset view can reset local tooltip/focus/scene offset state, not a real camera.
- relation style can improve line weight, labels, direction hint, and legend grouping.
- missing target warning should group by rel and explain that targets are outside current filters/results.

## Later

- real 3D engine.
- deck.gl/three.js/Cesium migration.
- real pointcloud/3d_tiles/model viewer.
- multi-hop relation graph.
- relation authoring.

Additional later items:

- real camera/zoom/drag/orbit controls.
- large-scene label collision management.
- terrain/globe.
- production preview generation backend.
- signed URL/auth/proxy delivery.

## Phase 7B Acceptance Gate

Phase 7B can be accepted when:

- Explorer still opens in 2D.
- `3D GIS Beta` remains opt-in.
- 3D scene has clearer marker/card visual language.
- hover/focus tooltip shows readable label and status/project context.
- selected Item focus is visually clear.
- relation overlay still only shows selected Item 1-depth relations.
- missing targets remain warnings only.
- Context Panel and ViewerShell flow still work from 3D selection.
- package and lockfiles are unchanged.
- no global Relationship Graph appears.
