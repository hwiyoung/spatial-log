/** Upload 검토 화면 공용 소품 — 분류 플래그, preview 점, 라벨 상수. */
import { PREVIEW_META } from '../../features/explorer/explorerMeta'

export const SP_LABEL = { bbox: 'BBox 추출', manual: '직접 지정', none: '좌표 없음' }

const FLAG_STYLE = {
  category: { color: 'var(--orange)', bd: 'color-mix(in srgb, var(--orange) 42%, transparent)', bg: 'color-mix(in srgb, var(--orange) 9%, transparent)' },
  metadata: { color: 'var(--draft)', bd: 'color-mix(in srgb, var(--draft) 38%, transparent)', bg: 'color-mix(in srgb, var(--draft) 9%, transparent)' },
  spatial: { color: 'var(--t2)', bd: 'var(--line)', bg: '#121821' },
  link: { color: 'var(--blue)', bd: 'color-mix(in srgb, var(--blue) 35%, transparent)', bg: 'color-mix(in srgb, var(--blue) 8%, transparent)' },
  ontology: { color: 'var(--blue)', bd: 'color-mix(in srgb, var(--blue) 35%, transparent)', bg: 'color-mix(in srgb, var(--blue) 8%, transparent)' },
}

export function Flag({ f }) {
  const st = FLAG_STYLE[f.k] || FLAG_STYLE.metadata
  return (
    <span
      style={{
        fontSize: 10, fontWeight: 600, borderRadius: 6, padding: '3px 8px', border: '1px solid',
        display: 'inline-flex', alignItems: 'center', gap: 4,
        color: st.color, borderColor: st.bd, background: st.bg,
      }}
    >
      {f.t}
    </span>
  )
}

export function PvDot({ s }) {
  const v = PREVIEW_META[s] || PREVIEW_META.missing
  return <span className="pv-dot" style={{ background: v.color }} />
}
