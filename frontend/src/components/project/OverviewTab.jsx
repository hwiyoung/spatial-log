/**
 * OverviewTab — 현황: 4 KPI + 예상 산출물 대비 등록 + 프로젝트 정보.
 * `design-reference/project/Project.html` 의 Overview 포팅 — 실 dashboard/Item 통계.
 */
import CategoryGlyph from '../viewer/CategoryGlyph'
import { getCategoryInfo } from '../../constants'
import { StatusMix } from './StatusBadge'

export default function OverviewTab({ stats, facts }) {
  const { regTotal, expTotal, deliverables, missing, missingCount, draftCount, statusCounts } = stats
  const comp = expTotal ? Math.min(100, Math.round((regTotal / expTotal) * 100)) : null

  return (
    <div>
      <div className="ov-kpis">
        <div className="bigkpi"><div className="v">{regTotal}</div><div className="l">총 Asset</div><div className="sub">등록된 산출물</div></div>
        <div className="bigkpi gap">
          <div className="v">{expTotal ? `${regTotal}/${expTotal}` : '—'}</div>
          <div className="l">등록 완성도</div>
          {comp != null
            ? <div className="compbar"><i style={{ width: comp + '%' }} /></div>
            : <div className="sub">예상 산출물 미설정</div>}
        </div>
        <div className="bigkpi gap">
          <div className="v">{missingCount}</div>
          <div className="l">누락 산출물</div>
          <div className="sub">{missing.length > 0 ? `${missing.length}개 유형에서 부족` : '누락 없음'}</div>
        </div>
        <div className="bigkpi"><div className="v" style={{ color: 'var(--draft)' }}>{draftCount}</div><div className="l">Draft</div><div className="sub">보완 대기</div></div>
      </div>

      <div className="panel">
        <div className="panel-h">
          <h3>예상 산출물 대비 등록</h3>
          <span className="hint">expected_deliverables vs registered</span>
          {missingCount > 0 && <span className="miss-tag">누락 {missingCount}건 · {missing.length}개 유형</span>}
        </div>
        <div className="deliv">
          {deliverables.length === 0 && <div className="proj-empty">등록된 산출물이 없습니다</div>}
          {deliverables.map(d => {
            const full = d.expected === 0 || d.registered >= d.expected
            const pct = d.expected ? Math.min(100, Math.round((d.registered / d.expected) * 100)) : 100
            return (
              <div className="drow" key={d.cat} title={d.description || undefined}>
                <span className="d-g"><CategoryGlyph cat={d.cat} s={16} /></span>
                <span className="d-name">{getCategoryInfo(d.cat).label}</span>
                <span className="d-bar"><i className={full ? 'ok' : 'part'} style={{ width: pct + '%' }} /></span>
                <span className="d-cnt"><b>{d.registered}</b><span className="e"> / {d.expected || '—'}</span></span>
                <span className={'d-stat ' + (full ? 'ok' : 'miss')}>{full ? '✓ 충족' : `누락 ${d.expected - d.registered}`}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="panel">
        <div className="panel-h"><h3>프로젝트 정보</h3></div>
        <div className="info-grid">
          <div><div className="info-k">Site</div><div className="info-v">{facts.site || '—'}</div></div>
          <div><div className="info-k">발주처 (Client)</div><div className="info-v">{facts.client || '—'}</div></div>
          <div><div className="info-k">PM</div><div className="info-v">{facts.pm || '—'}</div></div>
          <div><div className="info-k">Period</div><div className="info-v">{facts.period || '—'}</div></div>
          <div><div className="info-k">Default EPSG</div><div className="info-v mono">{facts.epsg || '—'}</div></div>
          <div><div className="info-k">상태 분포</div><StatusMix statusCounts={statusCounts} style={{ marginTop: 4 }} /></div>
        </div>
      </div>
    </div>
  )
}
