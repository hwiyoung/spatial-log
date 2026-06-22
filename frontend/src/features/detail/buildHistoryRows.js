/**
 * buildHistoryRows — `/items/{id}/history` 이벤트 + Item 메타데이터를 History 표시 행으로 합성.
 *
 * 정직성 원칙: 실제 기록된 이벤트만 보여준다. 단, 이력 로그 도입 이전에 등록된 Item 은
 * register 이벤트가 없으므로 properties.created(실존 사실)로 등록 행을 유도하고,
 * 다른 이벤트가 전혀 없을 때 properties.updated 가 created 와 다르면 "마지막 수정" 행을
 * 유도한다. 허구의 행위자·날짜는 만들지 않는다.
 */

export function buildHistoryRows(events = [], item = null) {
  const rows = events.map(e => ({
    type: e.event_type,
    text: e.summary,
    meta: e.actor || null,
    date: e.created_at || null,
  }))

  const props = item?.properties || {}
  if (!rows.some(r => r.type === 'register') && props.created) {
    rows.push({
      type: 'register',
      text: '등록됨',
      meta: '이력 기록 이전 — 메타데이터 기준',
      date: props.created,
    })
  }
  // 기록된 이벤트가 전혀 없는(이력 도입 이전) Item 에만 updated 폴백을 보여준다
  if (events.length === 0 && props.updated && props.updated !== props.created) {
    rows.push({
      type: 'meta',
      text: '마지막 수정',
      meta: '이력 기록 이전 — 메타데이터 기준',
      date: props.updated,
    })
  }

  // epoch 수치 비교 — '+00:00'/'Z' 등 오프셋 표기가 섞여도 안전한 최신순 정렬
  return rows.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
}

export function formatHistoryDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16).replace('T', ' ')
  const p = (n) => String(n).padStart(2, '0')
  // 사용자 로컬 시간으로 표시 — DB 는 UTC 로 저장한다
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
