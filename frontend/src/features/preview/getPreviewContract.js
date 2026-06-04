import { getDisplayLabel } from '../items/getDisplayLabel.js'
import { normalizePreviewStatus } from '../items/getItemPreviewSummary.js'
import { getPreviewCategoryPolicy } from './previewCategoryPolicy.js'

function normalizeViewerType(value, fallback) {
  const normalized = String(value || '').trim().toLowerCase().replace(/-/g, '_')
  const aliases = {
    thumbnail: 'thumbnail',
    image: 'image',
    image_set: 'image',
    document: 'document',
    video: 'video',
    panorama: 'panorama',
    model_screenshot: 'model_screenshot',
    pointcloud_placeholder: 'pointcloud_placeholder',
    tileset_placeholder: 'tileset_placeholder',
    '3d_tiles_placeholder': 'tileset_placeholder',
    unsupported: 'unsupported',
  }
  return aliases[normalized] || fallback || 'unsupported'
}

function getPreviewAsset(item, previewAssets) {
  if (!previewAssets || !item?.id) return null
  return previewAssets[item.id] || null
}

function getThumbnailUrl(item, previewAsset) {
  return previewAsset?.thumbnailUrl
    || previewAsset?.thumbnailHref
    || item?.assets?.thumbnail?.href
    || null
}

function getPreviewHref(previewAsset) {
  return previewAsset?.previewUrl || previewAsset?.previewHref || null
}

function getActionForStatus(status, policy, hasThumbnail) {
  if (status === 'available') {
    return {
      actionLabel: hasThumbnail ? '썸네일 보기' : policy.availableActionLabel,
      actionState: 'mock_only',
      needsConversion: false,
    }
  }
  if (status === 'pending') {
    return {
      actionLabel: policy.pendingActionLabel,
      actionState: 'info_only',
      needsConversion: false,
    }
  }
  if (status === 'failed') {
    return {
      actionLabel: '실패 사유 보기',
      actionState: 'info_only',
      needsConversion: true,
    }
  }
  return {
    actionLabel: policy.missingActionLabel,
    actionState: 'info_only',
    needsConversion: true,
  }
}

export function getPreviewContract(item, previewAssets = null, options = {}) {
  const props = item?.properties || {}
  const dataCategory = props.data_category || 'unknown'
  const policy = getPreviewCategoryPolicy(dataCategory)
  const previewAsset = getPreviewAsset(item, previewAssets)
  const status = normalizePreviewStatus(previewAsset?.status || props.previewStatus)
  const thumbnailUrl = getThumbnailUrl(item, previewAsset)
  const previewHref = getPreviewHref(previewAsset)
  const rawViewerType = previewAsset?.previewType || props.previewType
  const viewerType = normalizeViewerType(rawViewerType, policy.viewerType)
  const failureReason = previewAsset?.failureReason || props.previewFailureReason || null
  const action = getActionForStatus(status, policy, Boolean(thumbnailUrl))

  return {
    itemId: item?.id || null,
    dataCategory,
    status,
    viewerType,
    title: policy.title,
    description: policy.description,
    thumbnailUrl,
    previewHref,
    placeholderLabel: policy.placeholderLabel,
    failureReason,
    actionLabel: action.actionLabel,
    actionState: action.actionState,
    canOpenInline: action.actionState !== 'disabled',
    canOpenDetail: Boolean(item?.id && item?.collection),
    needsConversion: action.needsConversion,
    isMock: Boolean(options.isMock || previewAsset || String(previewHref || '').startsWith('mock://')),
    displayLabel: getDisplayLabel(item),
  }
}
