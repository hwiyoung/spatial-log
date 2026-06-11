/**
 * Project — 프로젝트(Collection) 대시보드 (route: /project)
 *
 * 좌측 프로젝트 목록(Active/Archived/Unassigned + 완성도 미니바) |
 * 우측 헤더(사실관계·KPI·이름변경·삭제) + 5탭(현황·공간·Draft·전체 Item·Timeline·Lineage).
 * Unassigned Inbox 는 전용 뷰 — 프로젝트 연결(실제 Collection 이동).
 * Draft 의 "보완하기" 는 MetadataCompletion 으로 연결된다.
 *
 * 참조: design-reference/project/Project.html (Claude Design 핸드오프)
 *      docs/system_structure_design.md 페이지 3
 * 주의: mock(?mock=1) 모드는 조회 데모만 — 생성/이름변경/삭제/이동은 실데이터 모드 전용.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { collectionApi, searchApi, itemApi } from '../services/api'
import { isMockExplorerMode, mockExplorerDataSource } from '../mocks/mockExplorerDataSource'
import { getExplorerItemView } from '../features/explorer/getExplorerItemView.js'
import { getProjectStats, getCollectionFacts } from '../features/project/getProjectStats.js'
import ProjectList from '../components/project/ProjectList'
import OverviewTab from '../components/project/OverviewTab'
import { DraftTab, ItemsTab, LineageTab } from '../components/project/ProjectItemTabs'
import UnassignedView from '../components/project/UnassignedView'
import CreateProjectModal from '../components/project/CreateProjectModal'
import MapView from '../components/MapView'
import '../styles/project.css'

const TABS = ['현황', '공간', 'Draft', '전체 Item', 'Timeline·Lineage']

export default function Project() {
  const navigate = useNavigate()
  const location = useLocation()
  const isMock = useMemo(() => isMockExplorerMode(), [])

  const [collections, setCollections] = useState([])
  const [liteStats, setLiteStats] = useState({})       // {colId: {assets, draft, expTotal}}
  const [selectedId, setSelectedId] = useState(null)
  const [items, setItems] = useState([])
  const [dashboard, setDashboard] = useState(null)
  const [tab, setTab] = useState('현황')
  const [loading, setLoading] = useState(true)
  const [itemsLoading, setItemsLoading] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [mapSel, setMapSel] = useState(null)
  const loadSeq = useRef(0)   // 빠른 프로젝트 전환 시 늦게 도착한 응답이 화면을 덮지 않게

  // 보완 화면에서 "← Project로" 복귀 시 원래 프로젝트 복원 (?col= 힌트)
  const initialCol = useMemo(() => new URLSearchParams(window.location.search).get('col'), [])

  // ── Collection 목록 + 사이드바 통계 ──
  // 주의: 갱신(rename/move/create 후)에는 전체 로더를 띄우지 않는다 — 화면 언마운트로
  // UnassignedView 선택 상태·지도 인스턴스가 날아간다. loading 은 최초 1회만.
  const loadCollections = useCallback(async () => {
    try {
      const res = isMock ? await mockExplorerDataSource.listCollections() : await collectionApi.list()
      const cols = res.data?.collections || []
      setCollections(cols)
      setSelectedId(prev => (
        prev && cols.some(c => c.id === prev) ? prev
          : (initialCol && cols.some(c => c.id === initialCol)) ? initialCol
            : (cols[0]?.id ?? null)
      ))
      setLoading(false)   // 목록이 오면 즉시 페인트 — 사이드바 통계는 비동기로 채워진다

      if (isMock) {
        // mock: 전체 Item 한 번에 받아 클라이언트에서 그룹핑
        const all = await mockExplorerDataSource.search({})
        const grouped = {}
        ;(all.data?.features || []).forEach(f => {
          const g = grouped[f.collection] = grouped[f.collection] || { assets: 0, draft: 0, expTotal: 0 }
          g.assets += 1
          if ((f.properties?.['sams:status'] || f.properties?.status) === 'draft') g.draft += 1
        })
        setLiteStats(grouped)
      } else {
        const results = await Promise.allSettled(cols.map(c => collectionApi.dashboard(c.id)))
        const stats = {}
        results.forEach((r, i) => {
          if (r.status !== 'fulfilled') return
          const d = r.value.data || {}
          stats[cols[i].id] = {
            assets: d.total_items || 0,
            draft: d.draft_count || 0,
            expTotal: (d.expected_vs_actual || []).reduce((a, row) => a + (row.expected || 0), 0),
          }
        })
        setLiteStats(stats)
      }
    } catch (err) {
      console.error('Collection 목록 로드 실패:', err)
      setCollections([])
    } finally {
      setLoading(false)
    }
  }, [isMock, initialCol])

  useEffect(() => { loadCollections() }, [loadCollections])

  // ── 선택 프로젝트의 Item + dashboard ──
  const loadSelected = useCallback(async () => {
    if (!selectedId) return
    const seq = ++loadSeq.current
    setItemsLoading(true)
    try {
      if (isMock) {
        const res = await mockExplorerDataSource.search({ collectionId: selectedId })
        if (seq !== loadSeq.current) return   // 더 새로운 선택이 진행 중 — 늦은 응답 폐기
        setItems(res.data?.features || [])
        setDashboard(null)
      } else {
        const [itemsRes, dashRes] = await Promise.allSettled([
          searchApi.search({ collections: [selectedId], limit: 200 }),
          collectionApi.dashboard(selectedId),
        ])
        if (seq !== loadSeq.current) return
        setItems(itemsRes.status === 'fulfilled' ? (itemsRes.value.data?.features || []) : [])
        setDashboard(dashRes.status === 'fulfilled' ? dashRes.value.data : null)
      }
    } finally {
      if (seq === loadSeq.current) setItemsLoading(false)
    }
  }, [selectedId, isMock])

  useEffect(() => {
    setTab('현황')
    setEditingTitle(false)
    setMapSel(null)
    loadSelected()
  }, [loadSelected])

  const selectedCol = collections.find(c => c.id === selectedId)
  const isInbox = selectedId === 'unassigned-inbox'
  const facts = useMemo(() => (selectedCol ? getCollectionFacts(selectedCol) : null), [selectedCol])
  const stats = useMemo(() => getProjectStats(items, dashboard), [items, dashboard])
  const views = useMemo(() => items.map(i => getExplorerItemView(i, collections)), [items, collections])

  // ── navigation (mock 쿼리 보존) ──
  const goDetail = (v) => navigate({ pathname: `/detail/${v.collection}/${v.id}`, search: location.search })
  const goComplete = (v) => navigate(
    { pathname: `/complete/${v.collection}/${v.id}`, search: location.search },
    { state: { from: 'project' } },
  )

  // ── actions (실데이터 전용) ──
  const handleRename = async () => {
    const next = titleDraft.trim()
    if (!next || next === (selectedCol?.title || '')) { setEditingTitle(false); return }
    try {
      await collectionApi.update(selectedId, { title: next })
      setEditingTitle(false)
      loadCollections()
    } catch (err) {
      alert('이름 변경 실패: ' + (err.response?.data?.detail || err.message))
    }
  }

  const handleDelete = async () => {
    const name = selectedCol?.title || selectedId
    if (!confirm(`"${name}" 프로젝트를 삭제하시겠습니까?\n하위 아이템과 S3 파일이 모두 삭제됩니다.`)) return
    try {
      await collectionApi.delete(selectedId)
      setSelectedId(null)
      setDashboard(null)
      loadCollections()
    } catch (err) {
      alert('삭제 실패: ' + (err.response?.data?.detail || err.message))
    }
  }

  const handleSaveDeliverables = async (deliverables) => {
    try {
      await collectionApi.update(selectedId, { expected_deliverables: deliverables })
      await Promise.all([loadSelected(), loadCollections()])   // KPI + 사이드바 미니바 갱신
    } catch (err) {
      alert('예상 산출물 저장 실패: ' + (err.response?.data?.detail || err.message))
      throw err
    }
  }

  const handleAssign = async (v, targetColId) => {
    if (isMock) {
      alert('데모 세션 — 이동은 실데이터 모드에서 가능합니다.')
      return
    }
    setBusyId(v.id)
    try {
      await itemApi.move(v.collection, v.id, targetColId)
      await Promise.all([loadSelected(), loadCollections()])
    } catch (err) {
      alert('이동 실패: ' + (err.response?.data?.detail || err.message))
    } finally {
      setBusyId(null)
    }
  }

  if (loading) return <div className="proj"><div className="proj-empty" style={{ margin: 'auto' }}>불러오는 중…</div></div>

  return (
    <div className="proj">
      <ProjectList
        collections={collections}
        liteStats={liteStats}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onCreate={() => {
          if (isMock) { alert('데모 세션 — 프로젝트 생성은 실데이터 모드에서 가능합니다.'); return }
          setShowCreate(true)
        }}
      />

      <div className="main">
        {!selectedCol ? (
          <div className="proj-empty" style={{ margin: 'auto' }}>왼쪽에서 프로젝트를 선택하거나 새로 만드세요.</div>
        ) : (
          <>
            <div className="phead">
              <div className="ph-top">
                <div>
                  <h1 className="ph-title">
                    {isInbox && <span style={{ color: 'var(--draft)' }}>◇</span>}
                    {editingTitle ? (
                      <>
                        <input
                          autoFocus value={titleDraft}
                          onChange={e => setTitleDraft(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setEditingTitle(false) }}
                        />
                        <button type="button" className="ph-edit" onClick={handleRename}>저장</button>
                        <button type="button" className="ph-edit" onClick={() => setEditingTitle(false)}>취소</button>
                      </>
                    ) : (
                      <>
                        {selectedCol.title || selectedCol.id}
                        {!isInbox && !isMock && (
                          <button type="button" className="ph-edit" title="이름 변경"
                            onClick={() => { setTitleDraft(selectedCol.title || selectedCol.id); setEditingTitle(true) }}>✎</button>
                        )}
                      </>
                    )}
                  </h1>
                  <div className="ph-sub">
                    {isInbox ? (
                      <span>아직 프로젝트에 배정되지 않은 산출물 · 특수 버킷</span>
                    ) : (
                      <>
                        {facts.site && <span>📍 <b>{facts.site}</b></span>}
                        {facts.client && <span>발주처 <b>{facts.client}</b></span>}
                        {facts.pm && <span>PM <b>{facts.pm}</b></span>}
                        {facts.period && <span>{facts.period}</span>}
                        {facts.epsg && <span className="mono">{facts.epsg}</span>}
                      </>
                    )}
                  </div>
                </div>
                <div className="ph-kpis">
                  <div className="kpi"><div className="v">{stats.regTotal}</div><div className="l">Assets</div></div>
                  <div className="kpi draft"><div className="v">{stats.draftCount}</div><div className="l">Draft</div></div>
                  {!isInbox && stats.expTotal && (
                    <div className="kpi gap"><div className="v">{stats.regTotal}/{stats.expTotal}</div><div className="l">등록</div></div>
                  )}
                  {isInbox && <div className="kpi pub"><div className="v">{stats.pubCount}</div><div className="l">Published</div></div>}
                  {!isInbox && !isMock && (
                    <div className="ph-acts">
                      <button type="button" className="ph-del" onClick={handleDelete}>🗑 삭제</button>
                    </div>
                  )}
                </div>
              </div>
              {!isInbox && (
                <div className="tabs">
                  {TABS.map(t => (
                    <button key={t} type="button" className={'tab' + (tab === t ? ' on' : '')} onClick={() => setTab(t)}>
                      {t}{t === 'Draft' && stats.draftCount > 0 && <span className="b">{stats.draftCount}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 재로딩 중에는 뷰를 언마운트하지 않는다(선택 상태·지도 유지) — 데이터가 아직 없을 때만 로더 */}
            <div className="body" style={itemsLoading && views.length > 0 ? { opacity: 0.6, pointerEvents: 'none' } : undefined}>
              {itemsLoading && views.length === 0 ? <div className="proj-empty">불러오는 중…</div> : isInbox ? (
                <UnassignedView
                  views={views}
                  projects={collections.filter(c => c.id !== 'unassigned-inbox')}
                  statusCounts={stats.statusCounts}
                  onAssign={handleAssign}
                  onOpen={goDetail}
                  busyId={busyId}
                />
              ) : (
                <>
                  {tab === '현황' && <OverviewTab stats={stats} facts={facts} onSaveDeliverables={isMock ? undefined : handleSaveDeliverables} />}
                  {tab === '공간' && (
                    <div className="spatial-tab">
                      <MapView
                        items={items}
                        selectedId={mapSel?.id}
                        onSelectItem={setMapSel}
                        fitToItems
                        loading={itemsLoading}
                      />
                    </div>
                  )}
                  {tab === 'Draft' && <DraftTab views={views} onComplete={goComplete} onOpen={goDetail} />}
                  {tab === '전체 Item' && <ItemsTab views={views} onOpen={goDetail} />}
                  {tab === 'Timeline·Lineage' && <LineageTab items={items} views={views} collectionId={selectedId} />}
                </>
              )}
            </div>
          </>
        )}
      </div>

      {showCreate && (
        <CreateProjectModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); loadCollections() }}
        />
      )}
    </div>
  )
}
