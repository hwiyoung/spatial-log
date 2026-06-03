export default function DraftBadge({ compact = false }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: compact ? '1px 6px' : '2px 8px',
      borderRadius: 4,
      fontSize: compact ? 10 : 12,
      fontWeight: 800,
      color: 'var(--warn)',
      background: 'rgba(240,180,42,0.13)',
      border: '1px solid rgba(240,180,42,0.40)',
      lineHeight: 1.3,
      whiteSpace: 'nowrap',
    }}>
      Draft
    </span>
  )
}
