import { getAsset3dVisualPolicy } from './asset3dVisualPolicy.js'

const ELEVATION_PROPERTY_KEYS = [
  'elevation',
  'altitude',
  'z',
  'height',
  'acquisition_height',
  'acquisitionHeight',
  'acquisition:height',
  'flight_height',
  'flight:height',
  'sensor:altitude',
  'sensor_altitude',
  'drone:altitude',
]

function finiteNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function getBboxZ(item) {
  const bbox = item?.bbox
  if (!Array.isArray(bbox) || bbox.length < 6) return null
  const minZ = finiteNumber(bbox[2])
  const maxZ = finiteNumber(bbox[5])
  if (minZ == null || maxZ == null) return null
  return {
    zSource: 'bbox-z',
    zValue: (minZ + maxZ) / 2,
    zRange: Math.abs(maxZ - minZ),
    label: 'bbox z center',
    detail: `bbox z range ${minZ} to ${maxZ}`,
  }
}

function getPropertyElevation(item) {
  const props = item?.properties || {}
  for (const key of ELEVATION_PROPERTY_KEYS) {
    const value = finiteNumber(props[key])
    if (value != null) {
      return {
        zSource: 'property-elevation',
        zValue: value,
        zRange: null,
        label: key,
        detail: `${key}: ${value}`,
      }
    }
  }
  return null
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function getActualElevationLift(zValue) {
  if (!Number.isFinite(zValue)) return 0
  return clamp(zValue / 4, -10, 28)
}

export function getAsset3dElevation(item) {
  const policy = getAsset3dVisualPolicy(item)
  const actual = getBboxZ(item) || getPropertyElevation(item)

  if (actual) {
    const actualLift = getActualElevationLift(actual.zValue)
    return {
      ...actual,
      isActualElevation: true,
      visualLayerHeight: policy.layerHeight,
      visualHeight: Math.max(policy.markerHeight, policy.markerHeight + Math.max(0, actualLift * 0.45)),
      visualLift: actualLift,
      layerLabel: 'Actual elevation',
      layerDescription: 'uses bbox z or elevation-like item property',
    }
  }

  return {
    zSource: 'visual-layer',
    zValue: policy.layerHeight,
    zRange: null,
    isActualElevation: false,
    visualLayerHeight: policy.layerHeight,
    visualHeight: policy.markerHeight,
    visualLift: 0,
    label: policy.layerLabel,
    detail: policy.description,
    layerLabel: policy.layerLabel,
    layerDescription: policy.description,
  }
}
