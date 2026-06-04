export default function ViewerModelPlaceholder({ contract }) {
  return (
    <section style={sectionStyle}>
      <div style={frameStyle}>
        {contract.thumbnailUrl ? (
          <img src={contract.thumbnailUrl} alt={contract.displayLabel} style={thumbnailStyle} />
        ) : (
          <div style={placeholderStyle}>
            <div style={modelShapeStyle} />
            <div style={placeholderTitleStyle}>3D model shell</div>
            <div style={placeholderTextStyle}>Screenshot or placeholder only.</div>
          </div>
        )}
      </div>
      <div style={copyStyle}>
        <div style={copyTitleStyle}>Model viewer deferred</div>
        <div style={copyBodyStyle}>
          The shell does not load model-viewer or render GLTF/OBJ assets. Format conversion and model viewer choice remain later ADR work.
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
  background: 'linear-gradient(145deg, rgba(106,175,80,0.12), rgba(19,22,31,0.24))',
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

const modelShapeStyle = {
  width: 120,
  height: 120,
  borderRadius: 8,
  border: '2px solid rgba(106,175,80,0.45)',
  transform: 'rotateX(58deg) rotateZ(45deg)',
  background: 'rgba(106,175,80,0.12)',
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
