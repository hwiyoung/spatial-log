import { getCategoryInfo } from '../../constants'
import { getDisplayLabel } from '../items/getDisplayLabel.js'
import { getItemStatus, getStatusInfo } from '../items/getItemStatus.js'
import { getItemVisibilityFlags } from '../items/getItemVisibilityFlags.js'
import { getRelationStyle } from '../relations/relationStyles.js'

export default function Asset3dLayer({
  projectedItems = [],
  selectedId,
  relationOverlayEnabled = false,
  relationOverlayModel = null,
  onSelectItem,
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
        const props = item.properties || {}
        const cat = getCategoryInfo(props.data_category)
        const status = getItemStatus(item)
        const statusInfo = getStatusInfo(status)
        const flags = getItemVisibilityFlags(item)
        const isSelected = item.id === selectedId
        const relatedRelation = relatedRelationByItem.get(item.id)
        const isRelated = Boolean(relatedRelation) && !isSelected
        const relationStyle = getRelationStyle(relatedRelation?.rel)
        const borderColor = isRelated ? relationStyle.markerColor : (flags.isPublished ? cat.color : statusInfo.markerColor)

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectItem?.(item)}
            title={`${getDisplayLabel(item)} · ${statusInfo.label}`}
            style={{
              position: 'absolute',
              left: `${asset.x}%`,
              top: `${asset.y}%`,
              width: isSelected ? 38 : 32,
              minHeight: asset.height,
              padding: 0,
              border: 'none',
              background: 'transparent',
              transform: 'translate(-50%, -100%)',
              transformOrigin: '50% 100%',
              cursor: 'pointer',
              zIndex: isSelected ? 500 : asset.zIndex,
            }}
          >
            <span style={{
              display: 'block',
              width: isSelected ? 38 : 32,
              height: asset.height,
              borderRadius: '7px 7px 4px 4px',
              background: `linear-gradient(180deg, ${cat.color}E6 0%, ${cat.color}7A 100%)`,
              border: `2px solid ${borderColor}`,
              boxShadow: isSelected
                ? `0 0 0 5px rgba(74,114,255,0.24), 0 12px 28px rgba(0,0,0,0.42)`
                : (isRelated
                  ? `0 0 0 4px ${relationStyle.color}44, 0 8px 18px rgba(0,0,0,0.36)`
                  : '0 7px 14px rgba(0,0,0,0.30)'),
              position: 'relative',
            }}>
              <span style={{
                position: 'absolute',
                left: '50%',
                top: 6,
                transform: 'translateX(-50%)',
                color: '#fff',
                fontSize: 14,
                fontWeight: 900,
                textShadow: '0 1px 2px rgba(0,0,0,0.5)',
              }}>
                {cat.icon}
              </span>
              <span style={{
                position: 'absolute',
                left: '50%',
                bottom: -4,
                width: isSelected ? 48 : 40,
                height: 12,
                transform: 'translateX(-50%) rotateX(62deg)',
                borderRadius: '50%',
                background: isSelected ? 'rgba(74,114,255,0.35)' : `${borderColor}33`,
              }} />
            </span>
          </button>
        )
      })}
    </>
  )
}
