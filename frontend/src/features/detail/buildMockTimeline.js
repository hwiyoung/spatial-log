/**
 * buildMockTimeline — mock 모드 전용 시계열 구성.
 *
 * 실 백엔드 `/items/{id}/timeline` 로직을 클라이언트에서 재현한다:
 *   1) 같은 collection 안에서 target + data_category 가 동일한 Item
 *   2) prev/next 링크 체인을 양방향으로 순회
 * 현재 Item 포함, datetime 오름차순 정렬.
 */
import { getItemStatus } from '../items/getItemStatus.js'
import { getDisplayLabel } from '../items/getDisplayLabel.js'

function parseTargetId(href) {
  const parts = String(href || '').replace(/\/+$/, '').split('/').filter(Boolean)
  return parts.length ? parts[parts.length - 1] : null
}

export function buildMockTimeline(item, allItems = []) {
  if (!item) return []
  const byId = new Map(allItems.map(i => [i.id, i]))
  const props = item.properties || {}
  const target = props.target
  const category = props.data_category
  const picked = new Map()

  const addItem = (it) => {
    if (!it || picked.has(it.id)) return
    const p = it.properties || {}
    picked.set(it.id, {
      item_id: it.id,
      collection_id: it.collection,
      datetime: p.datetime || p.start_datetime || null,
      description: getDisplayLabel(it),
      status: getItemStatus(it),
      data_category: p.data_category || 'unknown',
      is_current: it.id === item.id,
    })
  }

  // 1) 같은 target + category (같은 collection)
  if (target && category) {
    allItems.forEach((other) => {
      const op = other.properties || {}
      if (other.collection === item.collection && op.target === target && op.data_category === category) {
        addItem(other)
      }
    })
  }

  // 2) prev/next 링크 체인 순회 (양방향, 최대 60회 가드)
  addItem(item)
  const queue = [item]
  const seen = new Set([item.id])
  let guard = 0
  while (queue.length && guard < 60) {
    guard += 1
    const cur = queue.shift()
    ;(cur.links || []).forEach((l) => {
      if (l.rel !== 'prev' && l.rel !== 'next') return
      const tid = parseTargetId(l.href)
      if (!tid || seen.has(tid)) return
      const t = byId.get(tid)
      if (t) { seen.add(tid); addItem(t); queue.push(t) }
    })
  }

  return [...picked.values()].sort((a, b) => String(a.datetime || '').localeCompare(String(b.datetime || '')))
}
