/**
 * normalizeRelations — `/items/{id}/related` 응답(또는 mock 관계)을 Detail 그래프·authoring
 * 표시 모델로 환원한다.
 *
 * - prev/next 는 Timeline 섹션 소관이므로 제외한다.
 * - has_derived / describes 는 역방향(자동 생성) 링크 → incoming(읽기 전용)으로 분류한다.
 *   나머지는 outgoing(편집 가능)이다.
 * - linkIndex 는 **원본 related 배열 인덱스**다. 백엔드 delete_link 는 시스템 링크를 제외한
 *   사용자 링크 순번을 쓰고, get_related 도 같은 순서로 사용자 링크를 나열하므로 이 인덱스가
 *   removeLink 호출에 그대로 대응한다. (prev/next 슬롯을 건너뛰지 않고 forEach 인덱스를 쓰는 이유.)
 */

const REVERSE_RELS = new Set(['has_derived', 'describes'])
const TIMELINE_RELS = new Set(['prev', 'next'])

export function normalizeRelations(related = []) {
  const outgoing = []
  const incoming = []

  related.forEach((r, index) => {
    if (TIMELINE_RELS.has(r.rel)) return
    const targetId = r.target_id ?? r.targetId ?? null
    const entry = {
      id: `rel-${index}`,
      linkIndex: index,
      rel: r.rel,
      targetId,
      targetCol: r.target_collection_id ?? r.targetCol ?? null,
      name: r.description || r.title || targetId || '(이름 없음)',
      cat: r.data_category || r.cat || 'unknown',
      status: r.status || 'unknown',
      missing: r.missing === true || !targetId,
      direction: REVERSE_RELS.has(r.rel) ? 'in' : 'out',
    }
    if (entry.direction === 'in') incoming.push(entry)
    else outgoing.push(entry)
  })

  const counts = {}
  outgoing.forEach(r => { counts[r.rel] = (counts[r.rel] || 0) + 1 })

  return { outgoing, incoming, counts }
}
