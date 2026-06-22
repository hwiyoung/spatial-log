/**
 * Explorer 디자인 메타 — 상태/미리보기 색(=유일한 색 운반체), 카테고리 순서, 공간 근거 라벨.
 * 색은 index.css 전역 디자인 토큰을 가리킨다.
 */

export const STATUS_META = {
  draft: { label: 'Draft', color: 'var(--draft)', dashed: false },
  published: { label: 'Published', color: 'var(--pub)', dashed: false },
  archived: { label: 'Archived', color: 'var(--arch)', dashed: false },
  unknown: { label: 'Unknown', color: 'var(--unk)', dashed: true },
}

export const PREVIEW_META = {
  available: { label: 'available', color: 'var(--av)' },
  pending: { label: 'pending', color: 'var(--pend)' },
  missing: { label: 'missing', color: 'var(--miss)' },
  failed: { label: 'failed', color: 'var(--fail)' },
}

export const CAT_ORDER = ['pointcloud', '3d_model', '3d_tiles', 'orthoimage', 'image', 'panorama', 'video', 'document']

export const STATUS_ORDER = ['draft', 'published', 'archived', 'unknown']

export const SPATIAL_LABEL = {
  geometry: 'Geometry center',
  bbox: 'BBox center',
  fallback: 'Project fallback',
  none: 'No spatial marker',
}

// 상태/미리보기 색을 알파 합성한 배경·테두리 (CSS var 대상이라 color-mix 사용)
export function tint(color, pct) {
  return `color-mix(in srgb, ${color} ${pct}%, transparent)`
}
