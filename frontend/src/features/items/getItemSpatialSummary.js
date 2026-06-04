import { getBboxBounds, getGeometryBounds, getItemMapPosition } from '../explorer-map/getItemMapPosition.js'

const SPATIAL_LABELS = {
  geometry: 'Geometry available',
  bbox: 'BBox-derived location',
  fallback: 'Fallback project location',
  none: 'No spatial marker',
}

export function getItemSpatialSummary(item) {
  const geometryBounds = getGeometryBounds(item?.geometry)
  const bboxBounds = getBboxBounds(item?.bbox)
  const mapPosition = getItemMapPosition(item)
  const source = mapPosition?.source || 'none'

  return {
    label: SPATIAL_LABELS[source] || SPATIAL_LABELS.none,
    source,
    position: mapPosition?.position || null,
    bounds: mapPosition?.bounds || null,
    hasGeometry: Boolean(geometryBounds),
    hasBbox: Boolean(bboxBounds),
    usesFallback: source === 'fallback',
    hasMarker: Boolean(mapPosition),
  }
}
