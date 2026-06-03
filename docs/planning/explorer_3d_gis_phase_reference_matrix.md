# Explorer 3D GIS Phase Reference Matrix

Date: 2026-06-02

Scope: Re-validate whether SAMS Explorer should move away from a Relationship Graph-first plan and be replanned around a 3D GIS Asset Map. This document is planning-only. No feature implementation is included.

## Decision Frame

Explorer의 중심은 **공간 기반 산출물 탐색**이다.

기존 `Relationship Graph Beta`를 Explorer의 메인 뷰로 승격하는 계획은 폐기 또는 축소한다. 관계 그래프는 다음 중 하나로 재분류한다.

- 선택된 Item 주변의 1-depth 관계 overlay
- Detail 화면의 mini graph 또는 relation tab
- `links.prev` / `links.next` 기반 시계열 보조 네비게이션

즉, Explorer는 먼저 "어디에 어떤 산출물이 있는가"를 보여주고, 관계는 사용자가 특정 Item을 선택했을 때 추가로 드러나는 보조 정보가 되어야 한다.

## Why Relationship Graph Beta Is Not Suitable As The Explorer Main View

1. Explorer의 시스템 역할과 다르다.
   - 시스템 구조 설계서는 Explorer 목적을 "데이터를 찾는다. 시스템의 홈이자 가장 많이 쓰는 화면"으로 정의한다. 구성도도 검색 필터, 2D 지도, 검색 결과 목록을 중심으로 둔다. (`docs/input/sams-system-structure-design.md:45-90`)
   - 관계 그래프는 Detail의 구성 요소로 정의되어 있다. "현재 Item을 중심으로 연결된 모든 Item"을 보여주는 화면은 Detail에 위치한다. (`docs/input/sams-system-structure-design.md:93-140`)

2. 회의 요구의 우선 문제는 global graph가 아니다.
   - 회의 요약은 사람이 읽는 이름, 프로젝트 정보 가시성, Draft 구분, 업로드/미리보기 개선, 관계 설정/시각화를 함께 제기한다. (`docs/input/2026-05-11-sams-meeting-summary.txt:4-10`)
   - 관계는 "프로젝트 내 데이터 간 연관 관계 설정 및 시각화", "방향성과 관계 유형", "다단계 관계 시각화 및 텍스트 기반 표시 우선"으로 표현된다. 이는 전체 Explorer를 graph board로 바꾸라는 요구보다, asset 탐색과 detail discovery를 보강하라는 요구에 가깝다. (`docs/input/2026-05-11-sams-meeting-summary.txt:23-29`)

3. 정보 시각화 원칙과 맞지 않는다.
   - Explorer는 전체 공간 overview를 먼저 보여주고, zoom/filter 이후 필요한 detail을 보여주는 흐름이어야 한다.
   - global relationship graph는 사용자가 위치, project, data_category, status를 파악하기 전에 관계선을 먼저 노출해 인지 부하를 키운다.

4. 현재 spike 결과도 제품 목표와 어긋난다.
   - 기존 P0 graph MVP는 "relationship-first graph board"로 정리되어 있다. (`docs/planning/p0_explorer_graph_mvp_result.md:150`)
   - 이 방향은 `docs/input/sams-3d-gis-demo.html`이 암시한 "3D GIS 공간 안에서 node와 edge를 함께 보는 관계형 asset map"과 다르다.

5. 대용량/실데이터에서 global graph는 곧바로 깨질 가능성이 크다.
   - Explorer 검색 결과가 많아지면 모든 edge를 동시에 보여주는 graph는 clutter가 커진다.
   - STAC `links.href` target이 현재 검색 결과 밖에 있을 수 있어, graph 완성도는 검색 범위와 API target resolution에 의존한다.

## Real Goal Derived From The Meeting

회의 내용에서 도출되는 실제 목표는 다음과 같다.

- 사용자가 산출물을 **공간 위치와 유형 기준으로 빠르게 찾는다**.
- Draft, project, site, data category가 Explorer에서 즉시 보인다.
- 사람이 읽을 수 있는 title/display name을 지도, 목록, Detail, Upload 흐름에서 일관되게 사용한다.
- 관계는 중요하지만, 전체 Explorer를 대체하는 것이 아니라 선택 Item의 이해를 돕는다.
- preview/thumbnail은 Item 선택 후 빠른 판단을 가능하게 하는 Detail/Preview pipeline으로 정식화한다.
- 3D Tiles, point cloud, 3D model viewer는 Explorer overview 이후 Detail/Preview 단계에서 점진적으로 붙인다.

## Internal Role Evidence

| Area | Role Confirmed By Internal Docs | Planning Implication |
| --- | --- | --- |
| Explorer | 통합 검색, 지도 기반 위치 시각화, result list, hover/click 연동. (`docs/input/sams-system-structure-design.md:45-90`) | Explorer main view는 Asset Map이어야 한다. |
| Detail | 선택 Item의 전체 정보, preview, metadata, relation graph, prev/next timeline. (`docs/input/sams-system-structure-design.md:93-140`) | Relationship Graph는 Detail mini graph로 자연스럽다. |
| Project | Collection 단위 관리, 현황, 공간 현황 지도, Draft 목록. (`docs/input/sams-system-structure-design.md:145-299`) | Project는 management dashboard이며, Explorer와 공간 view 일부가 겹치므로 역할 분리가 필요하다. |
| Upload | 새 데이터 등록, Collection 연동, 관계 설정 step, 완료 후 Detail/Project 이동. (`docs/input/sams-system-structure-design.md:332-348`) | Upload 후 Draft/Detail/Project CTA가 Explorer visibility와 연결되어야 한다. |
| User Flow | Searcher는 Explorer에서 찾고 Detail에서 관계 그래프로 관련 데이터를 발견한다. (`docs/input/sams-system-structure-design.md:394-400`) | 관계 discovery는 Detail 중심, Explorer는 entry/overview 중심이다. |

## STAC Metadata v4 Evidence

STAC v4 local design supports an Asset Map-first plan.

| Field | Internal Evidence | Asset Map Use |
| --- | --- | --- |
| `type` | STAC Item core is `GeoJSON Feature`. (`docs/input/stac-metadata-v4-summary.md:13-18`) | Map layer input can be FeatureCollection-like. |
| `geometry` | 공간 범위. (`docs/input/stac-metadata-v4-summary.md:17`) Excel common metadata marks it required and auto/manual source. | Footprint, center, marker, spatial selection. |
| `bbox` | 2D 4값, 3D 6값 가능. (`docs/input/stac-metadata-v4-summary.md:18`) Excel common metadata confirms 3D/2D bbox. | Fast map extent, fit bounds, fallback footprint. |
| `properties.data_category` | enum: `3d_model`, `3d_tiles`, `pointcloud`, `orthoimage`, `image`, `panorama`, `video`, `document`. (`docs/input/stac-metadata-v4-summary.md:41-52`) | Layer styling, icon/shape/color, category filters. |
| `properties.status` | enum: `draft`, `published`, `archived`. (`docs/input/stac-metadata-v4-summary.md:54-62`) | Draft badge/filter, global visibility. |
| `links` | `derived_from`, `related`, `describedby`, `describes`, `prev`, `next`. (`docs/input/stac-metadata-v4-summary.md:24-33`) | Selected Item relation overlay, Detail mini graph, timeline. |
| `assets.{key}.title` | Preferred human-readable label source. (`docs/input/stac-metadata-v4-summary.md:64-68`) | Map label, list label, selected panel title. |
| Collection fields | `properties.project:name`, `project:site`, `project:campaign`. (`docs/input/stac-metadata-v4-summary.md:35-39`) | Project/site grouping and filters. |

Excel cross-check also confirms common availability of `geometry`, `bbox`, `data_category`, `status`, and relation links across data categories. (`docs/input/stac_metadata_design_v4.xlsx`, sheets: `공통 메타데이터`, `크로스체크`)

## External And Technical References

| Reference | What It Confirms | Planning Use |
| --- | --- | --- |
| [STAC Item Specification](https://github.com/radiantearth/stac-spec/blob/master/item-spec/item-spec.md) | A STAC Item is a GeoJSON Feature augmented with STAC fields. `id`, `type`, `bbox`, `geometry`, and `properties` are inherited from GeoJSON. | Explorer Item data should first be treated as geospatial features, not abstract graph nodes. |
| [MapLibre GeoJSONSource](https://maplibre.org/maplibre-gl-js/docs/API/classes/GeoJSONSource/) | MapLibre accepts GeoJSON sources and re-renders when `setData()` receives GeoJSON. | Existing MapLibre Explorer can render STAC Items as GeoJSON layers without changing the data model. |
| [deck.gl GeoJsonLayer](https://deck.gl/docs/api-reference/layers/geojson-layer) | deck.gl provides GeoJSON-based point/line/polygon rendering and 3D extrusion options for polygon features. | If MapLibre markers become limiting, deck.gl can become the richer WebGL layer path while keeping GeoJSON inputs. |
| [OGC 3D Tiles Standard](https://www.ogc.org/standards/3DTiles/) | 3D Tiles targets streaming/rendering massive 3D geospatial content such as photogrammetry, 3D buildings, BIM/CAD, instanced features, and point clouds. | 3D Tiles belongs to a later large-asset viewer/preview phase, not the first Explorer overview phase. |
| [Ben Shneiderman information visualization mantra](https://www.cs.umd.edu/~ben/about.html) | Overview first, zoom/filter, then details-on-demand. | Explorer should show spatial overview first; relationship details should appear after selection/filtering. |

## Phase Reference Matrix

| Phase | Goal | Internal Evidence | External / Technical Evidence | Deliverables | Completion Criteria | Gate To Next Phase |
| --- | --- | --- | --- | --- | --- | --- |
| Phase 0. Plan Correction | Supersede the Relationship Graph-first Explorer plan. Reclassify graph as selected-item overlay or Detail mini graph. | Explorer is search/map/list; relation graph is Detail. (`docs/input/sams-system-structure-design.md:45-140`) Current P0 result is relationship-first board. (`docs/planning/p0_explorer_graph_mvp_result.md:150`) | Shneiderman mantra supports overview before detail. | ADR update or new ADR; this reference matrix; issue list adjustment. | Docs explicitly say Explorer default is not Relationship Graph. Existing graph spike is marked superseded or experimental. | Team agrees the Explorer center is spatial asset discovery. |
| Phase 1. GeoJSON Asset Map Foundation | Make Explorer's main mental model a spatial asset map: all visible Items as geometry/footprint/center markers with list sync. | Explorer has map/list/search role. (`docs/input/sams-system-structure-design.md:45-90`) STAC v4 has `geometry`/`bbox`. | STAC Item is GeoJSON Feature; MapLibre GeoJSONSource can render GeoJSON. | Item-to-FeatureCollection adapter; layer style spec by `data_category`; bbox/geometry fallback policy; current 2D map/list preserved. | Explorer shows Items by spatial location, category, status, project/site labels. No relation graph default. | Real Explorer data has enough `geometry` or `bbox`; fallback policy for missing spatial data is documented. |
| Phase 2. Draft / Project / Status Visibility | Make Draft and project context visible globally in Explorer without requiring Detail selection. | Meeting notes call out Draft visibility and project filter pain. (`docs/input/2026-05-11-sams-ui-review-notes.md:17-33`) Project has Draft management. (`docs/input/sams-system-structure-design.md:256-276`) | STAC custom/common properties can carry status/category/project fields; information architecture supports filtering before detail. | Status filter; Draft badge on map/list/panel; project/site grouping; title/display_name resolver. | User can filter Draft and identify Draft directly on map/list. | Canonical status field decided: `properties.status` vs `properties["sams:status"]`; Inbox/Unassigned policy decided. |
| Phase 3. Details-On-Demand Asset Panel | On Item click, show preview, metadata gaps, project context, and relation counts/summary without leaving Explorer. | Explorer result click opens Detail panel option. (`docs/input/sams-system-structure-design.md:88-90`) UI notes require assigned project, Draft, missing metadata in asset detail panel. (`docs/input/2026-05-11-sams-ui-review-notes.md:12-16`) | Details-on-demand principle. | Reusable selected Item panel contract; footprint summary; missing metadata summary; Detail route CTA. | Clicked Item gives enough context to decide whether to open full Detail. | Detail/Preview fields are available from search result or one-item fetch. |
| Phase 4. Selected Item Relation Overlay | Show only relevant 1-depth relationships for the selected Item as map overlay lines and related item highlights. | Meeting asks relation direction/type; system design puts relation graph in Detail. (`docs/input/2026-05-11-sams-meeting-summary.txt:23-29`, `docs/input/sams-system-structure-design.md:138-140`) STAC v4 defines link rels. | GeoJSON LineString or renderer-native polyline can show selected edges; avoids global graph clutter. | Relation overlay spec; rel legend; edge style by `derived_from`, `related`, `prev`, `next`; missing target warning policy. | Selecting one Item reveals related Items and relation types without overwhelming the whole map. | Link target resolution works across current result set or one-hop fetch; relation direction semantics confirmed. |
| Phase 5. 3D GIS Asset Map Beta | Add a Beta 3D GIS scene for georeferenced asset map exploration, preserving Phase 1-4 data contracts. | 3D demo expresses target interaction: spatial nodes, relation lines, hover/pin, legend. (`docs/input/sams-3d-gis-demo.html:94-127`, `docs/input/sams-3d-gis-demo.html:143-160`) UI notes still ask whether demo floating animation fits real GIS. (`docs/input/2026-05-11-sams-ui-review-notes.md:160-164`) | Cesium or deck.gl can render geospatial 3D; deck.gl supports GeoJSON 3D options. Cesium decision should be documented before adding dependency. | Renderer decision ADR; dependency review; 3D scene prototype using real Item geometry/bbox; same filters and selected relation overlay. | 3D Beta communicates "where assets are and how selected assets relate" better than 2D for representative datasets. Existing 2D map/list remains default. | Visual review with real data passes; performance acceptable for expected result size; dependency and offline/basemap/token constraints resolved. |
| Phase 6. 3D Tiles / Point Cloud / Model Viewer | Move from asset overview to actual heavy 3D content preview/viewing. | Meeting says 3D model screenshot first, lightweight viewer later; point cloud subsampling/preview is ongoing. (`docs/input/2026-05-11-sams-meeting-summary.txt:39-42`) Preview requirements differ by document/panorama/video. (`docs/input/2026-05-11-sams-ui-review-notes.md:153-170`) | OGC 3D Tiles is for massive 3D geospatial content and point clouds. | Detail/Preview viewer architecture; thumbnail state model; 3D Tiles ingestion/viewer path; preview fallback UI. | User can open selected 3D Tiles/model/point cloud preview from Detail or panel with clear loading/failure states. | Preview pipeline and storage contracts are stable; sample 3D Tiles or converted point cloud data exists. |

## Recommended Replanning

The new plan is valid and should proceed, with the following corrections:

1. Do not make Relationship Graph the Explorer default view.
2. Keep Explorer's center as spatial asset discovery: map, filters, list, selected detail.
3. Treat STAC Items as GeoJSON Features first.
4. Render relations only after selection, either as an overlay on the map or as a Detail mini graph.
5. Delay 3D Tiles/point cloud/model rendering until the Preview/Detail viewer phase.
6. Keep the current 2D MapLibre map/list intact while adding any Beta view.

## Questions To Answer Before Development

1. Which status field is canonical in the running app: `properties.status` or `properties["sams:status"]`?
2. Are `geometry` and `bbox` consistently present in real `/stac/search` responses for all data categories?
3. What should Explorer show when an Item has no spatial geometry: Inbox list item, project centroid, deterministic fallback, or hidden from map?
4. Are relation `links.href` values resolvable to collection id and item id across projects?
5. Should selected relation overlay fetch missing linked Items outside the current search result, or only show loaded Items?
6. Is the 3D GIS Beta expected to run fully offline/local, and does that constrain basemap, terrain, Cesium Ion, or tile providers?
7. Is the first 3D Beta goal geospatial overview only, or actual 3D content viewing?
8. What result size must the Explorer map handle before requiring clustering, tiling, deck.gl, or server-side spatial aggregation?

## Final Validity Judgment

Proceed with the replanned direction.

The current Relationship Graph-first plan should be **superseded** for Explorer main UX. A graph data adapter may remain useful, but it should feed selected relation overlays or Detail mini graphs rather than a global graph board.

The most defensible next implementation plan is:

1. Explorer GeoJSON Asset Map foundation.
2. Draft/project/status/title visibility.
3. Details-on-demand selected item panel.
4. Selected Item relation overlay.
5. 3D GIS Beta renderer decision and prototype.
6. 3D Tiles/Preview viewer hardening.
