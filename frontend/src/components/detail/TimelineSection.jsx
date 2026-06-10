/**
 * TimelineSection — prev / 현재 / next 시계열 레인(읽기 전용 표시).
 * `design-reference/project/Detail.html` 의 .tl-lane 포팅.
 *
 * 실 데이터의 시계열은 단일 prev/next 가 아니라 체인일 수 있으므로 전체 체인을 datetime 순으로
 * 카드로 펼친다. 현재 Item 기준 이전/현재/다음으로 라벨링한다.
 * prev/next 연결(authoring)은 Relations 의 ＋관계 추가(prev/next 유형)로 수행한다.
 */
import CategoryGlyph from '../viewer/CategoryGlyph'
import StatusDot from './StatusDot'

function relLabel(idx, currentIdx) {
  if (idx === currentIdx) return '현재'
  return idx < currentIdx ? '이전' : '다음'
}

export default function TimelineSection({ timeline, currentId, currentView, onFocus }) {
  const items = Array.isArray(timeline) ? timeline : []
  const currentIdx = items.findIndex(t => t.is_current || t.item_id === currentId)

  return (
    <section className="dsec">
      <div className="dsec-h">
        <h2>Timeline</h2>
        <span className="dsec-sub">prev / next 시계열 — 같은 대상·유형의 시점별 자산</span>
      </div>

      {items.length <= 1 ? (
        // 연결된 prev/next 가 없어도 현재 Item 카드는 항상 레인 중앙에 두고(디자인 보장) prev/next 는
        // 비활성 힌트 슬롯으로 표시한다. authoring 은 Relations 의 prev/next 유형으로 위임.
        (() => {
          const cur = items[0] || {
            item_id: currentId, description: currentView?.name,
            data_category: currentView?.cat, status: currentView?.status, datetime: currentView?.dt,
          }
          return (
            <div className="tl-lane">
              <div className="tl-empty">＋ 이전 시점 — Relations 에서 prev 유형으로 연결</div>
              <span className="tl-arrow">→</span>
              <div className="tl-card current">
                <span className="tl-rel cur">현재</span>
                <span className="tl-row"><CategoryGlyph cat={cur.data_category || 'unknown'} s={15} /><StatusDot status={cur.status} size={8} /></span>
                <span className="tl-nm">{cur.description || cur.item_id}</span>
                <span className="tl-dt">{(cur.datetime || '').slice(0, 10) || '날짜 없음'}</span>
              </div>
              <span className="tl-arrow">→</span>
              <div className="tl-empty">＋ 다음 시점 — Relations 에서 next 유형으로 연결</div>
            </div>
          )
        })()
      ) : (
        <div className="tl-lane">
          {items.map((t, i) => {
            const current = i === currentIdx
            const node = (
              <div
                key={t.item_id}
                className={'tl-card' + (current ? ' current' : ' clickable')}
                onClick={() => !current && onFocus(t.collection_id, t.item_id)}
              >
                <span className={'tl-rel' + (current ? ' cur' : '')}>{relLabel(i, currentIdx)}</span>
                <span className="tl-row"><CategoryGlyph cat={t.data_category || 'unknown'} s={15} /><StatusDot status={t.status} size={8} /></span>
                <span className="tl-nm">{t.description || t.item_id}</span>
                <span className="tl-dt">{(t.datetime || '').slice(0, 10) || '날짜 없음'}</span>
              </div>
            )
            return i < items.length - 1
              ? [node, <span key={t.item_id + '-arr'} className="tl-arrow">→</span>]
              : node
          })}
        </div>
      )}
    </section>
  )
}
