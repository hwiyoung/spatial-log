export default function ViewerDocumentPlaceholder({ contract }) {
  return (
    <section style={sectionStyle}>
      <div style={documentFrameStyle}>
        {contract.thumbnailUrl ? (
          <img src={contract.thumbnailUrl} alt={contract.displayLabel} style={thumbnailStyle} />
        ) : (
          <div style={pageStackStyle}>
            <div style={pageStyle} />
            <div style={{ ...pageStyle, transform: 'translate(12px, 12px)' }} />
            <div style={pageTextStyle}>Document placeholder</div>
          </div>
        )}
      </div>
      <div style={copyStyle}>
        <div style={copyTitleStyle}>Document viewer deferred</div>
        <div style={copyBodyStyle}>
          This shell reserves the document/PDF action path. PDF.js and iframe production policy remain ADR candidates.
        </div>
      </div>
    </section>
  )
}

const sectionStyle = { display: 'grid', gap: 10 }

const documentFrameStyle = {
  minHeight: 360,
  borderRadius: 8,
  border: '1px solid var(--bd)',
  background: 'linear-gradient(145deg, rgba(136,153,170,0.10), rgba(19,22,31,0.22))',
  overflow: 'hidden',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const thumbnailStyle = {
  width: '100%',
  height: 360,
  objectFit: 'cover',
  display: 'block',
}

const pageStackStyle = {
  position: 'relative',
  width: 220,
  height: 250,
}

const pageStyle = {
  position: 'absolute',
  inset: 0,
  borderRadius: 6,
  border: '1px solid rgba(228,231,240,0.16)',
  background: 'rgba(228,231,240,0.08)',
}

const pageTextStyle = {
  position: 'absolute',
  left: 24,
  right: 24,
  top: 108,
  color: 'var(--t1)',
  fontSize: 16,
  fontWeight: 900,
  textAlign: 'center',
}

const copyStyle = {
  padding: '9px 10px',
  borderRadius: 6,
  border: '1px solid var(--bd)',
  background: 'var(--s2)',
}

const copyTitleStyle = {
  color: 'var(--t1)',
  fontSize: 13,
  fontWeight: 900,
  marginBottom: 4,
}

const copyBodyStyle = {
  color: 'var(--t3)',
  fontSize: 12,
  lineHeight: 1.45,
}
