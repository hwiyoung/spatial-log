/**
 * OntologyReview — read-only semantic review surface.
 *
 * This page turns `/api/ontology/concept-write-dry-run` into an operator-facing
 * queue. It does not approve, write, or backfill STAC Items.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { collectionApi, ontologyApi } from '../services/api'
import '../styles/ontology.css'

const REVIEW_STORAGE_KEY = 'sams:ontology-review-decisions:v1'

const STATUS_META = {
  would_write: { label: 'ID 매칭됨', tone: 'write' },
  already_present: { label: 'ID 저장됨', tone: 'ok' },
  no_source: { label: '라벨 없음', tone: 'muted' },
  unresolved: { label: 'ID 없음', tone: 'warn' },
  ambiguous: { label: '후보 여러 개', tone: 'bad' },
  conflict: { label: '기존 ID 불일치', tone: 'bad' },
}

const REVIEW_DECISIONS = [
  { id: 'approved', label: '매칭 확인', tone: 'ok' },
  { id: 'needs_vocab', label: '표준 ID 추가', tone: 'warn' },
  { id: 'needs_source', label: '라벨 입력 필요', tone: 'bad' },
  { id: 'deferred', label: '나중에 검토', tone: 'muted' },
]

const REVIEW_FILTERS = [
  { id: 'all', label: '전체' },
  { id: 'unreviewed', label: '아직 검수 안 함' },
  ...REVIEW_DECISIONS,
]

const WORKFLOW_LANES = {
  write: { label: 'ID 매칭됨', tone: 'write' },
  vocabulary: { label: 'ID 없는 라벨', tone: 'warn' },
  source: { label: '라벨 없음', tone: 'muted' },
  risk: { label: '후보 중복 또는 불일치', tone: 'bad' },
  monitor: { label: '조치 필요 없음', tone: 'ok' },
}

const FILTERS = [
  { id: 'all', label: '전체' },
  { id: 'would_write', label: 'ID 매칭됨' },
  { id: 'unresolved', label: 'ID 없는 라벨' },
  { id: 'no_source', label: '라벨 없음' },
  { id: 'risk', label: '후보 중복/불일치' },
]

function itemMatchesFilter(item, filter) {
  const statuses = [item.site?.status, item.target?.status]
  if (filter === 'all') return true
  if (filter === 'risk') return statuses.includes('ambiguous') || statuses.includes('conflict')
  return statuses.includes(filter)
}

function statusCount(items, filter) {
  return items.filter(item => itemMatchesFilter(item, filter)).length
}

function fieldCount(summary, field, status) {
  return summary?.fields?.[field]?.[status] || 0
}

function reviewLabel(decision) {
  return REVIEW_DECISIONS.find(row => row.id === decision)?.label || '아직 검수 안 함'
}

function reviewTone(decision) {
  return REVIEW_DECISIONS.find(row => row.id === decision)?.tone || 'muted'
}

function asList(value) {
  if (!value) return []
  return Array.isArray(value) ? value : Object.entries(value).map(([field, concept]) => ({ field, concept }))
}

function fieldLabel(field) {
  if (field === 'sams:site_concept') return 'Site ID'
  if (field === 'sams:target_concept') return 'Target ID'
  return field.replace('sams:', '')
}

function getItemKey(item) {
  return `${item.collection_id || 'collection 없음'}|${item.item_id || ''}`
}

function loadReviewState() {
  try {
    return JSON.parse(window.localStorage.getItem(REVIEW_STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

function saveReviewState(next) {
  try {
    window.localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // localStorage can be unavailable in private/embedded browser contexts.
  }
}

function getWorkflowLane(item) {
  const statuses = [item.site?.status, item.target?.status]
  if (statuses.includes('ambiguous') || statuses.includes('conflict')) return 'risk'
  if (statuses.includes('unresolved')) return 'vocabulary'
  if (statuses.includes('no_source')) return 'source'
  if (item.safe_to_write || asList(item.would_write).length > 0) return 'write'
  return 'monitor'
}

function getRecommendedDecision(item) {
  const lane = getWorkflowLane(item)
  if (lane === 'write') return 'approved'
  if (lane === 'vocabulary' || lane === 'risk') return 'needs_vocab'
  if (lane === 'source') return 'needs_source'
  return 'deferred'
}

function itemMatchesReviewFilter(item, filter, reviewState) {
  if (filter === 'all') return true
  const decision = reviewState[getItemKey(item)]?.decision || ''
  if (filter === 'unreviewed') return !decision
  return decision === filter
}

function reviewCount(items, filter, reviewState) {
  return items.filter(item => itemMatchesReviewFilter(item, filter, reviewState)).length
}

function buildReviewStats(items, reviewState) {
  const lanes = Object.fromEntries(Object.keys(WORKFLOW_LANES).map(key => [key, 0]))
  const decisions = { unreviewed: 0 }
  REVIEW_DECISIONS.forEach(row => { decisions[row.id] = 0 })

  items.forEach(item => {
    lanes[getWorkflowLane(item)] += 1
    const decision = reviewState[getItemKey(item)]?.decision
    if (decision && decisions[decision] !== undefined) decisions[decision] += 1
    else decisions.unreviewed += 1
  })

  return { lanes, decisions }
}

function buildDryRunSummary(items) {
  const fields = {
    'sams:site_concept': emptyFieldSummary(),
    'sams:target_concept': emptyFieldSummary(),
  }
  let itemsWithWriteCandidates = 0
  let safeToWrite = 0

  items.forEach(item => {
    if (asList(item.would_write).length > 0) itemsWithWriteCandidates += 1
    if (item.safe_to_write) safeToWrite += 1
    const proposals = [
      ['sams:site_concept', item.site?.status],
      ['sams:target_concept', item.target?.status],
    ]
    proposals.forEach(([field, status]) => {
      if (status && fields[field]?.[status] !== undefined) fields[field][status] += 1
    })
  })

  return {
    items_scanned: items.length,
    items_with_write_candidates: itemsWithWriteCandidates,
    safe_to_write: safeToWrite,
    fields,
  }
}

function emptyFieldSummary() {
  return {
    would_write: 0,
    already_present: 0,
    no_source: 0,
    unresolved: 0,
    ambiguous: 0,
    conflict: 0,
  }
}

function csvEscape(value) {
  const text = value == null ? '' : String(value)
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function exportReviewCsv(items, reviewState) {
  const headers = [
    'collection_id',
    'item_id',
    'data_category',
    'auto_match_lane',
    'site_standard_id_status',
    'site_label_source',
    'site_label',
    'site_standard_id',
    'target_standard_id_status',
    'target_label_source',
    'target_label',
    'target_standard_id',
    'standard_id_write_proposal',
    'ready_to_write_after_review',
    'operator_decision',
    'operator_note',
  ]
  const rows = items.map(item => {
    const review = reviewState[getItemKey(item)] || {}
    return [
      item.collection_id,
      item.item_id,
      item.data_category,
      WORKFLOW_LANES[getWorkflowLane(item)]?.label || getWorkflowLane(item),
      item.site?.status,
      item.site?.source_field,
      item.site?.source_label,
      item.site?.proposed_concept || item.site?.existing_concept,
      item.target?.status,
      item.target?.source_field,
      item.target?.source_label,
      item.target?.proposed_concept || item.target?.existing_concept,
      asList(item.would_write).map(row => `${fieldLabel(row.field)}=${row.concept}`).join('; '),
      item.safe_to_write ? 'true' : 'false',
      reviewLabel(review.decision),
      review.note || '',
    ]
  })
  const csv = [headers, ...rows].map(row => row.map(csvEscape).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `ontology-review-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function ProposalCell({ title, proposal }) {
  const meta = STATUS_META[proposal?.status] || STATUS_META.no_source
  const sourceLabel = proposal?.source_label || '라벨 없음'
  const sourceField = proposal?.source_field || '라벨 출처 없음'
  const concept = proposal?.proposed_concept || proposal?.existing_concept || ''
  const conceptLabel = proposal?.proposed_label_ko || ''
  const confidence = Math.round((proposal?.confidence || 0) * 100)

  return (
    <div className="ont-proposal">
      <div className="op-top">
        <span className="op-title">{title}</span>
        <span className={'op-status ' + meta.tone}>{meta.label}</span>
      </div>
      <div className="op-main">
        <span className="op-source" title={sourceField}>{sourceLabel}</span>
        {concept && <span className="op-arrow">→</span>}
        {concept && (
          <span className="op-concept" title={concept}>
            {conceptLabel || concept}
            <small>{concept}</small>
          </span>
        )}
      </div>
      <div className="op-sub">
        <span>{sourceField}</span>
        {confidence > 0 && <span>{confidence}%</span>}
      </div>
    </div>
  )
}

function groupByLabel(items, kind, status) {
  const map = new Map()
  items.forEach(item => {
    const proposal = item[kind]
    if (proposal?.status !== status) return
    const label = proposal.source_label || '라벨 없음'
    const key = `${label}|${proposal.source_field || ''}`
    const row = map.get(key) || {
      label,
      sourceField: proposal.source_field || '라벨 출처 없음',
      count: 0,
      collections: new Set(),
      categories: new Set(),
    }
    row.count += 1
    if (item.collection_id) row.collections.add(item.collection_id)
    if (item.data_category) row.categories.add(item.data_category)
    map.set(key, row)
  })
  return [...map.values()]
    .map(row => ({
      ...row,
      collections: [...row.collections],
      categories: [...row.categories],
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

function groupNoSource(items, kind) {
  const map = new Map()
  items.forEach(item => {
    if (item[kind]?.status !== 'no_source') return
    const key = `${item.collection_id || 'collection 없음'}|${item.data_category || 'category 없음'}`
    const row = map.get(key) || {
      collectionId: item.collection_id || 'collection 없음',
      category: item.data_category || 'category 없음',
      count: 0,
    }
    row.count += 1
    map.set(key, row)
  })
  return [...map.values()].sort((a, b) => b.count - a.count || a.collectionId.localeCompare(b.collectionId))
}

function GapList({ title, rows, empty }) {
  return (
    <div className="ont-gap">
      <div className="og-head">{title}</div>
      {rows.length === 0 ? (
        <div className="og-empty">{empty}</div>
      ) : rows.map(row => (
        <div className="og-row" key={`${row.label || row.collectionId}|${row.sourceField || row.category}`}>
          <div className="og-main">
            <b>{row.label || row.collectionId}</b>
            <span>{row.sourceField || row.category}</span>
          </div>
          <div className="og-meta">
            {'collections' in row && row.collections.slice(0, 3).map(c => <span key={c}>{c}</span>)}
            {'categories' in row && row.categories.slice(0, 3).map(c => <span key={c}>{c}</span>)}
            {'category' in row && <span>{row.category}</span>}
            <strong>{row.count}</strong>
          </div>
        </div>
      ))}
    </div>
  )
}

function ReviewRow({ item, review, onReviewChange }) {
  const lane = getWorkflowLane(item)
  const laneMeta = WORKFLOW_LANES[lane]
  const recommended = getRecommendedDecision(item)
  const decision = review?.decision || ''
  const note = review?.note || ''

  return (
    <div className="ont-row">
      <div className="or-id">
        <b title={item.item_id}>{item.item_id}</b>
        <span>{item.collection_id || 'collection 없음'} · {item.data_category || 'category 없음'}</span>
        <em className={'or-lane ' + laneMeta.tone}>{laneMeta.label}</em>
      </div>
      <ProposalCell title="Site" proposal={item.site} />
      <ProposalCell title="Target" proposal={item.target} />
      <div className="or-write">
        {asList(item.would_write).length === 0 ? (
          <span className="ow-none">ID 매칭 없음</span>
        ) : asList(item.would_write).map(row => (
          <span className="ow-chip" key={row.field}>
            <b>{fieldLabel(row.field)}</b>
            <small>{row.concept}</small>
          </span>
        ))}
      </div>
      <div className="or-review">
        <div className="rv-top">
          <span className={'rv-pill ' + reviewTone(decision)}>{reviewLabel(decision)}</span>
          <small>권장 결정: {reviewLabel(recommended)}</small>
        </div>
        <select
          value={decision}
          onChange={e => onReviewChange(item, { decision: e.target.value })}
          aria-label="운영 검수 결정"
        >
          <option value="">아직 검수 안 함</option>
          {REVIEW_DECISIONS.map(row => (
            <option key={row.id} value={row.id}>{row.label}</option>
          ))}
        </select>
        <input
          value={note}
          onChange={e => onReviewChange(item, { note: e.target.value })}
          placeholder="운영 메모"
          aria-label="운영 메모"
        />
      </div>
    </div>
  )
}

export default function OntologyReview() {
  const [collections, setCollections] = useState([])
  const [collectionId, setCollectionId] = useState('')
  const [filter, setFilter] = useState('all')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reviewFilter, setReviewFilter] = useState('all')
  const [reviewState, setReviewState] = useState(loadReviewState)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [collectionRes, dryRunRes] = await Promise.all([
        collectionApi.list(),
        ontologyApi.conceptWriteDryRun({
          collection_id: collectionId || null,
          include_unmatched: true,
          limit: 1000,
        }),
      ])
      setCollections(collectionRes.data?.collections || [])
      setData(dryRunRes.data)
    } catch (err) {
      console.error('Ontology review load failed:', err)
      setError(err.response?.data?.detail || err.message || '로드 실패')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [collectionId])

  useEffect(() => { load() }, [load])
  useEffect(() => { saveReviewState(reviewState) }, [reviewState])

  const items = data?.items || []
  const reviewScopedItems = useMemo(() => (
    items.filter(item => itemMatchesReviewFilter(item, reviewFilter, reviewState))
  ), [items, reviewFilter, reviewState])
  const statusScopedItems = useMemo(() => (
    items.filter(item => itemMatchesFilter(item, filter))
  ), [items, filter])
  const visibleItems = useMemo(() => (
    statusScopedItems.filter(item => itemMatchesReviewFilter(item, reviewFilter, reviewState))
  ), [statusScopedItems, reviewFilter, reviewState])
  const unresolvedSite = useMemo(() => groupByLabel(visibleItems, 'site', 'unresolved'), [visibleItems])
  const unresolvedTarget = useMemo(() => groupByLabel(visibleItems, 'target', 'unresolved'), [visibleItems])
  const noSourceSite = useMemo(() => groupNoSource(visibleItems, 'site'), [visibleItems])
  const noSourceTarget = useMemo(() => groupNoSource(visibleItems, 'target'), [visibleItems])
  const summary = useMemo(() => buildDryRunSummary(visibleItems), [visibleItems])
  const reviewStats = useMemo(() => buildReviewStats(visibleItems, reviewState), [visibleItems, reviewState])
  const reviewedCount = visibleItems.length - reviewStats.decisions.unreviewed

  const updateReview = useCallback((item, patch) => {
    const key = getItemKey(item)
    setReviewState(prev => {
      const current = prev[key] || {}
      const nextEntry = {
        ...current,
        ...patch,
        updated_at: new Date().toISOString(),
      }
      const hasDecision = Boolean(nextEntry.decision)
      const hasNote = Boolean((nextEntry.note || '').trim())
      if (!hasDecision && !hasNote) {
        const { [key]: _removed, ...rest } = prev
        return rest
      }
      return { ...prev, [key]: nextEntry }
    })
  }, [])

  return (
    <div className="ont">
      <aside className="ont-side">
        <div className="ont-brand">
          <span>운영 품질</span>
          <b>표준화 검수</b>
        </div>

        <div className="ont-control">
          <label>Collection</label>
          <select value={collectionId} onChange={e => setCollectionId(e.target.value)}>
            <option value="">전체 Collection</option>
            {collections.map(col => (
              <option key={col.id} value={col.id}>{col.title || col.id}</option>
            ))}
          </select>
        </div>

        <div className="ont-filter">
          <div className="of-label">자동 매칭 결과</div>
          {FILTERS.map(row => (
            <button
              key={row.id}
              className={filter === row.id ? 'on' : ''}
              onClick={() => setFilter(row.id)}
            >
              <span>{row.label}</span>
              <b>{statusCount(reviewScopedItems, row.id)}</b>
            </button>
          ))}
        </div>

        <div className="ont-filter">
          <div className="of-label">운영 검수 결정</div>
          {REVIEW_FILTERS.map(row => (
            <button
              key={row.id}
              className={reviewFilter === row.id ? 'on' : ''}
              onClick={() => setReviewFilter(row.id)}
            >
              <span>{row.label}</span>
              <b>{reviewCount(statusScopedItems, row.id, reviewState)}</b>
            </button>
          ))}
        </div>

        <div className="ont-note">
          검수 결정과 메모는 이 브라우저에만 저장됩니다. STAC Item, relation, upload data는 수정하지 않습니다.
        </div>
      </aside>

      <main className="ont-main">
        <header className="ont-head">
          <div>
            <h1>표준화 검수</h1>
            <p>같은 장소/대상을 이름 흔들림 없이 묶기 위한 ID 매칭 상태를 봅니다.</p>
          </div>
          <div className="ont-actions">
            <button className="ont-refresh" onClick={() => exportReviewCsv(visibleItems, reviewState)} disabled={loading || visibleItems.length === 0}>
              CSV 내보내기
            </button>
            <button className="ont-refresh" onClick={load} disabled={loading}>
              {loading ? '새로고침 중' : '새로고침'}
            </button>
          </div>
        </header>

        {error && <div className="ont-error">{error}</div>}

        <section className="ont-primer">
          <div className="opm-main">
            <b>표준 ID는 같은 site/target을 묶는 안정 키입니다.</b>
            <span>예를 들어 `성수`, `성수동`, `Seongsu`가 같은 장소라면 검색과 품질 검수는 같은 ID로 묶여야 합니다.</span>
          </div>
          <div className="opm-legend">
            <span><b>ID 매칭됨</b> 운영자가 확인하면 나중에 저장 후보가 됩니다.</span>
            <span><b>ID 없는 라벨</b> 라벨은 있지만 표준 ID 목록 보강이 필요합니다.</span>
            <span><b>라벨 없음</b> site/target 원본 입력부터 필요합니다.</span>
          </div>
        </section>

        <section className="ont-queue">
          <div className="oq-head">
            <h2>Item 검수 목록</h2>
            <span>{visibleItems.length} / {items.length}개 · 검수 완료 {reviewedCount}</span>
          </div>
          {loading ? (
            <div className="ont-empty">검수 데이터를 불러오는 중입니다.</div>
          ) : visibleItems.length === 0 ? (
            <div className="ont-empty">현재 필터에 해당하는 Item이 없습니다.</div>
          ) : (
            <div className="ont-rows">
              {visibleItems.map(item => (
                <ReviewRow
                  key={getItemKey(item)}
                  item={item}
                  review={reviewState[getItemKey(item)]}
                  onReviewChange={updateReview}
                />
              ))}
            </div>
          )}
        </section>

        <section className="ont-kpis">
          <div className="okpi"><b>{summary.items_scanned || 0}</b><span>검토 대상 Item</span></div>
          <div className="okpi write"><b>{summary.items_with_write_candidates || 0}</b><span>ID 매칭됨</span></div>
          <div className="okpi ok"><b>{summary.safe_to_write || 0}</b><span>검수 후 저장 가능</span></div>
          <div className="okpi ok"><b>{reviewedCount}</b><span>검수 완료</span></div>
          <div className="okpi warn"><b>{statusCount(visibleItems, 'unresolved')}</b><span>ID 없는 라벨</span></div>
          <div className="okpi muted"><b>{statusCount(visibleItems, 'no_source')}</b><span>라벨 없음</span></div>
        </section>

        <section className="ont-workflow">
          {Object.entries(WORKFLOW_LANES).map(([lane, meta]) => (
            <div className={'owf-card ' + meta.tone} key={lane}>
              <span>{meta.label}</span>
              <b>{reviewStats.lanes[lane] || 0}</b>
            </div>
          ))}
        </section>

        <section className="ont-coverage">
          <div className="oc-row">
            <span>Site ID</span>
            <b>{fieldCount(summary, 'sams:site_concept', 'would_write')}</b>
            <small>매칭됨</small>
            <b>{fieldCount(summary, 'sams:site_concept', 'unresolved')}</b>
            <small>ID 없음</small>
            <b>{fieldCount(summary, 'sams:site_concept', 'no_source')}</b>
            <small>라벨 없음</small>
          </div>
          <div className="oc-row">
            <span>Target ID</span>
            <b>{fieldCount(summary, 'sams:target_concept', 'would_write')}</b>
            <small>매칭됨</small>
            <b>{fieldCount(summary, 'sams:target_concept', 'unresolved')}</b>
            <small>ID 없음</small>
            <b>{fieldCount(summary, 'sams:target_concept', 'no_source')}</b>
            <small>라벨 없음</small>
          </div>
        </section>

        <section className="ont-gaps">
          <GapList title="ID 없는 site 라벨" rows={unresolvedSite} empty="ID 없는 site 라벨이 없습니다." />
          <GapList title="ID 없는 target 라벨" rows={unresolvedTarget} empty="ID 없는 target 라벨이 없습니다." />
          <GapList title="site 라벨 없음" rows={noSourceSite} empty="site 라벨 누락이 없습니다." />
          <GapList title="target 라벨 없음" rows={noSourceTarget} empty="target 라벨 누락이 없습니다." />
        </section>
      </main>
    </div>
  )
}
