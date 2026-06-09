/**
 * ResultList — Explorer 중앙 항상-표시 결과 목록 (지도와 stack/split 배치).
 * 핸드오프 Explorer.html / panels.jsx 의 ResultList 를 실제 결과(view 배열)에 연결.
 */
import CategoryGlyph from '../viewer/CategoryGlyph'
import { StatusBadge } from './Badges'
import { getCategoryInfo, formatSize } from '../../constants'

const SORT_LABELS = { recent: '최신순', name: '이름순', status: '상태순', size: '용량순' }

function Header({ total, shown, sort, setSort }) {
  const showShown = typeof total === 'number' && shown != null && shown !== total
  return (
    <div className="rl-head">
      <span className="rl-count">
        <b>{typeof total === 'number' ? total.toLocaleString() : total}</b> results
        {showShown && <span className="rl-shown"> · {shown.toLocaleString()} 표시</span>}
      </span>
      <div className="rl-sort">
        <span className="rl-sortl">정렬</span>
        <select value={sort} onChange={e => setSort(e.target.value)}>
          {Object.entries(SORT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
    </div>
  )
}

export default function ResultList({ items = [], selectedId, onSelect, onHover, total, sort, setSort, loading = false }) {
  if (loading) {
    return (
      <div className="rl">
        <Header total="…" sort={sort} setSort={setSort} />
        <div className="rl-body">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rl-skel"><span className="sk-g" /><span className="sk-l" /><span className="sk-s" /></div>
          ))}
        </div>
      </div>
    )
  }

  if (!items.length) {
    return (
      <div className="rl">
        <Header total={0} sort={sort} setSort={setSort} />
        <div className="rl-empty">
          <span className="oc-glyph">⊘</span>
          <b>결과 없음</b>
          <small>필터를 완화하거나 키워드를 지워보세요</small>
        </div>
      </div>
    )
  }

  const totalCount = typeof total === 'number' ? total : items.length
  return (
    <div className="rl">
      <Header total={totalCount} shown={items.length} sort={sort} setSort={setSort} />
      <div className="rl-body">
        {items.map(it => (
          <div
            key={it.id}
            className={'rl-row' + (it.id === selectedId ? ' sel' : '')}
            onClick={() => onSelect(it.id)}
            onMouseEnter={() => onHover?.(it.id)}
            onMouseLeave={() => onHover?.(null)}
          >
            <span className="rl-g" title={getCategoryInfo(it.cat).label}><CategoryGlyph cat={it.cat} s={16} /></span>
            <span className="rl-main">
              <span className="rl-name">{it.name}</span>
              <span className="rl-sub">
                <span className="rl-file">{it.file}</span>
                <span className="rl-meta">
                  {(it.isUnassigned ? 'Unassigned' : it.projectName)}{it.dt ? ' · ' + it.dt : ''}{it.size != null ? ' · ' + formatSize(it.size) : ''}
                </span>
              </span>
            </span>
            <span className="rl-right">
              <StatusBadge status={it.status} sm />
              <span className={'rl-pv pv-' + it.preview} title={'preview ' + it.preview} />
            </span>
          </div>
        ))}
        {totalCount > items.length && (
          <div className="rl-more">⋯ 외 {(totalCount - items.length).toLocaleString()}건 더 · 필터를 좁혀 보세요</div>
        )}
      </div>
    </div>
  )
}
