import { getCategoryInfo, getPreviewStatusInfo } from '../../constants.js'
import { mockPreviewAssets } from '../../mocks/fixtures/mockPreviewAssets.js'
import { getDisplayLabel } from '../items/getDisplayLabel.js'
import { getItemStatus, getStatusInfo } from '../items/getItemStatus.js'
import { getProjectContext } from '../items/getProjectContext.js'
import { getPreviewContract } from '../preview/getPreviewContract.js'
import { SUPPORTED_RELATIONS } from '../relations/relationStyles.js'

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

export function getAsset3dSummary(asset, {
  collections = [],
  relationRecords = [],
  relationOverlayModel = null,
  mockMode = false,
} = {}) {
  const item = asset?.item
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
  const isSelected = item?.id === relationOverlayModel?.selectedItemId
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
    zSourceLabel: getZSourceLabel(asset?.elevation),
    zDetail: getZDetail(asset?.elevation),
  }
}
