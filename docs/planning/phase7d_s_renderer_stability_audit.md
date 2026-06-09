# Phase 7D-S Renderer Stability Audit

Date: 2026-06-05

## Goal

Phase 7D-S audits flicker and jitter in the MapLibre custom layer + Three.js map-grounded renderer before coverage, boundary, and LOD work begins.

Scope is stability only:

- keep 2D Explorer default.
- keep 3D GIS optional Beta.
- keep Map-grounded 3D, True 3D constellation, and Pseudo fallback.
- do not add dependencies.
- do not implement coverage/boundary/LOD.
- do not implement time-series highlight.

## 1. Possible Flicker Causes

Likely causes found in the Phase 7D implementation:

1. `map.triggerRepaint()` was called inside custom layer `render()`.
   - MapLibre calls custom layer `render()` during a repaint.
   - Calling `triggerRepaint()` again inside `render()` can create a continuous repaint loop.

2. Hover changed React state on every `mousemove`.
   - Even when the hover target did not change, the map event handler could still run frequently.
   - This increased React churn while the map was also rendering WebGL frames.

3. Hover state was included in Three layer updates.
   - Hover changes could rebuild the Three scene.
   - Rebuilding/disposal during pointer movement is a strong flicker candidate.

4. The custom layer rebuilt full asset/relation groups for every update call.
   - Even if the visual scene had not changed, `update()` rebuilt and disposed all objects.

5. Transparent materials used default depth write behavior.
   - Transparent meshes writing depth can produce unstable ordering with rings, relation lines, and overlapping category objects.

6. Relation lines and endpoint dots were depth-tested against asset geometry.
   - Lines could appear to blink when near or inside large objects.

7. Category object scale was large in map-meter terms.
   - Large translucent geometry increases overlap and depth/transparency artifacts.

## 2. Map / Custom Layer Lifecycle Check

Current lifecycle:

- `MapGroundedThreeGisBeta` creates one MapLibre map on mount.
- `MapGroundedThreeLayer` is added once after map load.
- prop updates call layer `update()` instead of removing/adding the layer.
- unmount removes the custom layer when present, then removes the map.
- layer `onRemove()` disposes Three resources.

Result:

- map instance is not recreated on prop changes.
- custom layer is not removed/re-added on prop changes.
- cleanup now has explicit layer removal and resource disposal.

## 3. React State / Mousemove Check

Previous issue:

- map `move` updated React state continuously through `mapVersion`.
- mousemove could update hover state too frequently.

Stabilized policy:

- no continuous `mapVersion` state.
- hover target updates are throttled with `requestAnimationFrame`.
- React hover state updates only when nearest target changes.
- tooltip projection updates are throttled and do not touch the Three scene.

## 4. Scene Rebuild / Object Rebuild Check

Previous issue:

- scene groups were rebuilt every `update()`, including hover changes.

Stabilized policy:

- layer computes a scene signature from asset transforms, selected Item, overlay enabled state, and visible relation IDs.
- full group rebuild happens only when that signature changes.
- hover is intentionally excluded from the scene signature.
- hover tooltip does not rebuild scene objects.

Remaining limitation:

- selected/relation updates still rebuild full groups.
- object-level diffing could be added later, but is not necessary for the 24-item mock spike.

## 5. WebGL State Reset / Clear / Depth Check

Current policy:

- Three renderer shares MapLibre canvas/context.
- `renderer.autoClear = false` remains enabled.
- custom layer render receives and applies MapLibre projection matrix.
- render calls `renderer.resetState()` before rendering.
- render calls `renderer.resetState()` after rendering.
- render does not call `clearColor`, `clearDepth`, or `clear`.
- render no longer calls `map.triggerRepaint()`.

Result:

- Three does not clear the MapLibre frame.
- Three does not request an infinite repaint loop from inside render.

## 6. Transparency / DepthWrite / RenderOrder Check

Stabilized policy:

- transparent Three materials use `depthWrite = false`.
- relation lines use `depthTest = false` and `depthWrite = false`.
- relation endpoints use `depthTest = false` and high `renderOrder`.
- selected/related asset objects get higher render order.
- polygon offset is enabled on asset materials to reduce ring/object z-fighting.

## 7. TriggerRepaint Policy

Allowed:

- once after custom layer setup.
- after layer `update()` when the scene signature changed or props may affect visibility.

Removed:

- `triggerRepaint()` inside custom layer `render()`.

Rationale:

- MapLibre already decides when frames render during pan/zoom/pitch.
- a static custom layer should not request another frame every time it is rendered.

## 8. Fix Priority

Priority applied:

1. remove `triggerRepaint()` from `render()`.
2. exclude hover from scene rebuild.
3. throttle hover and tooltip projection with `requestAnimationFrame`.
4. rebuild only on scene signature changes.
5. tune transparent/depth/write/renderOrder policy.
6. reduce category scale meters.
7. document remaining picking and object-diff limitations.
