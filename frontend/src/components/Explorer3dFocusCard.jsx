export default function Explorer3dFocusCard({ asset, summary, relationOverlayEnabled }) {
  if (!asset || !summary) return null

  return (
    <div style={cardStyle}>
      <div style={eyebrowStyle}>Selected asset focus</div>
      <div style={titleStyle}>{summary.label}</div>
      <div style={chipRowStyle}>
        <Chip value={`${summary.categoryIcon} ${summary.categoryLabel}`} color={summary.categoryColor} />
        <Chip value={summary.statusLabel} color={summary.statusColor} />
        <Chip value={summary.previewStatusLabel} color={summary.previewStatusColor} />
      </div>
      <div style={gridStyle}>
        <Meta label="Project" value={summary.projectName} />
        <Meta label="Site" value={summary.projectSite} />
        <Meta label="Relations" value={`${summary.relationCount} total`} />
        <Meta label="Visible" value={`${summary.visibleRelationCount} shown`} />
        <Meta label="Missing" value={`${summary.missingRelationCount} warning`} />
        <Meta label="Z source" value={summary.zSourceLabel} />
      </div>
      <div style={noteStyle}>
        {relationOverlayEnabled
          ? '선택 항목의 1-depth 관계만 표시 중'
          : 'Context Panel에서 선택 항목 관계 보기를 켤 수 있습니다'}
      </div>
    </div>
  )
}

function Chip({ value, color }) {
  return (
    <span style={{
      padding: '3px 7px',
      borderRadius: 4,
      border: `1px solid ${color || 'rgba(228,231,240,0.18)'}55`,
      color: color || 'var(--t2)',
      background: 'rgba(12,14,20,0.34)',
      fontSize: 11,
      fontWeight: 900,
    }}>
      {value}
    </span>
  )
}

function Meta({ label, value }) {
  return (
    <div>
      <span style={metaLabelStyle}>{label}</span>
      <span style={metaValueStyle}>{value || '-'}</span>
    </div>
  )
}

const cardStyle = {
  position: 'absolute',
  top: 82,
  left: 12,
  zIndex: 730,
  width: 320,
  padding: '12px 13px',
  borderRadius: 7,
  border: '1px solid rgba(59,130,246,0.35)',
  background: 'rgba(12,14,20,0.92)',
  boxShadow: '0 18px 36px rgba(0,0,0,0.36)',
}

const eyebrowStyle = {
  color: '#7AA0FF',
  fontSize: 11,
  fontWeight: 900,
  textTransform: 'uppercase',
  letterSpacing: 0,
}

const titleStyle = {
  marginTop: 4,
  color: 'var(--t1)',
  fontSize: 14,
  fontWeight: 900,
  lineHeight: 1.35,
}

const chipRowStyle = {
  display: 'flex',
  gap: 5,
  flexWrap: 'wrap',
  marginTop: 8,
}

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 7,
  marginTop: 10,
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

const noteStyle = {
  marginTop: 10,
  color: 'var(--t3)',
  fontSize: 11,
  lineHeight: 1.35,
}
