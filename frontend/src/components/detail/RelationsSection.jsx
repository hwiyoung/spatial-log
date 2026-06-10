/**
 * RelationsSection — 관계 그래프 + authoring(추가/삭제 + 대상 picker).
 * `design-reference/project/detail/relations.jsx` 포팅.
 *
 * 데이터: normalizeRelations 의 outgoing(편집)·incoming(읽기 전용, 역방향 자동 링크).
 * 추가/삭제는 page 가 실 API(addLink/removeLink) 또는 mock 로컬 상태로 처리한다.
 * 관계 유형 변경은 백엔드에 원자적 엔드포인트가 없어 read-only 라벨로 표시(추가 시 유형 선택).
 */
import { useEffect, useMemo, useState } from 'react'
import CategoryGlyph from '../viewer/CategoryGlyph'
import StatusDot from './StatusDot'
import { statusHex } from '../../features/detail/statusHex'

const REL_TYPES = ['derived_from', 'related', 'describedby', 'describes', 'prev', 'next']
const REL_KO = {
  derived_from: '원본에서 파생', related: '관련/동시취득', describedby: '설명 문서',
  describes: '설명 대상', prev: '이전 시점', next: '다음 시점',
}
const ROLE = {
  has_derived: '가공본 · 이 Item에서 파생', describes: '설명 대상',
  describedby: '설명 문서', related: '관련/동시취득',
}

/* ---------------- Relation Graph ---------------- */
function RelationGraph({ view, outgoing, incoming, onFocus }) {
  const W = 560, H = 332, cx = W / 2, cy = H / 2, rx = 176, ry = 108
  const nodes = [
    ...outgoing.map(r => ({ ...r, dir: 'out' })),
    ...incoming.map(r => ({ ...r, dir: 'in' })),
  ]
  const n = nodes.length
  const placed = nodes.map((nd, i) => {
    const ang = ((-90 + (360 / Math.max(n, 1)) * i) * Math.PI) / 180
    return { ...nd, x: cx + Math.cos(ang) * rx, y: cy + Math.sin(ang) * ry }
  })

  return (
    <div className="rgraph">
      <svg width={W} height={H} viewBox={'0 0 ' + W + ' ' + H} className="rgraph-svg">
        <defs>
          <marker id="rgArrow" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M1,1 L8,4.5 L1,8" fill="none" stroke="#5C6573" strokeWidth="1.5" /></marker>
          <marker id="rgArrowW" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M1,1 L8,4.5 L1,8" fill="none" stroke="#F97316" strokeWidth="1.5" /></marker>
        </defs>
        {placed.map((nd, i) => {
          const x1 = nd.dir === 'out' ? cx : nd.x, y1 = nd.dir === 'out' ? cy : nd.y
          const x2 = nd.dir === 'out' ? nd.x : cx, y2 = nd.dir === 'out' ? nd.y : cy
          return (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
              className={'rg-edge' + (nd.missing ? ' warn' : '')}
              markerEnd={nd.missing ? 'url(#rgArrowW)' : 'url(#rgArrow)'} />
          )
        })}
      </svg>

      {/* center node */}
      <div className="rg-node center" style={{ left: cx, top: cy, borderColor: statusHex(view.status) }}>
        <span className="rg-g"><CategoryGlyph cat={view.cat} s={17} /></span>
        <span className="rg-nm">{view.name}</span>
        <StatusDot status={view.status} />
      </div>

      {/* neighbor nodes */}
      {placed.map((nd, i) => (
        <div key={i}
          className={'rg-node' + (nd.missing ? ' missing' : '') + (nd.targetId && !nd.missing ? ' clickable' : '')}
          style={{ left: nd.x, top: nd.y, borderColor: nd.missing ? '#5C6573' : statusHex(nd.status) }}
          onClick={() => !nd.missing && nd.targetId && onFocus(nd.targetCol, nd.targetId)}>
          <span className="rg-rel">{nd.dir === 'in' ? '← ' : '→ '}{nd.rel}</span>
          {nd.missing ? <span className="rg-miss">⚠ 대상 없음</span> : (
            <>
              <span className="rg-row"><span className="rg-g"><CategoryGlyph cat={nd.cat} s={15} /></span><StatusDot status={nd.status} size={8} /></span>
              <span className="rg-nm">{nd.name}</span>
            </>
          )}
        </div>
      ))}

      <div className="rg-legend">중심 = 현재 Item · → outgoing · ← incoming</div>
    </div>
  )
}

/* ---------------- Target Picker ---------------- */
function RelationPicker({ excludeIds, searchTargets, onPick, onClose }) {
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(null)
  const [rel, setRel] = useState('derived_from')
  const [list, setList] = useState([])

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(async () => {
      const res = await searchTargets(q.trim())
      if (!cancelled) setList(res || [])
    }, 200)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [q, searchTargets])

  // 이미 연결된 대상·자기 자신은 렌더 시점에 제외(excludeIds 는 매 렌더 새 배열이므로 effect 의존성에서 분리)
  const visible = useMemo(() => list.filter(it => !excludeIds.includes(it.id)), [list, excludeIds])
  const selected = useMemo(() => visible.find(it => it.id === sel) || null, [visible, sel])

  return (
    <div className="pick-overlay" onMouseDown={onClose}>
      <div className="pick" onMouseDown={e => e.stopPropagation()}>
        <div className="pick-head"><b>관계 추가</b><button className="pick-x" onClick={onClose}>×</button></div>
        <div className="pick-search"><span>⌕</span><input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="대상 Item 검색 · 이름 · 파일명 · 프로젝트" /></div>
        <div className="pick-list">
          {visible.map(it => (
            <div key={it.id} className={'pick-row' + (sel === it.id ? ' on' : '')} onClick={() => setSel(it.id)}>
              <span className="pick-g"><CategoryGlyph cat={it.cat} s={16} /></span>
              <span className="pick-main"><span className="pick-nm">{it.name}</span><span className="pick-sub">{it.collection} · {it.file}</span></span>
              <StatusDot status={it.status} />
              {sel === it.id && <span className="pick-check">✓</span>}
            </div>
          ))}
          {!visible.length && <div className="pick-empty">검색 결과 없음</div>}
        </div>
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
        <div className="pick-foot">
          <button className="pick-cancel" onClick={onClose}>취소</button>
          <button className="pick-add" disabled={!selected} onClick={() => selected && onPick({ targetId: selected.id, targetCol: selected.collection, rel, title: selected.name })}>
            관계 추가
          </button>
        </div>
      </div>
    </div>
  )
}

/* ---------------- Relations Section ---------------- */
export default function RelationsSection({ view, relations, excludeIds, searchTargets, onAdd, onDelete, onFocus, busy }) {
  const [picker, setPicker] = useState(false)
  const { outgoing, incoming, counts } = relations
  const empty = outgoing.length === 0 && incoming.length === 0

  const addRel = (payload) => { onAdd(payload); setPicker(false) }

  return (
    <section className="dsec">
      <div className="dsec-h">
        <h2>Relations</h2>
        <span className="dsec-sub">관계 authoring — 원본·가공본 · 설명 문서 · 관련 자산</span>
        <div className="rel-counts">{Object.entries(counts).map(([r, num]) => <span key={r} className="rcount">{r} <b>{num}</b></span>)}</div>
        <button className="btn-add" onClick={() => setPicker(true)} disabled={busy}>＋ 관계 추가</button>
      </div>

      {empty ? (
        <div className="rel-empty">
          <span className="oc-glyph">⬡</span>
          <b>아직 연결된 관계가 없습니다</b>
          <small>원본·가공본, 설명 문서, 관련 자산을 연결해 데이터 계보를 만드세요</small>
          <button className="btn-add lg" onClick={() => setPicker(true)} disabled={busy}>＋ 첫 관계 추가</button>
        </div>
      ) : (
        <div className="rel-body">
          <div className="rel-graph-wrap"><RelationGraph view={view} outgoing={outgoing} incoming={incoming} onFocus={onFocus} /></div>
          <div className="rel-auth">
            <div className="rel-grp-h">이 Item의 관계 <span>outgoing · 편집 가능</span></div>
            {outgoing.length === 0 && <div className="rel-mini-empty">outgoing 관계 없음 — ＋ 관계 추가</div>}
            {outgoing.map(r => (
              <div key={r.id} className={'rel-row' + (r.missing ? ' warn' : '')}>
                {r.missing ? (
                  <>
                    <span className="rr-g warn">⚠</span>
                    <span className="rr-main"><span className="rr-nm strike">{r.name}</span><span className="rr-sub warn">{r.rel} · 대상 삭제됨 / 존재하지 않음</span></span>
                  </>
                ) : (
                  <>
                    <span className="rr-g" onClick={() => onFocus(r.targetCol, r.targetId)}><CategoryGlyph cat={r.cat} s={15} /></span>
                    <span className="rr-main" onClick={() => onFocus(r.targetCol, r.targetId)}>
                      <span className="rr-nm">{r.name}</span>
                      <span className="rr-sub">{r.rel}{r.targetCol ? ' · ' + r.targetCol : ''}</span>
                    </span>
                  </>
                )}
                <button className="rr-del" onClick={() => onDelete(r)} disabled={busy} title="관계 삭제">×</button>
              </div>
            ))}

            <div className="rel-grp-h mt">이 Item을 참조 <span>incoming · 상대 Item에서 관리</span></div>
            {incoming.length === 0 && <div className="rel-mini-empty">incoming 관계 없음</div>}
            {incoming.map(r => (
              <div key={r.id} className="rel-row ro" onClick={() => !r.missing && r.targetId && onFocus(r.targetCol, r.targetId)}>
                <span className="rr-g"><CategoryGlyph cat={r.cat} s={15} /></span>
                <span className="rr-main"><span className="rr-nm">{r.name}</span><span className="rr-sub">{r.rel} · {ROLE[r.rel] || r.rel}</span></span>
                <StatusDot status={r.status} />
                <span className="rr-lock">읽기</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {picker && (
        <RelationPicker
          excludeIds={excludeIds}
          searchTargets={searchTargets}
          onPick={addRel}
          onClose={() => setPicker(false)}
        />
      )}
    </section>
  )
}
