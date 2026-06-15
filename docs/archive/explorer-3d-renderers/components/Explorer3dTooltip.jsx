export default function Explorer3dTooltip({ asset, summary }) {
  if (!asset || !summary) return null

  return (
    <div
      style={{
        ...tooltipStyle,
        left: `${asset.x}%`,
        top: `${Math.max(8, asset.y - asset.height / 3)}%`,
      }}
      role="tooltip"
    >
      <div style={titleStyle}>{summary.label}</div>
      <div style={metaGridStyle}>
        <Meta label="Category" value={`${summary.categoryIcon} ${summary.categoryLabel}`} />
        <Meta label="Project" value={summary.projectName} />
        <Meta label="Status" value={summary.statusLabel} />
        <Meta label="Preview" value={summary.previewStatusLabel} />
        <Meta label="Relations" value={`${summary.relationCount} linked`} />
        <Meta label="Z source" value={summary.zSourceLabel} />
      </div>
      <div style={zDetailStyle}>{summary.zDetail}</div>
    </div>
  )
}

function Meta({ label, value }) {
  return (
    <div style={metaStyle}>
      <span style={metaLabelStyle}>{label}</span>
      <span style={metaValueStyle}>{value || '-'}</span>
    </div>
  )
}

const tooltipStyle = {
  position: 'absolute',
  zIndex: 760,
  width: 260,
  transform: 'translate(-50%, -100%)',
  padding: '10px 11px',
  borderRadius: 7,
  border: '1px solid rgba(228,231,240,0.18)',
  background: 'rgba(12,14,20,0.94)',
  boxShadow: '0 18px 38px rgba(0,0,0,0.42)',
  pointerEvents: 'none',
}

const titleStyle = {
  color: 'var(--t1)',
  fontSize: 13,
  fontWeight: 900,
  lineHeight: 1.35,
  marginBottom: 8,
}

const metaGridStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 6,
}

const metaStyle = {
  minWidth: 0,
}

const metaLabelStyle = {
  display: 'block',
  color: 'var(--t3)',
  fontSize: 10,
  fontWeight: 800,
  marginBottom: 2,
}

const metaValueStyle = {
  display: 'block',
  color: 'var(--t2)',
  fontSize: 11,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const zDetailStyle = {
  marginTop: 8,
  color: 'var(--t3)',
  fontSize: 11,
  lineHeight: 1.35,
}
