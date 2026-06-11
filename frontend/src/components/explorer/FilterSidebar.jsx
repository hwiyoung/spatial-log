/**
 * FilterSidebar — Explorer 좌측 필터 컬럼 (키워드 · 상태 · 카테고리 · 프로젝트 · 시간 · 공간).
 * 핸드오프 Explorer.html / panels.jsx 의 FilterSidebar 를 실제 필터 상태에 연결한 것.
 */
import CategoryGlyph from '../viewer/CategoryGlyph'
import { getCategoryInfo } from '../../constants'
import { STATUS_META, STATUS_ORDER, CAT_ORDER } from '../../features/explorer/explorerMeta'

export default function FilterSidebar({ filters, setF, facet, collections = [], onStartDraw, drawActive = false }) {
  const toggle = (key, val) => {
    const set = new Set(filters[key])
    set.has(val) ? set.delete(val) : set.add(val)
    setF({ ...filters, [key]: [...set] })
  }
  const projects = [{ id: 'all', title: '전체 프로젝트' }, ...collections]

  return (
    <aside className="sidebar">
      <div className="side-sec">
        <div className="side-h">Search</div>
        <div className="kw">
          <span className="kw-i">⌕</span>
          <input
            value={filters.kw}
            onChange={e => setF({ ...filters, kw: e.target.value })}
            placeholder="이름 · 파일명 · 프로젝트 · 키워드"
          />
          {filters.kw && <button className="kw-x" onClick={() => setF({ ...filters, kw: '' })} aria-label="키워드 지우기">×</button>}
        </div>
      </div>

      <div className="side-sec">
        <div className="side-h">Status</div>
        <div className="chk-list">
          {STATUS_ORDER.map(s => {
            const meta = STATUS_META[s]
            const on = filters.status.includes(s)
            return (
              <label key={s} className={'chk' + (on ? ' on' : '')} onClick={() => toggle('status', s)}>
                <span className="chk-box" style={{ borderColor: meta.color }}>{on && <i style={{ background: meta.color }} />}</span>
                <span className="chk-dot" style={{ background: meta.color, borderStyle: meta.dashed ? 'dashed' : 'solid' }} />
                <span className="chk-l">{meta.label}</span>
                <span className="chk-n">{facet.status[s] || 0}</span>
              </label>
            )
          })}
        </div>
      </div>

      <div className="side-sec">
        <div className="side-h">Category <span className="side-hint">형태로 구분</span></div>
        <div className="cat-list">
          {CAT_ORDER.map(c => {
            const on = filters.cat.includes(c)
            return (
              <label key={c} className={'catrow' + (on ? ' on' : '')} onClick={() => toggle('cat', c)}>
                <span className="catrow-g"><CategoryGlyph cat={c} s={15} /></span>
                <span className="catrow-l">{getCategoryInfo(c).label}</span>
                <span className="catrow-n">{facet.cat[c] || 0}</span>
              </label>
            )
          })}
        </div>
      </div>

      <div className="side-sec">
        <div className="side-h">Project</div>
        <div className="proj-list">
          {projects.map(p => {
            const on = filters.project === p.id
            const label = p.id === 'unassigned-inbox' ? 'Unassigned Inbox' : (p.title || p.id)
            const count = p.id === 'all' ? facet.totalAll : (facet.project[p.id] || 0)
            return (
              <label key={p.id} className={'projrow' + (on ? ' on' : '')} onClick={() => setF({ ...filters, project: p.id })}>
                <span className="radio">{on && <i />}</span>
                <span className="projrow-l" title={label}>{label}</span>
                <span className="catrow-n">{count}</span>
              </label>
            )
          })}
        </div>
      </div>

      <div className="side-sec">
        <div className="side-h">Time <span className="side-hint">취득일 · 서버 검색</span></div>
        <div className="time-row">
          <input
            className="time-i" type="month" value={filters.timeFrom}
            max={filters.timeTo || undefined} title={'결과 범위: ' + (facet.timeMin || '—')}
            onChange={e => setF({ ...filters, timeFrom: e.target.value })}
          />
          <span className="time-sep">→</span>
          <input
            className="time-i" type="month" value={filters.timeTo}
            min={filters.timeFrom || undefined} title={'결과 범위: ' + (facet.timeMax || '—')}
            onChange={e => setF({ ...filters, timeTo: e.target.value })}
          />
        </div>
        {(filters.timeFrom || filters.timeTo) && (
          <button className="time-clear" onClick={() => setF({ ...filters, timeFrom: '', timeTo: '' })}>× 시간 필터 지우기</button>
        )}
      </div>

      <div className="side-sec">
        <div className="side-h">Spatial</div>
        <label className={'spat-tog' + (filters.bboxOnly ? ' on' : '')} onClick={() => setF({ ...filters, bboxOnly: !filters.bboxOnly })}>
          <span className="chk-box">{filters.bboxOnly && <i />}</span> 현재 지도 범위 안만
        </label>
        {filters.drawnBbox ? (
          <div className="spat-chip">
            ▢ 영역 적용됨
            <span className="mono">{filters.drawnBbox.map(v => v.toFixed(3)).join(', ')}</span>
            <button onClick={() => setF({ ...filters, drawnBbox: null })} title="영역 필터 해제" aria-label="영역 필터 해제">×</button>
          </div>
        ) : (
          <button
            className={'spat-draw' + (drawActive ? ' active' : '')}
            onClick={onStartDraw}
            title="지도에서 드래그로 영역을 그리면 그 안의 결과만 검색합니다"
          >
            {drawActive ? '지도에서 드래그… (Esc 취소)' : '▢ 영역 그리기'}
          </button>
        )}
      </div>

      <div className="side-foot">지도 · 목록 · Context Panel 이 동일한 결과를 공유합니다</div>
    </aside>
  )
}
