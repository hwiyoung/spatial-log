export default function ViewerTilesetPlaceholder({ contract }) {
  return (
    <section style={sectionStyle}>
      <div style={frameStyle}>
        {contract.thumbnailUrl ? (
          <img src={contract.thumbnailUrl} alt={contract.displayLabel} style={thumbnailStyle} />
        ) : (
          <div style={placeholderStyle}>
            <div style={tileGridStyle}>
              {Array.from({ length: 9 }).map((_, index) => (
                <span key={index} style={tileStyle} />
              ))}
            </div>
            <div style={placeholderTitleStyle}>3D Tiles shell</div>
            <div style={placeholderTextStyle}>Tileset renderer needed later.</div>
          </div>
        )}
      </div>
      <div style={copyStyle}>
        <div style={copyTitleStyle}>3D Tiles viewer deferred</div>
        <div style={copyBodyStyle}>
          This shell does not load Cesium or a production 3D Tiles renderer. Tileset URL, offline, and renderer decisions remain later ADR work.
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
  background: 'linear-gradient(145deg, rgba(80,170,175,0.13), rgba(19,22,31,0.24))',
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

const tileGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 48px)',
  gap: 7,
  transform: 'perspective(360px) rotateX(54deg) rotateZ(-8deg)',
}

const tileStyle = {
  width: 48,
  height: 48,
  borderRadius: 4,
  border: '1px solid rgba(80,170,175,0.42)',
  background: 'rgba(80,170,175,0.12)',
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
