/**
 * MetadataSection / SpatialSection — 전체 메타데이터(provenance 구분) + Spatial(미니맵 + 필드).
 * `design-reference/project/Detail.html` 의 .dsec(metadata) / .dsec(spatial) 포팅.
 *
 * 편집 모드에서는 편집 가능한 필드가 input/select 로 바뀐다(기존 Detail 편집 기능 유지).
 * 위치(center/bbox)는 LocationPicker(📍 위치) 로 편집하므로 여기서는 읽기 전용.
 */
import CategoryGlyph from '../viewer/CategoryGlyph'
import SpatialMiniMap from './SpatialMiniMap'
import { CATEGORIES } from '../../constants'
import { STATUS_META, tint } from '../../features/explorer/explorerMeta'

// 메타 행 key → 실제 편집 대상 STAC property key
const EDIT_FIELD = {
  display_name: 'description',
  title: 'title',
  'project:name': 'project:name',
  'project:site': 'project:site',
  target: 'target',
  datetime: 'datetime',
  data_category: 'data_category',
  status: 'sams:status',
  'proj:epsg': 'proj:epsg',
  gsd: 'gsd',
}
const STATUS_OPTIONS = ['draft', 'published', 'archived']

function ProvBadge({ prov }) {
  return <span className={'prov ' + prov}>{prov === 'auto' ? 'AUTO' : prov === 'manual' ? '수동' : '미입력'}</span>
}

function StatusBadgeInline({ status }) {
  const v = STATUS_META[status] || STATUS_META.unknown
  return (
    <span className="badge" style={{ color: v.color, borderColor: tint(v.color, 40), background: tint(v.color, 8), borderStyle: v.dashed ? 'dashed' : 'solid' }}>
      {v.label}
    </span>
  )
}

function rawValue(item, propKey, editDraft) {
  if (editDraft[propKey] !== undefined) return editDraft[propKey]
  const raw = item?.properties?.[propKey]
  if (raw == null) return ''
  return typeof raw === 'object' ? JSON.stringify(raw) : String(raw)
}

function EditField({ propKey, item, editDraft, onEditChange, placeholder }) {
  const value = rawValue(item, propKey, editDraft)
  const set = (v) => onEditChange(propKey, v)

  if (propKey === 'sams:status') {
    return (
      <select className="rr-sel" value={value || 'draft'} onChange={e => set(e.target.value)}>
        {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
      </select>
    )
  }
  if (propKey === 'data_category') {
    return (
      <select className="rr-sel" value={value || 'unknown'} onChange={e => set(e.target.value)}>
        {Object.keys(CATEGORIES).map(c => <option key={c} value={c}>{CATEGORIES[c].label}</option>)}
      </select>
    )
  }
  return (
    <input
      className="mv-input" value={value} placeholder={placeholder || '입력하세요'}
      onChange={e => set(e.target.value)}
    />
  )
}

function MetaRow({ row, item, editMode, editDraft, onEditChange }) {
  const propKey = EDIT_FIELD[row.k]
  const editable = editMode && !!propKey
  return (
    <div className="mrow">
      <span className="mk">{row.glyph && <CategoryGlyph cat={row.glyph} s={14} />}{row.label}</span>
      {editable ? (
        <EditField propKey={propKey} item={item} editDraft={editDraft} onEditChange={onEditChange} placeholder={row.value} />
      ) : (
        <span className={'mv' + (row.mono ? ' mono' : '') + (row.prov === 'needed' ? ' needed' : '')}>
          {row.status ? <StatusBadgeInline status={row.status} /> : row.value}
        </span>
      )}
      <ProvBadge prov={row.prov} />
    </div>
  )
}

export function MetadataSection({ meta, item, editMode, editDraft, onEditChange }) {
  const groups = meta.order.filter(g => g !== 'Spatial')
  return (
    <section className="dsec">
      <div className="dsec-h"><h2>전체 Metadata</h2><span className="dsec-sub">자동 추출 ↔ 수동 입력 provenance 구분</span></div>
      <div className="meta-legend">
        <span className="ml"><span className="prov auto">자동추출</span> {meta.counts.auto}</span>
        <span className="ml"><span className="prov manual">수동입력</span> {meta.counts.manual}</span>
        <span className="ml"><span className="prov needed">미입력</span> {meta.counts.needed}</span>
      </div>
      {groups.map(g => (
        <div className="meta-group" key={g}>
          <div className="meta-gh">{g}</div>
          <div className="meta-grid">
            {meta.groups[g].map(row => (
              <MetaRow key={row.k} row={row} item={item} editMode={editMode} editDraft={editDraft} onEditChange={onEditChange} />
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}

export function SpatialSection({ meta, item, view, onEditLocation }) {
  const spatialRows = meta.groups.Spatial || []
  return (
    <section className="dsec">
      <div className="dsec-h">
        <h2>Spatial</h2>
        <span className="dsec-sub">위치 · 범위 — point / bbox / footprint</span>
        {onEditLocation && <button type="button" className="btn-add" onClick={onEditLocation}>📍 위치 지정</button>}
      </div>
      <div className="spatial-body">
        <div className="spatial-map"><SpatialMiniMap item={item} view={view} /></div>
        <div className="spatial-fields">
          {spatialRows.map(row => (
            <div className="mrow" key={row.k}>
              <span className="mk">{row.label}</span>
              <span className={'mv' + (row.mono ? ' mono' : '') + (row.prov === 'needed' ? ' needed' : '')}>{row.value}</span>
              <ProvBadge prov={row.prov} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
