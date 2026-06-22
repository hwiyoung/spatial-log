const PREVIEW_STATUSES = new Set(['available', 'pending', 'missing', 'failed'])

const CATEGORY_PREVIEW_LABELS = {
  pointcloud: 'Point cloud preview',
  '3d_model': '3D model preview',
  '3d_tiles': '3D Tiles preview',
  orthoimage: 'Image preview',
  image: 'Image preview',
  panorama: 'Panorama preview',
  video: 'Video preview',
  document: 'Document preview',
  unknown: 'Asset preview',
}

const PREVIEW_STATUS_LABELS = {
  available: 'Preview available',
  pending: 'Preview pending',
  missing: 'Preview missing',
  failed: 'Preview failed',
}

export function normalizePreviewStatus(status) {
  const normalized = String(status || '').trim().toLowerCase()
  return PREVIEW_STATUSES.has(normalized) ? normalized : 'missing'
}

export function getPreviewLabelForCategory(category) {
  return CATEGORY_PREVIEW_LABELS[category] || CATEGORY_PREVIEW_LABELS.unknown
}

export function getItemPreviewSummary(item) {
  const props = item?.properties || {}
  const dataCategory = props.data_category || 'unknown'
  const status = normalizePreviewStatus(props.previewStatus)
  const thumbnailHref = item?.assets?.thumbnail?.href || null

  return {
    status,
    statusLabel: PREVIEW_STATUS_LABELS[status],
    previewLabel: getPreviewLabelForCategory(dataCategory),
    previewType: props.previewType || null,
    thumbnailHref,
    failureReason: props.previewFailureReason || null,
  }
}
