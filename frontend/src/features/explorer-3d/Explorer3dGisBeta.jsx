import { useMemo } from 'react'
import { getCategoryInfo } from '../../constants'
import { getAsset3dItems } from './getAsset3dPosition.js'
import Asset3dLayer from './Asset3dLayer.jsx'
import Relation3dOverlay from './Relation3dOverlay.jsx'

export default function Explorer3dGisBeta({
  items = [],
  selectedId,
  onSelectItem,
  relationOverlayEnabled = false,
  relationOverlayModel = null,
}) {
  const projectedItems = useMemo(() => getAsset3dItems(items), [items])
  const categoryCounts = useMemo(() => getCategoryCounts(items), [items])

  if (!items || items.length === 0) {
    return (
      <div style={rootStyle}>
        <BetaBadge />
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--t3)',
          fontSize: 14,
        }}>
          검색 결과 없음
        </div>
      </div>
    )
  }

  return (
    <div style={rootStyle}>
      <BetaBadge />
      <div style={{
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 180,
        display: 'flex',
        gap: 5,
        flexWrap: 'wrap',
        justifyContent: 'flex-end',
        maxWidth: 420,
      }}>
        {Object.entries(categoryCounts).map(([category, count]) => {
          const cat = getCategoryInfo(category)
          return (
            <span key={category} style={{
              padding: '3px 7px',
              borderRadius: 4,
              background: 'rgba(19,22,31,0.88)',
              border: `1px solid ${cat.color}35`,
              color: cat.color,
              fontSize: 12,
              fontWeight: 800,
            }}>
              {cat.icon} {count}
            </span>
          )
        })}
      </div>
      <div style={sceneStyle}>
        <div style={horizonStyle} />
        <div style={gridStyle} />
        <Relation3dOverlay
          projectedItems={projectedItems}
          relationOverlayEnabled={relationOverlayEnabled}
          relationOverlayModel={relationOverlayModel}
        />
        <Asset3dLayer
          projectedItems={projectedItems}
          selectedId={selectedId}
          relationOverlayEnabled={relationOverlayEnabled}
          relationOverlayModel={relationOverlayModel}
          onSelectItem={onSelectItem}
        />
      </div>
    </div>
  )
}

function BetaBadge() {
  return (
    <div style={{
      position: 'absolute',
      top: 48,
      left: 12,
      zIndex: 190,
      padding: '4px 10px',
      borderRadius: 4,
      background: 'rgba(19,22,31,0.92)',
      border: '1px solid rgba(80,170,175,0.38)',
      color: '#50AAAF',
      fontSize: 12,
      fontWeight: 900,
    }}>
      3D GIS Beta
    </div>
  )
}

function getCategoryCounts(items) {
  return (items || []).reduce((counts, item) => {
    const category = item.properties?.data_category || 'unknown'
    counts[category] = (counts[category] || 0) + 1
    return counts
  }, {})
}

const rootStyle = {
  position: 'relative',
  width: '100%',
  height: '100%',
  overflow: 'hidden',
  background: '#11151F',
}

const sceneStyle = {
  position: 'absolute',
  inset: 0,
  overflow: 'hidden',
  background: 'linear-gradient(180deg, #151B28 0%, #11151F 48%, #0D111A 100%)',
}

const horizonStyle = {
  position: 'absolute',
  left: 0,
  right: 0,
  top: '28%',
  height: 1,
  background: 'rgba(200,206,218,0.14)',
}

const gridStyle = {
  position: 'absolute',
  left: '8%',
  right: '8%',
  bottom: '-14%',
  height: '76%',
  transform: 'perspective(760px) rotateX(62deg)',
  transformOrigin: '50% 100%',
  backgroundImage: `
    linear-gradient(rgba(80,170,175,0.18) 1px, transparent 1px),
    linear-gradient(90deg, rgba(80,170,175,0.14) 1px, transparent 1px)
  `,
  backgroundSize: '46px 46px',
  borderTop: '1px solid rgba(80,170,175,0.24)',
}
