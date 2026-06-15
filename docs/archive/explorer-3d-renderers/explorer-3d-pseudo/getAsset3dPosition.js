import { getItemsBounds } from '../explorer-map/getItemsBounds.js'
import { getItemMapPosition } from '../explorer-map/getItemMapPosition.js'
import { getAsset3dElevation } from './getAsset3dElevation.js'
import { getAsset3dVisualPolicy } from './asset3dVisualPolicy.js'

const SOURCE_LIFT = {
  geometry: 10,
  bbox: 4,
  fallback: 0,
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function normalize(value, min, max) {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max) || min === max) return 0.5
  return clamp((value - min) / (max - min), 0, 1)
}

export function getAsset3dBounds(items = []) {
  return getItemsBounds(items)
}

export function getAsset3dPosition(item, bounds) {
  const mapPosition = getItemMapPosition(item)
  if (!mapPosition?.position) return null

  const [w, s, e, n] = bounds || [mapPosition.position[0], mapPosition.position[1], mapPosition.position[0], mapPosition.position[1]]
  const [lng, lat] = mapPosition.position
  const x = 8 + normalize(lng, w, e) * 84
  const depth = normalize(lat, s, n)
  const elevation = getAsset3dElevation(item)
  const visualPolicy = getAsset3dVisualPolicy(item)
  const y = 82 - depth * 64 - Math.max(0, elevation.visualLift)
  const height = elevation.visualHeight + (SOURCE_LIFT[mapPosition.source] || 0)

  return {
    item,
    itemId: item.id,
    lngLat: mapPosition.position,
    source: mapPosition.source,
    visualPolicy,
    elevation,
    x,
    y,
    baseX: x,
    baseY: y,
    height,
    depth,
    zIndex: Math.round(100 + depth * 100),
  }
}

function applyStackOffsets(assets) {
  const groups = new Map()
  assets.forEach(asset => {
    const key = `${Math.round(asset.x / 2)}:${Math.round(asset.y / 2)}`
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
      .sort((a, b) => b.height - a.height || a.itemId.localeCompare(b.itemId))
      .forEach((asset, index) => {
        const angle = (-90 + index * (360 / group.length)) * (Math.PI / 180)
        const radius = Math.min(5.8, 2.2 + group.length * 0.65)
        asset.stackIndex = index
        asset.stackCount = group.length
        asset.x = clamp(asset.x + Math.cos(angle) * radius, 6, 94)
        asset.y = clamp(asset.y + Math.sin(angle) * radius * 0.68, 16, 88)
      })
  })

  return assets
}

function applySelectedFocus(assets, selectedId, focusSelected) {
  if (!selectedId || !focusSelected) return assets
  const selected = assets.find(asset => asset.itemId === selectedId)
  if (!selected) return assets

  const shiftX = 50 - selected.x
  const shiftY = 58 - selected.y

  return assets.map(asset => ({
    ...asset,
    x: clamp(asset.x + shiftX, 6, 94),
    y: clamp(asset.y + shiftY, 16, 88),
    focusShift: { x: shiftX, y: shiftY },
  }))
}

export function getAsset3dItems(items = [], options = {}) {
  const bounds = getAsset3dBounds(items)
  const projected = (items || [])
    .map(item => getAsset3dPosition(item, bounds))
    .filter(Boolean)
  const stacked = applyStackOffsets(projected)
  return applySelectedFocus(stacked, options.selectedId, options.focusSelected)
}
