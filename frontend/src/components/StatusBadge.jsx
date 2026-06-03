import { getStatusInfo } from '../features/items/getItemStatus.js'

export default function StatusBadge({ status, count, compact = false }) {
  const info = getStatusInfo(status)
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: compact ? '1px 6px' : '2px 8px',
      borderRadius: 4,
      fontSize: compact ? 10 : 12,
      fontWeight: 700,
      color: info.color,
      background: info.background,
      border: `1px solid ${info.border}`,
      lineHeight: 1.3,
      whiteSpace: 'nowrap',
    }}>
      {info.label}{count != null ? ` ${count}` : ''}
    </span>
  )
}
