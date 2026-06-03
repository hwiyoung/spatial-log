export default function ProjectBadge({ projectName, isUnassigned = false, count, compact = false }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: compact ? '1px 6px' : '2px 8px',
      borderRadius: 4,
      fontSize: compact ? 10 : 12,
      fontWeight: 650,
      color: isUnassigned ? '#D8C26A' : 'var(--t2)',
      background: isUnassigned ? 'rgba(216,194,106,0.12)' : 'var(--s2)',
      border: `1px solid ${isUnassigned ? 'rgba(216,194,106,0.34)' : 'var(--bd)'}`,
      lineHeight: 1.3,
      whiteSpace: 'nowrap',
      maxWidth: compact ? 132 : 220,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    }}>
      {isUnassigned ? 'Unassigned' : projectName || 'Unassigned'}{count != null ? ` ${count}` : ''}
    </span>
  )
}
