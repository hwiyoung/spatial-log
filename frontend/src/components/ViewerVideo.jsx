function isPlayableVideoUrl(url) {
  return /^(https?:|blob:|data:video)/.test(String(url || ''))
}

export default function ViewerVideo({ contract }) {
  const playableUrl = isPlayableVideoUrl(contract.previewHref) ? contract.previewHref : null

  return (
    <section style={sectionStyle}>
      <div style={mediaFrameStyle}>
        {playableUrl ? (
          <video
            src={playableUrl}
            poster={contract.thumbnailUrl || undefined}
            controls
            preload="metadata"
            style={videoStyle}
          />
        ) : contract.thumbnailUrl ? (
          <div style={posterStyle}>
            <img src={contract.thumbnailUrl} alt={contract.displayLabel} style={posterImageStyle} />
            <span style={posterBadgeStyle}>Video poster shell</span>
          </div>
        ) : (
          <div style={placeholderStyle}>
            <div style={placeholderTitleStyle}>Video shell</div>
            <div style={placeholderTextStyle}>Playable mock URL is not available.</div>
          </div>
        )}
      </div>
      <div style={copyStyle}>
        <div style={copyTitleStyle}>{playableUrl ? 'Native mock player' : 'Video placeholder'}</div>
        <div style={copyBodyStyle}>
          HTML video is only used for playable mock/local URLs. Autoplay is disabled and production video integration is deferred.
        </div>
      </div>
    </section>
  )
}

const sectionStyle = { display: 'grid', gap: 10 }

const mediaFrameStyle = {
  minHeight: 320,
  borderRadius: 8,
  overflow: 'hidden',
  border: '1px solid var(--bd)',
  background: '#080A0F',
}

const videoStyle = {
  width: '100%',
  height: 360,
  display: 'block',
  background: '#000',
}

const posterStyle = {
  position: 'relative',
  minHeight: 360,
}

const posterImageStyle = {
  width: '100%',
  height: 360,
  objectFit: 'cover',
  display: 'block',
  opacity: 0.82,
}

const posterBadgeStyle = {
  position: 'absolute',
  left: 12,
  bottom: 12,
  padding: '4px 9px',
  borderRadius: 4,
  color: '#fff',
  background: 'rgba(0,0,0,0.58)',
  border: '1px solid rgba(255,255,255,0.18)',
  fontSize: 12,
  fontWeight: 900,
}

const placeholderStyle = {
  minHeight: 360,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
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
