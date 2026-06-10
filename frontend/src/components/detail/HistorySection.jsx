/**
 * HistorySection — Item 이력 (등록 · 상태 · 메타데이터 · 위치 · 이동 · 관계 · preview).
 * `design-reference/project/Detail.html` 의 .hist UI 를 실데이터(`/items/{id}/history`)에 연결.
 * 디자인의 합성 이력(가짜 행위자/날짜)은 쓰지 않는다 — buildHistoryRows 의 정직성 원칙 참조.
 */
import { buildHistoryRows, formatHistoryDate } from '../../features/detail/buildHistoryRows'

const ICON = {
  register: '＋', assign: '◇', preview: '▤', file: '⇄',
  meta: '✎', status: '◉', relation: '⬡', location: '◎',
}

export default function HistorySection({ events, item }) {
  const rows = buildHistoryRows(events, item)

  return (
    <section className="dsec">
      <div className="dsec-h">
        <h2>History</h2>
        <span className="dsec-sub">등록 · 상태 · 메타데이터 · 위치 · 이동 · 관계 이력</span>
      </div>
      {rows.length === 0 ? (
        <div className="hist-empty">기록된 이력이 없습니다 — 등록·수정·이동 등의 작업이 이곳에 기록됩니다</div>
      ) : (
        <div className="hist">
          {rows.map((h, i) => (
            <div className="hrow" key={i}>
              <span className="hic">{ICON[h.type] || '·'}</span>
              <div className="hmain">
                <div className="htext">{h.text}</div>
                {h.meta && <div className="hmeta">{h.meta}</div>}
              </div>
              <span className="hdate">{formatHistoryDate(h.date)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
