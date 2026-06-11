export function isValidLngLat(lng, lat) {
  return Number.isFinite(lng)
    && Number.isFinite(lat)
    && lng >= -180
    && lng <= 180
    && lat >= -90
    && lat <= 90
    && !(lng === 0 && lat === 0)
}

export function getBboxCenter(bbox) {
  if (!Array.isArray(bbox) || bbox.length < 4) return null
  const [w, s, e, n] = bbox.map(Number)
  if (!isValidLngLat(w, s) || !isValidLngLat(e, n)) return null
  return [(w + e) / 2, (s + n) / 2]
}

export function getBboxBounds(bbox) {
  if (!Array.isArray(bbox) || bbox.length < 4) return null
  const [w, s, e, n] = bbox.map(Number)
  if (!isValidLngLat(w, s) || !isValidLngLat(e, n)) return null
  return [Math.min(w, e), Math.min(s, n), Math.max(w, e), Math.max(s, n)]
}

function collectLngLats(coordinates, output = []) {
  if (!Array.isArray(coordinates)) return output
  if (coordinates.length >= 2 && coordinates.every(value => typeof value === 'number')) {
    const [lng, lat] = coordinates
    if (isValidLngLat(lng, lat)) output.push([lng, lat])
    return output
  }
  coordinates.forEach(child => collectLngLats(child, output))
  return output
}

export function getGeometryBounds(geometry) {
  if (!geometry) return null
  const points = collectLngLats(geometry.coordinates)
  if (points.length === 0) return null
  const lngs = points.map(([lng]) => lng)
  const lats = points.map(([, lat]) => lat)
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)]
}

export function getBoundsCenter(bounds) {
  if (!Array.isArray(bounds) || bounds.length < 4) return null
  const [w, s, e, n] = bounds
  const center = [(w + e) / 2, (s + n) / 2]
  return isValidLngLat(center[0], center[1]) ? center : null
}

/**
 * 위치 우선순위 (설계서 12.1): geometry center → bbox center → project fallback → 없음.
 * fallbackCenters: {collectionId: [lon,lat]} — 실데이터에서 좌표 없는 Item 의 프로젝트 위치.
 */
export function getItemMapPosition(item, fallbackCenters = null) {
  const geometryBounds = getGeometryBounds(item?.geometry)
  const geometryCenter = getBoundsCenter(geometryBounds)
  if (geometryCenter) {
    return { position: geometryCenter, source: 'geometry', bounds: geometryBounds }
  }

  const bboxBounds = getBboxBounds(item?.bbox)
  const bboxCenter = getBoundsCenter(bboxBounds)
  if (bboxCenter) {
    return { position: bboxCenter, source: 'bbox', bounds: bboxBounds }
  }

  const mockFallback = item?.properties?.['mock:fallback_center']
  if (Array.isArray(mockFallback) && mockFallback.length >= 2) {
    const [lng, lat] = mockFallback.map(Number)
    if (isValidLngLat(lng, lat)) {
      return { position: [lng, lat], source: 'fallback', bounds: [lng, lat, lng, lat] }
    }
  }

  // 실데이터 project fallback — 좌표 없는 Item 을 소속 Collection 위치로 (설계서 12.1 3단계)
  const projCenter = fallbackCenters?.[item?.collection]
  if (Array.isArray(projCenter) && isValidLngLat(projCenter[0], projCenter[1])) {
    return {
      position: [projCenter[0], projCenter[1]],
      source: 'fallback',
      bounds: [projCenter[0], projCenter[1], projCenter[0], projCenter[1]],
    }
  }

  return null
}
