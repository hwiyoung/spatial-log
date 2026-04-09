/**
 * Explorer — 데이터 탐색/검색 메인 페이지
 *
 * 구성: 검색 사이드바 | 2D 지도 + 결과 목록 | 미리보기 패널(슬라이드)
 * 검색: STAC /search POST (키워드, 유형 필터, Collection 필터)
 *
 * 참조: docs/system_structure_design.md 페이지 1
 */
import { useState, useEffect, useCallback } from 'react'
import { searchApi, collectionApi } from '../services/api'
import SearchSidebar from '../components/SearchSidebar'
import MapView from '../components/MapView'
import ResultList from '../components/ResultList'
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
      {/* 사이드바 */}
      <SearchSidebar
        keyword={keyword}
        onKeywordChange={setKeyword}
        categoryFilter={categoryFilter}
        onToggleCategory={toggleCategory}
        collections={collections}
        selectedCollection={selectedCollection}
        onSelectCollection={setSelectedCollection}
        resultCount={items.length}
      />

      {/* 메인 영역: 지도 + 결과 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* 지도 */}
        <div style={{ flex: 1, minHeight: 200, position: 'relative' }}>
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

        {/* 결과 목록 */}
        <ResultList
          items={items}
          selectedId={selectedItem?.id}
          onHover={setHoveredId}
          onSelect={handleSelectItem}
        />
      </div>

      {/* 미리보기 패널 */}
      {selectedItem && (
        <PreviewPanel
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  )
}
