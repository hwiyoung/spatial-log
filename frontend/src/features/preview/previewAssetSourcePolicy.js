export const IMAGE_PREVIEW_CATEGORIES = new Set(['image', 'orthoimage'])

export const PREVIEW_SOURCE_ROLE_PRIORITY = ['thumbnail', 'overview', 'preview']

export const LOADABLE_IMAGE_MIME_TYPES = new Set([
  'image/avif',
  'image/gif',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/svg+xml',
  'image/webp',
])

export function normalizeRoleList(roles) {
  if (!Array.isArray(roles)) return []
  return roles
    .map(role => String(role || '').trim().toLowerCase())
    .filter(Boolean)
}

export function getPrioritizedPreviewRole(asset) {
  const roles = normalizeRoleList(asset?.roles)
  return PREVIEW_SOURCE_ROLE_PRIORITY.find(role => roles.includes(role)) || null
}

export function getUrlScheme(url) {
  const value = String(url || '').trim()
  if (!value) return 'missing'
  if (value.startsWith('data:')) return 'data'
  if (value.startsWith('/mock-preview/')) return 'mock_preview_path'
  if (value.startsWith('mock://')) return 'mock_uri'
  if (value.startsWith('https://')) return 'https'
  if (value.startsWith('http://')) return 'http'
  return 'unknown'
}

export function inferMimeType(url, explicitMimeType) {
  if (explicitMimeType) return String(explicitMimeType).toLowerCase()

  const value = String(url || '').trim().toLowerCase()
  const dataMatch = value.match(/^data:([^;,]+)/)
  if (dataMatch) return dataMatch[1]

  if (value.endsWith('.svg')) return 'image/svg+xml'
  if (value.endsWith('.png')) return 'image/png'
  if (value.endsWith('.jpg') || value.endsWith('.jpeg')) return 'image/jpeg'
  if (value.endsWith('.webp')) return 'image/webp'
  if (value.endsWith('.gif')) return 'image/gif'
  if (value.endsWith('.avif')) return 'image/avif'
  if (value.endsWith('.tif') || value.endsWith('.tiff')) return 'image/tiff'

  return null
}

export function isBrowserLoadableImageMime(mimeType) {
  if (!mimeType) return true
  return LOADABLE_IMAGE_MIME_TYPES.has(String(mimeType).toLowerCase())
}

export function isLoadableImageSource({ dataCategory, url, mimeType }) {
  if (!IMAGE_PREVIEW_CATEGORIES.has(dataCategory)) return false

  const scheme = getUrlScheme(url)
  if (scheme === 'mock_uri' || scheme === 'missing' || scheme === 'unknown') return false
  if (scheme === 'data') {
    return String(url || '').toLowerCase().startsWith('data:image/')
      && isBrowserLoadableImageMime(mimeType)
  }
  if (scheme === 'mock_preview_path') return isBrowserLoadableImageMime(mimeType)
  if (scheme === 'http' || scheme === 'https') return isBrowserLoadableImageMime(mimeType)

  return false
}
