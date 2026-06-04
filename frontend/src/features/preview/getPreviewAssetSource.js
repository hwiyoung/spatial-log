import {
  getPrioritizedPreviewRole,
  getUrlScheme,
  inferMimeType,
  isBrowserLoadableImageMime,
  isLoadableImageSource,
  PREVIEW_SOURCE_ROLE_PRIORITY,
} from './previewAssetSourcePolicy.js'

function getPreviewAsset(item, previewAssets) {
  if (!item?.id || !previewAssets) return null
  return previewAssets[item.id] || null
}

function pickMockAssetUrl(previewAsset) {
  if (!previewAsset) return null
  if (previewAsset.thumbnailUrl) {
    return { url: previewAsset.thumbnailUrl, role: 'thumbnail', label: previewAsset.label || 'Mock thumbnail' }
  }
  if (previewAsset.previewUrl) {
    return { url: previewAsset.previewUrl, role: 'preview', label: previewAsset.label || 'Mock preview' }
  }
  if (previewAsset.thumbnailHref) {
    return { url: previewAsset.thumbnailHref, role: 'thumbnail', label: previewAsset.label || 'Mock thumbnail' }
  }
  if (previewAsset.previewHref) {
    return { url: previewAsset.previewHref, role: 'preview', label: previewAsset.label || 'Mock preview' }
  }
  return null
}

function getNamedAsset(item, role) {
  const asset = item?.assets?.[role]
  if (!asset?.href) return null
  return {
    sourceKind: 'stac_named_asset',
    url: asset.href,
    mimeType: asset.type,
    role,
    label: asset.title || `${role} asset`,
    isMock: false,
    isBrokenMock: false,
  }
}

function getRoleAsset(item) {
  const assets = item?.assets || {}

  for (const role of PREVIEW_SOURCE_ROLE_PRIORITY) {
    const entry = Object.entries(assets).find(([, asset]) => getPrioritizedPreviewRole(asset) === role)
    if (entry) {
      const [assetKey, asset] = entry
      return {
        sourceKind: 'stac_role_asset',
        url: asset.href,
        mimeType: asset.type,
        role,
        label: asset.title || `${assetKey} asset`,
        isMock: false,
        isBrokenMock: false,
      }
    }
  }

  return null
}

function getCandidate(item, previewContract, previewAssets) {
  const previewAsset = getPreviewAsset(item, previewAssets)
  const mockUrl = pickMockAssetUrl(previewAsset)
  if (mockUrl) {
    return {
      sourceKind: 'mock_preview_asset',
      url: mockUrl.url,
      mimeType: previewAsset.mimeType || previewAsset.type,
      role: mockUrl.role,
      label: mockUrl.label,
      isMock: true,
      isBrokenMock: Boolean(previewAsset.isBrokenMock),
    }
  }

  for (const role of PREVIEW_SOURCE_ROLE_PRIORITY) {
    const namedAsset = getNamedAsset(item, role)
    if (namedAsset) return namedAsset
  }

  const roleAsset = getRoleAsset(item)
  if (roleAsset) return roleAsset

  if (previewContract?.thumbnailUrl) {
    return {
      sourceKind: 'preview_contract',
      url: previewContract.thumbnailUrl,
      mimeType: null,
      role: 'thumbnail',
      label: 'Preview contract thumbnail',
      isMock: Boolean(previewContract.isMock),
      isBrokenMock: false,
    }
  }

  return null
}

function getFallbackReason(candidate, scheme, loadableUrl, dataCategory, mimeType, isLoadableImage) {
  if (!candidate?.url) return 'No preview asset URL was found.'
  if (scheme === 'mock_uri') return 'mock:// preview pointers are not loadable image URLs.'
  if (!['image', 'orthoimage'].includes(dataCategory)) return 'Image loading is only piloted for image and orthoimage categories.'
  if (mimeType && !isBrowserLoadableImageMime(mimeType)) {
    return `${mimeType} is not browser-loadable in Phase 6D. Generate a thumbnail, overview, or preview image first.`
  }
  if (!loadableUrl || !isLoadableImage) return 'The selected source is not a browser-loadable image preview for this category.'
  return null
}

export function getPreviewAssetSource(item, previewContract = null, previewAssets = null) {
  const dataCategory = previewContract?.dataCategory || item?.properties?.data_category || 'unknown'
  const candidate = getCandidate(item, previewContract, previewAssets)

  if (!candidate) {
    return {
      itemId: item?.id || previewContract?.itemId || null,
      dataCategory,
      sourceKind: 'fallback',
      url: null,
      originalUrl: null,
      urlScheme: 'missing',
      mimeType: null,
      role: null,
      label: 'Fallback placeholder',
      isMock: false,
      isLoadableImage: false,
      isBrokenMock: false,
      fallbackReason: 'No preview asset URL was found.',
    }
  }

  const mimeType = inferMimeType(candidate.url, candidate.mimeType)
  const scheme = getUrlScheme(candidate.url)
  const loadableUrl = scheme === 'mock_uri' ? null : candidate.url
  const isLoadableImage = isLoadableImageSource({
    dataCategory,
    url: loadableUrl,
    mimeType,
  })

  return {
    itemId: item?.id || previewContract?.itemId || null,
    dataCategory,
    sourceKind: candidate.sourceKind,
    url: loadableUrl,
    originalUrl: candidate.url,
    urlScheme: scheme,
    mimeType,
    role: candidate.role || null,
    label: candidate.label || 'Preview source',
    isMock: Boolean(candidate.isMock),
    isLoadableImage,
    isBrokenMock: Boolean(candidate.isBrokenMock),
    fallbackReason: getFallbackReason(candidate, scheme, loadableUrl, dataCategory, mimeType, isLoadableImage),
  }
}
