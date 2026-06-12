# Historical Decisions Summary

This summary replaces the old archive source files that were removed to keep `docs/` small. Use git history if exact previous text is needed.

## Source Inputs

- The original SAMS product direction was safe storage plus search, with metadata autofill as the adoption-critical differentiator.
- The original UI structure was four pages: Explorer, Detail, Project, Upload.
- May 2026 meeting notes emphasized readable filenames, project/status visibility, Draft handling, relation visibility, upload follow-up, and preview/thumbnail behavior.
- STAC metadata v4 established the fields that still matter for active work: `geometry`, `bbox`, `properties.data_category`, `properties.status`, relation `links`, and asset titles.

## Planning History

- The April implementation plan was real-data oriented and focused on practical UI/UX and upload improvements.
- The June phase plan shifted into mock-first Explorer validation. That was useful for UI exploration, but the current roadmap treats this as a source of drift: v1 needs operating hardening, real-data proof, and Core 3D Spatial Relationship View stabilization before more showcase work.
- The short `meeting_change_phase_traceability.md` was superseded by the 2026-06-05 traceability update. That detailed update was later summarized into this file and the current roadmap.

## Explorer And Relationship Graph

- A graph-first Explorer direction was explicitly rejected.
- Explorer remains a spatial asset discovery surface: filter, map, list, selected item context, preview state, and project/status/category visibility.
- Relationship behavior should stay selected-item scoped in Explorer, or move to Detail as an item-centered mini graph. Global Relationship Graph should not become the default Explorer view.

## Phase Result Logs

- Phase 0 created mock demo mode so Explorer could be checked without backend data.
- Phases 1-4 established map/list sync, Draft/project/status labels, selected item context panel, and selected item relation overlay.
- Phases 6A-6D defined preview/viewer contract, lightweight ViewerShell, image/ortho source handling, and diagnostics. These were UI contracts, not production heavy viewers.
- Phase logs included many browser/manual QA notes and mock port references. They are no longer current operating instructions.

## 3D Renderer History

- Phase 5 introduced optional pseudo-3D Beta while preserving 2D as the default.
- Phase 7B improved designed pseudo-3D but did not deliver enough GIS grounding.
- Phase 7C added a standalone Three.js true-3D spike.
- Phase 7D moved toward MapLibre custom layer plus Three.js, giving the active map-grounded direction.
- Phase 7D-S stabilized the map-grounded renderer enough to make coverage/boundary/LOD the next optional 3D work.
- Superseded ADRs/design specs for pseudo-3D, designed beta, and standalone true-3D were removed because the active ADR is now `docs/adr/ADR-3d-gis-map-grounded-renderer.md`.
- The 2026-06-12 roadmap clarification reclassified 3D relationship understanding as a v1 core capability. The deferred Phase 2 scope is production heavy viewers and conversion pipelines, not the map-grounded relationship view itself.

## Preview And Viewer History

- Heavy viewers such as PDF.js, Potree, Cesium, model-viewer, and production video integration were intentionally deferred.
- `docs/adr/ADR-preview-asset-delivery-policy.md` remains active for the current preview delivery decision.
- Old preview phase logs and design contracts were consolidated into `docs/frontend_contracts.md`.

## Removed Demos And Guides

- Static HTML/JSX demos and scaffold-era Claude Code guides were removed from active history because they duplicate the implemented app and current `CLAUDE.md`.
- Old changelog details were removed from docs; use git history for exact implementation archaeology.
