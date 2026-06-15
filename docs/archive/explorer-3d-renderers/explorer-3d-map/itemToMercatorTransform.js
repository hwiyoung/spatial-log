import maplibregl from 'maplibre-gl'
import { getItemMapPosition } from '../explorer-map/getItemMapPosition.js'
import { getAsset3dElevation } from '../explorer-3d/getAsset3dElevation.js'
import { getAsset3dVisualPolicy } from '../explorer-3d/asset3dVisualPolicy.js'

const CATEGORY_SCALE_METERS = {
  pointcloud: 62,
  '3d_model': 54,
  '3d_tiles': 58,
  panorama: 42,
  video: 38,
  orthoimage: 48,
  image: 36,
  document: 30,
  unknown: 32,
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function getDisplayAltitudeMeters(elevation) {
  if (!elevation?.isActualElevation) return 0
  return clamp(Number(elevation.zValue) || 0, 0, 180)
}

function getVisualScaleMeters(visualPolicy, elevation) {
  const categoryScale = CATEGORY_SCALE_METERS[visualPolicy?.dataCategory] || CATEGORY_SCALE_METERS.unknown
  const actualBoost = elevation?.isActualElevation ? Math.max(0, elevation.visualLift || 0) * 0.72 : 0
  return clamp(categoryScale + actualBoost, 24, 88)
}

function getStackOffset(index, count) {
  if (count <= 1) return { eastMeters: 0, northMeters: 0 }
  const angle = (-90 + index * (360 / count)) * (Math.PI / 180)
  const radius = Math.min(36, 14 + count * 3.5)
  return {
    eastMeters: Math.cos(angle) * radius,
    northMeters: Math.sin(angle) * radius,
  }
}

function applyStackOffsets(assets) {
  const groups = new Map()
  assets.forEach(asset => {
    const key = `${asset.lngLat[0].toFixed(5)}:${asset.lngLat[1].toFixed(5)}`
    const group = groups.get(key) || []
    group.push(asset)
    groups.set(key, group)
  })

  groups.forEach(group => {
    group
      .sort((a, b) => b.objectHeight - a.objectHeight || a.itemId.localeCompare(b.itemId))
      .forEach((asset, index) => {
        asset.stackIndex = index
        asset.stackCount = group.length
        asset.stackOffset = getStackOffset(index, group.length)
      })
  })

  return assets
}

export function getItemMercatorTransform(asset) {
  const lngLat = asset?.lngLat
  if (!Array.isArray(lngLat)) return null

  const altitudeMeters = getDisplayAltitudeMeters(asset.elevation)
  const coordinate = maplibregl.MercatorCoordinate.fromLngLat(lngLat, altitudeMeters)
  const meterScale = coordinate.meterInMercatorCoordinateUnits()
  const offset = asset.stackOffset || { eastMeters: 0, northMeters: 0 }
  const visualScaleMeters = getVisualScaleMeters(asset.visualPolicy, asset.elevation)
  const scale = meterScale * visualScaleMeters

  return {
    x: coordinate.x + offset.eastMeters * meterScale,
    y: coordinate.y - offset.northMeters * meterScale,
    z: coordinate.z || 0,
    meterScale,
    visualScaleMeters,
    scale,
    altitudeMeters,
    offset,
  }
}

function getObjectHeight(visualPolicy, elevation) {
  const baseHeight = (visualPolicy?.markerHeight || 28) / 34
  const actualRange = elevation?.zRange ? Math.min(1.2, elevation.zRange * 0.08) : 0
  const actualLift = elevation?.isActualElevation ? Math.max(0, elevation.visualLift || 0) * 0.028 : 0
  return clamp(baseHeight + actualRange + actualLift, 0.34, 3.4)
}

export function getMapGroundedAssetItems(items = []) {
  const assets = (items || [])
    .map(item => {
      const mapPosition = getItemMapPosition(item)
      if (!mapPosition?.position) return null
      const elevation = getAsset3dElevation(item)
      const visualPolicy = getAsset3dVisualPolicy(item)
      return {
        item,
        itemId: item.id,
        lngLat: mapPosition.position,
        source: mapPosition.source,
        visualPolicy,
        elevation,
        objectHeight: getObjectHeight(visualPolicy, elevation),
        footprint: Math.max(0.28, (visualPolicy.markerWidth || 34) / 48),
        stackIndex: 0,
        stackCount: 1,
        stackOffset: { eastMeters: 0, northMeters: 0 },
      }
    })
    .filter(Boolean)

  return applyStackOffsets(assets).map(asset => ({
    ...asset,
    transform: getItemMercatorTransform(asset),
  })).filter(asset => asset.transform)
}
