export default function RelationWarning({ overlayModel }) {
  const missingTargets = overlayModel?.missingTargets || []
  if (missingTargets.length === 0) return null

  const visibleTargets = missingTargets.slice(0, 3)
  const hiddenCount = Math.max(0, missingTargets.length - visibleTargets.length)

  return (
    <div style={{
      position: 'absolute',
      top: 48,
      left: 10,
      zIndex: 3,
      maxWidth: 360,
      padding: '8px 10px',
      borderRadius: 6,
      background: 'rgba(19,22,31,0.94)',
      border: '1px solid rgba(240,180,42,0.35)',
      color: 'var(--t2)',
      fontSize: 12,
      boxShadow: '0 2px 10px rgba(0,0,0,0.24)',
    }}>
      <div style={{ color: 'var(--warn)', fontWeight: 800, marginBottom: 5 }}>
        Missing relation targets: {missingTargets.length}
      </div>
      <div style={{ fontFamily: 'monospace', overflowWrap: 'anywhere' }}>
        {visibleTargets.map(target => target.relatedItemId || target.targetItemId).join(', ')}
        {hiddenCount > 0 ? `, +${hiddenCount} more` : ''}
      </div>
    </div>
  )
}
