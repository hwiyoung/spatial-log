# Phase 7A 3D GIS Design Gap Analysis

Date: 2026-06-05

## Goal

Phase 7A compares the current Phase 5 pseudo-3D GIS Beta with the intended "3D GIS relational asset map" direction from the meeting notes and system structure documents.

This is a specification and gap analysis phase. It does not add dependencies, change code, change DB/API schema, or make the 3D view the Explorer default.

## Current Phase 5 Pseudo-3D Beta

The current Beta already does these things:

- keeps Explorer default view as `2D 지도`.
- exposes `3D GIS Beta` as an optional toggle.
- uses the same `visibleItems` as the 2D map/list.
- projects Items to a pseudo-3D CSS/SVG surface with `getAsset3dItems`.
- uses category color/icon from the existing category policy.
- uses approximate category height for visual depth.
- preserves selected Item state across 2D and 3D.
- opens the same Context Panel when a pseudo-3D asset is clicked.
- reuses the selected Item 1-depth relation overlay model.
- draws visible selected-item relation lines in 3D Beta.
- highlights related visible Items when relation overlay is enabled.
- shows missing relation target warning.
- shows active relation legend.
- shows empty state when no visible Items remain.

## Current Phase 5 Gaps

The current Beta is functional but not yet a designed 3D GIS relational asset map.

Key gaps:

- node/card shape is a generic vertical column, not a designed asset card/marker language.
- category visuals rely mostly on color/icon/height, not distinct shape and affordance.
- draft/status/project context is not visible enough in-scene.
- hover is limited to native `title`, not an intentional tooltip.
- click selects an Item, but does not create a clear focus/pin mode inside the 3D scene.
- relation lines are simple SVG lines and labels, without stronger direction or selected-focus treatment.
- legend is only a compact active-rel list, not a full scene guide.
- there is no reset view control.
- there is no explicit camera/zoom/drag interaction.
- no keyboard minimum exists for moving focus across scene Items.
- missing targets are listed, but not visually connected to the selected relation story.
- coincident or close Items can still produce short or overlapping relation lines.
- `docs/input/sams-3d-gis-demo.html` is not present in this checkout, so the meeting demo must be inferred from notes and available screenshots/comments.

## Intended Design Interactions From Inputs

The meeting and UI review inputs imply the 3D GIS view should support:

- readable file/display name on hover.
- click on an icon/card to highlight the same Item in the result list and open context.
- visible project/status/draft context for non-expert users.
- relation visualization centered on the selected Item, not all Items.
- directional and typed relation styling.
- warning when related targets are outside the current visible result set.
- a spatial asset map feeling, not a detached global graph board.
- possible floating animation from the 3D relationship demo, but only if it helps GIS discovery and does not harm readability.
- continuity with Context Panel preview, relation summary, and ViewerShell actions.

## What Current Code Can Do Directly

The current React/CSS/SVG path can support Phase 7B improvements without new dependencies:

- replace columns with designed marker/card variants.
- add category-specific shape language.
- add stronger selected/related/focus rings.
- add in-scene Draft/status badges.
- add compact project/site chips for selected or hovered Item.
- add custom hover tooltip.
- add a click pin/focus label over the selected Item.
- improve relation legend content.
- style relation lines by rel, direction, and selected focus.
- show missing target warning with better copy and rel grouping.
- add a reset view button that returns local scene UI state to default.
- preserve Context Panel and selected Item flow.
- preserve relation overlay toggle semantics.

## What Needs Renderer Or Dependency Work

These are not good Phase 7B targets with the current renderer:

- real camera orbit, free zoom, drag, and tilt.
- map-projected 3D layers with robust picking.
- high-density asset rendering beyond a small mock/demo set.
- true 3D asset meshes, point clouds, 3D Tiles, or terrain.
- spatially accurate 3D height/extrusion based on real z values.
- advanced label occlusion and collision management.
- smooth 2D/3D transition tied to MapLibre camera.

Those require a renderer migration path such as three.js, MapLibre + deck.gl, or Cesium.

## Gap Comparison Table

| Area | Current Phase 5 Beta | Target Designed Beta | Phase 7B Feasibility |
| --- | --- | --- | --- |
| scene layout | fixed pseudo-3D grid and horizon | clearer designed asset-map surface with selected focus zone | feasible with CSS/SVG |
| node/card shape | generic columns | category-specific cards/plates/towers | feasible |
| data_category visual language | color/icon/height | shape + color + icon + height hierarchy | feasible |
| status/draft/project | status ring only, project mostly panel/list | Draft badge and selected project/site chip | feasible |
| relation line style | rel-colored SVG line and text | stronger selected relation styling, direction cue, grouped legend | feasible, arrows limited |
| legend | active rels only | category + relation + status legend | feasible |
| hover tooltip | native browser title | custom tooltip with label/category/status/project | feasible |
| click pin/focus | click selects Item | selected focus card/pin in scene plus Context Panel | feasible |
| reset view | none | reset local focus/tooltip/scene offset state | feasible |
| camera/zoom/drag | none | real camera controls | later renderer work |
| selected item context | Context Panel opens | Context Panel plus in-scene selected summary | feasible |
| relation focus mode | overlay toggle only | selected Item relation focus with related/missing grouping | feasible |
| missing target warning | count and first IDs | grouped by rel with clearer warning copy | feasible |
| 2D/3D toggle behavior | shared state, 2D default | preserve this unchanged | already feasible |
| Context Panel integration | shared selected Item | preserve and make selected-focus intent clearer | already feasible |

## Phase 7B Minimum Design Improvement

Phase 7B should keep the current renderer and improve the designed screen:

- designed category marker/card variants.
- stronger category/status/draft visual language.
- full legend for categories, status, and relation lines.
- custom hover tooltip.
- selected Item focus card/pin.
- related Item highlight polish.
- relation toggle semantics unchanged.
- missing target warning polish.
- reset view control for local scene state.
- Context Panel integration unchanged.
- no global Relationship Graph.

## Phase 7C Or Later

Move these later:

- three.js, deck.gl, or Cesium migration.
- real camera/zoom/drag/orbit.
- terrain, 3D Tiles, point cloud, and model rendering.
- real preview/viewer integration for heavy asset categories.
- multi-hop relation graph.
- relation authoring.
- backend relation endpoint and permission policy.
- label collision and large-scene performance strategy.
