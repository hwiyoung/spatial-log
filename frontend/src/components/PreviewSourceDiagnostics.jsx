import { getPreviewSourceDiagnostics } from '../features/preview/getPreviewSourceDiagnostics.js'

export default function PreviewSourceDiagnostics({ source, loadState }) {
  const diagnostics = getPreviewSourceDiagnostics(source, loadState)

  return (
    <div style={rootStyle}>
      <div style={headerStyle}>
        <div>
          <div style={titleStyle}>Preview source diagnostics</div>
          <div style={subtitleStyle}>image / orthoimage delivery contract</div>
        </div>
        <span style={stateBadgeStyle(diagnostics.loadState)}>
          {diagnostics.loadStateLabel}
        </span>
      </div>

      <div style={gridStyle}>
        {diagnostics.rows.map(([key, value]) => (
          <div key={key} style={rowStyle}>
            <span style={keyStyle}>{key}</span>
            <span style={valueStyle}>{value}</span>
          </div>
        ))}
      </div>

      {diagnostics.isMockUriBlocked && (
        <div style={warningStyle}>
          mock:// is a fixture pointer and was blocked from direct image loading.
        </div>
      )}

      {diagnostics.fallbackReason && (
        <div style={noteStyle}>
          {diagnostics.fallbackReason}
        </div>
      )}
    </div>
  )
}

const rootStyle = {
  padding: '10px 11px',
  borderRadius: 6,
  border: '1px solid var(--bd)',
  background: 'var(--s2)',
}

const headerStyle = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 10,
  marginBottom: 9,
}

const titleStyle = {
  color: 'var(--t1)',
  fontSize: 13,
  fontWeight: 900,
}

const subtitleStyle = {
  marginTop: 2,
  color: 'var(--t3)',
  fontSize: 12,
  lineHeight: 1.35,
}

function stateBadgeStyle(loadState) {
  const color = loadState === 'loaded'
    ? 'var(--ok)'
    : loadState === 'loading'
      ? 'var(--warn)'
      : loadState === 'error'
        ? 'var(--err, #e55)'
        : 'var(--t2)'
  return {
    flexShrink: 0,
    padding: '3px 8px',
    borderRadius: 4,
    border: '1px solid var(--bd)',
    background: 'rgba(12,14,20,0.34)',
    color,
    fontSize: 12,
    fontWeight: 900,
  }
}

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
  gap: 6,
}

const rowStyle = {
  minWidth: 0,
  padding: '6px 7px',
  borderRadius: 5,
  border: '1px solid var(--bd)',
  background: 'rgba(12,14,20,0.32)',
}

const keyStyle = {
  display: 'block',
  color: 'var(--t3)',
  fontSize: 11,
  fontWeight: 800,
  marginBottom: 2,
}

const valueStyle = {
  display: 'block',
  color: 'var(--t2)',
  fontSize: 12,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const warningStyle = {
  marginTop: 8,
  color: 'var(--warn)',
  fontSize: 12,
  fontWeight: 800,
  lineHeight: 1.45,
}

const noteStyle = {
  marginTop: 8,
  color: 'var(--t3)',
  fontSize: 12,
  lineHeight: 1.45,
}
