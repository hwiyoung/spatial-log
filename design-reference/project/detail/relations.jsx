/* SAMS Detail — Relation graph + authoring (add/edit/delete + picker) + Timeline authoring */
(function () {
  const { useState, useMemo, useRef } = React;
  const S = window.SAMS;
  let _uid = 1; const uid = () => 'r' + (_uid++);
  const REL_TYPES = ['derived_from', 'related', 'describedby', 'describes'];
  const REL_KO = { derived_from: '원본에서 파생', related: '관련/동시취득', describedby: '설명 문서', describes: '설명 대상', prev: '이전 시점', next: '다음 시점' };

  function StatusDot({ s, size = 9 }) {
    const v = S.STATUS[s] || S.STATUS.unknown;
    return <i className="sdot" style={{ width: size, height: size, background: v.color, borderColor: v.color, borderStyle: v.dashed ? 'dashed' : 'solid' }} />;
  }
  function targetItem(t) { return S.BY_ID[t] || null; }

  /* ---------------- Relation Graph ---------------- */
  function RelationGraph({ item, rels, incoming, onFocus }) {
    const W = 560, H = 332, cx = W / 2, cy = H / 2, rx = 176, ry = 108;
    const nodes = [];
    rels.forEach(r => nodes.push({ dir: 'out', rel: r.rel, id: r.target, item: targetItem(r.target), missing: r.missing || !targetItem(r.target), title: r.title }));
    incoming.forEach(r => nodes.push({ dir: 'in', rel: r.rel, id: r.sourceId, item: r.sourceItem, missing: false, title: r.sourceItem.name, role: r.role }));
    const n = nodes.length;
    const placed = nodes.map((nd, i) => {
      const ang = (-90 + (360 / Math.max(n, 1)) * i) * Math.PI / 180;
      return { ...nd, x: cx + Math.cos(ang) * rx, y: cy + Math.sin(ang) * ry, ang };
    });

    return (
      <div className="rgraph">
        <svg width={W} height={H} viewBox={'0 0 ' + W + ' ' + H} className="rgraph-svg">
          <defs>
            <marker id="rgArrow" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M1,1 L8,4.5 L1,8" fill="none" stroke="#5C6573" strokeWidth="1.5" /></marker>
            <marker id="rgArrowW" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M1,1 L8,4.5 L1,8" fill="none" stroke="#F97316" strokeWidth="1.5" /></marker>
          </defs>
          {placed.map((nd, i) => {
            const x1 = nd.dir === 'out' ? cx : nd.x, y1 = nd.dir === 'out' ? cy : nd.y;
            const x2 = nd.dir === 'out' ? nd.x : cx, y2 = nd.dir === 'out' ? nd.y : cy;
            return <g key={i}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} className={'rg-edge' + (nd.missing ? ' warn' : '')} markerEnd={nd.missing ? 'url(#rgArrowW)' : 'url(#rgArrow)'} />
              {/* 2nd-degree depth hint */}
              {nd.item && (nd.item.rel || []).filter(rr => rr.target !== item.id).slice(0, 3).map((rr, k) => {
                const a2 = nd.ang + (k - 1) * 0.32;
                return <circle key={k} cx={nd.x + Math.cos(a2) * 30} cy={nd.y + Math.sin(a2) * 22} r="3" className="rg-d2" />;
              })}
            </g>;
          })}
        </svg>

        {/* center node */}
        <div className="rg-node center" style={{ left: cx, top: cy, borderColor: S.STATUS[item.status].color }}>
          <span className="rg-g"><CategoryGlyph cat={item.cat} s={17} /></span>
          <span className="rg-nm">{item.name}</span>
          <StatusDot s={item.status} />
        </div>

        {/* neighbor nodes */}
        {placed.map((nd, i) => (
          <div key={i} className={'rg-node' + (nd.missing ? ' missing' : '') + (nd.item ? ' clickable' : '')}
            style={{ left: nd.x, top: nd.y, borderColor: nd.item ? S.STATUS[nd.item.status].color : '#5C6573' }}
            onClick={() => nd.item && onFocus(nd.id)}>
            <span className="rg-rel">{nd.dir === 'in' ? '← ' : '→ '}{nd.rel}</span>
            {nd.missing ? <span className="rg-miss">⚠ 대상 없음</span> : <>
              <span className="rg-row"><span className="rg-g"><CategoryGlyph cat={nd.item.cat} s={15} /></span><StatusDot s={nd.item.status} size={8} /></span>
              <span className="rg-nm">{nd.item.name}</span>
            </>}
          </div>
        ))}

        <div className="rg-legend">중심 = 현재 Item · → outgoing · ← incoming · 작은 점 = 2-depth</div>
      </div>
    );
  }

  /* ---------------- Target Picker ---------------- */
  function RelationPicker({ title, mode, fixedRel, excludeIds, onPick, onClose }) {
    const [q, setQ] = useState('');
    const [sel, setSel] = useState(null);
    const [rel, setRel] = useState(fixedRel || 'derived_from');
    const list = useMemo(() => {
      const qq = q.trim().toLowerCase();
      return S.ITEMS.filter(it => !excludeIds.includes(it.id) && (!qq || (it.name + ' ' + it.file + ' ' + S.collectionById(it.col).title).toLowerCase().includes(qq)));
    }, [q, excludeIds]);
    return (
      <div className="pick-overlay" onMouseDown={onClose}>
        <div className="pick" onMouseDown={e => e.stopPropagation()}>
          <div className="pick-head"><b>{title}</b><button className="pick-x" onClick={onClose}>×</button></div>
          <div className="pick-search"><span>⌕</span><input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="대상 Item 검색 · 이름 · 파일명 · 프로젝트" /></div>
          <div className="pick-list">
            {list.map(it => (
              <div key={it.id} className={'pick-row' + (sel === it.id ? ' on' : '')} onClick={() => setSel(it.id)}>
                <span className="pick-g"><CategoryGlyph cat={it.cat} s={16} /></span>
                <span className="pick-main"><span className="pick-nm">{it.name}</span><span className="pick-sub">{S.COL_SHORT[it.col]} · {it.file}</span></span>
                <StatusDot s={it.status} />
                {sel === it.id && <span className="pick-check">✓</span>}
              </div>
            ))}
            {!list.length && <div className="pick-empty">검색 결과 없음</div>}
          </div>
          {mode === 'relation' && (
            <div className="pick-rel">
              <span className="pick-rell">관계 유형</span>
              <div className="pick-reltypes">
                {REL_TYPES.map(rt => (
                  <button key={rt} className={'pick-relbtn' + (rel === rt ? ' on' : '')} onClick={() => setRel(rt)}>
                    <b>{rt}</b><span>{REL_KO[rt]}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="pick-foot">
            <button className="pick-cancel" onClick={onClose}>취소</button>
            <button className="pick-add" disabled={!sel} onClick={() => sel && onPick({ target: sel, rel: mode === 'timeline' ? fixedRel : rel, title: S.BY_ID[sel].name })}>
              {mode === 'timeline' ? (fixedRel === 'prev' ? '이전 시점으로 연결' : '다음 시점으로 연결') : '관계 추가'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ---------------- Relations Section ---------------- */
  function RelationsSection({ item, rels, setRels, incoming, onFocus }) {
    const [picker, setPicker] = useState(false);
    const counts = {}; rels.forEach(r => counts[r.rel] = (counts[r.rel] || 0) + 1);
    const excludeIds = [item.id, ...rels.map(r => r.target)];
    const empty = rels.length === 0 && incoming.length === 0;

    const addRel = ({ target, rel, title }) => { setRels([...rels, { id: uid(), rel, target, title, missing: false }]); setPicker(false); };
    const delRel = (id) => setRels(rels.filter(r => r.id !== id));
    const chgRel = (id, rel) => setRels(rels.map(r => r.id === id ? { ...r, rel } : r));

    return (
      <section className="dsec">
        <div className="dsec-h">
          <h2>Relations</h2>
          <span className="dsec-sub">관계 authoring — 이 화면에서만 생성·수정</span>
          <div className="rel-counts">{Object.entries(counts).map(([r, n]) => <span key={r} className="rcount">{r} <b>{n}</b></span>)}</div>
          <button className="btn-add" onClick={() => setPicker(true)}>＋ 관계 추가</button>
        </div>

        {empty ? (
          <div className="rel-empty">
            <span className="oc-glyph">⬡</span>
            <b>아직 연결된 관계가 없습니다</b>
            <small>원본·가공본, 설명 문서, 관련 자산을 연결해 데이터 계보를 만드세요</small>
            <button className="btn-add lg" onClick={() => setPicker(true)}>＋ 첫 관계 추가</button>
          </div>
        ) : (
          <div className="rel-body">
            <div className="rel-graph-wrap"><RelationGraph item={item} rels={rels} incoming={incoming} onFocus={onFocus} /></div>
            <div className="rel-auth">
              <div className="rel-grp-h">이 Item의 관계 <span>outgoing · 편집 가능</span></div>
              {rels.length === 0 && <div className="rel-mini-empty">outgoing 관계 없음 — ＋ 관계 추가</div>}
              {rels.map(r => {
                const tgt = targetItem(r.target);
                return (
                  <div key={r.id} className={'rel-row' + (!tgt ? ' warn' : '')}>
                    {tgt ? <>
                      <span className="rr-g" onClick={() => onFocus(r.target)}><CategoryGlyph cat={tgt.cat} s={15} /></span>
                      <span className="rr-main" onClick={() => onFocus(r.target)}>
                        <span className="rr-nm">{tgt.name}</span>
                        <span className="rr-sub">{S.COL_SHORT[tgt.col]} · {S.STATUS[tgt.status].label}</span>
                      </span>
                    </> : <>
                      <span className="rr-g warn">⚠</span>
                      <span className="rr-main"><span className="rr-nm strike">{r.title}</span><span className="rr-sub warn">대상 삭제됨 / 존재하지 않음</span></span>
                    </>}
                    <select className="rr-sel" value={r.rel} onChange={e => chgRel(r.id, e.target.value)}>
                      {REL_TYPES.map(rt => <option key={rt} value={rt}>{rt}</option>)}
                    </select>
                    <button className="rr-del" onClick={() => delRel(r.id)} title="관계 삭제">×</button>
                  </div>
                );
              })}

              <div className="rel-grp-h mt">이 Item을 참조 <span>incoming · 상대 Item에서 관리</span></div>
              {incoming.length === 0 && <div className="rel-mini-empty">incoming 관계 없음</div>}
              {incoming.map((r, i) => (
                <div key={i} className="rel-row ro" onClick={() => onFocus(r.sourceId)}>
                  <span className="rr-g"><CategoryGlyph cat={r.sourceItem.cat} s={15} /></span>
                  <span className="rr-main"><span className="rr-nm">{r.sourceItem.name}</span><span className="rr-sub">{r.rel} · {r.role}</span></span>
                  <StatusDot s={r.sourceItem.status} />
                  <span className="rr-lock">읽기</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {picker && <RelationPicker title="관계 추가" mode="relation" excludeIds={excludeIds} onPick={addRel} onClose={() => setPicker(false)} />}
      </section>
    );
  }

  /* ---------------- Timeline Section ---------------- */
  function TimelineSection({ item, timeline, setTimeline, onFocus }) {
    const [picker, setPicker] = useState(null); // 'prev' | 'next'
    const slot = (which) => {
      const r = timeline[which];
      if (!r) return (
        <button className="tl-empty" onClick={() => setPicker(which)}>＋ {which === 'prev' ? '이전' : '다음'} 시점 연결</button>
      );
      const tgt = targetItem(r.target);
      if (!tgt) return (
        <div className="tl-card warn">
          <span className="tl-rel">{which}</span>
          <span className="tl-nm strike">{r.title}</span>
          <span className="tl-warn">⚠ 대상 삭제됨 / 결과 밖</span>
          <button className="tl-x" onClick={() => setTimeline({ ...timeline, [which]: null })}>×</button>
        </div>
      );
      return (
        <div className="tl-card clickable" onClick={() => onFocus(r.target)} style={{ borderColor: S.STATUS[tgt.status].color }}>
          <span className="tl-rel">{which}</span>
          <span className="tl-row"><CategoryGlyph cat={tgt.cat} s={15} /><StatusDot s={tgt.status} size={8} /></span>
          <span className="tl-nm">{tgt.name}</span>
          <span className="tl-dt">{tgt.dt}</span>
          <button className="tl-x" onClick={e => { e.stopPropagation(); setTimeline({ ...timeline, [which]: null }); }}>×</button>
        </div>
      );
    };
    const excludeIds = [item.id, timeline.prev && timeline.prev.target, timeline.next && timeline.next.target].filter(Boolean);
    return (
      <section className="dsec">
        <div className="dsec-h">
          <h2>Timeline</h2>
          <span className="dsec-sub">prev / next 시계열 authoring</span>
        </div>
        <div className="tl-lane">
          {slot('prev')}
          <span className="tl-arrow">→</span>
          <div className="tl-card current"><span className="tl-rel cur">현재</span><span className="tl-row"><CategoryGlyph cat={item.cat} s={15} /><StatusDot s={item.status} size={8} /></span><span className="tl-nm">{item.name}</span><span className="tl-dt">{item.dt}</span></div>
          <span className="tl-arrow">→</span>
          {slot('next')}
        </div>
        {picker && <RelationPicker title={(picker === 'prev' ? '이전' : '다음') + ' 시점 Item 연결'} mode="timeline" fixedRel={picker} excludeIds={excludeIds}
          onPick={({ target, title }) => { setTimeline({ ...timeline, [picker]: { target, title } }); setPicker(null); }} onClose={() => setPicker(null)} />}
      </section>
    );
  }

  Object.assign(window, { RelationsSection, TimelineSection, RelationGraph, RelationPicker });
})();
