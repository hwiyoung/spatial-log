import { categoryGlyphSvg } from '../explorer-map/categoryGlyphSvg.js'

const ICON_SIZE = 64
const CACHE = new Map()

export function getDeckCategoryIcon(category = 'unknown') {
  const key = category || 'unknown'
  if (CACHE.has(key)) return CACHE.get(key)

  const svg = categoryGlyphSvg(key, ICON_SIZE)
    .replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')
  const icon = {
    id: `cat-${key}`,
    url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    width: ICON_SIZE,
    height: ICON_SIZE,
    anchorX: ICON_SIZE / 2,
    anchorY: ICON_SIZE / 2,
    mask: true,
  }
  CACHE.set(key, icon)
  return icon
}
