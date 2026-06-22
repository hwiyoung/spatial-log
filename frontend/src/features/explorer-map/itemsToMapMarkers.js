import { getItemMapPosition } from './getItemMapPosition.js'

export function itemsToMapMarkers(items, fallbackCenters = null) {
  return (items || [])
    .map(item => {
      const mapPosition = getItemMapPosition(item, fallbackCenters)
      if (!mapPosition) return null
      return {
        id: item.id,
        item,
        position: mapPosition.position,
        positionSource: mapPosition.source,
        bounds: mapPosition.bounds,
      }
    })
    .filter(Boolean)
}
