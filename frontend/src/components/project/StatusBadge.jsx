/** Project 화면 공용 상태 배지 + 상태 분포 칩 — 색은 STATUS_META(상태 토큰)만 운반. */
import { STATUS_META, tint } from '../../features/explorer/explorerMeta'

export function Badge({ status }) {
  const v = STATUS_META[status] || STATUS_META.unknown
  return (
    <span className="badge" style={{ color: v.color, borderColor: tint(v.color, 40), background: tint(v.color, 8), borderStyle: v.dashed ? 'dashed' : 'solid' }}>
      {v.label}
    </span>
  )
}

export function StatusMix({ statusCounts, style }) {
  const entries = Object.entries(statusCounts || {})
  if (entries.length === 0) return <span style={{ fontSize: 12, color: 'var(--t3)' }}>Item 없음</span>
  return (
    <div className="statusmix" style={style}>
      {entries.map(([s, n]) => {
        const v = STATUS_META[s] || STATUS_META.unknown
        return (
          <span className="smchip" key={s}>
            <i style={{ background: v.color, borderColor: v.color, borderStyle: v.dashed ? 'dashed' : 'solid' }} />
            {v.label} {n}
          </span>
        )
      })}
    </div>
  )
}
