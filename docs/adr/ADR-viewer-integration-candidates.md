# ADR: Viewer Integration Candidates

Date: 2026-06-04

## Status

Accepted as deferred candidates for Phase 6B.

## Context

Phase 6B implements a lightweight viewer shell. It validates preview action UX and category/status fallback behavior, but it does not integrate production heavy viewers.

The current Explorer product direction remains:

- 2D map/list is the default Explorer view.
- `3D GIS Beta` is optional.
- Context Panel is the entry point for preview actions.
- Relationship Graph/global graph is not the Explorer default.
- DB/API schema is not changed in this phase.

## Candidate Comparison

| Candidate | Primary use | Dependency impact | Bundle impact | Offline/local dev impact | Data conversion need | Phase 6B decision |
| --- | --- | --- | --- | --- | --- | --- |
| PDF.js | `document` / PDF viewer | Adds PDF runtime, worker, and asset handling | Medium to high depending worker packaging | Requires worker path and local asset handling | May need PDF or server-rendered pages | Defer; show document placeholder shell only. |
| HTML video | `video` preview/player | Browser-native, no package when using `<video>` | Low if native only | Requires playable local/mock URL and codec support | May need transcoding or poster generation | Defer production integration; allow only non-autoplay mock shell when playable URL exists. |
| model-viewer | `3d_model` viewer | Adds web component/runtime dependency | Medium | Needs model assets and browser WebGL support | May need GLB/GLTF conversion from OBJ/FBX/etc. | Defer; show screenshot/placeholder shell only. |
| Potree | `pointcloud` viewer | Heavy renderer, workers, point cloud assets | High | Needs converted point cloud format and local asset serving | Usually needs LAS/LAZ to Potree format conversion | Defer; show lightweight/conversion-needed shell only. |
| Cesium / 3D Tiles renderer | `3d_tiles` viewer | Heavy 3D engine, workers/assets, token/terrain decisions if globe is used | High | Needs local tileset serving and offline basemap/terrain policy | Needs valid 3D Tiles tileset and URL policy | Defer; show tileset viewer-needed shell only. |
| Panorama viewer TBD | `panorama` viewer | Unknown until library is selected | Unknown | Needs equirectangular metadata and local texture serving | May need equirectangular conversion/metadata normalization | Defer; keep later TBD. |

## Candidate Details

### PDF.js

PDF.js is the leading candidate for production document/PDF viewing. It introduces worker packaging, PDF asset loading, page virtualization, and security review questions. Phase 6B avoids it so the shell can validate document action UX without changing bundle/runtime behavior.

### HTML Video

Native HTML video is lower impact than a library, but production use still needs playable URLs, codec policy, poster generation, range requests, and permissions. Phase 6B may render a native `<video controls>` shell only if a mock/local playable URL exists. It must not autoplay.

### model-viewer

`model-viewer` is a plausible lightweight 3D model candidate for GLB/GLTF assets. It does not solve conversion from arbitrary model formats and adds runtime/rendering concerns. Phase 6B keeps `3d_model` as screenshot/placeholder shell.

### Potree

Potree is a candidate for point cloud viewing, but it implies data conversion, worker/assets packaging, and potentially large local files. Phase 6B only shows point cloud preview readiness and conversion/viewer-needed states.

### Cesium / 3D Tiles Renderer

Cesium or an equivalent 3D Tiles renderer is a candidate for production 3D Tiles viewing. It is too heavy for a shell validation phase because it adds renderer setup, worker/assets packaging, tileset serving, offline terrain/basemap policy, and camera interaction decisions.

### Panorama Viewer TBD

The panorama viewer choice remains open. The likely production requirement is an equirectangular or cubemap renderer with metadata validation. Phase 6B shows panorama placeholder/failure shell only.

## Why Phase 6B Defers These

Phase 6B must prove:

- preview action wiring.
- shell open/close behavior.
- category-specific fallback UI.
- `available`, `pending`, `missing`, and `failed` status messaging.
- 2D/3D Beta selection continuity.

Adding production viewer dependencies now would mix dependency decisions with UI contract validation and would increase bundle, local development, and data conversion risk before the user flow is proven.

## Category Priority Proposal

Recommended later priority:

1. `image` / `orthoimage`: lowest risk, already thumbnail/image-style ready.
2. `document`: PDF.js or server-rendered page previews after worker/asset policy is decided.
3. `video`: native player after playable URL, poster, codec, and range-request policies are defined.
4. `3d_model`: model-viewer or equivalent after GLB/GLTF conversion path is defined.
5. `panorama`: choose renderer after panorama metadata requirements are fixed.
6. `3d_tiles`: Cesium or equivalent after tileset/local/offline policies are defined.
7. `pointcloud`: Potree or equivalent after point cloud conversion and storage policy are defined.

This priority favors lower dependency and lower conversion-risk categories first.
