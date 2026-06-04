export default function PreviewActionButton({ contract, compact = false, onOpen }) {
  if (!contract) return null

  const disabled = contract.actionState === 'disabled'
  const tone = getActionTone(contract, disabled)

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        if (disabled) return
        if (onOpen) {
          onOpen(contract)
          return
        }
        window.alert('Lightweight Viewer Shell is not connected.')
      }}
      title={disabled ? contract.description : 'Open Phase 6B lightweight viewer shell. Heavy viewer is not opened.'}
      style={{
        padding: compact ? '7px 9px' : '8px 10px',
        borderRadius: 6,
        border: `1px solid ${tone.border}`,
        background: tone.background,
        color: tone.color,
        fontSize: 13,
        fontWeight: 800,
        cursor: disabled ? 'not-allowed' : 'pointer',
        width: compact ? 'auto' : '100%',
      }}
    >
      {contract.actionLabel}
    </button>
  )
}

function getActionTone(contract, disabled) {
  if (disabled) return { border: 'var(--bd)', background: 'var(--s2)', color: 'var(--t3)' }
  if (contract.status === 'failed') {
    return { border: 'rgba(229,85,85,0.32)', background: 'rgba(229,85,85,0.08)', color: 'var(--err, #e55)' }
  }
  if (contract.status === 'pending') {
    return { border: 'rgba(240,180,42,0.32)', background: 'rgba(240,180,42,0.08)', color: 'var(--warn)' }
  }
  if (contract.status === 'missing') {
    return { border: 'var(--bd)', background: 'var(--s2)', color: 'var(--t2)' }
  }
  return { border: 'rgba(74,114,255,0.32)', background: 'rgba(74,114,255,0.10)', color: 'var(--ac)' }
}
