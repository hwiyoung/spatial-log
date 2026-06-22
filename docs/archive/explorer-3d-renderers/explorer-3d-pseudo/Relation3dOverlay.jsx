import { getRelationStyle } from '../relations/relationStyles.js'

export default function Relation3dOverlay({
  projectedItems = [],
  relationOverlayEnabled = false,
  relationOverlayModel = null,
}) {
  if (!relationOverlayEnabled) return null

  const projectedById = new Map(projectedItems.map(asset => [asset.itemId, asset]))
  const visibleRelations = relationOverlayModel?.visibleRelations || []

  if (visibleRelations.length === 0) return null

  return (
    <svg
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 120,
        filter: 'drop-shadow(0 8px 12px rgba(0,0,0,0.28))',
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
        const directionLabel = relation.direction === 'inbound' ? 'inbound' : 'outbound'

        return (
          <g key={relation.id}>
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="rgba(244,246,250,0.35)"
              strokeWidth={Math.max(0.65, style.lineWidth / 1.2)}
              strokeLinecap="round"
            />
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={style.color}
              strokeWidth={Math.max(0.45, style.lineWidth / 1.45)}
              strokeOpacity="0.95"
              strokeLinecap="round"
              strokeDasharray={style.dashArray ? style.dashArray.join(' ') : undefined}
            />
            <circle cx={x1} cy={y1} r="0.75" fill="#F4F6FA" stroke={style.color} strokeWidth="0.28" />
            <circle cx={x2} cy={y2} r="0.9" fill={style.color} stroke="#F4F6FA" strokeWidth="0.24" />
            <text
              x={midX}
              y={midY - 1.25}
              fill="#F4F6FA"
              stroke="#11151F"
              strokeWidth="0.5"
              paintOrder="stroke"
              fontSize="2.35"
              textAnchor="middle"
              dominantBaseline="central"
              style={{ letterSpacing: 0 }}
            >
              {style.label}
            </text>
            <text
              x={midX}
              y={midY + 1.45}
              fill={style.color}
              stroke="#11151F"
              strokeWidth="0.45"
              paintOrder="stroke"
              fontSize="2.05"
              textAnchor="middle"
              dominantBaseline="central"
              style={{ letterSpacing: 0 }}
            >
              {directionLabel}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
