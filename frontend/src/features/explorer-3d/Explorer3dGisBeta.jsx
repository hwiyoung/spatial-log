import { useEffect, useMemo, useState } from 'react'
import { getCategoryInfo, getPreviewStatusInfo } from '../../constants.js'
import Explorer3dControls from '../../components/Explorer3dControls.jsx'
import Explorer3dFocusCard from '../../components/Explorer3dFocusCard.jsx'
import Explorer3dLegend from '../../components/Explorer3dLegend.jsx'
import Explorer3dTooltip from '../../components/Explorer3dTooltip.jsx'
import { mockPreviewAssets } from '../../mocks/fixtures/mockPreviewAssets.js'
import { getDisplayLabel } from '../items/getDisplayLabel.js'
import { getItemStatus, getStatusInfo } from '../items/getItemStatus.js'
import { getProjectContext } from '../items/getProjectContext.js'
import { getPreviewContract } from '../preview/getPreviewContract.js'
import { SUPPORTED_RELATIONS } from '../relations/relationStyles.js'
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
    ? getAssetSummary(selectedAsset, {
      collections,
      relationRecords,
      relationOverlayModel,
      mockMode,
    })
    : null
  const hoverSummary = hoverAsset
    ? getAssetSummary(hoverAsset, {
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

  return (
    <div style={rootStyle}>
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

function countItemRelations(item, relationRecords = []) {
  const itemId = item?.id
  if (!itemId) return 0
  const recordCount = relationRecords.filter(relation => (
    relation.sourceId === itemId || relation.targetId === itemId
  )).length
  const linkCount = (item?.links || []).filter(link => SUPPORTED_RELATIONS.includes(link.rel)).length
  return Math.max(recordCount, linkCount)
}

function getZSourceLabel(elevation) {
  if (elevation?.zSource === 'bbox-z') return 'Actual bbox Z'
  if (elevation?.zSource === 'property-elevation') return 'Actual elevation property'
  return 'Visual layer'
}

function getZDetail(elevation) {
  if (!elevation) return 'No z source'
  if (elevation.isActualElevation) {
    return `${elevation.detail}; visual lift ${Math.round(elevation.visualLift)}`
  }
  return `${elevation.detail}; category layer height ${Math.round(elevation.visualLayerHeight)}`
}

function getAssetSummary(asset, {
  collections = [],
  relationRecords = [],
  relationOverlayModel = null,
  mockMode = false,
} = {}) {
  const item = asset.item
  const dataCategory = item?.properties?.data_category || 'unknown'
  const category = getCategoryInfo(dataCategory)
  const status = getItemStatus(item)
  const statusInfo = getStatusInfo(status)
  const project = getProjectContext(item, collections)
  const previewContract = getPreviewContract(
    item,
    mockMode ? mockPreviewAssets : null,
    { isMock: mockMode },
  )
  const previewInfo = getPreviewStatusInfo(previewContract.status)
  const isSelected = item.id === relationOverlayModel?.selectedItemId
  const visibleRelationCount = isSelected ? relationOverlayModel?.visibleRelations?.length || 0 : 0
  const missingRelationCount = isSelected ? relationOverlayModel?.missingTargets?.length || 0 : 0
  const relationCount = isSelected
    ? visibleRelationCount + missingRelationCount
    : countItemRelations(item, relationRecords)

  return {
    label: getDisplayLabel(item),
    categoryIcon: category.icon,
    categoryLabel: category.label,
    categoryColor: category.color,
    statusLabel: statusInfo.label,
    statusColor: statusInfo.markerColor,
    projectName: project.projectName,
    projectSite: project.projectSite,
    previewStatusLabel: previewInfo.label,
    previewStatusColor: previewInfo.color,
    relationCount,
    visibleRelationCount,
    missingRelationCount,
    zSourceLabel: getZSourceLabel(asset.elevation),
    zDetail: getZDetail(asset.elevation),
  }
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
    radial-gradient(circle at 50% 62%, rgba(74,114,255,0.14), transparent 34%),
    radial-gradient(circle at 50% 18%, rgba(80,170,175,0.12), transparent 24%)
  `,
}

const horizonStyle = {
  position: 'absolute',
  left: 0,
  right: 0,
  top: '28%',
  height: 1,
  background: 'linear-gradient(90deg, transparent, rgba(200,206,218,0.22), transparent)',
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
  boxShadow: '0 0 42px rgba(74,114,255,0.12)',
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
