export default function Explorer3dControls({
  focusSelected = false,
  selectedLabel = null,
  relationOverlayEnabled = false,
  onResetView,
}) {
  return (
    <div style={rootStyle}>
      <button type="button" onClick={onResetView} style={buttonStyle}>
        Reset view
      </button>
      <div style={stateStyle}>
        <span style={labelStyle}>Focus</span>
        <span style={valueStyle}>{focusSelected && selectedLabel ? selectedLabel : 'Spatial layout'}</span>
      </div>
      <div style={stateStyle}>
        <span style={labelStyle}>Relations</span>
        <span style={valueStyle}>{relationOverlayEnabled ? '선택 관계 보기' : 'Hidden'}</span>
      </div>
    </div>
  )
}

const rootStyle = {
  position: 'absolute',
  top: 12,
  right: 12,
  zIndex: 740,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: 7,
  borderRadius: 7,
  border: '1px solid rgba(228,231,240,0.16)',
  background: 'rgba(12,14,20,0.88)',
  boxShadow: '0 12px 28px rgba(0,0,0,0.30)',
}

const buttonStyle = {
  height: 30,
  padding: '0 10px',
  borderRadius: 5,
  border: '1px solid var(--bd)',
  background: 'var(--s2)',
  color: 'var(--t1)',
  fontSize: 12,
  fontWeight: 900,
  cursor: 'pointer',
}

const stateStyle = {
  maxWidth: 150,
  minWidth: 90,
  padding: '2px 7px',
  borderLeft: '1px solid rgba(228,231,240,0.12)',
}

const labelStyle = {
  display: 'block',
  color: 'var(--t3)',
  fontSize: 10,
  fontWeight: 800,
}

const valueStyle = {
  display: 'block',
  color: 'var(--t2)',
  fontSize: 11,
  fontWeight: 900,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}
