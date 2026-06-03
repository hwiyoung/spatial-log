import { itemsToMapMarkers } from './itemsToMapMarkers.js'

export function getItemsBounds(items) {
  const markers = itemsToMapMarkers(items)
  if (markers.length === 0) return null

  return markers.reduce((bounds, marker) => {
    const markerBounds = marker.bounds || [
      marker.position[0],
      marker.position[1],
      marker.position[0],
      marker.position[1],
    ]
    if (!bounds) return markerBounds
    return [
      Math.min(bounds[0], markerBounds[0]),
      Math.min(bounds[1], markerBounds[1]),
      Math.max(bounds[2], markerBounds[2]),
      Math.max(bounds[3], markerBounds[3]),
    ]
  }, null)
}
