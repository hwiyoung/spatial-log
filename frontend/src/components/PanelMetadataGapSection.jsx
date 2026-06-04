import { getItemStatus } from '../features/items/getItemStatus.js'

export default function PanelMetadataGapSection({ item }) {
  const props = item?.properties || {}
  const status = getItemStatus(item)
  const isDraft = status === 'draft'
  const missingRequiredFields = props.missingRequiredFields || []
  const metadataGaps = props.metadataGaps || []
  const hasDraftReason = Boolean(props.draftReason)
  const hasPreviewFailure = Boolean(props.previewFailureReason)
  const hasIssues = hasDraftReason || hasPreviewFailure || missingRequiredFields.length > 0 || metadataGaps.length > 0

  if (!hasIssues) {
    return (
      <section style={sectionStyle}>
        <SectionTitle>Metadata Quality</SectionTitle>
        <div style={{ color: 'var(--t2)', fontSize: 13 }}>No metadata gaps flagged.</div>
      </section>
    )
  }

  return (
    <section style={{
      ...sectionStyle,
      borderColor: isDraft ? 'rgba(240,180,42,0.35)' : 'var(--bd)',
      background: isDraft ? 'rgba(240,180,42,0.07)' : 'var(--s2)',
    }}>
      <SectionTitle>Metadata Quality</SectionTitle>
      {hasDraftReason && (
        <div style={{
          padding: '8px 10px',
          borderRadius: 6,
          background: 'rgba(240,180,42,0.12)',
          border: '1px solid rgba(240,180,42,0.28)',
          marginBottom: 9,
        }}>
          <div style={{ color: 'var(--warn)', fontSize: 12, fontWeight: 800, marginBottom: 3 }}>
            Draft reason
          </div>
          <div style={{ color: 'var(--t1)', fontSize: 13 }}>{props.draftReason}</div>
        </div>
      )}
      {hasPreviewFailure && (
        <Notice label="Preview failure" value={props.previewFailureReason} tone="error" />
      )}
      {missingRequiredFields.length > 0 && (
        <div style={{ marginBottom: 9 }}>
          <div style={{ color: 'var(--t3)', fontSize: 12, fontWeight: 700, marginBottom: 5 }}>
            Missing required fields
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {missingRequiredFields.map(field => (
              <Chip key={field} label={field} />
            ))}
          </div>
        </div>
      )}
      {metadataGaps.length > 0 && (
        <div>
          <div style={{ color: 'var(--t3)', fontSize: 12, fontWeight: 700, marginBottom: 5 }}>
            Metadata gaps
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--t2)', fontSize: 13 }}>
            {metadataGaps.map(gap => (
              <li key={gap} style={{ marginBottom: 3 }}>{gap}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

function SectionTitle({ children }) {
  return (
    <div style={{ color: 'var(--t3)', marginBottom: 8, fontSize: 12, fontWeight: 700 }}>
      {children}
    </div>
  )
}

function Notice({ label, value, tone }) {
  const color = tone === 'error' ? 'var(--err, #e55)' : 'var(--warn)'
  return (
    <div style={{ padding: '3px 0 8px', fontSize: 13 }}>
      <span style={{ color, fontWeight: 700, marginRight: 8 }}>{label}</span>
      <span style={{ color: 'var(--t2)' }}>{value}</span>
    </div>
  )
}

function Chip({ label }) {
  return (
    <span style={{
      padding: '2px 7px',
      borderRadius: 4,
      fontSize: 12,
      fontFamily: 'monospace',
      color: 'var(--warn)',
      background: 'rgba(240,180,42,0.10)',
      border: '1px solid rgba(240,180,42,0.24)',
    }}>
      {label}
    </span>
  )
}

const sectionStyle = {
  padding: '10px 12px',
  background: 'var(--s2)',
  borderRadius: 6,
  border: '1px solid var(--bd)',
  marginBottom: 12,
}
