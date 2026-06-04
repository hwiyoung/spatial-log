import { getRelationStyle, SUPPORTED_RELATIONS } from '../relations/relationStyles.js'

export default function Relation3dOverlay({
  projectedItems = [],
  relationOverlayEnabled = false,
  relationOverlayModel = null,
}) {
  if (!relationOverlayEnabled) return null

  const projectedById = new Map(projectedItems.map(asset => [asset.itemId, asset]))
  const visibleRelations = relationOverlayModel?.visibleRelations || []
  const missingTargets = relationOverlayModel?.missingTargets || []
  const activeRels = new Set(visibleRelations.map(relation => relation.rel))

  return (
    <>
      <svg
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 120,
        }}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {visibleRelations.map(relation => {
          const source = projectedById.get(relation.sourceItemId)
          const target = projectedById.get(relation.targetItemId)
          if (!source || !target) return null
          const style = getRelationStyle(relation.rel)
          const x1 = source.x
          const y1 = source.y - source.height / 11
          const x2 = target.x
          const y2 = target.y - target.height / 11
          const midX = (x1 + x2) / 2
          const midY = (y1 + y2) / 2
          return (
            <g key={relation.id}>
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={style.color}
                strokeWidth={Math.max(0.35, style.lineWidth / 2)}
                strokeOpacity="0.88"
                strokeLinecap="round"
                strokeDasharray={style.dashArray ? style.dashArray.join(' ') : undefined}
              />
              <text
                x={midX}
                y={midY}
                fill="#F4F6FA"
                stroke="#11151F"
                strokeWidth="0.45"
                paintOrder="stroke"
                fontSize="2.6"
                textAnchor="middle"
                dominantBaseline="central"
                style={{ letterSpacing: 0 }}
              >
                {relation.rel}
              </text>
            </g>
          )
        })}
      </svg>
      {missingTargets.length > 0 && (
        <div style={{
          position: 'absolute',
          top: 56,
          left: 12,
          zIndex: 180,
          maxWidth: 360,
          padding: '8px 10px',
          borderRadius: 6,
          background: 'rgba(19,22,31,0.94)',
          border: '1px solid rgba(240,180,42,0.35)',
          color: 'var(--t2)',
          fontSize: 12,
        }}>
          <div style={{ color: 'var(--warn)', fontWeight: 800, marginBottom: 5 }}>
            Missing relation targets: {missingTargets.length}
          </div>
          <div style={{ fontFamily: 'monospace', overflowWrap: 'anywhere' }}>
            {missingTargets.slice(0, 3).map(target => target.relatedItemId || target.targetItemId).join(', ')}
            {missingTargets.length > 3 ? `, +${missingTargets.length - 3} more` : ''}
          </div>
        </div>
      )}
      {activeRels.size > 0 && (
        <div style={{
          position: 'absolute',
          left: 12,
          bottom: 12,
          zIndex: 180,
          padding: '8px 10px',
          borderRadius: 6,
          background: 'rgba(19,22,31,0.92)',
          border: '1px solid var(--bd)',
          color: 'var(--t2)',
          fontSize: 12,
        }}>
          <div style={{ color: 'var(--t1)', fontWeight: 800, marginBottom: 6 }}>Relation overlay</div>
          <div style={{ display: 'grid', gap: 5 }}>
            {SUPPORTED_RELATIONS.filter(rel => activeRels.has(rel)).map(rel => (
              <LegendRow key={rel} rel={rel} />
            ))}
          </div>
        </div>
      )}
    </>
  )
}

function LegendRow({ rel }) {
  const style = getRelationStyle(rel)
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
