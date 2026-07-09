/**
 * ProjectItemTabs — Draft(보완 대상) · 전체 Item · Timeline·Lineage 탭.
 * `design-reference/project/Project.html` 의 DraftTab/ItemsTab/LineageTab 포팅 — 실 Item 데이터.
 * Draft 의 "보완하기" 는 MetadataCompletion(/complete) 으로, 행 클릭은 Detail 로 연결한다.
 */
import CategoryGlyph from '../viewer/CategoryGlyph'
import { getCategoryInfo, formatSize } from '../../constants'
import { PREVIEW_META } from '../../features/explorer/explorerMeta'
import { Badge } from './StatusBadge'

function PvDot({ p }) {
  const v = PREVIEW_META[p] || PREVIEW_META.missing
  return <span className="pvdot" style={{ background: v.color }} title={'preview ' + v.label} />
}

export function DraftTab({ views, onComplete, onOpen }) {
  const drafts = views.filter(v => v.status === 'draft')
  if (!drafts.length) {
    return <div className="panel proj-empty">Draft 없음 — 모든 산출물이 보완 완료되었습니다</div>
  }
  return (
    <div>
      <div className="panel-h" style={{ padding: '0 2px' }}>
        <h3 style={{ fontSize: 14 }}>Draft · 보완 대상</h3>
        <span className="hint">{drafts.length}건 · 각 항목 → Metadata Completion</span>
      </div>
      {drafts.map(v => (
        <div className="irow" key={v.id}>
          <span className="ig"><CategoryGlyph cat={v.cat} s={16} /></span>
          <div className="im" onClick={() => onOpen(v)} style={{ cursor: 'pointer' }}>
            <div className="inm">{v.name}</div>
            <div className="isub">{v.file}</div>
            {(v.miss.length > 0 || v.gaps.length > 0) && (
              <div className="gapchips">
                {v.miss.map(m => <span key={m} className="gapchip">{m}</span>)}
                {v.gaps.map((g, i) => <span key={'g' + i} className="gapchip">{g}</span>)}
              </div>
            )}
          </div>
          <div className="irow-r">
            <PvDot p={v.preview} />
            <Badge status={v.status} />
            <button type="button" className="complete-btn" onClick={() => onComplete(v)}>보완하기 →</button>
          </div>
        </div>
      ))}
    </div>
  )
}

export function ItemsTab({
  views,
  onOpen,
  selectedIds = new Set(),
  onToggleSelect,
  onClearSelection,
  onMergeSelected,
  mergeBusy = false,
}) {
  if (!views.length) return <div className="panel proj-empty">등록된 Item 이 없습니다</div>
  const selectedCount = selectedIds.size
  const mergeableCount = views.filter(v => v.cat === 'image' && v.status !== 'archived').length
  return (
    <div>
      <div className="panel-h item-toolbar" style={{ padding: '0 2px' }}>
        <div>
          <h3 style={{ fontSize: 14 }}>전체 Item</h3>
          <span className="hint">
            {views.length}건 · 이미지 병합 가능 {mergeableCount}건 · 행 클릭 → Detail
          </span>
        </div>
        <div className="item-actions">
          {selectedCount > 0 && <span className="sel-count">{selectedCount}건 선택</span>}
          {selectedCount > 0 && (
            <button type="button" className="ghost-btn" onClick={onClearSelection} disabled={mergeBusy}>
              선택 해제
            </button>
          )}
          <button
            type="button"
            className="complete-btn"
            onClick={onMergeSelected}
            disabled={mergeBusy || selectedCount < 2}
            title="선택한 원본 이미지 Item을 하나의 이미지 셋으로 묶고 원본 Item은 Archived로 보존"
          >
            {mergeBusy ? '병합 중…' : '이미지 셋 병합'}
          </button>
        </div>
      </div>
      {views.map(v => (
        <div className="irow click" key={v.id} onClick={() => onOpen(v)}>
          <label
            className={'isel' + (selectedIds.has(v.id) ? ' on' : '')}
            title={v.cat === 'image' && v.status !== 'archived' ? '병합 대상으로 선택' : '원본 이미지 Draft/Published Item만 병합 가능'}
            onClick={e => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={selectedIds.has(v.id)}
              disabled={v.cat !== 'image' || v.status === 'archived' || mergeBusy}
              onChange={() => onToggleSelect?.(v)}
            />
          </label>
          <span className="ig"><CategoryGlyph cat={v.cat} s={16} /></span>
          <div className="im">
            <div className="inm">{v.name}</div>
            <div className="isub">{getCategoryInfo(v.cat).label}{v.dt ? ` · ${v.dt}` : ''}{v.size != null ? ` · ${formatSize(v.size)}` : ''}</div>
          </div>
          <div className="irow-r"><PvDot p={v.preview} /><Badge status={v.status} /></div>
        </div>
      ))}
    </div>
  )
}

// ── Lineage: Item links → 계보/시계열 엣지 ──
const LINEAGE_RELS = new Set(['derived_from', 'has_derived', 'describedby', 'describes', 'related'])
const TIMELINE_RELS = new Set(['prev', 'next'])

// href 에서 대상 collection/item 추출 — "./id" 또는 ".../collections/{cid}/items/{iid}"
function parseTarget(href, fallbackCol) {
  const parts = String(href || '').replace(/\/+$/, '').split('/').filter(Boolean)
  const itemId = parts.length ? parts[parts.length - 1] : null
  const itemsIdx = parts.indexOf('items')
  const collectionId = itemsIdx > 0 ? parts[itemsIdx - 1] : fallbackCol
  return { itemId, collectionId }
}

export function buildLineage(items, views, collectionId) {
  const viewById = new Map(views.map(v => [v.id, v]))
  const edges = []
  const timeline = []
  items.forEach(item => {
    const from = viewById.get(item.id)
    if (!from) return
    const declaredMissing = new Set(item.properties?.['mock:missingRelationTargets'] || [])
    ;(item.links || []).forEach(l => {
      if (!LINEAGE_RELS.has(l.rel) && !TIMELINE_RELS.has(l.rel)) return
      const t = parseTarget(l.href, collectionId)
      const target = t.itemId ? viewById.get(t.itemId) : null
      // 같은 collection 을 가리키는데 결과에 없으면(또는 명시적 누락 표시) 깨진 참조로 경고
      const missing = !target && (t.collectionId === collectionId || declaredMissing.has(t.itemId))
      const edge = {
        from, rel: l.rel, targetId: t.itemId, target: target || null,
        title: l.title || t.itemId, inProject: Boolean(target), missing,
      }
      if (TIMELINE_RELS.has(l.rel)) timeline.push(edge)
      else edges.push(edge)
    })
  })
  return { edges, timeline }
}

function LinNode({ view, fallback, missing }) {
  if (!view) {
    return (
      <span className="lin-node" style={{ color: missing ? 'var(--orange)' : 'var(--t2)' }}>
        {missing ? '⚠ ' : ''}{fallback || '(외부 Item)'}
      </span>
    )
  }
  return <span className="lin-node"><CategoryGlyph cat={view.cat} s={14} /><span className="ln-nm">{view.name}</span></span>
}

export function LineageTab({ items, views, collectionId }) {
  const { edges, timeline } = buildLineage(items, views, collectionId)
  return (
    <div>
      <div className="panel">
        <div className="lin-h">가공 계보 · derived / describes / related</div>
        {edges.length === 0
          ? <div style={{ color: 'var(--t3)', fontSize: 12 }}>계보 관계 없음</div>
          : edges.map((e, i) => (
            <div className="lin-edge" key={i}>
              <LinNode view={e.from} />
              <span className="lin-rel">{e.rel}</span>
              <span className="lin-arrow">→</span>
              <LinNode view={e.target} fallback={e.title} missing={e.missing} />
              {!e.inProject && !e.missing && <span className="lin-out">프로젝트 밖</span>}
            </div>
          ))}
      </div>
      <div className="panel">
        <div className="lin-h">시계열 · prev / next</div>
        {timeline.length === 0
          ? <div style={{ color: 'var(--t3)', fontSize: 12 }}>시계열 관계 없음</div>
          : timeline.map((e, i) => (
            <div className="lin-edge" key={i}>
              <LinNode view={e.from} />
              <span className="lin-rel">{e.rel}</span>
              <span className="lin-arrow">→</span>
              <LinNode view={e.target} fallback={e.title} missing={e.missing} />
              {!e.inProject && !e.missing && <span className="lin-out">프로젝트 밖</span>}
            </div>
          ))}
      </div>
    </div>
  )
}
