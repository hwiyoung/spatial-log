export const PREVIEW_STATUS_LABELS = {
  available: 'Preview available',
  pending: 'Preview pending',
  missing: 'Preview missing',
  failed: 'Preview failed',
}

export const PREVIEW_CATEGORY_POLICY = {
  pointcloud: {
    title: 'Point cloud preview',
    placeholderLabel: 'Point cloud lightweight preview',
    viewerType: 'pointcloud_placeholder',
    description: 'Point cloud viewer is deferred. This card shows preview readiness and conversion state.',
    availableActionLabel: '미리보기 열기',
    pendingActionLabel: '뷰어 준비 중',
    missingActionLabel: '변환 필요',
  },
  '3d_model': {
    title: '3D model preview',
    placeholderLabel: 'Model screenshot preview',
    viewerType: 'model_screenshot',
    description: '3D model viewer is deferred. Use screenshot or placeholder preview in Phase 6A.',
    availableActionLabel: '썸네일 보기',
    pendingActionLabel: '뷰어 준비 중',
    missingActionLabel: '변환 필요',
  },
  '3d_tiles': {
    title: '3D Tiles preview',
    placeholderLabel: '3D Tiles viewer needed',
    viewerType: 'tileset_placeholder',
    description: '3D Tiles renderer is deferred. This card confirms tileset preview contract state.',
    availableActionLabel: '미리보기 열기',
    pendingActionLabel: '뷰어 준비 중',
    missingActionLabel: '변환 필요',
  },
  orthoimage: {
    title: 'Image preview',
    placeholderLabel: 'Orthoimage preview',
    viewerType: 'image',
    description: 'Image-style preview card for orthophoto assets.',
    availableActionLabel: '썸네일 보기',
    pendingActionLabel: '뷰어 준비 중',
    missingActionLabel: '변환 필요',
  },
  image: {
    title: 'Image preview',
    placeholderLabel: 'Image preview',
    viewerType: 'image',
    description: 'Image-style preview card for photo assets.',
    availableActionLabel: '썸네일 보기',
    pendingActionLabel: '뷰어 준비 중',
    missingActionLabel: '변환 필요',
  },
  panorama: {
    title: 'Panorama preview',
    placeholderLabel: 'Panorama viewer needed',
    viewerType: 'panorama',
    description: 'Panorama viewer is deferred. This card shows readiness for later panorama integration.',
    availableActionLabel: '미리보기 열기',
    pendingActionLabel: '뷰어 준비 중',
    missingActionLabel: '변환 필요',
  },
  video: {
    title: 'Video preview',
    placeholderLabel: 'Video preview placeholder',
    viewerType: 'video',
    description: 'Video player is deferred. This card shows poster/preview contract state only.',
    availableActionLabel: '미리보기 열기',
    pendingActionLabel: '뷰어 준비 중',
    missingActionLabel: '변환 필요',
  },
  document: {
    title: 'Document preview',
    placeholderLabel: 'Document preview placeholder',
    viewerType: 'document',
    description: 'Document/PDF viewer is deferred. This card shows document preview contract state only.',
    availableActionLabel: '미리보기 열기',
    pendingActionLabel: '뷰어 준비 중',
    missingActionLabel: '변환 필요',
  },
  unknown: {
    title: 'Asset preview',
    placeholderLabel: 'Unsupported preview',
    viewerType: 'unsupported',
    description: 'No category-specific preview policy exists.',
    availableActionLabel: '미리보기 열기',
    pendingActionLabel: '뷰어 준비 중',
    missingActionLabel: '변환 필요',
  },
}

export function getPreviewCategoryPolicy(dataCategory) {
  return PREVIEW_CATEGORY_POLICY[dataCategory] || PREVIEW_CATEGORY_POLICY.unknown
}
