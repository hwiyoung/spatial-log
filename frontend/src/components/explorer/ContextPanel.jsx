/**
 * ContextPanel — Explorer 우측 항상-표시 컨텍스트 패널.
 * 선택 Item 의 Preview · 식별 · 프로젝트/상태 · 메타데이터 품질 · 공간 근거 · 관계를 한 화면에서 판단.
 * 핸드오프 Explorer.html / panels.jsx 의 ContextPanel 을 실제 데이터(view + 관계 overlay 모델)에 연결.
 */
import CategoryGlyph from '../viewer/CategoryGlyph'
import { StatusBadge } from './Badges'
import { getCategoryInfo, formatSize } from '../../constants'
import { PREVIEW_META, SPATIAL_LABEL } from '../../features/explorer/explorerMeta'

function Section({ title, hint, warn, children }) {
  return (
    <div className={'sec' + (warn ? ' warn' : '')}>
      <div className="sec-h">{title}{hint && <span className="sec-hint">{hint}</span>}</div>
      <div className="sec-b">{children}</div>
    </div>
  )
}

function buildRelationView(relationModel, resolveName) {
  // 표시 이름은 "상대 item"(relatedItemId)의 이름. relation.title 은 링크에 적힌 값이라 incoming 관계에선
  // 선택 item 자신의 이름일 수 있으므로 신뢰하지 않고, 결과에 있으면 실제 item 이름으로 해석한다.
  const name = (r) => (resolveName && resolveName(r.relatedItemId)) || r.title || r.relatedItemId
  const visible = (relationModel?.visibleRelations || []).map(r => ({
    rel: r.rel, title: name(r), targetId: r.relatedItemId, inResult: true,
  }))
  const missing = (relationModel?.missingTargets || []).map(r => ({
    rel: r.rel, title: name(r), targetId: r.relatedItemId, inResult: false,
  }))
  const records = [...visible, ...missing]
  const counts = {}
  records.forEach(r => { counts[r.rel] = (counts[r.rel] || 0) + 1 })
  return { records, counts, total: records.length, missingCount: missing.length }
}

export default function ContextPanel({
  view,
  outOfResult = false,
  relationModel = null,
  resolveName,
  onClear,
  onSelectRelated,
  onOpenDetail,
  onOpenViewer,
}) {
  if (!view) {
    return (
      <div className="ctx empty">
        <div className="ctx-empty">
          <span className="oc-glyph">◍</span>
          <b>Item을 선택하세요</b>
          <small>지도 marker 또는 목록 행을 클릭하면<br />Preview · 상태 · 누락 · 공간 근거 · 관계를 즉시 판단합니다</small>
        </div>
      </div>
    )
  }

  const pv = PREVIEW_META[view.preview] || PREVIEW_META.missing
  const rel = buildRelationView(relationModel, resolveName)
  const hasGap = view.draftReason || view.miss.length > 0 || view.gaps.length > 0

  return (
    <div className="ctx">
      <div className="ctx-head">
        <span className="ctx-cat"><CategoryGlyph cat={view.cat} s={15} /> {getCategoryInfo(view.cat).label}</span>
        {outOfResult && <span className="ctx-out" title="선택 Item이 현재 필터 결과에 포함되지 않음">○ 현재 결과 밖</span>}
        <button className="ctx-x" onClick={onClear} aria-label="패널 닫기">×</button>
      </div>

      <div className={'ctx-hero pv-bg-' + view.preview}>
        <div className="hero-thumb">
          {view.thumbnailHref
            ? <img src={view.thumbnailHref} alt="" onError={e => { e.currentTarget.style.display = 'none' }} />
            : view.preview === 'available'
              ? <span className="hero-ok"><CategoryGlyph cat={view.cat} s={30} /></span>
              : <span className="hero-ph">{view.preview === 'pending' ? '⟳' : view.preview === 'failed' ? '⚠' : '▢'}</span>}
        </div>
        <div className="hero-meta">
          <span className="hero-pvl" style={{ color: pv.color }}>preview · {pv.label}</span>
          {view.previewFail && <span className="hero-fail">{view.previewFail}</span>}
          {view.preview === 'pending' && <span className="hero-note">변환/검수 대기 중</span>}
          {view.preview === 'missing' && <span className="hero-note">preview 미생성 — 변환 필요</span>}
        </div>
      </div>

      <div className="ctx-scroll">
        <Section title="Identity">
          <div className="kv"><b className="kv-title">{view.name}</b></div>
          <div className="kv"><span className="kvk">file</span><span className="kvv mono">{view.file}</span></div>
          <div className="kv"><span className="kvk">id</span><span className="kvv mono dim">{view.id}</span></div>
          {view.size != null && <div className="kv"><span className="kvk">size</span><span className="kvv">{formatSize(view.size)}</span></div>}
        </Section>

        <Section title="Project / Status">
          <div className="kv"><span className="kvk">project</span><span className="kvv">{view.isUnassigned ? <span className="unassigned">Unassigned Inbox</span> : view.projectName}</span></div>
          {view.projectSite && <div className="kv"><span className="kvk">site</span><span className="kvv">{view.projectSite}</span></div>}
          <div className="kv"><span className="kvk">status</span><span className="kvv"><StatusBadge status={view.status} /></span></div>
          {view.dt && <div className="kv"><span className="kvk">date</span><span className="kvv">{view.dt}</span></div>}
        </Section>

        {hasGap ? (
          <Section title="Metadata quality" warn>
            {view.draftReason && <div className="draft-reason"><span className="dr-badge">Draft</span> {view.draftReason}</div>}
            {view.miss.length > 0 && <>
              <div className="gap-l">필수 누락 {view.miss.length}</div>
              <div className="gap-chips">{view.miss.map(m => <span key={m} className="gap-chip">{m}</span>)}</div>
            </>}
            {view.gaps.length > 0 && <div className="gap-notes">{view.gaps.map((g, i) => <div key={i}>· {g}</div>)}</div>}
          </Section>
        ) : (
          <Section title="Metadata quality"><div className="ok-line">✓ 필수 메타데이터 충족</div></Section>
        )}

        <Section title="Spatial">
          <div className="kv"><span className="kvk">source</span><span className="kvv"><span className={'spat-src s-' + view.src}>{SPATIAL_LABEL[view.src] || SPATIAL_LABEL.none}</span></span></div>
          {view.lon != null && <div className="kv"><span className="kvk">center</span><span className="kvv mono">{view.lon.toFixed(4)}, {view.lat.toFixed(4)}</span></div>}
          {view.hasExtent && <div className="kv"><span className="kvk">extent</span><span className="kvv mono dim">bbox · footprint</span></div>}
          {view.epsg && <div className="kv"><span className="kvk">epsg</span><span className="kvv mono">{view.epsg}</span></div>}
          {view.elev != null && <div className="kv"><span className="kvk">elev</span><span className="kvv">{view.elev} m</span></div>}
          {view.src === 'fallback' && <div className="spat-fb">⚑ 직접 좌표 없음 — 프로젝트 위치로 fallback</div>}
        </Section>

        <Section title="Relation" hint="1-depth">
          {rel.total === 0 ? <div className="rel-none">연결된 관계 없음</div> : <>
            <div className="rel-chips">
              {Object.entries(rel.counts).map(([r, n]) => <span key={r} className="rel-chip">{r} <b>{n}</b></span>)}
            </div>
            <div className="rel-records">
              {rel.records.map((r) => (
                <div
                  key={r.rel + '|' + r.targetId}
                  className={'rel-rec' + (r.inResult ? '' : ' warn')}
                  onClick={() => { if (r.inResult) onSelectRelated?.(r.targetId) }}
                >
                  <span className="rr-rel">{r.rel}</span>
                  <span className="rr-t" title={r.title}>{r.title}</span>
                  {r.inResult ? <span className="rr-go">→</span> : <span className="rr-w">결과 밖</span>}
                </div>
              ))}
            </div>
            {rel.missingCount > 0 && <div className="rel-warn">⚠ 결과 밖/누락 관계 {rel.missingCount}건 — 지도 overlay 에 warning 표시</div>}
          </>}
        </Section>
      </div>

      <div className="ctx-foot">
        <button className="af primary" onClick={onOpenDetail}>Detail 열기</button>
        <div className="af-row">
          <button className="af" onClick={onOpenViewer}>Viewer</button>
          <button className="af" disabled title="메타데이터 편집은 Detail 에서">{view.status === 'draft' ? '보완하기' : 'Metadata'}</button>
          <button className="af" disabled title="Project 화면 연결 예정">Project</button>
        </div>
      </div>
    </div>
  )
}
