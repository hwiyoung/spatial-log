/**
 * getProjectStats — Collection 의 Item 목록(+dashboard) → Project 화면 통계 모델.
 *
 * - 산출물 충족(deliverables)은 dashboard.expected_vs_actual(실데이터, Collection 의
 *   expected_deliverables 기반)을 우선 쓰고, 없으면 등록된 유형만 expected '—' 로 표시한다.
 * - 상태 분포/Draft 수는 Item 목록에서 직접 센다 (dashboard 미가용 시에도 동작).
 */
import { getItemStatus } from '../items/getItemStatus.js'

export function getProjectStats(items = [], dashboard = null) {
  const statusCounts = {}
  const regByCat = {}
  items.forEach(i => {
    const s = getItemStatus(i)
    statusCounts[s] = (statusCounts[s] || 0) + 1
    const c = i.properties?.data_category || 'unknown'
    regByCat[c] = (regByCat[c] || 0) + 1
  })

  let deliverables
  if (dashboard?.expected_vs_actual?.length) {
    deliverables = dashboard.expected_vs_actual.map(r => ({
      cat: r.category,
      expected: r.expected || 0,
      registered: r.actual || 0,
      description: r.description || '',
    }))
    // expected 목록에 없지만 등록된 유형도 표시 — 정확한 카운트는 dashboard(type_counts) 우선
    const counts = dashboard?.type_counts || regByCat
    const known = new Set(deliverables.map(d => d.cat))
    Object.entries(counts).forEach(([cat, n]) => {
      if (!known.has(cat)) deliverables.push({ cat, expected: 0, registered: n, description: '' })
    })
  } else {
    const counts = dashboard?.type_counts || regByCat
    deliverables = Object.entries(counts).map(([cat, n]) => ({ cat, expected: 0, registered: n, description: '' }))
  }

  const expTotal = deliverables.reduce((a, d) => a + d.expected, 0)
  const missing = deliverables.filter(d => d.expected > 0 && d.registered < d.expected)
  const missingCount = missing.reduce((a, d) => a + (d.expected - d.registered), 0)

  return {
    // 정확한 총계는 dashboard(전수 집계) 우선 — items 는 검색 limit(200) 에 잘릴 수 있다.
    regTotal: dashboard?.total_items ?? items.length,
    expTotal: expTotal || null,           // expected 정보 없으면 null — UI 는 '—' 처리
    deliverables,
    missing,
    missingCount,
    statusCounts,
    draftCount: dashboard?.draft_count ?? (statusCounts.draft || 0),
    pubCount: statusCounts.published || 0,
  }
}

// Collection 메타 표시값 — 실데이터(summaries) 우선, mock(properties) 폴백
export function getCollectionFacts(col) {
  const sm = col?.summaries || {}
  const pr = col?.properties || {}
  // 기간: summaries(PUT 수정이 반영되는 곳) 우선, extent.temporal(생성 시점 값) 폴백
  const pStart = sm['project:period_start'] || col?.extent?.temporal?.interval?.[0]?.[0] || null
  const pEnd = sm['project:period_end'] || col?.extent?.temporal?.interval?.[0]?.[1] || null
  const period = (pStart || pEnd)
    ? `${(pStart || '').slice(0, 10) || '…'} ~ ${(pEnd || '').slice(0, 10) || '…'}`
    : null
  const epsgRaw = sm['project:default_epsg'] || pr.default_crs || null
  return {
    site: sm['project:site'] || pr['project:site'] || null,
    client: sm['project:client'] || pr.client || null,
    pm: sm['project:manager'] || pr.pm || null,
    period,
    epsg: epsgRaw ? (String(epsgRaw).startsWith('EPSG') ? String(epsgRaw) : `EPSG:${epsgRaw}`) : null,
    status: sm['sams:status'] || pr.status || 'active',
  }
}
