import { useEffect, useMemo } from 'react'
import { RELATION_STYLES, SUPPORTED_RELATIONS } from '../features/relations/relationStyles.js'

const SOURCE_ID = 'selected-relation-overlay'
const LABEL_LAYER_ID = 'selected-relation-overlay-labels'

function lineLayerId(rel) {
  return `selected-relation-overlay-line-${rel}`
}

function toFeatureCollection(visibleRelations = []) {
  return {
    type: 'FeatureCollection',
    features: visibleRelations.map(relation => ({
      type: 'Feature',
      id: relation.id,
      properties: {
        id: relation.id,
        rel: relation.rel,
        label: `${relation.rel} ${relation.direction}`,
        direction: relation.direction,
      },
      geometry: {
        type: 'LineString',
        coordinates: [relation.sourcePosition, relation.targetPosition],
      },
    })),
  }
}

function removeOverlay(map) {
  if (!map) return
  if (map.getLayer(LABEL_LAYER_ID)) map.removeLayer(LABEL_LAYER_ID)
  SUPPORTED_RELATIONS.forEach(rel => {
    const id = lineLayerId(rel)
    if (map.getLayer(id)) map.removeLayer(id)
  })
  if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
}

function ensureOverlay(map, data) {
  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, {
      type: 'geojson',
      data,
    })
  } else {
    map.getSource(SOURCE_ID).setData(data)
  }

  SUPPORTED_RELATIONS.forEach(rel => {
    const style = RELATION_STYLES[rel]
    const id = lineLayerId(rel)
    if (map.getLayer(id)) return

    const paint = {
      'line-color': style.color,
      'line-width': style.lineWidth,
      'line-opacity': 0.88,
    }
    if (style.dashArray) {
      paint['line-dasharray'] = style.dashArray
    }

    map.addLayer({
      id,
      type: 'line',
      source: SOURCE_ID,
      filter: ['==', ['get', 'rel'], rel],
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint,
    })
  })

  if (!map.getLayer(LABEL_LAYER_ID)) {
    map.addLayer({
      id: LABEL_LAYER_ID,
      type: 'symbol',
      source: SOURCE_ID,
      layout: {
        'symbol-placement': 'line-center',
        'text-field': ['get', 'label'],
        'text-size': 11,
        'text-letter-spacing': 0,
        'text-allow-overlap': true,
        'text-ignore-placement': true,
      },
      paint: {
        'text-color': '#F4F6FA',
        'text-halo-color': '#11151F',
        'text-halo-width': 2,
      },
    })
  }
}

export default function RelationOverlayLayer({ map, mapLoaded, enabled, overlayModel }) {
  const data = useMemo(
    () => toFeatureCollection(enabled ? overlayModel?.visibleRelations : []),
    [enabled, overlayModel],
  )

  useEffect(() => {
    if (!map || !mapLoaded) return undefined
    if (!enabled) {
      removeOverlay(map)
      return undefined
    }

    ensureOverlay(map, data)

    return () => {
      removeOverlay(map)
    }
  }, [map, mapLoaded, enabled, data])

  return null
}
