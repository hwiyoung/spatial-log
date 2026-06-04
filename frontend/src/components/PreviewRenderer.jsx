import { getCategoryInfo } from '../constants'
import PreviewStatusBadge from './PreviewStatusBadge'

export default function PreviewRenderer({ contract }) {
  if (!contract) return null

  const cat = getCategoryInfo(contract.dataCategory)
  const hasImageCard = contract.status === 'available'
    && contract.thumbnailUrl
    && ['image', 'thumbnail', 'document', 'video', 'panorama'].includes(contract.viewerType)
  const tone = getStatusTone(contract.status)

  return (
    <section style={{ marginBottom: 14 }}>
      <div style={{
        position: 'relative',
        height: 246,
        borderRadius: 8,
        border: `1px solid ${tone.border}`,
        background: tone.background,
        overflow: 'hidden',
      }}>
        {hasImageCard ? (
          <img
            src={contract.thumbnailUrl}
            alt={contract.displayLabel}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <PreviewPlaceholder contract={contract} color={cat.color} icon={cat.icon} />
        )}
        <div style={{
          position: 'absolute',
          top: 10,
          left: 10,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          alignItems: 'center',
        }}>
          <span style={{
            padding: '3px 8px',
            borderRadius: 4,
            fontSize: 12,
            fontWeight: 800,
            color: cat.color,
            background: 'rgba(19,22,31,0.88)',
            border: `1px solid ${cat.color}40`,
          }}>
            {cat.icon} {contract.title}
          </span>
          <PreviewStatusBadge status={contract.status} />
        </div>
        <div style={{
          position: 'absolute',
          right: 10,
          bottom: 10,
          padding: '3px 8px',
          borderRadius: 4,
          fontSize: 12,
          fontWeight: 800,
          color: tone.color,
          background: 'rgba(19,22,31,0.88)',
          border: '1px solid var(--bd)',
        }}>
          {contract.viewerType}
        </div>
      </div>
      <div style={{
        marginTop: 8,
        display: 'grid',
        gap: 6,
        padding: '8px 10px',
        borderRadius: 6,
        background: 'var(--s2)',
        border: '1px solid var(--bd)',
      }}>
        <div style={{ color: 'var(--t1)', fontSize: 13, fontWeight: 800 }}>
          {contract.placeholderLabel}
        </div>
        <div style={{ color: 'var(--t3)', fontSize: 12 }}>
          {contract.description}
        </div>
        {contract.status === 'failed' && contract.failureReason && (
          <div style={{
            padding: '7px 9px',
            borderRadius: 5,
            color: 'var(--err, #e55)',
            background: 'rgba(229,85,85,0.08)',
            border: '1px solid rgba(229,85,85,0.26)',
            fontSize: 12,
            fontWeight: 700,
          }}>
            {contract.failureReason}
          </div>
        )}
        {contract.status === 'pending' && (
          <div style={{ color: 'var(--warn)', fontSize: 12, fontWeight: 700 }}>
            Preview generation or conversion is pending.
          </div>
        )}
        {contract.status === 'missing' && (
          <div style={{ color: 'var(--t3)', fontSize: 12, fontWeight: 700 }}>
            Preview asset is missing or conversion has not started.
          </div>
        )}
      </div>
    </section>
  )
}

function PreviewPlaceholder({ contract, color, icon }) {
  const details = {
    pointcloud_placeholder: 'Viewer-needed placeholder',
    tileset_placeholder: '3D Tiles placeholder',
    model_screenshot: 'Model screenshot contract',
    panorama: 'Panorama placeholder',
    video: 'Video poster placeholder',
    document: 'Document preview placeholder',
    image: 'Image preview card',
    thumbnail: 'Thumbnail contract',
    unsupported: 'Unsupported preview',
  }

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      color,
      background: `linear-gradient(145deg, ${color}10 0%, rgba(19,22,31,0.12) 100%)`,
    }}>
      <div style={{ fontSize: 46, opacity: 0.46 }}>{icon}</div>
      <div style={{ color: 'var(--t1)', fontSize: 16, fontWeight: 800 }}>
        {contract.placeholderLabel}
      </div>
      <div style={{ color: 'var(--t3)', fontSize: 12, fontWeight: 700 }}>
        {details[contract.viewerType] || details.unsupported}
      </div>
    </div>
  )
}

function getStatusTone(status) {
  if (status === 'available') {
    return { color: 'var(--ok)', border: 'rgba(61,214,140,0.28)', background: 'var(--s2)' }
  }
  if (status === 'pending') {
    return { color: 'var(--warn)', border: 'rgba(240,180,42,0.30)', background: 'rgba(240,180,42,0.06)' }
  }
  if (status === 'failed') {
    return { color: 'var(--err, #e55)', border: 'rgba(229,85,85,0.30)', background: 'rgba(229,85,85,0.06)' }
  }
  return { color: 'var(--t3)', border: 'var(--bd)', background: 'var(--s2)' }
}
