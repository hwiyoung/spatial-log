# Map-Grounded 3D GIS Spike Spec

Date: 2026-06-05

## Goal

Phase 7D validates whether the optional 3D GIS Beta can move from an independent Three.js constellation into a georeferenced MapLibre map surface.

The target screen is a MapLibre background map with Three.js category objects rendered as a custom 3D layer at Item locations.

## 2D Default / 3D Beta Optional

Explorer remains:

- default: 2D map/list.
- optional: 3D GIS Beta.

3D GIS Beta renderer modes:

1. Map-grounded 3D
2. True 3D constellation
3. Pseudo fallback

The 3D mode must not become the route default.

## MapLibre + Three.js Structure

Map-grounded mode uses:

- MapLibre map for base raster map, pan, zoom, pitch, and bearing.
- MapLibre custom layer with `renderingMode: "3d"`.
- Three.js renderer sharing the MapLibre canvas/context.
- Three.js scene rendered from MapLibre's projection matrix.

DOM overlays remain outside the map canvas:

- mode switch.
- Beta badge.
- controls.
- legend.
- focus card.
- tooltip.
- warning text.

## Coordinate Transform Policy

Input:

- existing `getItemMapPosition(item)`.
- lng/lat from geometry center, bbox center, or mock fallback center.

Transform:

- convert lng/lat/altitude into `maplibregl.MercatorCoordinate`.
- use `meterInMercatorCoordinateUnits()` for object scale.
- same-location assets receive small meter offsets before Mercator placement.

The map owns camera and projection. The custom layer does not create an independent camera orbit.

## Altitude / Elevation Policy

Reuse Phase 7B/7C zSource priority:

1. `bbox-z`
2. `property-elevation`
3. `visual-layer`

Map-grounded constraints:

- actual positive elevation can be used as Mercator altitude.
- negative elevation is clamped to the map surface because the current map has no terrain/subsurface model.
- visual-layer items stay on the map surface but use category object height/scale.

Tooltip/focus card must continue to show whether the item uses actual elevation or visual layer.

## Selected Relation Line Policy

Relation rules remain unchanged:

- no selected Item: no relation line.
- overlay off: no relation line.
- overlay on: only `relationOverlayModel.visibleRelations`.
- missing targets are warnings only.
- no fake missing target objects.
- no global graph.
- no all-Item relation rendering.

Relation line endpoints use the map-grounded asset transforms.

## Hover / Click / Picking Policy

Phase 7D uses a screen-nearest fallback strategy:

- MapLibre mouse event gives screen point.
- project each asset lng/lat to screen point.
- choose nearest asset within a small pixel threshold.
- hover tooltip and click selection use that nearest asset.

This is intentionally documented as a spike limitation. Later renderer work can replace it with custom-layer ray picking or deck.gl picking.

## Context Panel Integration

Clicking a map-grounded asset calls existing `onSelectItem(item)`.

Context Panel remains the authoritative detail surface:

- identity.
- project/status/Draft.
- preview action.
- relation summary.
- relation CTA.

ViewerShell and preview behavior are unchanged.

## Fallback Policy

If MapLibre custom layer setup fails:

- switch to `True 3D constellation`.
- keep `Pseudo fallback` available.
- preserve Explorer selected Item and relation state.

## Phase 7E / Later Handoff

Phase 7E:

- relation highlight choreography.
- temporal prev/next highlight.
- long edge readability.

Coverage/Boundary/LOD phase:

- drone photo coverage.
- flight line/coverage polygon.
- 3D model footprint/boundary.
- scale-based icon/object switching.
- better map-layer authoring.

Upload/Metadata phases:

- GIS format auto classification.
- parser failure diagnostics.
- real geometry extraction.

## Not In Phase 7D

- production renderer migration.
- deck.gl implementation.
- Cesium implementation.
- production pointcloud/3D Tiles/model viewer.
- backend/API/schema changes.
- global Relationship Graph.
