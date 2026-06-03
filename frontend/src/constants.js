/** 데이터 유형 카테고리 정의 */
export const CATEGORIES = {
  pointcloud:  { icon: '⦿', label: '포인트 클라우드', color: '#E05555' },
  '3d_model':  { icon: '△', label: '3D 모델',       color: '#6AAF50' },
  '3d_tiles':  { icon: '▦', label: '3D Tiles',      color: '#50AAAF' },
  orthoimage:  { icon: '▨', label: '정사영상',       color: '#9055C8' },
  image:       { icon: '▣', label: '원본 이미지',     color: '#35A5E0' },
  panorama:    { icon: '◉', label: '파노라마',       color: '#E87830' },
  video:       { icon: '▶', label: '동영상',         color: '#E04040' },
  document:    { icon: '▤', label: '문헌정보',       color: '#8899AA' },
  unknown:     { icon: '?', label: '알 수 없음',     color: '#5C6478' },
}

export function getCategoryInfo(cat) {
  return CATEGORIES[cat] || CATEGORIES.unknown
}

export function getDisplayLabel(item) {
  const props = item?.properties || {}
  const firstAssetWithTitle = Object.values(item?.assets || {}).find(asset => asset?.title)
  return props.display_name
    || props.title
    || firstAssetWithTitle?.title
    || props.description
    || props.originalFilename
    || props['file:name']
    || item?.id
    || 'Untitled Item'
}

export function getItemStatus(item) {
  const props = item?.properties || {}
  return props.status || props['sams:status'] || 'unknown'
}

export function getStatusInfo(status) {
  const normalized = status || 'unknown'
  const map = {
    draft: { label: 'Draft', color: 'var(--warn)' },
    published: { label: 'Published', color: 'var(--ok)' },
    archived: { label: 'Archived', color: 'var(--t3)' },
    unknown: { label: 'Unknown', color: 'var(--t3)' },
  }
  return map[normalized] || map.unknown
}

export function getPreviewStatusInfo(status) {
  const normalized = status || 'missing'
  const map = {
    available: { label: 'Preview available', color: 'var(--ok)' },
    missing: { label: 'Preview missing', color: 'var(--t3)' },
    failed: { label: 'Preview failed', color: 'var(--err, #e55)' },
    pending: { label: 'Preview pending', color: 'var(--warn)' },
  }
  return map[normalized] || map.missing
}

export function formatSize(bytes) {
  if (bytes == null) return '—'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB'
  return (bytes / 1073741824).toFixed(1) + ' GB'
}
