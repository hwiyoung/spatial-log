/* SAMS Explorer — left filters, always-on result list, context panel */
(function () {

function StatusBadge({ status, sm }) {
  const v = window.SAMS.STATUS[status];
  return <span className={'sbadge' + (sm ? ' sm' : '')} style={{ color: v.color, borderColor: v.color + '66', background: v.color + '14', borderStyle: v.dashed ? 'dashed' : 'solid' }}>{v.label}</span>;
}
function PreviewDot({ p }) {
  const v = window.SAMS.PREVIEW[p];
  return <span className="pvdot" title={'preview ' + v.label}><i style={{ background: v.color }} />{v.label}</span>;
}

/* ---------------- Left filter sidebar ---------------- */
function FilterSidebar({ filters, setF, facet }) {
  const S = window.SAMS;
  const tog = (key, val) => {
    const set = new Set(filters[key]);
    set.has(val) ? set.delete(val) : set.add(val);
    setF({ ...filters, [key]: [...set] });
  };
  const STATUSES = ['draft', 'published', 'archived', 'unknown'];
  return (
    <aside className="sidebar">
      <div className="side-sec">
        <div className="side-h">Search</div>
        <div className="kw"><span className="kw-i">⌕</span>
          <input value={filters.kw} onChange={e => setF({ ...filters, kw: e.target.value })} placeholder="이름 · 파일명 · 프로젝트 · 키워드" />
          {filters.kw && <button className="kw-x" onClick={() => setF({ ...filters, kw: '' })}>×</button>}
        </div>
      </div>

      <div className="side-sec">
        <div className="side-h">Status</div>
        <div className="chk-list">
          {STATUSES.map(s => (
            <label key={s} className={'chk' + (filters.status.includes(s) ? ' on' : '')} onClick={() => tog('status', s)}>
              <span className="chk-box" style={{ borderColor: S.STATUS[s].color }}>{filters.status.includes(s) && <i style={{ background: S.STATUS[s].color }} />}</span>
              <span className="chk-dot" style={{ background: S.STATUS[s].color, borderStyle: S.STATUS[s].dashed ? 'dashed' : 'solid' }} />
              <span className="chk-l">{S.STATUS[s].label}</span>
              <span className="chk-n">{facet.status[s] || 0}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="side-sec">
        <div className="side-h">Category <span className="side-hint">형태로 구분</span></div>
        <div className="cat-list">
          {S.CAT_ORDER.map(c => (
            <label key={c} className={'catrow' + (filters.cat.includes(c) ? ' on' : '')} onClick={() => tog('cat', c)}>
              <span className="catrow-g"><CategoryGlyph cat={c} s={15} /></span>
              <span className="catrow-l">{S.CAT[c].ko}</span>
              <span className="catrow-n">{facet.cat[c] || 0}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="side-sec">
        <div className="side-h">Project</div>
        <div className="proj-list">
          {[{ id: 'all', title: '전체 프로젝트' }, ...S.COLLECTIONS].map(p => (
            <label key={p.id} className={'projrow' + (filters.project === p.id ? ' on' : '')} onClick={() => setF({ ...filters, project: p.id })}>
              <span className="radio">{filters.project === p.id && <i />}</span>
              <span className="projrow-l">{p.id === 'unassigned-inbox' ? 'Unassigned Inbox' : p.title}</span>
              <span className="catrow-n">{p.id === 'all' ? facet.totalAll : (facet.project[p.id] || 0)}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="side-sec">
        <div className="side-h">Time</div>
        <div className="time-row">
          <div className="time-i">2024-02</div><span className="time-sep">→</span><div className="time-i">2024-05</div>
        </div>
        <div className="time-track"><span className="time-fill" /></div>
      </div>

      <div className="side-sec">
        <div className="side-h">Spatial</div>
        <label className={'spat-tog' + (filters.bboxOnly ? ' on' : '')} onClick={() => setF({ ...filters, bboxOnly: !filters.bboxOnly })}>
          <span className="chk-box">{filters.bboxOnly && <i />}</span> 현재 지도 범위 안만
        </label>
        <button className="spat-draw">▢ 영역 그리기</button>
      </div>

      <div className="side-foot">visibleItems · 지도 · 목록 · Context Panel 동기화</div>
    </aside>
  );
}

/* ---------------- Result list (always visible) ---------------- */
function ResultList({ items, selectedId, onSelect, total, sort, setSort, large, loading, layout }) {
  const S = window.SAMS;
  const sorts = { recent: '최신순', name: '이름순', status: '상태순', size: '용량순' };
  if (loading) {
    return <div className="rl">{<RLHeader total={'…'} sort={sort} setSort={setSort} sorts={sorts} layout={layout} />}
      <div className="rl-body">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="rl-skel"><span className="sk-g" /><span className="sk-l" /><span className="sk-s" /></div>)}</div></div>;
  }
  if (!items.length) {
    return <div className="rl"><RLHeader total={0} sort={sort} setSort={setSort} sorts={sorts} layout={layout} />
      <div className="rl-empty"><span className="oc-glyph">⊘</span><b>결과 없음</b><small>필터를 완화하거나 키워드를 지워보세요</small></div></div>;
  }
  return (
    <div className="rl">
      <RLHeader total={total} sort={sort} setSort={setSort} sorts={sorts} layout={layout} shown={items.length} large={large} />
      <div className="rl-body">
        {items.map(it => {
          const sel = it.id === selectedId;
          return (
            <div key={it.id} className={'rl-row' + (sel ? ' sel' : '')} onClick={() => onSelect(it.id)}>
              <span className="rl-g" title={S.CAT[it.cat].ko}><CategoryGlyph cat={it.cat} s={16} /></span>
              <span className="rl-main">
                <span className="rl-name">{it.name}</span>
                <span className="rl-sub">
                  <span className="rl-file">{it.file}</span>
                  <span className="rl-meta">{S.COL_SHORT[it.col]} · {it.dt} · {S.formatSize(it.size)}</span>
                </span>
              </span>
              <span className="rl-right">
                <StatusBadge status={it.status} sm />
                <span className={'rl-pv pv-' + it.preview} title={'preview ' + it.preview} />
              </span>
            </div>
          );
        })}
        {large && <div className="rl-more">⋯ 외 {(total - items.length).toLocaleString()}건 더 · 스크롤하여 로드</div>}
      </div>
    </div>
  );
}
function RLHeader({ total, shown, sort, setSort, sorts, layout, large }) {
  return (
    <div className="rl-head">
      <span className="rl-count"><b>{typeof total === 'number' ? total.toLocaleString() : total}</b> results
        {large && <span className="rl-shown"> · {shown} 표시</span>}</span>
      <div className="rl-sort">
        <span className="rl-sortl">정렬</span>
        <select value={sort} onChange={e => setSort(e.target.value)}>
          {Object.entries(sorts).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
    </div>
  );
}

/* ---------------- Context Panel ---------------- */
function ContextPanel({ item, visibleIds, onSelect, onClear, outOfResult }) {
  const S = window.SAMS;
  if (!item) {
    return (
      <div className="ctx empty">
        <div className="ctx-empty">
          <span className="oc-glyph">◍</span>
          <b>Item을 선택하세요</b>
          <small>지도 marker 또는 목록 행을 클릭하면<br />Preview · 상태 · 누락 · 공간 근거 · 관계를 즉시 판단합니다</small>
        </div>
      </div>
    );
  }
  const col = S.collectionById(item.col);
  const rs = S.relationSummary(item);
  const pv = S.PREVIEW[item.preview];
  const spatialLabel = S.SPATIAL_LABEL[item.src];
  return (
    <div className="ctx">
      <div className="ctx-head">
        <span className="ctx-cat"><CategoryGlyph cat={item.cat} s={15} /> {S.CAT[item.cat].ko}</span>
        {outOfResult && <span className="ctx-out" title="선택 Item이 현재 필터 결과에 포함되지 않음">○ 현재 결과 밖</span>}
        <button className="ctx-x" onClick={onClear}>×</button>
      </div>

      {/* preview hero */}
      <div className={'ctx-hero pv-bg-' + item.preview}>
        <div className="hero-thumb">
          {item.preview === 'available' ? <span className="hero-ok"><CategoryGlyph cat={item.cat} s={30} /></span>
            : <span className="hero-ph">{item.preview === 'pending' ? '⟳' : item.preview === 'failed' ? '⚠' : '▢'}</span>}
        </div>
        <div className="hero-meta">
          <span className="hero-pvl" style={{ color: pv.color }}>preview · {pv.label}</span>
          {item.previewFail && <span className="hero-fail">{item.previewFail}</span>}
          {item.preview === 'pending' && <span className="hero-note">변환/검수 대기 중</span>}
          {item.preview === 'missing' && <span className="hero-note">preview 미생성 — 변환 필요</span>}
        </div>
      </div>

      <div className="ctx-scroll">
        {/* identity */}
        <Section title="Identity">
          <div className="kv"><b className="kv-title">{item.name}</b></div>
          <div className="kv"><span className="kvk">file</span><span className="kvv mono">{item.file}</span></div>
          <div className="kv"><span className="kvk">id</span><span className="kvv mono dim">{item.id}</span></div>
          <div className="kv"><span className="kvk">size</span><span className="kvv">{S.formatSize(item.size)}</span></div>
        </Section>

        {/* project / status */}
        <Section title="Project / Status">
          <div className="kv"><span className="kvk">project</span><span className="kvv">{item.col === 'unassigned-inbox' ? <span className="unassigned">Unassigned Inbox</span> : col.title}</span></div>
          <div className="kv"><span className="kvk">site</span><span className="kvv">{col.site}</span></div>
          <div className="kv"><span className="kvk">status</span><span className="kvv"><StatusBadge status={item.status} /></span></div>
          <div className="kv"><span className="kvk">date</span><span className="kvv">{item.dt}</span></div>
        </Section>

        {/* metadata gap */}
        {(item.draftReason || (item.miss && item.miss.length) || (item.gaps && item.gaps.length)) ? (
          <Section title="Metadata quality" warn>
            {item.draftReason && <div className="draft-reason"><span className="dr-badge">Draft</span> {item.draftReason}</div>}
            {item.miss && item.miss.length > 0 && <>
              <div className="gap-l">필수 누락 {item.miss.length}</div>
              <div className="gap-chips">{item.miss.map(m => <span key={m} className="gap-chip">{m}</span>)}</div>
            </>}
            {item.gaps && item.gaps.length > 0 && <div className="gap-notes">{item.gaps.map((g, i) => <div key={i}>· {g}</div>)}</div>}
          </Section>
        ) : (
          <Section title="Metadata quality"><div className="ok-line">✓ 필수 메타데이터 충족</div></Section>
        )}

        {/* spatial */}
        <Section title="Spatial">
          <div className="kv"><span className="kvk">source</span><span className="kvv"><span className={'spat-src s-' + item.src}>{spatialLabel}</span></span></div>
          {item.lon != null && <div className="kv"><span className="kvk">center</span><span className="kvv mono">{item.lon.toFixed(4)}, {item.lat.toFixed(4)}</span></div>}
          {item.bbox && <div className="kv"><span className="kvk">extent</span><span className="kvv mono dim">bbox · footprint</span></div>}
          {item.elev != null && <div className="kv"><span className="kvk">elev</span><span className="kvv">{item.elev} m</span></div>}
          {item.src === 'fallback' && <div className="spat-fb">⚑ 직접 좌표 없음 — 프로젝트 위치로 fallback</div>}
        </Section>

        {/* relations */}
        <Section title="Relation" hint="1-depth">
          {rs.total === 0 ? <div className="rel-none">연결된 관계 없음</div> : <>
            <div className="rel-chips">
              {Object.entries(rs.counts).map(([rel, n]) => <span key={rel} className="rel-chip">{rel} <b>{n}</b></span>)}
            </div>
            <div className="rel-records">
              {rs.records.map((r, i) => {
                const tgt = S.BY_ID[r.target];
                const inResult = tgt && visibleIds.has(tgt.id);
                const warn = r.missing || !tgt || !inResult;
                return (
                  <div key={i} className={'rel-rec' + (warn ? ' warn' : '')} onClick={() => { if (tgt && inResult) onSelect(tgt.id); }}>
                    <span className="rr-rel">{r.rel}</span>
                    <span className="rr-t">{r.title}</span>
                    {r.missing ? <span className="rr-w">관계 대상 없음</span> : !inResult ? <span className="rr-w">결과 밖</span> : <span className="rr-go">→</span>}
                  </div>
                );
              })}
            </div>
            {rs.missingCount > 0 && <div className="rel-warn">⚠ 결과 밖/누락 관계 {rs.missing.length}건 — 지도 overlay에 warning 표시</div>}
          </>}
        </Section>
      </div>

      {/* action footer */}
      <div className="ctx-foot">
        <button className="af primary">Detail 열기</button>
        <div className="af-row">
          <button className="af">Viewer</button>
          <button className="af">{item.status === 'draft' ? '보완하기' : 'Metadata'}</button>
          <button className="af">Project 연결</button>
        </div>
      </div>
    </div>
  );
}
function Section({ title, hint, warn, children }) {
  return (
    <div className={'sec' + (warn ? ' warn' : '')}>
      <div className="sec-h">{title}{hint && <span className="sec-hint">{hint}</span>}</div>
      <div className="sec-b">{children}</div>
    </div>
  );
}

Object.assign(window, { FilterSidebar, ResultList, ContextPanel, StatusBadge });
})();
