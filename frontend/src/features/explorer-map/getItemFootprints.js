/**
 * getItemFootprints — Item 들의 공간 범위(geometry/bbox)를 footprint 폴리곤 FeatureCollection 으로.
 *
 * 디자인(.footprint): 상태색 점선 외곽 + 옅은 채움 — 점 마커가 "어디"라면 footprint 는 "어디까지".
 * geometry(Polygon/MultiPolygon) 우선, 없으면 bbox 사각형. 퇴화(점 크기) 범위는 제외 —
 * 위치 수동 지정이 만드는 ±0.0001° 미니 bbox 가 전부 폴리곤으로 뜨는 노이즈 방지.
 */
import { getBboxBounds, getGeometryBounds, isValidLngLat } from './getItemMapPosition.js'
import { getItemStatus } from '../items/getItemStatus.js'

// 이 폭(도) 이하의 범위는 점으로 취급 — 마커만 표시.
// 위치 수동 지정이 만드는 ±0.0001° bbox(폭 0.0002 + 부동소수점 오차)를 확실히 흡수 (~33m@적도)
const MIN_EXTENT_DEG = 0.0003
// 이보다 넓은 범위는 손상/뒤집힌 bbox 로 본다 — 358° 띠 같은 노이즈 방지
const MAX_EXTENT_DEG = 30

function bboxPolygon([w, s, e, n]) {
  return { type: 'Polygon', coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] }
}

function isUsablePolygon(geometry) {
  if (!geometry) return false
  if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') return false
  // MultiPolygon 포함 모든 링의 모든 좌표를 검증 — 일부만 보면 쓰레기 좌표가 지도 소스로 들어간다
  const rings = geometry.type === 'Polygon' ? geometry.coordinates : geometry.coordinates.flat()
  if (!Array.isArray(rings) || rings.length === 0) return false
  return rings.every(ring =>
    Array.isArray(ring) && ring.length >= 4 && ring.every(c => Array.isArray(c) && isValidLngLat(c[0], c[1]))
  )
}

function passesExtent(dw, dh) {
  return (dw > MIN_EXTENT_DEG || dh > MIN_EXTENT_DEG) && dw <= MAX_EXTENT_DEG && dh <= MAX_EXTENT_DEG
}

export function getItemFootprints(items = [], selectedId = null) {
  const features = []
  items.forEach(item => {
    let geometry = null
    if (isUsablePolygon(item?.geometry)) {
      // 전체 지오메트리 bounds 기준 — MultiPolygon 첫 링만 보면 extent 를 오판한다
      const [w, s, e, n] = getGeometryBounds(item.geometry) || [0, 0, 0, 0]
      if (passesExtent(e - w, n - s)) geometry = item.geometry
    }
    if (!geometry) {
      const b = getBboxBounds(item?.bbox)
      if (b && passesExtent(b[2] - b[0], b[3] - b[1])) geometry = bboxPolygon(b)
    }
    if (!geometry) return
    features.push({
      type: 'Feature',
      geometry,
      properties: { id: item.id, status: getItemStatus(item), sel: item.id === selectedId },
    })
  })
  return { type: 'FeatureCollection', features }
}
