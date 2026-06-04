import { getPreviewStatusInfo } from '../constants'

export default function PreviewStatusBadge({ status }) {
  const info = getPreviewStatusInfo(status)
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '3px 8px',
      borderRadius: 4,
      fontSize: 12,
      fontWeight: 800,
      color: info.color,
      background: 'rgba(19,22,31,0.88)',
      border: '1px solid var(--bd)',
    }}>
      {info.label}
    </span>
  )
}
