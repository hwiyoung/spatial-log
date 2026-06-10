/**
 * ProjectList — Project 좌측 사이드바: Active/Archived/Unassigned 그룹 + 완성도 미니바.
 * `design-reference/project/Project.html` 의 .plist 포팅 — 행 통계는 liteStats(사전 로드)로 표시.
 */

function ProjectRow({ col, lite, active, onSelect }) {
  const inbox = col.id === 'unassigned-inbox'
  const hasExp = lite?.expTotal > 0
  return (
    <div className={'prow' + (active ? ' on' : '') + (inbox ? ' inbox' : '')} onClick={() => onSelect(col.id)}>
      <div className="prow-t">{inbox && <span className="ibx">◇</span>}{col.title || col.id}</div>
      <div className="prow-meta">
        <span className="prow-asset">{lite ? `${lite.assets} assets` : '—'}</span>
        {lite?.draft > 0 && <span className="prow-draft">Draft {lite.draft}</span>}
        {!inbox && hasExp && <span className="prow-comp">{lite.assets}/{lite.expTotal}</span>}
      </div>
      {!inbox && hasExp && (
        <div className="pl-mini"><i style={{ width: Math.min(100, Math.round((lite.assets / lite.expTotal) * 100)) + '%' }} /></div>
      )}
    </div>
  )
}

export default function ProjectList({ collections, liteStats, selectedId, onSelect, onCreate }) {
  const inbox = collections.filter(c => c.id === 'unassigned-inbox')
  const rest = collections.filter(c => c.id !== 'unassigned-inbox')
  const statusOf = (c) => c?.summaries?.['sams:status'] || c?.properties?.status || 'active'
  const archived = rest.filter(c => ['archived', 'completed'].includes(statusOf(c)))
  const activeCols = rest.filter(c => !['archived', 'completed'].includes(statusOf(c)))

  return (
    <div className="plist">
      <div className="plist-scroll">
        <div className="pl-group">Active <span className="n">{activeCols.length}</span></div>
        {activeCols.map(c => (
          <ProjectRow key={c.id} col={c} lite={liteStats[c.id]} active={selectedId === c.id} onSelect={onSelect} />
        ))}
        {activeCols.length === 0 && <div className="pl-empty">진행 중인 프로젝트 없음</div>}

        <div className="pl-group">Archived <span className="n">{archived.length}</span></div>
        {archived.map(c => (
          <ProjectRow key={c.id} col={c} lite={liteStats[c.id]} active={selectedId === c.id} onSelect={onSelect} />
        ))}
        {archived.length === 0 && <div className="pl-empty">보관된 프로젝트 없음</div>}

        {inbox.length > 0 && (
          <>
            <div className="pl-group">Unassigned</div>
            {inbox.map(c => (
              <ProjectRow key={c.id} col={c} lite={liteStats[c.id]} active={selectedId === c.id} onSelect={onSelect} />
            ))}
          </>
        )}
      </div>
      <div className="pl-new">
        <button type="button" onClick={onCreate}>＋ 새 프로젝트</button>
      </div>
    </div>
  )
}
