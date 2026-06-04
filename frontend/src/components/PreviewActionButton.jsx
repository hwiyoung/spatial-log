export default function PreviewActionButton({ contract, compact = false }) {
  if (!contract) return null

  const disabled = contract.actionState === 'disabled'
  const isInfo = contract.actionState === 'info_only'
  const isMock = contract.actionState === 'mock_only'

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        if (disabled) return
        const message = isInfo
          ? (contract.failureReason || 'Preview failed. Phase 6B viewer work is required.')
          : 'Mock preview only. Real viewer opens in Phase 6B or later.'
        window.alert(message)
      }}
      title={disabled ? contract.description : 'Phase 6A contract action. Heavy viewer is not opened.'}
      style={{
        padding: compact ? '7px 9px' : '8px 10px',
        borderRadius: 6,
        border: `1px solid ${disabled ? 'var(--bd)' : (isInfo ? 'rgba(229,85,85,0.32)' : 'rgba(74,114,255,0.32)')}`,
        background: disabled ? 'var(--s2)' : (isInfo ? 'rgba(229,85,85,0.08)' : 'rgba(74,114,255,0.10)'),
        color: disabled ? 'var(--t3)' : (isInfo ? 'var(--err, #e55)' : 'var(--ac)'),
        fontSize: 13,
        fontWeight: 800,
        cursor: disabled ? 'not-allowed' : 'pointer',
        width: compact ? 'auto' : '100%',
      }}
    >
      {contract.actionLabel}
      {isMock ? ' · Mock' : ''}
    </button>
  )
}
