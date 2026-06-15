import { getDisplayLabel } from '../items/getDisplayLabel.js'
import { getItemStatus, getStatusInfo } from '../items/getItemStatus.js'
import { getItemMapPosition } from '../explorer-map/getItemMapPosition.js'
import { getAsset3dElevation } from '../explorer-3d/getAsset3dElevation.js'
import { getRelationStyle } from '../relations/relationStyles.js'
import { getDeckCategoryIcon } from './deckCategoryIcons.js'

const GHOST_REL_OFFSET_DEG = 0.0024
const BASE_TEXT_LIMIT = 46

function hexToRgb(hex, fallback = [148, 163, 184]) {
  const value = String(hex || '').trim().replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return fallback
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ]
}

function withAlpha(rgb, alpha = 255) {
  return [rgb[0], rgb[1], rgb[2], alpha]
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function getNodeElevation(item) {
  const elevation = getAsset3dElevation(item)
  if (elevation.isActualElevation && Number.isFinite(elevation.zValue)) {
    return clamp(elevation.zValue, -30, 180)
  }
  return clamp(elevation.visualLayerHeight || 0, 0, 96)
}

function offsetGhostPosition(anchor, index) {
  const ring = Math.floor(index / 6) + 1
  const angle = ((index % 6) / 6) * Math.PI * 2 - Math.PI / 2
  const offset = GHOST_REL_OFFSET_DEG * ring
  return [
    anchor[0] + Math.cos(angle) * offset,
    anchor[1] + Math.sin(angle) * offset,
    Math.max(anchor[2] || 0, 18) + 8,
  ]
}

function makeNode({
  fallbackCenters,
  hoveredId,
  item,
  relationOverlayEnabled,
  relatedIds,
  selectedId,
}) {
  const mapPosition = getItemMapPosition(item, fallbackCenters)
  if (!mapPosition?.position) return null

  const status = getItemStatus(item)
  const statusInfo = getStatusInfo(status)
  const statusRgb = hexToRgb(statusInfo.markerColor)
  const id = item.id
  const isSelected = id === selectedId
  const isRelated = relatedIds.has(id) && !isSelected
  const isHovered = id === hoveredId && !isSelected
  const isDimmed = Boolean(selectedId && relationOverlayEnabled && !isSelected && !isRelated && !isHovered)
  const dataCategory = item.properties?.data_category || 'unknown'
  const z = getNodeElevation(item)

  return {
    id,
    item,
    itemId: id,
    dataCategory,
    icon: getDeckCategoryIcon(dataCategory),
    label: getDisplayLabel(item),
    position: [mapPosition.position[0], mapPosition.position[1], z],
    source: mapPosition.source,
    status,
    statusInfo,
    statusRgb,
    fillColor: withAlpha(statusRgb, isDimmed ? 34 : status === 'archived' ? 70 : 118),
    lineColor: withAlpha(statusRgb, isDimmed ? 76 : 245),
    iconColor: isDimmed ? [180, 190, 204, 70] : [219, 226, 236, 232],
    textColor: isDimmed ? [188, 198, 210, 82] : [230, 236, 244, 235],
    radius: isSelected ? 14 : isHovered ? 13 : isRelated ? 12 : 10,
    lineWidth: isSelected ? 2.4 : isHovered ? 2 : 1.55,
    haloRadius: isSelected ? 22 : isHovered ? 18 : isRelated ? 16 : 0,
    haloColor: isSelected
      ? [59, 130, 246, 70]
      : isHovered
        ? [244, 246, 250, 48]
        : [96, 165, 250, 32],
    isSelected,
    isRelated,
    isHovered,
    isDimmed,
    isGhost: false,
  }
}

function makeGhostNode({ missing, selectedNode, index }) {
  const label = missing.title || missing.relatedItemId || missing.targetItemId || 'missing target'
  return {
    id: `ghost-${missing.id || index}`,
    itemId: missing.relatedItemId || missing.targetItemId || `missing-${index}`,
    dataCategory: 'unknown',
    icon: getDeckCategoryIcon('unknown'),
    label,
    position: offsetGhostPosition(selectedNode.position, index),
    source: 'missing',
    status: 'missing',
    statusInfo: { label: 'Missing target' },
    statusRgb: [251, 191, 36],
    fillColor: [251, 191, 36, 36],
    lineColor: [251, 191, 36, 216],
    iconColor: [251, 191, 36, 210],
    textColor: [251, 191, 36, 236],
    radius: 9,
    lineWidth: 1.7,
    haloRadius: 14,
    haloColor: [251, 191, 36, 32],
    isSelected: false,
    isRelated: false,
    isHovered: false,
    isDimmed: false,
    isGhost: true,
    relation: missing,
  }
}

function makeRelation(relation, nodesById) {
  const sourceNode = nodesById.get(relation.sourceItemId)
  const targetNode = nodesById.get(relation.targetItemId)
  if (!sourceNode || !targetNode) return null
  const style = getRelationStyle(relation.rel)
  return {
    ...relation,
    style,
    sourceNode,
    targetNode,
    sourcePosition: sourceNode.position,
    targetPosition: targetNode.position,
    label: `${style.label} · ${relation.direction === 'inbound' ? 'in' : 'out'}`,
  }
}

export function buildExplorerDeckScene({
  fallbackCenters = null,
  hoveredId = null,
  items = [],
  relationOverlayEnabled = false,
  relationOverlayModel = null,
  selectedId = null,
} = {}) {
  const relatedIds = new Set(relationOverlayModel?.relatedItemIds || [])
  const assetNodes = (items || [])
    .map(item => makeNode({
      fallbackCenters,
      hoveredId,
      item,
      relationOverlayEnabled,
      relatedIds,
      selectedId,
    }))
    .filter(Boolean)

  const nodesById = new Map(assetNodes.map(node => [node.itemId, node]))
  const relations = relationOverlayEnabled
    ? (relationOverlayModel?.visibleRelations || [])
      .map(relation => makeRelation(relation, nodesById))
      .filter(Boolean)
    : []

  const selectedNode = selectedId ? nodesById.get(selectedId) : null
  const ghostNodes = relationOverlayEnabled && selectedNode
    ? (relationOverlayModel?.missingTargets || []).map((missing, index) => makeGhostNode({ missing, selectedNode, index }))
    : []

  const nodes = [...assetNodes, ...ghostNodes]
  const labelledNodes = nodes.filter(node => (
    node.isSelected
    || node.isRelated
    || node.isHovered
    || node.isGhost
    || assetNodes.length <= BASE_TEXT_LIMIT
  ))
  const haloNodes = nodes.filter(node => node.haloRadius > 0)

  return {
    nodes,
    assetNodes,
    ghostNodes,
    labelledNodes,
    haloNodes,
    relations,
    activeRels: new Set(relations.map(relation => relation.rel)),
    missingTargets: relationOverlayModel?.missingTargets || [],
  }
}
