import { useCallback, useEffect, useMemo, useState } from 'react'
import { getCategoryInfo } from '../../constants.js'
import Explorer3dControls from '../../components/Explorer3dControls.jsx'
import Explorer3dFocusCard from '../../components/Explorer3dFocusCard.jsx'
import Explorer3dLegend from '../../components/Explorer3dLegend.jsx'
import Explorer3dTooltip from '../../components/Explorer3dTooltip.jsx'
import MapGroundedThreeGisBeta from '../explorer-3d-map/MapGroundedThreeGisBeta.jsx'
import ExplorerThreeGisBeta from '../explorer-3d-three/ExplorerThreeGisBeta.jsx'
import { getAsset3dSummary } from './getAsset3dSummary.js'
import { getAsset3dItems } from './getAsset3dPosition.js'
import Asset3dLayer from './Asset3dLayer.jsx'
import Relation3dOverlay from './Relation3dOverlay.jsx'

export default function Explorer3dGisBeta({
  items = [],
  collections = [],
  selectedId,
  onSelectItem,
  relationOverlayEnabled = false,
  relationOverlayModel = null,
  relationRecords = [],
  mockMode = false,
}) {
  const [hoveredAsset, setHoveredAsset] = useState(null)
  const [sceneFocusEnabled, setSceneFocusEnabled] = useState(Boolean(selectedId))
  const [rendererMode, setRendererMode] = useState('map-grounded')

  useEffect(() => {
    setSceneFocusEnabled(Boolean(selectedId))
  }, [selectedId])

  const projectedItems = useMemo(
    () => getAsset3dItems(items, {
      selectedId,
      focusSelected: sceneFocusEnabled,
    }),
    [items, selectedId, sceneFocusEnabled],
  )
  const categoryCounts = useMemo(() => getCategoryCounts(items), [items])
  const projectedById = useMemo(
    () => new Map(projectedItems.map(asset => [asset.itemId, asset])),
    [projectedItems],
  )
  const activeRels = useMemo(
    () => new Set((relationOverlayModel?.visibleRelations || []).map(relation => relation.rel)),
    [relationOverlayModel],
  )
  const selectedAsset = selectedId ? projectedById.get(selectedId) : null
  const hoverAsset = hoveredAsset && projectedById.get(hoveredAsset.itemId)
    ? projectedById.get(hoveredAsset.itemId)
    : null
  const selectedSummary = selectedAsset
    ? getAsset3dSummary(selectedAsset, {
      collections,
      relationRecords,
      relationOverlayModel,
      mockMode,
    })
    : null
  const hoverSummary = hoverAsset
    ? getAsset3dSummary(hoverAsset, {
      collections,
      relationRecords,
      relationOverlayModel,
      mockMode,
    })
    : null

  const handleSelectItem = item => {
    setSceneFocusEnabled(true)
    onSelectItem?.(item)
  }

  const handleWebglUnavailable = useCallback(() => {
    setRendererMode('pseudo')
  }, [])

  const handleMapGroundedUnavailable = useCallback(() => {
    setRendererMode('three')
  }, [])

  const resetView = () => {
    setHoveredAsset(null)
    setSceneFocusEnabled(false)
  }

  if (!items || items.length === 0) {
    return (
      <div style={rootStyle}>
        <BetaBadge count={0} />
        <div style={emptyStyle}>
          <div style={emptyTitleStyle}>검색 결과 없음</div>
          <div style={emptyHintStyle}>검색어와 필터를 조정하면 3D GIS Beta asset map이 다시 표시됩니다.</div>
        </div>
      </div>
    )
  }

  if (rendererMode === 'three') {
    return (
      <div style={rootStyle}>
        <RendererModeSwitch rendererMode={rendererMode} onChange={setRendererMode} />
        <ExplorerThreeGisBeta
          items={items}
          collections={collections}
          selectedId={selectedId}
          onSelectItem={handleSelectItem}
          relationOverlayEnabled={relationOverlayEnabled}
          relationOverlayModel={relationOverlayModel}
          relationRecords={relationRecords}
          mockMode={mockMode}
          onWebglUnavailable={handleWebglUnavailable}
        />
      </div>
    )
  }

  if (rendererMode === 'map-grounded') {
    return (
      <div style={rootStyle}>
        <RendererModeSwitch rendererMode={rendererMode} onChange={setRendererMode} />
        <MapGroundedThreeGisBeta
          items={items}
          collections={collections}
          selectedId={selectedId}
          onSelectItem={handleSelectItem}
          relationOverlayEnabled={relationOverlayEnabled}
          relationOverlayModel={relationOverlayModel}
          relationRecords={relationRecords}
          mockMode={mockMode}
          onLayerUnavailable={handleMapGroundedUnavailable}
        />
      </div>
    )
  }

  return (
    <div style={rootStyle}>
      <RendererModeSwitch rendererMode={rendererMode} onChange={setRendererMode} />
      <BetaBadge count={items.length} />
      <Explorer3dControls
        focusSelected={sceneFocusEnabled}
        selectedLabel={selectedSummary?.label}
        relationOverlayEnabled={relationOverlayEnabled}
        onResetView={resetView}
      />
      <SceneCategoryCounts categoryCounts={categoryCounts} />
      <div style={sceneStyle}>
        <div style={depthGlowStyle} />
        <div style={horizonStyle} />
        <div style={zAxisStyle}>
          <span>visual Z</span>
        </div>
        <div style={gridStyle} />
        <div style={nearGridStyle} />
        <Relation3dOverlay
          projectedItems={projectedItems}
          relationOverlayEnabled={relationOverlayEnabled}
          relationOverlayModel={relationOverlayModel}
        />
        <Asset3dLayer
          projectedItems={projectedItems}
          selectedId={selectedId}
          hoveredId={hoverAsset?.itemId}
          relationOverlayEnabled={relationOverlayEnabled}
          relationOverlayModel={relationOverlayModel}
          onSelectItem={handleSelectItem}
          onHoverAsset={setHoveredAsset}
        />
      </div>
      <Explorer3dLegend
        activeRels={activeRels}
        relationOverlayEnabled={relationOverlayEnabled}
        missingTargets={relationOverlayModel?.missingTargets || []}
      />
      <Explorer3dFocusCard
        asset={selectedAsset}
        summary={selectedSummary}
        relationOverlayEnabled={relationOverlayEnabled}
      />
      <Explorer3dTooltip asset={hoverAsset} summary={hoverSummary} />
    </div>
  )
}

function RendererModeSwitch({ rendererMode, onChange }) {
  return (
    <div style={rendererSwitchStyle} aria-label="3D GIS renderer mode">
      <button
        type="button"
        onClick={() => onChange?.('map-grounded')}
        style={modeButtonStyle(rendererMode === 'map-grounded')}
      >
        Map-grounded 3D
      </button>
      <button
        type="button"
        onClick={() => onChange?.('three')}
        style={modeButtonStyle(rendererMode === 'three')}
      >
        True 3D constellation
      </button>
      <button
        type="button"
        onClick={() => onChange?.('pseudo')}
        style={modeButtonStyle(rendererMode === 'pseudo')}
      >
        Pseudo fallback
      </button>
    </div>
  )
}

function BetaBadge({ count }) {
  return (
    <div style={betaBadgeStyle}>
      3D GIS Beta · {count} assets
    </div>
  )
}

function SceneCategoryCounts({ categoryCounts }) {
  return (
    <div style={countRowStyle}>
      {Object.entries(categoryCounts).map(([category, count]) => {
        const cat = getCategoryInfo(category)
        return (
          <span key={category} style={{
            padding: '3px 7px',
            borderRadius: 4,
            background: 'rgba(19,22,31,0.82)',
            border: `1px solid ${cat.color}35`,
            color: cat.color,
            fontSize: 11,
            fontWeight: 900,
          }}>
            {cat.icon} {count}
          </span>
        )
      })}
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

const rendererSwitchStyle = {
  position: 'absolute',
  top: 48,
  right: 12,
  zIndex: 790,
  display: 'inline-flex',
  gap: 4,
  padding: 4,
  borderRadius: 6,
  border: '1px solid rgba(228,231,240,0.16)',
  background: 'rgba(12,14,20,0.88)',
  boxShadow: '0 12px 28px rgba(0,0,0,0.30)',
}

function modeButtonStyle(active) {
  return {
    height: 27,
    padding: '0 9px',
    borderRadius: 4,
    border: active ? '1px solid rgba(122,160,255,0.65)' : '1px solid transparent',
    background: active ? 'rgba(59,130,246,0.22)' : 'transparent',
    color: active ? '#F4F6FA' : 'var(--t3)',
    fontSize: 11,
    fontWeight: 900,
    cursor: 'pointer',
  }
}

const sceneStyle = {
  position: 'absolute',
  inset: 0,
  overflow: 'hidden',
  background: 'linear-gradient(180deg, #182030 0%, #121723 44%, #0D111A 100%)',
}

const betaBadgeStyle = {
  position: 'absolute',
  top: 48,
  left: 12,
  zIndex: 740,
  padding: '4px 10px',
  borderRadius: 4,
  background: 'rgba(19,22,31,0.92)',
  border: '1px solid rgba(80,170,175,0.38)',
  color: '#50AAAF',
  fontSize: 12,
  fontWeight: 900,
}

const countRowStyle = {
  position: 'absolute',
  top: 54,
  right: 12,
  zIndex: 710,
  display: 'flex',
  gap: 5,
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
  maxWidth: 430,
}

const depthGlowStyle = {
  position: 'absolute',
  inset: 0,
  background: `
    radial-gradient(circle at 50% 62%, rgba(59,130,246,0.14), transparent 34%),
    radial-gradient(circle at 50% 18%, rgba(80,170,175,0.12), transparent 24%)
  `,
}

const horizonStyle = {
  position: 'absolute',
  left: 0,
  right: 0,
  top: '28%',
  height: 1,
  background: 'linear-gradient(90deg, transparent, rgba(107,114,128,0.22), transparent)',
}

const zAxisStyle = {
  position: 'absolute',
  left: '7%',
  top: '22%',
  bottom: '14%',
  width: 1,
  background: 'linear-gradient(180deg, rgba(122,160,255,0.45), rgba(122,160,255,0.02))',
  color: '#9CB5FF',
  fontSize: 10,
  fontWeight: 900,
}

const gridStyle = {
  position: 'absolute',
  left: '8%',
  right: '8%',
  bottom: '-14%',
  height: '76%',
  transform: 'perspective(820px) rotateX(62deg)',
  transformOrigin: '50% 100%',
  backgroundImage: `
    linear-gradient(rgba(80,170,175,0.18) 1px, transparent 1px),
    linear-gradient(90deg, rgba(80,170,175,0.14) 1px, transparent 1px)
  `,
  backgroundSize: '46px 46px',
  borderTop: '1px solid rgba(80,170,175,0.26)',
}

const nearGridStyle = {
  position: 'absolute',
  left: '18%',
  right: '18%',
  bottom: '10%',
  height: '24%',
  transform: 'perspective(760px) rotateX(62deg)',
  transformOrigin: '50% 100%',
  border: '1px solid rgba(122,160,255,0.18)',
  borderRadius: '50%',
  boxShadow: '0 0 42px rgba(59,130,246,0.12)',
}

const emptyStyle = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  color: 'var(--t3)',
  textAlign: 'center',
  padding: 24,
}

const emptyTitleStyle = {
  color: 'var(--t1)',
  fontSize: 15,
  fontWeight: 900,
}

const emptyHintStyle = {
  color: 'var(--t3)',
  fontSize: 13,
}
