/**
 * Explorer — 데이터 탐색/검색 메인 페이지
 *
 * 구성: 검색 사이드바 | 2D 지도 + 결과 목록 | 미리보기 패널(슬라이드)
 * 검색: STAC /search POST (키워드, 유형 필터, Collection 필터)
 *
 * 참조: docs/system_structure_design.md 페이지 1
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { searchApi, collectionApi } from '../services/api'
import SearchSidebar from '../components/SearchSidebar'
import MapView from '../components/MapView'
import PreviewPanel from '../components/PreviewPanel'

export default function Explorer() {
  // 검색 상태
  const [keyword, setKeyword] = useState('')
  const [categoryFilter, setCategoryFilter] = useState(new Set())
  const [collections, setCollections] = useState([])
  const [selectedCollection, setSelectedCollection] = useState(null)

  // 결과 상태
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)

  // UI 상태
  const [hoveredId, setHoveredId] = useState(null)
  const [selectedItem, setSelectedItem] = useState(null)

  // 사이드바 리사이즈
  const [sidebarWidth, setSidebarWidth] = useState(380)
  // 프리뷰 패널 리사이즈
  const [previewWidth, setPreviewWidth] = useState(540)
  // 리사이즈 대상: null | 'sidebar' | 'preview'
  const resizingTarget = useRef(null)

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!resizingTarget.current) return
      if (resizingTarget.current === 'sidebar') {
        setSidebarWidth(Math.min(600, Math.max(280, e.clientX)))
      } else if (resizingTarget.current === 'preview') {
        setPreviewWidth(Math.min(800, Math.max(320, window.innerWidth - e.clientX)))
      }
    }
    const handleMouseUp = () => { resizingTarget.current = null; document.body.style.cursor = '' }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  // Collection 목록 로드
  useEffect(() => {
    collectionApi.list()
      .then(res => {
        const cols = res.data?.collections || []
        setCollections(cols)
      })
      .catch(() => setCollections([]))
  }, [])

  // 검색 실행 (debounced)
  useEffect(() => {
    const timer = setTimeout(() => doSearch(), 300)
    return () => clearTimeout(timer)
  }, [keyword, categoryFilter, selectedCollection])

  const doSearch = useCallback(async () => {
    setLoading(true)
    try {
      const params = { limit: 200 }

      // Collection 필터
      if (selectedCollection) {
        params.collections = [selectedCollection]
      }

      // 키워드 → q 파라미터 (stac-fastapi의 free-text search)
      if (keyword.trim()) {
        params.q = keyword.trim()
      }

      // 유형 필터 → CQL2
      if (categoryFilter.size > 0) {
        const cats = [...categoryFilter]
        if (cats.length === 1) {
          params.filter = { op: 'eq', args: [{ property: 'data_category' }, cats[0]] }
          params['filter-lang'] = 'cql2-json'
        } else {
          params.filter = {
            op: 'or',
            args: cats.map(c => ({ op: 'eq', args: [{ property: 'data_category' }, c] })),
          }
          params['filter-lang'] = 'cql2-json'
        }
      }

      const res = await searchApi.search(params)
      const features = res.data?.features || []
      setItems(features)
    } catch (err) {
      console.error('검색 실패:', err)
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [keyword, categoryFilter, selectedCollection])

  const toggleCategory = (cat) => {
    setCategoryFilter(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  const handleSelectItem = (item) => {
    setSelectedItem(prev => prev?.id === item.id ? null : item)
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* 사이드바 (검색 + 결과 목록 통합) */}
      <SearchSidebar
        keyword={keyword}
        onKeywordChange={setKeyword}
        categoryFilter={categoryFilter}
        onToggleCategory={toggleCategory}
        collections={collections}
        selectedCollection={selectedCollection}
        onSelectCollection={setSelectedCollection}
        resultCount={items.length}
        items={items}
        selectedId={selectedItem?.id}
        onHover={setHoveredId}
        onSelect={handleSelectItem}
        width={sidebarWidth}
      />

      {/* 사이드바 리사이즈 핸들 */}
      <ResizeHandle onMouseDown={() => { resizingTarget.current = 'sidebar'; document.body.style.cursor = 'col-resize' }} active={resizingTarget.current === 'sidebar'} />

      {/* 메인 영역: 지도 전체 */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <MapView
          items={items}
          hoveredId={hoveredId}
          selectedId={selectedItem?.id}
          onSelectItem={handleSelectItem}
        />
        {loading && (
          <div style={{
            position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
            padding: '4px 12px', background: 'var(--s1)', borderRadius: 4,
            fontSize: 13, color: 'var(--t2)', border: '1px solid var(--bd)',
          }}>
            검색 중...
          </div>
        )}
      </div>

      {/* 미리보기 패널 */}
      {selectedItem && (
        <>
          <ResizeHandle onMouseDown={() => { resizingTarget.current = 'preview'; document.body.style.cursor = 'col-resize' }} active={resizingTarget.current === 'preview'} />
          <PreviewPanel
            item={selectedItem}
            onClose={() => setSelectedItem(null)}
            width={previewWidth}
          />
        </>
      )}
    </div>
  )
}

function ResizeHandle({ onMouseDown }) {
  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        width: 4, cursor: 'col-resize', flexShrink: 0,
        background: 'var(--bd)', transition: 'background 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--ac)'}
      onMouseLeave={e => e.currentTarget.style.background = 'var(--bd)'}
    />
  )
}
