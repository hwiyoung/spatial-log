import { getItemsBounds } from '../explorer-map/getItemsBounds.js'
import { getItemMapPosition } from '../explorer-map/getItemMapPosition.js'
import { getAsset3dElevation } from '../explorer-3d/getAsset3dElevation.js'
import { getAsset3dVisualPolicy } from '../explorer-3d/asset3dVisualPolicy.js'

export const THREE_SCENE_SPAN = 22

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function normalize(value, min, max) {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max) || min === max) return 0.5
  return clamp((value - min) / (max - min), 0, 1)
}

function getElevationY(elevation) {
  const categoryLift = (elevation?.visualLayerHeight || 24) * 0.022
  const actualLift = elevation?.isActualElevation ? (elevation.visualLift || 0) * 0.17 : 0
  return clamp(0.35 + categoryLift + actualLift, 0.18, 6.8)
}

function getObjectHeight(visualPolicy, elevation) {
  const baseHeight = (visualPolicy?.markerHeight || 28) / 34
  const actualRange = elevation?.zRange ? Math.min(1.2, elevation.zRange * 0.08) : 0
  const actualLift = elevation?.isActualElevation ? Math.max(0, elevation.visualLift || 0) * 0.028 : 0
  return clamp(baseHeight + actualRange + actualLift, 0.34, 3.4)
}

export function getThreeAssetPosition(item, bounds) {
  const mapPosition = getItemMapPosition(item)
  if (!mapPosition?.position) return null

  const [lng, lat] = mapPosition.position
  const fallbackBounds = [lng, lat, lng, lat]
  const [w, s, e, n] = bounds || fallbackBounds
  const x = (normalize(lng, w, e) - 0.5) * THREE_SCENE_SPAN
  const z = (0.5 - normalize(lat, s, n)) * THREE_SCENE_SPAN
  const elevation = getAsset3dElevation(item)
  const visualPolicy = getAsset3dVisualPolicy(item)
  const y = getElevationY(elevation)
  const objectHeight = getObjectHeight(visualPolicy, elevation)

  return {
    item,
    itemId: item.id,
    lngLat: mapPosition.position,
    source: mapPosition.source,
    visualPolicy,
    elevation,
    position: { x, y, z },
    basePosition: { x, y, z },
    objectHeight,
    footprint: Math.max(0.28, (visualPolicy.markerWidth || 34) / 48),
  }
}

function applyStackOffsets(assets) {
  const groups = new Map()
  assets.forEach(asset => {
    const key = `${Math.round(asset.position.x * 2)}:${Math.round(asset.position.z * 2)}`
    const group = groups.get(key) || []
    group.push(asset)
    groups.set(key, group)
  })

  groups.forEach(group => {
    if (group.length <= 1) {
      group[0].stackIndex = 0
      group[0].stackCount = 1
      return
    }

    group
      .sort((a, b) => b.objectHeight - a.objectHeight || a.itemId.localeCompare(b.itemId))
      .forEach((asset, index) => {
        const angle = (-90 + index * (360 / group.length)) * (Math.PI / 180)
        const radius = Math.min(1.05, 0.42 + group.length * 0.08)
        asset.stackIndex = index
        asset.stackCount = group.length
        asset.position = {
          ...asset.position,
          x: asset.position.x + Math.cos(angle) * radius,
          z: asset.position.z + Math.sin(angle) * radius,
          y: asset.position.y + index * 0.08,
        }
      })
  })

  return assets
}

function applySelectedFocus(assets, selectedId, focusSelected) {
  if (!selectedId || !focusSelected) return assets
  const selected = assets.find(asset => asset.itemId === selectedId)
  if (!selected) return assets

  const shiftX = -selected.position.x
  const shiftZ = -selected.position.z

  return assets.map(asset => ({
    ...asset,
    position: {
      ...asset.position,
      x: asset.position.x + shiftX,
      z: asset.position.z + shiftZ,
    },
    focusShift: { x: shiftX, z: shiftZ },
  }))
}

export function getThreeAssetItems(items = [], options = {}) {
  const bounds = getItemsBounds(items)
  const projected = (items || [])
    .map(item => getThreeAssetPosition(item, bounds))
    .filter(Boolean)
  const stacked = applyStackOffsets(projected)
  return applySelectedFocus(stacked, options.selectedId, options.focusSelected)
}
