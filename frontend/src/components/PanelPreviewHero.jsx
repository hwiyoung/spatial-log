import { getCategoryInfo, getPreviewStatusInfo } from '../constants'
import { getDisplayLabel } from '../features/items/getDisplayLabel.js'
import { getItemPreviewSummary } from '../features/items/getItemPreviewSummary.js'

export default function PanelPreviewHero({ item }) {
  const props = item?.properties || {}
  const cat = getCategoryInfo(props.data_category)
  const summary = getItemPreviewSummary(item)
  const previewInfo = getPreviewStatusInfo(summary.status)
  const label = getDisplayLabel(item)
  const hasThumbnail = summary.status === 'available' && summary.thumbnailHref

  return (
    <section style={{ marginBottom: 14 }}>
      <div style={{
        position: 'relative',
        height: 236,
        borderRadius: 8,
        border: '1px solid var(--bd)',
        background: 'var(--s2)',
        overflow: 'hidden',
      }}>
        {hasThumbnail ? (
          <img
            src={summary.thumbnailHref}
            alt={label}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            color: cat.color,
          }}>
            <div style={{ fontSize: 44, opacity: 0.42 }}>{cat.icon}</div>
            <div style={{ color: 'var(--t1)', fontSize: 15, fontWeight: 700 }}>{summary.previewLabel}</div>
            <div style={{ color: previewInfo.color, fontSize: 13, fontWeight: 700 }}>
              {summary.statusLabel}
            </div>
          </div>
        )}
        <div style={{
          position: 'absolute',
          top: 10,
          left: 10,
          padding: '3px 8px',
          borderRadius: 4,
          fontSize: 12,
          fontWeight: 700,
          color: cat.color,
          background: 'rgba(19,22,31,0.88)',
          border: `1px solid ${cat.color}40`,
        }}>
          {cat.icon} {summary.previewLabel}
        </div>
        <div style={{
          position: 'absolute',
          right: 10,
          bottom: 10,
          padding: '3px 8px',
          borderRadius: 4,
          fontSize: 12,
          fontWeight: 700,
          color: previewInfo.color,
          background: 'rgba(19,22,31,0.88)',
          border: '1px solid var(--bd)',
        }}>
          {summary.statusLabel}
        </div>
      </div>
      {summary.status === 'failed' && summary.failureReason && (
        <div style={{
          marginTop: 8,
          padding: '8px 10px',
          borderRadius: 6,
          border: '1px solid rgba(229,85,85,0.28)',
          background: 'rgba(229,85,85,0.08)',
          color: 'var(--t2)',
          fontSize: 13,
        }}>
          <b style={{ color: 'var(--err, #e55)' }}>Preview failed</b>
          <span style={{ marginLeft: 8 }}>{summary.failureReason}</span>
        </div>
      )}
    </section>
  )
}
