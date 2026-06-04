import { RELATION_STYLES, SUPPORTED_RELATIONS } from '../features/relations/relationStyles.js'

export default function RelationLegend({ overlayModel }) {
  const activeRels = new Set((overlayModel?.visibleRelations || []).map(relation => relation.rel))
  if (activeRels.size === 0) return null

  return (
    <div style={{
      position: 'absolute',
      left: 10,
      bottom: 10,
      zIndex: 3,
      padding: '8px 10px',
      borderRadius: 6,
      background: 'rgba(19,22,31,0.92)',
      border: '1px solid var(--bd)',
      color: 'var(--t2)',
      fontSize: 12,
      minWidth: 150,
    }}>
      <div style={{ color: 'var(--t1)', fontWeight: 800, marginBottom: 6 }}>
        Relation overlay
      </div>
      <div style={{ display: 'grid', gap: 5 }}>
        {SUPPORTED_RELATIONS.filter(rel => activeRels.has(rel)).map(rel => (
          <LegendRow key={rel} rel={rel} />
        ))}
      </div>
    </div>
  )
}

function LegendRow({ rel }) {
  const style = RELATION_STYLES[rel]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <span style={{
        width: 28,
        height: 0,
        borderTop: `${style.lineWidth}px ${style.dashArray ? 'dashed' : 'solid'} ${style.color}`,
      }} />
      <span>{style.label}</span>
    </div>
  )
}
