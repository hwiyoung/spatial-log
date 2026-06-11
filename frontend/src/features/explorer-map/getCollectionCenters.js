/**
 * getCollectionCenters — Collection 별 프로젝트 중심 좌표 맵.
 *
 * 두 용도: ① 좌표 없는 Item 의 project fallback 위치(설계서 12.1 위치 우선순위 3단계),
 * ② 지도 region 라벨(◎ 프로젝트명) 위치.
 *
 * 우선순위: Collection extent(유효할 때) → 같은 Collection 의 좌표 있는 Item 들의 범위 중심.
 * 실데이터 Collection 의 extent 는 생성 시 전세계 기본값이고 자동 갱신이 없어(알려진 갭)
 * Item 유도 폴백이 실질 경로다. mock fixture 의 bbox 는 중첩 깊이가 달라 재귀 해제한다.
 */
import { getItemMapPosition, isValidLngLat } from './getItemMapPosition.js'

// 이보다 넓은 extent 는 "위치"라 보기 어렵다 (전세계/대륙급 기본값 걸러냄)
const MAX_EXTENT_DEG = 30

// [[w,s,e,n]] / [[[w,s,e,n]]] 등 중첩 깊이가 달라도 숫자 4개 배열까지 해제
function unwrapBbox(b) {
  let cur = b
  for (let i = 0; i < 4 && Array.isArray(cur); i++) {
    if (cur.length >= 4 && cur.every(v => typeof v === 'number')) {
      // 3D bbox [w,s,zmin,e,n,zmax] → XY 만
      return cur.length === 6 ? [cur[0], cur[1], cur[3], cur[4]] : cur
    }
    cur = cur[0]
  }
  return null
}

function extentCenter(col) {
  const bbox = unwrapBbox(col?.extent?.spatial?.bbox)
  if (!bbox) return null
  const [w, s, e, n] = bbox.map(Number)
  if (![w, s, e, n].every(Number.isFinite)) return null
  if (w > e || s > n) return null   // antimeridian/손상 extent — Item 유도 경로로 폴백
  if (e - w > MAX_EXTENT_DEG || n - s > MAX_EXTENT_DEG) return null
  const lon = (w + e) / 2
  const lat = (s + n) / 2
  return isValidLngLat(lon, lat) ? [lon, lat] : null
}

function itemsCenters(items) {
  // collection 별로 좌표 있는 Item 들의 bounds 중심 (fallback 없이 — 순환 방지)
  const acc = {}
  ;(items || []).forEach(item => {
    const col = item?.collection
    if (!col) return
    const pos = getItemMapPosition(item)
    if (!pos || pos.source === 'fallback') return
    const a = acc[col] = acc[col] || { minLon: Infinity, maxLon: -Infinity, minLat: Infinity, maxLat: -Infinity, n: 0 }
    a.minLon = Math.min(a.minLon, pos.position[0]); a.maxLon = Math.max(a.maxLon, pos.position[0])
    a.minLat = Math.min(a.minLat, pos.position[1]); a.maxLat = Math.max(a.maxLat, pos.position[1])
    a.n += 1
  })
  const centers = {}
  Object.entries(acc).forEach(([col, a]) => {
    if (a.n === 0) return
    // outlier 하나가 중심을 무의미한 중간점으로 끌고 가지 않게 — 범위가 비정상이면 중심을 내지 않는다
    if (a.maxLon - a.minLon > MAX_EXTENT_DEG || a.maxLat - a.minLat > MAX_EXTENT_DEG) return
    const lon = (a.minLon + a.maxLon) / 2
    const lat = (a.minLat + a.maxLat) / 2
    if (isValidLngLat(lon, lat)) centers[col] = [lon, lat]
  })
  return centers
}

export function getCollectionCenters(collections = [], items = []) {
  const derived = itemsCenters(items)
  const centers = {}
  collections.forEach(col => {
    const c = extentCenter(col) || derived[col.id]
    if (c) centers[col.id] = c
  })
  // collections 목록에 없는 collection 의 Item 유도 중심도 노출 (자동 생성 upload-* 등)
  Object.entries(derived).forEach(([id, c]) => { if (!centers[id]) centers[id] = c })
  return centers
}

export function getRegionLabels(collections = [], items = []) {
  const centers = getCollectionCenters(collections, items)
  return collections
    .filter(c => centers[c.id] && c.id !== 'unassigned-inbox')
    .map(c => ({ id: c.id, title: c.title || c.id, center: centers[c.id] }))
}
