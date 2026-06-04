export default function ViewerImageToolbar({
  scale,
  canControl,
  onZoomIn,
  onZoomOut,
  onReset,
}) {
  return (
    <div style={toolbarStyle} aria-label="Image viewer controls">
      <button type="button" disabled={!canControl} onClick={onZoomOut} style={buttonStyle(canControl)}>
        -
      </button>
      <span style={scaleStyle}>{Math.round(scale * 100)}%</span>
      <button type="button" disabled={!canControl} onClick={onZoomIn} style={buttonStyle(canControl)}>
        +
      </button>
      <button type="button" disabled={!canControl} onClick={onReset} style={resetButtonStyle(canControl)}>
        Reset
      </button>
    </div>
  )
}

const toolbarStyle = {
  position: 'absolute',
  right: 12,
  top: 12,
  zIndex: 3,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: 6,
  borderRadius: 6,
  border: '1px solid rgba(228,231,240,0.16)',
  background: 'rgba(12,14,20,0.72)',
  backdropFilter: 'blur(6px)',
}

const scaleStyle = {
  minWidth: 44,
  color: 'var(--t2)',
  fontSize: 12,
  fontWeight: 900,
  textAlign: 'center',
}

function buttonStyle(canControl) {
  return {
    width: 28,
    height: 28,
    borderRadius: 4,
    border: '1px solid var(--bd)',
    background: canControl ? 'var(--s2)' : 'rgba(26,30,42,0.7)',
    color: canControl ? 'var(--t1)' : 'var(--t3)',
    cursor: canControl ? 'pointer' : 'not-allowed',
    fontSize: 16,
    fontWeight: 900,
    lineHeight: '24px',
  }
}

function resetButtonStyle(canControl) {
  return {
    ...buttonStyle(canControl),
    width: 56,
    fontSize: 12,
  }
}
