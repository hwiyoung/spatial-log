/**
 * 카테고리 글리프를 SVG 마크업 문자열로 반환 (MapLibre 마커 등 명령형 DOM 용).
 * React용 컴포넌트(components/viewer/CategoryGlyph)와 동일한 형태(shape-only).
 */
const SHAPE_BY_CATEGORY = {
  pointcloud: 'pointcloud', '3d_model': 'model', '3d_tiles': 'tiles', orthoimage: 'ortho',
  image: 'image', panorama: 'pano', video: 'video', document: 'doc',
}

export function categoryGlyphSvg(cat, s = 15) {
  const open = `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">`
  let inner
  switch (SHAPE_BY_CATEGORY[cat]) {
    case 'pointcloud':
      inner = [[7, 7], [12, 6], [17, 8], [6, 13], [12, 12], [18, 14], [9, 18], [15, 17]]
        .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.05" fill="currentColor" stroke="none"/>`).join(''); break
    case 'model': inner = '<path d="M12 4 L20 18 L4 18 Z"/><path d="M12 4 L12 18 M7 13 L17 13"/>'; break
    case 'tiles': inner = '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>'; break
    case 'ortho': inner = '<rect x="4" y="4" width="16" height="16" rx="1.5"/><path d="M4 14 L10 9 L14 13 L20 8"/><path d="M4 18 L9 15 L13 18"/>'; break
    case 'image': inner = '<rect x="4" y="6" width="16" height="12" rx="1.5"/><circle cx="9" cy="11" r="1.6"/><path d="M5 17 L11 12 L15 15 L19 11"/>'; break
    case 'pano': inner = '<ellipse cx="12" cy="12" rx="9" ry="6"/><path d="M12 6 C8 9 8 15 12 18 M12 6 C16 9 16 15 12 18 M3.4 12 H20.6"/>'; break
    case 'video': inner = '<rect x="3.5" y="6" width="17" height="12" rx="2"/><path d="M10 9.5 L14.5 12 L10 14.5 Z" fill="currentColor" stroke="none"/>'; break
    case 'doc': inner = '<path d="M7 3 H14 L18 7 V21 H7 Z"/><path d="M14 3 V7 H18 M9.5 12 H15.5 M9.5 15 H15.5 M9.5 18 H13"/>'; break
    default: inner = '<circle cx="12" cy="12" r="8"/>'
  }
  return open + inner + '</svg>'
}

export const STATUS_VAR = { draft: 'var(--draft)', published: 'var(--pub)', archived: 'var(--arch)', unknown: 'var(--unk)' }
export const PREVIEW_VAR = { available: 'var(--av)', pending: 'var(--pend)', missing: 'var(--miss)', failed: 'var(--fail)' }
