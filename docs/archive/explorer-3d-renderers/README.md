# Archived Explorer 3D Renderers

Archived on 2026-06-15 after `ADR-3d-relationship-deckgl.md`.

The active Explorer 3D Spatial Relationship View now uses the existing CARTO dark
MapLibre scene plus deck.gl `MapboxOverlay({ interleaved: true })`.

Archived code here is non-runtime reference material only:

- `explorer-3d-map/`: previous MapLibre custom layer + Three.js renderer.
- `explorer-3d-three/`: previous standalone Three.js constellation renderer.
- `explorer-3d-pseudo/`: previous CSS/SVG pseudo-3D fallback renderer.
- `components/`: UI panels used only by the archived renderer variants.

Do not re-enable these as Explorer main-view renderers. Reuse only small helper
ideas if they fit the selected Item 1-depth overlay model.
