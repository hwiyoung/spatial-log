export default function ExplorerViewToggle({ viewMode, onChange }) {
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 3,
      padding: 3,
      borderRadius: 6,
      background: 'rgba(19,22,31,0.92)',
      border: '1px solid var(--bd)',
      boxShadow: '0 2px 10px rgba(0,0,0,0.22)',
    }}>
      <ToggleButton
        active={viewMode === '2d'}
        onClick={() => onChange('2d')}
        label="2D 지도"
      />
      <ToggleButton
        active={viewMode === '3d'}
        onClick={() => onChange('3d')}
        label="3D GIS Beta"
      />
    </div>
  )
}

function ToggleButton({ active, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '5px 10px',
        borderRadius: 4,
        border: 'none',
        background: active ? 'var(--ac)' : 'transparent',
        color: active ? '#fff' : 'var(--t2)',
        fontSize: 12,
        fontWeight: 800,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}
