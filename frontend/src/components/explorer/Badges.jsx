/** Explorer 상태 배지 + 미리보기 점 — 색은 상태/미리보기 토큰만 사용. */
import { STATUS_META, PREVIEW_META, tint } from '../../features/explorer/explorerMeta'

export function StatusBadge({ status, sm = false }) {
  const v = STATUS_META[status] || STATUS_META.unknown
  return (
    <span
      className={'sbadge' + (sm ? ' sm' : '')}
      style={{ color: v.color, borderColor: tint(v.color, 40), background: tint(v.color, 8), borderStyle: v.dashed ? 'dashed' : 'solid' }}
    >
      {v.label}
    </span>
  )
}

export function PreviewDot({ p }) {
  const v = PREVIEW_META[p] || PREVIEW_META.missing
  return (
    <span className="pvdot" title={'preview ' + v.label}>
      <i style={{ background: v.color }} />{v.label}
    </span>
  )
}
