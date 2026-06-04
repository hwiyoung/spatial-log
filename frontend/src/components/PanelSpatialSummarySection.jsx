import { getItemSpatialSummary } from '../features/items/getItemSpatialSummary.js'

export default function PanelSpatialSummarySection({ item }) {
  const summary = getItemSpatialSummary(item)

  return (
    <section style={sectionStyle}>
      <div style={{ color: 'var(--t3)', marginBottom: 8, fontSize: 12, fontWeight: 700 }}>
        Spatial Summary
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
        <SpatialBadge summary={summary} />
        {summary.hasGeometry && <Flag label="geometry" />}
        {summary.hasBbox && <Flag label="bbox" />}
        {summary.usesFallback && <Flag label="fallback" />}
      </div>
      <MetaRow label="Marker source" value={summary.source} />
      <MetaRow label="Map position" value={formatLngLat(summary.position)} mono />
      {item?.bbox && item.bbox.length >= 4 && (
        <>
          <MetaRow label="BBox west/south" value={`${fixed(item.bbox[0])}, ${fixed(item.bbox[1])}`} mono />
          <MetaRow label="BBox east/north" value={`${fixed(item.bbox[2])}, ${fixed(item.bbox[3])}`} mono />
        </>
      )}
    </section>
  )
}

function SpatialBadge({ summary }) {
  const tone = {
    geometry: { color: 'var(--ok)', border: 'rgba(61,214,140,0.26)', bg: 'rgba(61,214,140,0.09)' },
    bbox: { color: 'var(--ac)', border: 'rgba(74,114,255,0.26)', bg: 'rgba(74,114,255,0.08)' },
    fallback: { color: 'var(--warn)', border: 'rgba(240,180,42,0.30)', bg: 'rgba(240,180,42,0.10)' },
    none: { color: 'var(--t3)', border: 'var(--bd)', bg: 'var(--s1)' },
  }[summary.source] || {}
  return (
    <span style={{
      padding: '2px 8px',
      borderRadius: 4,
      fontSize: 12,
      fontWeight: 800,
      color: tone.color,
      background: tone.bg,
      border: `1px solid ${tone.border}`,
    }}>
      {summary.label}
    </span>
  )
}

function Flag({ label }) {
  return (
    <span style={{
      padding: '2px 7px',
      borderRadius: 4,
      fontSize: 12,
      color: 'var(--t2)',
      background: 'var(--s1)',
      border: '1px solid var(--bd)',
    }}>
      {label}
    </span>
  )
}

function MetaRow({ label, value, mono = false }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '3px 0', fontSize: 13 }}>
      <span style={{ color: 'var(--t3)', flexShrink: 0 }}>{label}</span>
      <span style={{ color: 'var(--t1)', textAlign: 'right', fontFamily: mono ? 'monospace' : 'inherit' }}>
        {value || '—'}
      </span>
    </div>
  )
}

function formatLngLat(position) {
  if (!Array.isArray(position) || position.length < 2) return null
  return `${fixed(position[0])}, ${fixed(position[1])}`
}

function fixed(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number.toFixed(6) : '—'
}

const sectionStyle = {
  padding: '10px 12px',
  background: 'var(--s2)',
  borderRadius: 6,
  border: '1px solid var(--bd)',
  marginBottom: 12,
}
