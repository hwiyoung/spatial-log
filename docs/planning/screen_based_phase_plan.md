# Screen-Based Explorer Phase Plan

Date: 2026-06-02

## Why The Previous Phase Shape Was Confusing

The earlier planning language centered on adapters, resolvers, graph layouts, and backend-like logic. That made the work sound technically complete even when a user could not open a browser and verify the intended Explorer experience.

For SAMS Explorer, the product risk is not whether a relation object can be transformed. The risk is whether a PM/Searcher can find spatial assets, understand project/status/category context, click an Item, and see enough preview/relation context without relying on live production data.

## Why Screen-Based Phases

Each phase must answer a visible question:

- What does the user see in Explorer?
- What can the user click?
- Which mock data proves the edge case?
- What must remain unchanged from the existing 2D map/list flow?

Backend-like work is allowed only when it feeds a mock API or mock data source with the same shape the screen will consume later.

## Guardrails

- Relationship Graph is not an Explorer default view.
- Relation UI is selected Item only: 1-depth overlay or Detail mini graph.
- Existing 2D map/list behavior stays in place.
- Real 3D Tiles, point cloud, and model viewers are out of scope until Phase 6.
- DB/API schema changes are out of scope for these phases.
- `node_modules` must never be committed.

## Phase Plan

| Phase | Goal | Browser Check | Required Mock Data | Deliverables | Definition Of Done |
| --- | --- | --- | --- | --- | --- |
| Phase 0. Mock Demo Mode | Make Explorer testable without backend data. | Open `/?mock=1`; see Mock Demo Mode badge; mock projects/items load. | 3 projects, 24 Items, all categories/statuses/preview states, mixed geometry coverage. | Mock fixtures, local mock data source, Phase 0 result doc. | User can load map/list/panel from mock data without backend/API availability. |
| Phase 1. Explorer Asset Map 화면 | Make map/list the primary asset discovery surface. | Same mock Items appear in map and list; no-geometry document uses fallback marker. | Geometry Items, bbox-only Items, fallback-only Items. | Item-to-map fallback policy, marker/list sync notes. | Selecting map/list Item opens the same context panel. |
| Phase 2. Draft / Project / Status / Label 화면 | Make Draft/project/status/readable label visible before Detail. | Click Draft filter, project filter, Unassigned filter; badges and readable labels remain visible. | Draft/published/archived/unknown, assigned/unassigned, display name different from original filename. | Status/project filters, label resolver, Draft badge display. | User can identify Draft and project context directly in Explorer. |
| Phase 3. Item 클릭 -> Context Panel 화면 | Show details-on-demand without route change. | Click marker; right Context Panel opens. Click list item; same panel opens. | Items with metadata gaps, draft reason, original filename, preview states. | Context Panel contract and UI. | Panel shows project, status, preview, original filename, metadata gaps, and Detail CTA. |
| Phase 4. 선택 Item 관계 Overlay 화면 | Show only selected Item 1-depth relations. | Select relation-rich Item; only its relation lines/highlights appear; global graph does not appear. | All rel types, missing relation target outside current results. | Relation overlay adapter, rel legend, warning policy. | Relation warning is visible without rendering a global graph board. |
| Phase 5. 3D GIS Beta 화면 | Add optional 3D GIS Beta using the same filters/context/relation contracts. | Toggle 2D map / 3D GIS Beta; selected Item context and relation overlay semantics remain. | Same mock Items; representative 3D positions or bbox elevations if needed. | Renderer ADR, 3D beta route/toggle, dependency review. | 2D remains default and 3D Beta is clearly optional. |
| Phase 6. Preview / Viewer 화면 | Handle data-category preview states and later real viewers. | Check document, panorama, video, 3d_model, pointcloud, 3d_tiles preview fallback states. | `available`, `missing`, `failed`, `pending` preview states across categories. | Preview contract, fallback UI, later viewer integration plan. | Each category gives a clear preview/failure/pending state before real heavy viewers are added. |

## Mock API Principle

Mock data source and future real data source must return the same shape at the screen boundary:

- `/stac/search` returns FeatureCollection-like `features`.
- `/collections` returns Collection-like records.
- `/items/:id` returns one STAC Item-like Feature.
- `/items/:id/relations` returns 1-depth relation records.

The screen should not know whether the source is MSW, local fixture, or real API except for the visible Mock Demo Mode badge.
