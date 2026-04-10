/**
 * 검색 사이드바 — 키워드, 유형 필터, 프로젝트 필터
 */
import { CATEGORIES } from '../constants'

export default function SearchSidebar({
  keyword, onKeywordChange,
  categoryFilter, onToggleCategory,
  collections, selectedCollection, onSelectCollection,
  resultCount,
}) {
  return (
    <div style={{
      width: 320, minWidth: 320, background: 'var(--s1)',
      borderRight: '1px solid var(--bd)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* 키워드 검색 */}
      <div style={{ padding: '12px 14px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 10px', background: 'var(--s2)',
          border: '1px solid var(--bd)', borderRadius: 6,
        }}>
          <span style={{ fontSize: 14, color: 'var(--t3)' }}>🔍</span>
          <input
            value={keyword}
            onChange={e => onKeywordChange(e.target.value)}
            placeholder="사이트, 대상, 키워드..."
            style={{
              flex: 1, border: 'none', outline: 'none',
              background: 'transparent', color: 'var(--t1)', fontSize: 14,
            }}
          />
        </div>
      </div>

      {/* 유형 필터 */}
      <div style={{ padding: '0 14px 12px' }}>
        <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 6, fontWeight: 600 }}>데이터 유형</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {Object.entries(CATEGORIES).filter(([k]) => k !== 'unknown').map(([key, cat]) => {
            const active = categoryFilter.has(key)
            return (
              <span
                key={key}
                onClick={() => onToggleCategory(key)}
                style={{
                  padding: '2px 8px', borderRadius: 4, fontSize: 12, cursor: 'pointer',
                  border: `1px solid ${active ? cat.color + '40' : 'var(--bd)'}`,
                  background: active ? cat.color + '12' : 'transparent',
                  color: active ? cat.color : 'var(--t3)',
                }}
              >
                <span style={{ fontSize: 12 }}>{cat.icon}</span> {cat.label}
              </span>
            )
          })}
        </div>
      </div>

      {/* 프로젝트 필터 */}
      <div style={{ padding: '0 14px', flex: 1, overflow: 'auto' }}>
        <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 6, fontWeight: 600 }}>프로젝트</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div
            onClick={() => onSelectCollection(null)}
            style={{
              padding: '4px 8px', borderRadius: 4, fontSize: 12, cursor: 'pointer',
              color: !selectedCollection ? 'var(--ac)' : 'var(--t3)',
              background: !selectedCollection ? 'rgba(74,114,255,0.06)' : 'transparent',
            }}
          >
            전체
          </div>
          {collections.map(col => (
            <div
              key={col.id}
              onClick={() => onSelectCollection(selectedCollection === col.id ? null : col.id)}
              style={{
                padding: '4px 8px', borderRadius: 4, fontSize: 12, cursor: 'pointer',
                color: selectedCollection === col.id ? 'var(--ac)' : 'var(--t3)',
                background: selectedCollection === col.id ? 'rgba(74,114,255,0.06)' : 'transparent',
              }}
            >
              {col.title || col.id}
            </div>
          ))}
        </div>
      </div>

      {/* 결과 수 */}
      <div style={{
        padding: '8px 14px', fontSize: 12, color: 'var(--t2)',
        borderTop: '1px solid var(--bd)',
      }}>
        검색 결과: <b style={{ color: 'var(--ac)' }}>{resultCount}</b>건
      </div>
    </div>
  )
}
