export default function ViewerPointCloudPlaceholder({ contract }) {
  return (
    <section style={sectionStyle}>
      <div style={frameStyle}>
        {contract.thumbnailUrl ? (
          <img src={contract.thumbnailUrl} alt={contract.displayLabel} style={thumbnailStyle} />
        ) : (
          <div style={placeholderStyle}>
            <PointDots />
            <div style={placeholderTitleStyle}>Point cloud shell</div>
            <div style={placeholderTextStyle}>Conversion and viewer integration needed.</div>
          </div>
        )}
      </div>
      <div style={copyStyle}>
        <div style={copyTitleStyle}>Point cloud viewer deferred</div>
        <div style={copyBodyStyle}>
          This shell does not load Potree or point cloud workers. It verifies lightweight preview, conversion-needed, and viewer-needed states.
        </div>
      </div>
    </section>
  )
}

function PointDots() {
  return (
    <div style={dotsStyle}>
      {Array.from({ length: 20 }).map((_, index) => (
        <span
          key={index}
          style={{
            position: 'absolute',
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: 'rgba(224,85,85,0.72)',
            left: `${12 + ((index * 31) % 170)}px`,
            top: `${12 + ((index * 47) % 116)}px`,
          }}
        />
      ))}
    </div>
  )
}

const sectionStyle = { display: 'grid', gap: 10 }

const frameStyle = {
  minHeight: 360,
  borderRadius: 8,
  border: '1px solid var(--bd)',
  background: 'linear-gradient(145deg, rgba(224,85,85,0.12), rgba(19,22,31,0.24))',
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

const dotsStyle = {
  position: 'relative',
  width: 210,
  height: 150,
  borderRadius: 8,
  border: '1px solid rgba(224,85,85,0.34)',
  background: 'rgba(224,85,85,0.05)',
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
