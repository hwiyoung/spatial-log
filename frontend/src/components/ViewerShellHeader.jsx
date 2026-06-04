import { getCategoryInfo } from '../constants'
import PreviewStatusBadge from './PreviewStatusBadge'

export default function ViewerShellHeader({ contract, onClose }) {
  const cat = getCategoryInfo(contract.dataCategory)

  return (
    <header style={headerStyle}>
      <div style={{ minWidth: 0 }}>
        <div style={eyebrowStyle}>
          <span style={{
            color: cat.color,
            borderColor: `${cat.color}40`,
            background: `${cat.color}12`,
            ...categoryPillStyle,
          }}>
            {cat.icon} {cat.label} · {contract.dataCategory}
          </span>
          <PreviewStatusBadge status={contract.status} />
        </div>
        <h2 id="viewer-shell-title" style={titleStyle}>
          {contract.displayLabel}
        </h2>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close viewer shell"
        style={closeButtonStyle}
      >
        x
      </button>
    </header>
  )
}

const headerStyle = {
  padding: '14px 16px',
  borderBottom: '1px solid var(--bd)',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12,
}

const eyebrowStyle = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 6,
  marginBottom: 8,
}

const categoryPillStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '3px 8px',
  borderRadius: 4,
  border: '1px solid',
  fontSize: 12,
  fontWeight: 800,
}

const titleStyle = {
  margin: 0,
  color: 'var(--t1)',
  fontSize: 18,
  lineHeight: 1.3,
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const closeButtonStyle = {
  width: 32,
  height: 32,
  flexShrink: 0,
  borderRadius: 4,
  border: '1px solid var(--bd)',
  background: 'var(--s2)',
  color: 'var(--t2)',
  cursor: 'pointer',
  fontSize: 16,
  lineHeight: '28px',
}
