import { getCategoryInfo } from '../../constants.js'
import { getItemStatus, getStatusInfo } from '../items/getItemStatus.js'

export const ASSET_3D_CATEGORY_VISUALS = {
  pointcloud: {
    shape: 'scan-tower',
    markerHeight: 78,
    markerWidth: 36,
    layerHeight: 82,
    layerLabel: 'Volumetric scan layer',
    description: 'dense point cloud or scan volume',
  },
  '3d_model': {
    shape: 'model-prism',
    markerHeight: 66,
    markerWidth: 38,
    layerHeight: 68,
    layerLabel: 'Model layer',
    description: 'model or mesh asset',
  },
  '3d_tiles': {
    shape: 'tile-stack',
    markerHeight: 60,
    markerWidth: 40,
    layerHeight: 64,
    layerLabel: 'Tileset layer',
    description: '3D tileset or geospatial 3D context',
  },
  panorama: {
    shape: 'dome-card',
    markerHeight: 44,
    markerWidth: 36,
    layerHeight: 46,
    layerLabel: 'Panorama layer',
    description: '360 capture location',
  },
  video: {
    shape: 'media-card',
    markerHeight: 38,
    markerWidth: 36,
    layerHeight: 40,
    layerLabel: 'Video layer',
    description: 'time-based visual media',
  },
  orthoimage: {
    shape: 'map-plate',
    markerHeight: 30,
    markerWidth: 46,
    layerHeight: 30,
    layerLabel: 'Ortho plate layer',
    description: 'orthographic raster footprint',
  },
  image: {
    shape: 'photo-card',
    markerHeight: 28,
    markerWidth: 38,
    layerHeight: 28,
    layerLabel: 'Image card layer',
    description: 'image set or photo asset',
  },
  document: {
    shape: 'document-sheet',
    markerHeight: 22,
    markerWidth: 34,
    layerHeight: 22,
    layerLabel: 'Document sheet layer',
    description: 'supporting document',
  },
  unknown: {
    shape: 'unknown-card',
    markerHeight: 26,
    markerWidth: 34,
    layerHeight: 26,
    layerLabel: 'Unknown layer',
    description: 'uncategorized asset',
  },
}

export function getAsset3dCategoryVisual(dataCategory) {
  return ASSET_3D_CATEGORY_VISUALS[dataCategory] || ASSET_3D_CATEGORY_VISUALS.unknown
}

export function getAsset3dVisualPolicy(item) {
  const dataCategory = item?.properties?.data_category || 'unknown'
  const category = getCategoryInfo(dataCategory)
  const visual = getAsset3dCategoryVisual(dataCategory)
  const status = getItemStatus(item)
  const statusInfo = getStatusInfo(status)

  return {
    dataCategory,
    category,
    status,
    statusInfo,
    ...visual,
  }
}

export function getAsset3dStateVisual({
  item,
  isSelected = false,
  isRelated = false,
  isHovered = false,
  relationStyle = null,
} = {}) {
  const policy = getAsset3dVisualPolicy(item)
  const isDraft = policy.status === 'draft'
  const isArchived = policy.status === 'archived'
  const isUnknown = policy.status === 'unknown'
  const relationColor = relationStyle?.markerColor || relationStyle?.color

  const borderColor = isSelected
    ? '#F4F6FA'
    : isRelated && relationColor
      ? relationColor
      : isDraft
        ? '#F0B42A'
        : isUnknown
          ? '#C8CEDA'
          : policy.category.color

  const accentColor = isRelated && relationColor
    ? relationColor
    : isDraft
      ? '#F0B42A'
      : isArchived
        ? '#687084'
        : isUnknown
          ? '#C8CEDA'
          : policy.category.color

  return {
    ...policy,
    isDraft,
    isArchived,
    isUnknown,
    borderColor,
    accentColor,
    opacity: isArchived ? 0.58 : 1,
    background: isArchived
      ? 'linear-gradient(180deg, rgba(92,100,120,0.78), rgba(49,55,70,0.62))'
      : `linear-gradient(180deg, ${policy.category.color}E8 0%, ${policy.category.color}68 100%)`,
    ring: isSelected
      ? '0 0 0 5px rgba(74,114,255,0.25), 0 18px 34px rgba(0,0,0,0.48)'
      : isRelated
        ? `0 0 0 4px ${accentColor}45, 0 12px 24px rgba(0,0,0,0.38)`
        : isHovered
          ? '0 0 0 4px rgba(244,246,250,0.18), 0 12px 24px rgba(0,0,0,0.36)'
          : '0 8px 16px rgba(0,0,0,0.32)',
  }
}
