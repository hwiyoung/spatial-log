import { formatSize, getCategoryInfo } from '../constants'
import { getDisplayLabel, getOriginalFilename } from '../features/items/getDisplayLabel.js'

export default function PanelIdentitySection({ item }) {
  const props = item?.properties || {}
  const cat = getCategoryInfo(props.data_category)
  const label = getDisplayLabel(item)
  const originalFilename = getOriginalFilename(item)

  return (
    <PanelSection title="Identity">
      <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--t1)', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
        <Tag label={`${cat.icon} ${cat.label}`} color={cat.color} />
        {props.previewType && <Tag label={props.previewType} />}
        {props.datetime && <Tag label={props.datetime.slice(0, 10)} />}
      </div>
      <MetaRow label="Item ID" value={item?.id} mono />
      <MetaRow label="Original filename" value={originalFilename} mono />
      <MetaRow label="File size" value={formatSize(props['file:size'])} />
      {props['pc:count'] && <MetaRow label="Point count" value={Number(props['pc:count']).toLocaleString()} />}
      {props['image:image_count'] && <MetaRow label="Image count" value={`${props['image:image_count']}장`} />}
      {props['image:camera_model'] && <MetaRow label="Camera" value={props['image:camera_model']} />}
      {props['video:duration'] && <MetaRow label="Video duration" value={`${props['video:duration']}s`} />}
      {props['proj:epsg'] && <MetaRow label="CRS" value={`EPSG:${props['proj:epsg']}`} />}
    </PanelSection>
  )
}

function PanelSection({ title, children }) {
  return (
    <section style={sectionStyle}>
      <SectionTitle>{title}</SectionTitle>
      {children}
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

function Tag({ label, color }) {
  return (
    <span style={{
      padding: '2px 8px',
      borderRadius: 4,
      fontSize: 12,
      color: color || 'var(--t2)',
      background: color ? `${color}12` : 'var(--s1)',
      border: `1px solid ${color ? `${color}35` : 'var(--bd)'}`,
    }}>
      {label}
    </span>
  )
}

function MetaRow({ label, value, mono = false }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '3px 0', fontSize: 13 }}>
      <span style={{ color: 'var(--t3)', flexShrink: 0 }}>{label}</span>
      <span style={{
        color: 'var(--t1)',
        textAlign: 'right',
        fontFamily: mono ? 'monospace' : 'inherit',
        overflowWrap: 'anywhere',
      }}>
        {value || '—'}
      </span>
    </div>
  )
}

const sectionStyle = {
  padding: '10px 12px',
  background: 'var(--s2)',
  borderRadius: 6,
  border: '1px solid var(--bd)',
  marginBottom: 12,
}
