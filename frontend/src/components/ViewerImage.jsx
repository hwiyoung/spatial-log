export default function ViewerImage({ contract, label = 'Image shell' }) {
  const hasThumbnail = Boolean(contract.thumbnailUrl)

  return (
    <section style={sectionStyle}>
      <div style={mediaFrameStyle}>
        {hasThumbnail ? (
          <img
            src={contract.thumbnailUrl}
            alt={contract.displayLabel}
            style={imageStyle}
          />
        ) : (
          <ImagePlaceholder label={label} contract={contract} />
        )}
      </div>
      <ShellCopy
        title={hasThumbnail ? label : 'Image placeholder'}
        body={hasThumbnail
          ? 'Thumbnail asset is rendered as a large image-style shell.'
          : 'No thumbnail is available. The shell keeps the image viewer entry visible without launching a production viewer.'}
      />
    </section>
  )
}

function ImagePlaceholder({ label, contract }) {
  return (
    <div style={placeholderStyle}>
      <div style={placeholderTitleStyle}>{label}</div>
      <div style={placeholderTextStyle}>{contract.placeholderLabel}</div>
    </div>
  )
}

function ShellCopy({ title, body }) {
  return (
    <div style={copyStyle}>
      <div style={copyTitleStyle}>{title}</div>
      <div style={copyBodyStyle}>{body}</div>
    </div>
  )
}

const sectionStyle = { display: 'grid', gap: 10 }

const mediaFrameStyle = {
  minHeight: 360,
  borderRadius: 8,
  overflow: 'hidden',
  border: '1px solid var(--bd)',
  background: 'var(--s2)',
}

const imageStyle = {
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
  gap: 8,
  background: 'linear-gradient(145deg, rgba(74,114,255,0.12), rgba(19,22,31,0.22))',
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
