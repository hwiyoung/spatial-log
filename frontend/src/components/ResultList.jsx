/**
 * 검색 결과 목록 — Item 목록 표시, hover/click 연동
 */
import { getCategoryInfo, formatSize } from '../constants'

export default function ResultList({ items, selectedId, onHover, onSelect }) {
  return (
    <div style={{
      flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column',
      borderTop: '1px solid var(--bd)',
    }}>
      <div style={{
        padding: '8px 14px', fontSize: 13, color: 'var(--t2)',
        borderBottom: '1px solid var(--bd)', flexShrink: 0,
      }}>
        검색 결과 ({items.length})
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {items.map(item => {
          const props = item.properties || {}
          const cat = getCategoryInfo(props.data_category)
          const isSelected = item.id === selectedId
          return (
            <div
              key={item.id}
              onMouseEnter={() => onHover(item.id)}
              onMouseLeave={() => onHover(null)}
              onClick={() => onSelect(item)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 14px', cursor: 'pointer',
                background: isSelected ? 'rgba(74,114,255,0.06)' : 'transparent',
                borderBottom: '1px solid var(--bd)',
              }}
            >
              {/* 아이콘 */}
              <div style={{
                width: 30, height: 30, borderRadius: 6,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, flexShrink: 0,
                background: cat.color + '12', color: cat.color,
              }}>
                {cat.icon}
              </div>

              {/* 정보 */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 14, fontWeight: 500, color: 'var(--t1)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {props.description || item.id}
                </div>
                <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 1 }}>
                  {props.datetime?.slice(0, 10) || '날짜 없음'}
                  {props['file:size'] ? ` · ${formatSize(props['file:size'])}` : ''}
                  {props.target ? ` · ${props.target}` : ''}
                </div>
              </div>

              {/* 유형 뱃지 */}
              <span style={{
                padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600,
                flexShrink: 0, background: cat.color + '12', color: cat.color,
              }}>
                {cat.label}
              </span>
            </div>
          )
        })}
        {items.length === 0 && (
          <div style={{ padding: 30, textAlign: 'center', color: 'var(--t3)', fontSize: 14 }}>
            검색 결과 없음
          </div>
        )}
      </div>
    </div>
  )
}
