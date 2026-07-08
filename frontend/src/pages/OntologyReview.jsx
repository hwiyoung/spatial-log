/**
 * OntologyReview — read-only semantic review surface.
 *
 * This page turns `/api/ontology/concept-write-dry-run` into an operator-facing
 * queue. It does not approve, write, or backfill STAC Items.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { collectionApi, ontologyApi } from '../services/api'
import '../styles/ontology.css'

const STATUS_META = {
  would_write: { label: '쓰기 후보', tone: 'write' },
  already_present: { label: '이미 있음', tone: 'ok' },
  no_source: { label: '원본 없음', tone: 'muted' },
  unresolved: { label: '미해결', tone: 'warn' },
  ambiguous: { label: '모호함', tone: 'bad' },
  conflict: { label: '충돌', tone: 'bad' },
}

const FILTERS = [
  { id: 'all', label: '전체' },
  { id: 'would_write', label: '쓰기 후보' },
  { id: 'unresolved', label: '미해결' },
  { id: 'no_source', label: '원본 없음' },
  { id: 'risk', label: '모호/충돌' },
]

function statusLabel(status) {
  return STATUS_META[status]?.label || status
}

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

function asList(value) {
  if (!value) return []
  return Array.isArray(value) ? value : Object.entries(value).map(([field, concept]) => ({ field, concept }))
}

function ProposalCell({ title, proposal }) {
  const meta = STATUS_META[proposal?.status] || STATUS_META.no_source
  const sourceLabel = proposal?.source_label || '원본 라벨 없음'
  const sourceField = proposal?.source_field || 'source 없음'
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
    const label = proposal.source_label || '원본 라벨 없음'
    const key = `${label}|${proposal.source_field || ''}`
    const row = map.get(key) || {
      label,
      sourceField: proposal.source_field || 'source 없음',
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

function ReviewRow({ item }) {
  return (
    <div className="ont-row">
      <div className="or-id">
        <b title={item.item_id}>{item.item_id}</b>
        <span>{item.collection_id || 'collection 없음'} · {item.data_category || 'category 없음'}</span>
      </div>
      <ProposalCell title="Site" proposal={item.site} />
      <ProposalCell title="Target" proposal={item.target} />
      <div className="or-write">
        {asList(item.would_write).length === 0 ? (
          <span className="ow-none">쓰기 없음</span>
        ) : asList(item.would_write).map(row => (
          <span className="ow-chip" key={row.field}>
            <b>{row.field.replace('sams:', '')}</b>
            <small>{row.concept}</small>
          </span>
        ))}
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

  const items = data?.items || []
  const visibleItems = useMemo(() => items.filter(item => itemMatchesFilter(item, filter)), [items, filter])
  const unresolvedSite = useMemo(() => groupByLabel(items, 'site', 'unresolved'), [items])
  const unresolvedTarget = useMemo(() => groupByLabel(items, 'target', 'unresolved'), [items])
  const noSourceSite = useMemo(() => groupNoSource(items, 'site'), [items])
  const noSourceTarget = useMemo(() => groupNoSource(items, 'target'), [items])
  const summary = data?.summary || {}

  return (
    <div className="ont">
      <aside className="ont-side">
        <div className="ont-brand">
          <span>Ontology</span>
          <b>Review</b>
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
          {FILTERS.map(row => (
            <button
              key={row.id}
              className={filter === row.id ? 'on' : ''}
              onClick={() => setFilter(row.id)}
            >
              <span>{row.label}</span>
              <b>{statusCount(items, row.id)}</b>
            </button>
          ))}
        </div>

        <div className="ont-note">
          이 화면은 dry-run 결과만 보여줍니다. STAC Item, relation, upload data는 수정하지 않습니다.
        </div>
      </aside>

      <main className="ont-main">
        <header className="ont-head">
          <div>
            <h1>Ontology Review</h1>
            <p>문자열 site/target이 어떤 concept로 해석되는지 검토합니다.</p>
          </div>
          <button className="ont-refresh" onClick={load} disabled={loading}>
            {loading ? '새로고침 중' : '새로고침'}
          </button>
        </header>

        {error && <div className="ont-error">{error}</div>}

        <section className="ont-kpis">
          <div className="okpi"><b>{summary.items_scanned || 0}</b><span>스캔 Item</span></div>
          <div className="okpi write"><b>{summary.items_with_write_candidates || 0}</b><span>쓰기 후보</span></div>
          <div className="okpi ok"><b>{summary.safe_to_write || 0}</b><span>safe 후보</span></div>
          <div className="okpi warn"><b>{fieldCount(summary, 'sams:site_concept', 'unresolved') + fieldCount(summary, 'sams:target_concept', 'unresolved')}</b><span>미해결</span></div>
          <div className="okpi muted"><b>{fieldCount(summary, 'sams:site_concept', 'no_source') + fieldCount(summary, 'sams:target_concept', 'no_source')}</b><span>원본 없음</span></div>
        </section>

        <section className="ont-coverage">
          <div className="oc-row">
            <span>Site concept</span>
            <b>{fieldCount(summary, 'sams:site_concept', 'would_write')}</b>
            <small>쓰기 후보</small>
            <b>{fieldCount(summary, 'sams:site_concept', 'unresolved')}</b>
            <small>미해결</small>
            <b>{fieldCount(summary, 'sams:site_concept', 'no_source')}</b>
            <small>원본 없음</small>
          </div>
          <div className="oc-row">
            <span>Target concept</span>
            <b>{fieldCount(summary, 'sams:target_concept', 'would_write')}</b>
            <small>쓰기 후보</small>
            <b>{fieldCount(summary, 'sams:target_concept', 'unresolved')}</b>
            <small>미해결</small>
            <b>{fieldCount(summary, 'sams:target_concept', 'no_source')}</b>
            <small>원본 없음</small>
          </div>
        </section>

        <section className="ont-gaps">
          <GapList title="미해결 site 라벨" rows={unresolvedSite} empty="미해결 site가 없습니다." />
          <GapList title="미해결 target 라벨" rows={unresolvedTarget} empty="미해결 target이 없습니다." />
          <GapList title="site 원본 없음" rows={noSourceSite} empty="site 원본 누락이 없습니다." />
          <GapList title="target 원본 없음" rows={noSourceTarget} empty="target 원본 누락이 없습니다." />
        </section>

        <section className="ont-queue">
          <div className="oq-head">
            <h2>Review Queue</h2>
            <span>{visibleItems.length} / {items.length} Items</span>
          </div>
          {loading ? (
            <div className="ont-empty">dry-run 결과를 불러오는 중입니다.</div>
          ) : visibleItems.length === 0 ? (
            <div className="ont-empty">현재 필터에 해당하는 Item이 없습니다.</div>
          ) : (
            <div className="ont-rows">
              {visibleItems.map(item => <ReviewRow key={`${item.collection_id}|${item.item_id}`} item={item} />)}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
