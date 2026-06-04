export default function ViewerPanoramaPlaceholder({ contract }) {
  return (
    <section style={sectionStyle}>
      <div style={frameStyle}>
        {contract.thumbnailUrl ? (
          <img src={contract.thumbnailUrl} alt={contract.displayLabel} style={thumbnailStyle} />
        ) : (
          <div style={placeholderStyle}>
            <div style={ringStyle} />
            <div style={placeholderTitleStyle}>Panorama shell</div>
            <div style={placeholderTextStyle}>Panorama renderer needed later.</div>
          </div>
        )}
      </div>
      <div style={copyStyle}>
        <div style={copyTitleStyle}>Panorama viewer deferred</div>
        <div style={copyBodyStyle}>
          This shell validates panorama action UX only. Renderer choice and equirectangular metadata checks move to a later phase.
        </div>
      </div>
    </section>
  )
}

const sectionStyle = { display: 'grid', gap: 10 }

const frameStyle = {
  minHeight: 360,
  borderRadius: 8,
  border: '1px solid var(--bd)',
  background: 'linear-gradient(145deg, rgba(232,120,48,0.14), rgba(19,22,31,0.24))',
  overflow: 'hidden',
}

const thumbnailStyle = {
  width: '100%',
  height: 360,
  objectFit: 'cover',
  display: 'block',
}

const placeholderStyle = {
  minHeight: 360,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
}

const ringStyle = {
  width: 136,
  height: 64,
  borderRadius: '50%',
  border: '2px solid rgba(232,120,48,0.46)',
  boxShadow: '0 0 0 16px rgba(232,120,48,0.06)',
}

const placeholderTitleStyle = {
  color: 'var(--t1)',
  fontSize: 18,
  fontWeight: 900,
}

const placeholderTextStyle = {
  color: 'var(--t3)',
  fontSize: 13,
  fontWeight: 800,
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
