import { getItemsBounds } from '../explorer-map/getItemsBounds.js'
import { getItemMapPosition } from '../explorer-map/getItemMapPosition.js'

const CATEGORY_HEIGHTS = {
  pointcloud: 72,
  '3d_model': 62,
  '3d_tiles': 56,
  orthoimage: 28,
  image: 24,
  panorama: 38,
  video: 32,
  document: 18,
  unknown: 22,
}

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

function getCategoryHeight(item) {
  const category = item?.properties?.data_category || 'unknown'
  return CATEGORY_HEIGHTS[category] || CATEGORY_HEIGHTS.unknown
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
  const y = 82 - depth * 64
  const height = getCategoryHeight(item) + (SOURCE_LIFT[mapPosition.source] || 0)

  return {
    item,
    itemId: item.id,
    lngLat: mapPosition.position,
    source: mapPosition.source,
    x,
    y,
    height,
    depth,
    zIndex: Math.round(100 + depth * 100),
  }
}

export function getAsset3dItems(items = []) {
  const bounds = getAsset3dBounds(items)
  return (items || [])
    .map(item => getAsset3dPosition(item, bounds))
    .filter(Boolean)
}
