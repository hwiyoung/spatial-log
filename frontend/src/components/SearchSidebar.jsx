/**
 * 검색 사이드바 — 키워드, 유형 필터, 프로젝트 필터, 검색 결과 목록
 */
import {
  CATEGORIES,
  getCategoryInfo,
  formatSize,
  getPreviewStatusInfo,
} from '../constants'
import DraftBadge from './DraftBadge'
import ProjectBadge from './ProjectBadge'
import StatusBadge from './StatusBadge'
import { getDisplayLabel, getOriginalFilename } from '../features/items/getDisplayLabel.js'
import { getItemStatus } from '../features/items/getItemStatus.js'
import { getProjectContext } from '../features/items/getProjectContext.js'
import { getItemVisibilityFlags } from '../features/items/getItemVisibilityFlags.js'

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
  { value: 'unknown', label: 'Unknown' },
]

export default function SearchSidebar({
  keyword, onKeywordChange,
  categoryFilter, onToggleCategory,
  collections, selectedCollection, onSelectCollection,
  statusFilter = 'all', onStatusFilterChange,
  resultCount,
  items, selectedId, onHover, onSelect,
  width = 380,
  mockMode = false,
}) {
  const statusCounts = getStatusCounts(items)
  const projectCounts = getProjectCounts(items)

  return (
    <div style={{
      width, minWidth: 280, background: 'var(--s1)',
      borderRight: '1px solid var(--bd)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* 키워드 검색 */}
      <div style={{ padding: '12px 14px' }}>
        {mockMode && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            marginBottom: 8, padding: '2px 8px', borderRadius: 4,
            fontSize: 12, fontWeight: 700, color: '#D7B84A',
            background: 'rgba(215,184,74,0.10)', border: '1px solid rgba(215,184,74,0.28)',
          }}>
            Mock Demo Mode
          </div>
        )}
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

      {/* 상태 필터: mock demo 검증용. 실제 API 필터 계약 확정 전에는 mock mode에서만 노출 */}
      {mockMode && onStatusFilterChange && (
        <div style={{ padding: '0 14px 10px' }}>
          <div style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 6, fontWeight: 600 }}>상태</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            {STATUS_FILTERS.map(filter => {
              const active = statusFilter === filter.value
              const count = filter.value === 'all' ? items?.length || 0 : statusCounts[filter.value] || 0
              return (
                <span
                  key={filter.value}
                  onClick={() => onStatusFilterChange(filter.value)}
                  style={{
                    padding: '2px 8px', borderRadius: 4, fontSize: 12, cursor: 'pointer',
                    color: active ? 'var(--ac)' : 'var(--t3)',
                    background: active ? 'rgba(74,114,255,0.06)' : 'transparent',
                    border: `1px solid ${active ? 'rgba(74,114,255,0.2)' : 'var(--bd)'}`,
                  }}
                >
                  {filter.label} {count}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* 유형 필터 */}
      <div style={{ padding: '0 14px 12px' }}>
        <div style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 6, fontWeight: 600 }}>데이터 유형</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {Object.entries(CATEGORIES).filter(([k]) => k !== 'unknown').map(([key, cat]) => {
            const active = categoryFilter.has(key)
            return (
              <span
                key={key}
                onClick={() => onToggleCategory(key)}
                style={{
                  padding: '2px 8px', borderRadius: 4, fontSize: 13, cursor: 'pointer',
                  border: `1px solid ${active ? cat.color + '40' : 'var(--bd)'}`,
                  background: active ? cat.color + '12' : 'transparent',
                  color: active ? cat.color : 'var(--t3)',
                }}
              >
                <span style={{ fontSize: 13 }}>{cat.icon}</span> {cat.label}
              </span>
            )
          })}
        </div>
      </div>

      {/* 프로젝트 필터 */}
      <div style={{ padding: '0 14px 8px' }}>
        <div style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 6, fontWeight: 600 }}>프로젝트</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          <span
            onClick={() => onSelectCollection(null)}
            style={{
              padding: '2px 8px', borderRadius: 4, fontSize: 12, cursor: 'pointer',
              color: !selectedCollection ? 'var(--ac)' : 'var(--t3)',
              background: !selectedCollection ? 'rgba(74,114,255,0.06)' : 'transparent',
              border: `1px solid ${!selectedCollection ? 'rgba(74,114,255,0.2)' : 'var(--bd)'}`,
            }}
          >
            All {items?.length || 0}
          </span>
          {collections.map(col => {
            const isUnassigned = col.id === 'unassigned-inbox'
            return (
              <span
                key={col.id}
                onClick={() => onSelectCollection(selectedCollection === col.id ? null : col.id)}
                style={{
                  padding: '2px 8px', borderRadius: 4, fontSize: 12, cursor: 'pointer',
                  color: selectedCollection === col.id ? 'var(--ac)' : 'var(--t3)',
                  background: selectedCollection === col.id ? 'rgba(74,114,255,0.06)' : 'transparent',
                  border: `1px solid ${selectedCollection === col.id ? 'rgba(74,114,255,0.2)' : 'var(--bd)'}`,
                }}
              >
                {isUnassigned ? 'Unassigned Inbox' : col.title || col.id} {projectCounts[col.id] || 0}
              </span>
            )
          })}
        </div>
      </div>

      {/* 결과 수 + 구분선 */}
      <div style={{
        padding: '6px 14px', fontSize: 13, color: 'var(--t2)',
        borderTop: '1px solid var(--bd)', borderBottom: '1px solid var(--bd)',
        flexShrink: 0,
      }}>
        검색 결과: <b style={{ color: 'var(--ac)' }}>{resultCount}</b>건
      </div>

      {/* 검색 결과 목록 */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {items && items.map(item => {
          const props = item.properties || {}
          const cat = getCategoryInfo(props.data_category)
          const status = getItemStatus(item)
          const previewInfo = getPreviewStatusInfo(props.previewStatus)
          const project = getProjectContext(item, collections)
          const flags = getItemVisibilityFlags(item, collections)
          const originalFilename = getOriginalFilename(item)
          const isSelected = item.id === selectedId
          return (
            <div
              key={item.id}
              onMouseEnter={() => onHover?.(item.id)}
              onMouseLeave={() => onHover?.(null)}
              onClick={() => onSelect?.(item)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 14px', cursor: 'pointer',
                background: isSelected ? 'rgba(74,114,255,0.06)' : 'transparent',
                borderBottom: '1px solid var(--bd)',
              }}
            >
              {/* 썸네일 or 아이콘 */}
              {item.assets?.thumbnail?.href ? (
                <img
                  src={item.assets.thumbnail.href}
                  alt=""
                  style={{
                    width: 40, height: 30, borderRadius: 3,
                    objectFit: 'cover', flexShrink: 0, background: 'var(--s2)',
                  }}
                  onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
                />
              ) : null}
              <div style={{
                width: item.assets?.thumbnail?.href ? 0 : 30, height: 30, borderRadius: 3,
                display: item.assets?.thumbnail?.href ? 'none' : 'flex',
                alignItems: 'center', justifyContent: 'center',
                fontSize: 14, flexShrink: 0,
                background: cat.color + '12', color: cat.color,
              }}>
                {cat.icon}
              </div>

              {/* 정보 */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13, fontWeight: 500, color: 'var(--t1)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {getDisplayLabel(item)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--t3)' }}>
                  {originalFilename || props.datetime?.slice(0, 10) || item.id}
                  {props['file:size'] ? ` · ${formatSize(props['file:size'])}` : ''}
                  {project.projectSite ? ` · ${project.projectSite}` : ''}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                  <ProjectBadge projectName={project.projectName} isUnassigned={project.isUnassigned} compact />
                  {flags.isDraft ? <DraftBadge compact /> : <StatusBadge status={status} compact />}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                {/* 유형 뱃지 */}
                <span style={{
                  padding: '1px 6px', borderRadius: 3, fontSize: 10, fontWeight: 600,
                  background: cat.color + '12', color: cat.color,
                }}>
                  {cat.label}
                </span>
                {mockMode && (
                  <span
                    title={previewInfo.label}
                    style={{
                      padding: '1px 6px', borderRadius: 3, fontSize: 10, fontWeight: 600,
                      background: 'var(--s2)', color: previewInfo.color,
                    }}
                  >
                    {previewInfo.label.replace('Preview ', '')}
                  </span>
                )}
              </div>
            </div>
          )
        })}
        {(!items || items.length === 0) && (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>
            검색 결과 없음
          </div>
        )}
      </div>
    </div>
  )
}

function getStatusCounts(items = []) {
  return items.reduce((counts, item) => {
    const status = getItemStatus(item)
    counts[status] = (counts[status] || 0) + 1
    return counts
  }, {})
}

function getProjectCounts(items = []) {
  return items.reduce((counts, item) => {
    const collectionId = item.collection || item.collection_id || 'unassigned'
    counts[collectionId] = (counts[collectionId] || 0) + 1
    return counts
  }, {})
}
