/**
 * Explorer — 데이터 탐색/검색 메인 페이지 (3-column: 필터 · 지도+목록 · Context Panel)
 *
 * 구성: FilterSidebar | center(head: 배치/2D·3D/관계 · body: 지도 + divider + 결과목록) | ContextPanel
 * 데이터: 키워드+프로젝트 범위는 검색(STAC /search 또는 mock)으로 가져오고, 상태·카테고리·지도범위
 *        필터는 클라이언트에서 적용한다(즉시 반영 + facet 카운트 일관성). 지도/목록/패널이 동일 결과 공유.
 *
 * 참조: design-reference/project/Explorer.html (+ explorer/panels.jsx, explorer/map.jsx)
 *      docs/system_structure_design.md 페이지 1
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { searchApi, collectionApi } from '../services/api'
import { isMockExplorerMode, mockExplorerDataSource } from '../mocks/mockExplorerDataSource'
import { mockRelations } from '../mocks/fixtures/mockRelations.js'
import { getSelectedRelationOverlay } from '../features/relations/getSelectedRelationOverlay.js'
import { getItemStatus } from '../features/items/getItemStatus.js'
import { getDisplayLabel } from '../features/items/getDisplayLabel.js'
import { getItemMapPosition } from '../features/explorer-map/getItemMapPosition.js'
import { getExplorerItemView, EXPLORER_SORTS } from '../features/explorer/getExplorerItemView.js'
import FilterSidebar from '../components/explorer/FilterSidebar'
import ResultList from '../components/explorer/ResultList'
import ContextPanel from '../components/explorer/ContextPanel'
import MapView from '../components/MapView'
import Explorer3dGisBeta from '../features/explorer-3d/Explorer3dGisBeta.jsx'
import '../styles/explorer.css'

const EMPTY_FILTERS = { kw: '', status: [], cat: [], project: 'all', bboxOnly: false }

export default function Explorer() {
  const mockMode = useMemo(() => isMockExplorerMode(), [])
  const navigate = useNavigate()
  const location = useLocation()

  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [collections, setCollections] = useState([])
  const [scopeItems, setScopeItems] = useState([])   // 키워드 범위(상태·카테고리 미적용)
  const [loading, setLoading] = useState(false)

  const [selectedItem, setSelectedItem] = useState(null)
  const [hoveredId, setHoveredId] = useState(null)
  const [mapBounds, setMapBounds] = useState(null)

  // center layout
  const [mode, setMode] = useState('2d')          // 2d | 3d
  const [arrange, setArrange] = useState('stack')  // stack | split
  const [ratio, setRatio] = useState(0.62)
  const [sort, setSort] = useState('recent')
  const [showRel, setShowRel] = useState(true)

  // ── Collection 목록 ──
  useEffect(() => {
    const api = mockMode ? mockExplorerDataSource.listCollections() : collectionApi.list()
    api.then(res => setCollections(res.data?.collections || [])).catch(() => setCollections([]))
  }, [mockMode])

  // ── 키워드+프로젝트 범위 검색 (debounced). 상태/카테고리는 클라이언트 필터. ──
  useEffect(() => {
    const timer = setTimeout(() => doSearch(), 300)
    return () => clearTimeout(timer)
  }, [filters.kw, mockMode])

  const doSearch = useCallback(async () => {
    setLoading(true)
    try {
      if (mockMode) {
        const res = await mockExplorerDataSource.search({ keyword: filters.kw, categories: [], collectionId: null, status: 'all' })
        setScopeItems(res.data?.features || [])
        return
      }
      const params = { limit: 200 }
      const kw = filters.kw.trim()
      if (kw) {
        // pgstac 는 free-text q 를 지원하지 않으므로 CQL2 like 필터로 키워드를 환원
        // (이 코드베이스가 이미 카테고리 필터에 쓰던 cql2-json 패턴과 동일).
        const like = (prop) => ({ op: 'like', args: [{ property: prop }, `%${kw}%`] })
        params.filter = { op: 'or', args: [like('title'), like('description'), like('file:name')] }
        params['filter-lang'] = 'cql2-json'
      }
      const res = await searchApi.search(params)
      setScopeItems(res.data?.features || [])
    } catch (err) {
      console.error('검색 실패:', err)
      setScopeItems([])
    } finally {
      setLoading(false)
    }
  }, [filters.kw, mockMode])

  // ── facet 카운트 (status/cat: 프로젝트 범위 기준 · project: 전체 범위 기준) ──
  const inBounds = useCallback((item) => {
    if (!mapBounds) return true
    const pos = getItemMapPosition(item)
    if (!pos) return false
    const [lon, lat] = pos.position
    return lon >= mapBounds.minLon && lon <= mapBounds.maxLon && lat >= mapBounds.minLat && lat <= mapBounds.maxLat
  }, [mapBounds])

  const byProject = useMemo(() => (
    filters.project === 'all' ? scopeItems : scopeItems.filter(i => i.collection === filters.project)
  ), [scopeItems, filters.project])

  const facet = useMemo(() => {
    const status = {}, cat = {}, project = {}
    byProject.forEach(i => {
      const s = getItemStatus(i); status[s] = (status[s] || 0) + 1
      const c = i.properties?.data_category || 'unknown'; cat[c] = (cat[c] || 0) + 1
    })
    scopeItems.forEach(i => { const col = i.collection || 'unassigned-inbox'; project[col] = (project[col] || 0) + 1 })
    const dates = byProject.map(i => i.properties?.datetime).filter(Boolean).map(d => String(d).slice(0, 7)).sort()
    return { status, cat, project, totalAll: scopeItems.length, timeMin: dates[0], timeMax: dates[dates.length - 1] }
  }, [byProject, scopeItems])

  // ── 클라이언트 필터 (상태·카테고리). 지도범위(bbox)는 별도 memo 로 분리 —
  //    bboxOnly 가 꺼져 있을 땐 mapBounds 변동이 결과 배열 식별자를 흔들지 않게 해 카메라-필터 루프를 막는다.
  const baseFiltered = useMemo(() => {
    let r = byProject
    if (filters.status.length) r = r.filter(i => filters.status.includes(getItemStatus(i)))
    if (filters.cat.length) r = r.filter(i => filters.cat.includes(i.properties?.data_category))
    return r
  }, [byProject, filters.status, filters.cat])

  const filteredItems = useMemo(() => (
    filters.bboxOnly ? baseFiltered.filter(inBounds) : baseFiltered
  ), [baseFiltered, filters.bboxOnly, inBounds])

  const visibleIds = useMemo(() => new Set(filteredItems.map(i => i.id)), [filteredItems])
  const itemById = useMemo(() => {
    const m = new Map()
    scopeItems.forEach(i => m.set(i.id, i))
    if (selectedItem) m.set(selectedItem.id, selectedItem)
    return m
  }, [scopeItems, selectedItem])

  // 정렬된 결과 view (목록용)
  const sortedViews = useMemo(() => (
    filteredItems.map(i => getExplorerItemView(i, collections)).sort(EXPLORER_SORTS[sort] || EXPLORER_SORTS.recent)
  ), [filteredItems, collections, sort])

  const relationRecords = useMemo(() => (mockMode ? mockRelations : []), [mockMode])
  const relationOverlayModel = useMemo(() => getSelectedRelationOverlay({
    selectedItem, visibleItems: filteredItems, relationRecords,
  }), [selectedItem, filteredItems, relationRecords])

  const selectedView = useMemo(() => (selectedItem ? getExplorerItemView(selectedItem, collections) : null), [selectedItem, collections])
  const outOfResult = Boolean(selectedItem) && !visibleIds.has(selectedItem.id)

  // ── selection / navigation ──
  const selectById = useCallback((id) => {
    const item = itemById.get(id)
    if (item) setSelectedItem(item)
  }, [itemById])
  const goViewer = useCallback((item) => {
    if (item?.collection && item?.id) navigate({ pathname: `/viewer/${item.collection}/${item.id}`, search: location.search })
  }, [navigate, location.search])
  const goDetail = useCallback((item) => {
    if (item?.collection && item?.id) navigate({ pathname: `/detail/${item.collection}/${item.id}`, search: location.search })
  }, [navigate, location.search])
  const goCompletion = useCallback((item) => {
    if (item?.collection && item?.id) navigate({ pathname: `/complete/${item.collection}/${item.id}`, search: location.search }, { state: { from: 'explorer' } })
  }, [navigate, location.search])
  const goProject = useCallback((item) => {
    if (!item?.collection) return
    const search = new URLSearchParams(location.search)
    search.set('col', item.collection)   // Project 페이지가 ?col= 로 해당 프로젝트를 선택한다
    navigate({ pathname: '/project', search: search.toString() })
  }, [navigate, location.search])

  // ── divider drag (stack=세로 / split=가로) ──
  const bodyRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const dragTeardownRef = useRef(null)
  const startDrag = useCallback((e) => {
    e.preventDefault()
    setDragging(true)
    const rect = bodyRef.current.getBoundingClientRect()
    const move = (ev) => {
      const r = arrange === 'split' ? (ev.clientX - rect.left) / rect.width : (ev.clientY - rect.top) / rect.height
      setRatio(Math.max(0.25, Math.min(0.82, r)))
    }
    const cleanup = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
    function up() { setDragging(false); cleanup(); dragTeardownRef.current = null }
    dragTeardownRef.current = cleanup
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }, [arrange])
  // 드래그 중 언마운트되면 window 리스너가 새도록 두지 않는다
  useEffect(() => () => { dragTeardownRef.current?.() }, [])

  const scopeLabel = filters.project === 'all'
    ? '전체 프로젝트'
    : (filters.project === 'unassigned-inbox' ? 'Unassigned Inbox' : (collections.find(c => c.id === filters.project)?.title || filters.project))
  const mapFlex = { flex: '0 0 ' + (ratio * 100) + '%' }

  return (
    <div className="exp">
      <FilterSidebar filters={filters} setF={setFilters} facet={facet} collections={collections} />

      <div className="center">
        <div className="center-head">
          <span className="ch-scope">
            {loading ? '불러오는 중…' : <><b>{filteredItems.length.toLocaleString()}</b> · {scopeLabel}</>}
          </span>
          <span className="ch-sub">지도·목록·Context Panel 동기화</span>
          {mockMode && <span className="ch-sub" style={{ color: 'var(--draft)', marginLeft: 0 }}>· Mock Demo</span>}
          <div className="ch-r">
            <div className="seg" title="중앙 배치">
              <button className={arrange === 'stack' ? 'on' : ''} onClick={() => setArrange('stack')}><span className="ic">▤</span> 상하</button>
              <button className={arrange === 'split' ? 'on' : ''} onClick={() => setArrange('split')}><span className="ic">▥</span> 좌우</button>
            </div>
            <div className="seg" title="지도 렌더">
              <button className={mode === '2d' ? 'on' : ''} onClick={() => setMode('2d')}>2D</button>
              <button className={mode === '3d' ? 'on' : ''} onClick={() => setMode('3d')}>3D</button>
            </div>
            <div className={'toggle' + (showRel ? ' on' : '')} onClick={() => setShowRel(v => !v)} title="선택 Item의 관계를 지도에 표시">
              <span className="sw" /> 관계
            </div>
          </div>
        </div>

        <div className={'center-body ' + arrange} ref={bodyRef}>
          <div className="pane-map" style={mapFlex}>
            {mode === '2d' ? (
              <MapView
                items={filteredItems}
                selectedId={selectedItem?.id}
                hoveredId={hoveredId}
                onSelectItem={setSelectedItem}
                relationOverlayEnabled={showRel}
                relationOverlayModel={relationOverlayModel}
                onBoundsChange={setMapBounds}
                fitToItems={!filters.bboxOnly}
                loading={loading}
              />
            ) : (
              <Explorer3dGisBeta
                items={filteredItems}
                collections={collections}
                selectedId={selectedItem?.id}
                onSelectItem={setSelectedItem}
                relationOverlayEnabled={showRel}
                relationOverlayModel={relationOverlayModel}
                relationRecords={relationRecords}
                mockMode={mockMode}
              />
            )}
          </div>
          <div className={'divider ' + (arrange === 'split' ? 'v' : 'h') + (dragging ? ' drag' : '')} onMouseDown={startDrag} />
          <div className="pane-list">
            <ResultList
              items={sortedViews}
              selectedId={selectedItem?.id}
              onSelect={selectById}
              onHover={setHoveredId}
              total={filteredItems.length}
              sort={sort}
              setSort={setSort}
              loading={loading}
            />
          </div>
        </div>
      </div>

      <div className="ctx-col">
        <ContextPanel
          view={loading ? null : selectedView}
          outOfResult={outOfResult}
          relationModel={relationOverlayModel}
          resolveName={(id) => { const it = itemById.get(id); return it ? getDisplayLabel(it) : null }}
          onClear={() => setSelectedItem(null)}
          onSelectRelated={selectById}
          onOpenDetail={() => goDetail(selectedItem)}
          onOpenViewer={() => goViewer(selectedItem)}
          onOpenCompletion={() => goCompletion(selectedItem)}
          onOpenProject={() => goProject(selectedItem)}
        />
      </div>
    </div>
  )
}
