import { getDisplayLabel } from '../items/getDisplayLabel.js'
import { getRelationStyle } from '../relations/relationStyles.js'
import { getAsset3dStateVisual } from './asset3dVisualPolicy.js'

export default function Asset3dLayer({
  projectedItems = [],
  selectedId,
  hoveredId = null,
  relationOverlayEnabled = false,
  relationOverlayModel = null,
  onSelectItem,
  onHoverAsset,
}) {
  const relatedRelationByItem = new Map()
  if (relationOverlayEnabled) {
    ;(relationOverlayModel?.visibleRelations || []).forEach(relation => {
      relatedRelationByItem.set(relation.relatedItemId, relation)
    })
  }

  return (
    <>
      {projectedItems.map(asset => {
        const item = asset.item
        const isSelected = item.id === selectedId
        const relatedRelation = relatedRelationByItem.get(item.id)
        const isRelated = Boolean(relatedRelation) && !isSelected
        const relationStyle = getRelationStyle(relatedRelation?.rel)
        const isHovered = item.id === hoveredId
        const visual = getAsset3dStateVisual({
          item,
          isSelected,
          isRelated,
          isHovered,
          relationStyle,
        })
        const isDimmed = selectedId && relationOverlayEnabled && !isSelected && !isRelated
        const width = isSelected ? visual.markerWidth + 9 : visual.markerWidth
        const ariaLabel = [
          getDisplayLabel(item),
          visual.category.label,
          visual.statusInfo.label,
          `z source ${asset.elevation.zSource}`,
        ].join(' · ')

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectItem?.(item)}
            onMouseEnter={() => onHoverAsset?.(asset)}
            onMouseLeave={() => onHoverAsset?.(null)}
            onFocus={() => onHoverAsset?.(asset)}
            onBlur={() => onHoverAsset?.(null)}
            title={ariaLabel}
            aria-label={ariaLabel}
            style={{
              position: 'absolute',
              left: `${asset.x}%`,
              top: `${asset.y}%`,
              width,
              minHeight: asset.height,
              padding: 0,
              border: 'none',
              background: 'transparent',
              transform: 'translate(-50%, -100%)',
              transformOrigin: '50% 100%',
              cursor: 'pointer',
              opacity: isDimmed ? 0.34 : visual.opacity,
              zIndex: isSelected ? 500 : asset.zIndex,
              transition: 'left 0.18s ease, top 0.18s ease, opacity 0.16s ease',
            }}
          >
            <span style={{
              display: 'block',
              width,
              height: asset.height,
              ...shapeStyle(visual.shape),
              background: visual.background,
              border: `2px solid ${visual.borderColor}`,
              boxShadow: visual.ring,
              position: 'relative',
              transition: 'transform 0.16s ease, box-shadow 0.16s ease',
              transform: isSelected ? 'scale(1.08)' : 'scale(1)',
            }}>
              <span style={{
                position: 'absolute',
                left: '50%',
                top: iconTop(visual.shape),
                transform: 'translateX(-50%)',
                color: '#fff',
                fontSize: isSelected ? 16 : 14,
                fontWeight: 900,
                textShadow: '0 1px 2px rgba(0,0,0,0.5)',
              }}>
                {visual.category.icon}
              </span>
              <ShapeAccent shape={visual.shape} color={visual.accentColor} />
              {visual.isDraft && <span style={draftBadgeStyle}>!</span>}
              {asset.elevation.isActualElevation && <span style={zBadgeStyle}>Z</span>}
              {isSelected && <span style={pinStyle} />}
              <span style={{
                position: 'absolute',
                left: '50%',
                bottom: -4,
                width: isSelected ? width + 18 : width + 9,
                height: 12,
                transform: 'translateX(-50%) rotateX(62deg)',
                borderRadius: '50%',
                background: isSelected ? 'rgba(74,114,255,0.38)' : `${visual.accentColor}30`,
              }} />
            </span>
            {isSelected && <span style={selectedLabelStyle}>Selected</span>}
          </button>
        )
      })}
    </>
  )
}

function shapeStyle(shape) {
  if (shape === 'map-plate') {
    return {
      borderRadius: '5px',
      transform: 'perspective(240px) rotateX(56deg)',
      transformOrigin: '50% 100%',
    }
  }
  if (shape === 'photo-card' || shape === 'media-card' || shape === 'document-sheet') {
    return {
      borderRadius: shape === 'document-sheet' ? '3px 7px 4px 4px' : 6,
    }
  }
  if (shape === 'dome-card') {
    return {
      borderRadius: '18px 18px 6px 6px',
    }
  }
  if (shape === 'tile-stack') {
    return {
      borderRadius: '6px 6px 3px 3px',
    }
  }
  if (shape === 'model-prism') {
    return {
      borderRadius: '8px 4px 5px 5px',
      transform: 'skewX(-4deg)',
    }
  }
  return {
    borderRadius: '8px 8px 4px 4px',
  }
}

function iconTop(shape) {
  if (shape === 'map-plate') return '36%'
  if (shape === 'photo-card' || shape === 'media-card' || shape === 'document-sheet') return 6
  return 7
}

function ShapeAccent({ shape, color }) {
  if (shape === 'tile-stack') {
    return (
      <>
        <span style={tileLayerStyle(color, 10)} />
        <span style={tileLayerStyle(color, 18)} />
      </>
    )
  }
  if (shape === 'scan-tower') {
    return (
      <>
        <span style={scanRingStyle(color, 30)} />
        <span style={scanRingStyle(color, 50)} />
        <span style={scanRingStyle(color, 70)} />
      </>
    )
  }
  if (shape === 'media-card') {
    return <span style={playAccentStyle}>▶</span>
  }
  if (shape === 'document-sheet') {
    return <span style={documentFoldStyle} />
  }
  return null
}

function tileLayerStyle(color, top) {
  return {
    position: 'absolute',
    left: 6,
    right: 6,
    top,
    height: 2,
    borderRadius: 2,
    background: `${color}AA`,
  }
}

function scanRingStyle(color, top) {
  return {
    position: 'absolute',
    left: '50%',
    top: `${top}%`,
    width: '72%',
    height: 4,
    transform: 'translateX(-50%) rotateX(62deg)',
    borderRadius: '50%',
    border: `1px solid ${color}AA`,
  }
}

const playAccentStyle = {
  position: 'absolute',
  right: 6,
  bottom: 5,
  color: 'rgba(255,255,255,0.9)',
  fontSize: 10,
  fontWeight: 900,
}

const documentFoldStyle = {
  position: 'absolute',
  right: -1,
  top: -1,
  width: 10,
  height: 10,
  borderLeft: '1px solid rgba(255,255,255,0.45)',
  borderBottom: '1px solid rgba(255,255,255,0.45)',
  background: 'rgba(255,255,255,0.22)',
  borderRadius: '0 6px 0 3px',
}

const draftBadgeStyle = {
  position: 'absolute',
  right: -7,
  top: -8,
  width: 17,
  height: 17,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#F0B42A',
  color: '#11151F',
  border: '2px solid rgba(12,14,20,0.82)',
  fontSize: 11,
  fontWeight: 900,
}

const zBadgeStyle = {
  position: 'absolute',
  left: -7,
  top: -8,
  width: 17,
  height: 17,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#7AA0FF',
  color: '#fff',
  border: '2px solid rgba(12,14,20,0.82)',
  fontSize: 10,
  fontWeight: 900,
}

const pinStyle = {
  position: 'absolute',
  left: '50%',
  bottom: -24,
  width: 2,
  height: 24,
  transform: 'translateX(-50%)',
  background: 'linear-gradient(180deg, rgba(122,160,255,0.9), rgba(122,160,255,0))',
}

const selectedLabelStyle = {
  position: 'absolute',
  left: '50%',
  bottom: -30,
  transform: 'translateX(-50%)',
  padding: '2px 6px',
  borderRadius: 4,
  background: 'rgba(12,14,20,0.86)',
  border: '1px solid rgba(122,160,255,0.35)',
  color: '#B8CAFF',
  fontSize: 10,
  fontWeight: 900,
  whiteSpace: 'nowrap',
}
