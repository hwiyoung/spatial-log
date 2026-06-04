import { getUrlScheme } from './previewAssetSourcePolicy.js'
import { getHumanFallbackReason, getPreviewLoadStateLabel } from './previewDeliveryPolicy.js'

export function getPreviewSourceDiagnostics(source, loadState) {
  const urlScheme = source?.urlScheme || getUrlScheme(source?.url || source?.originalUrl)
  const fallbackReason = getHumanFallbackReason(source, loadState)

  return {
    sourceLabel: source?.label || 'Fallback placeholder',
    sourceKind: source?.sourceKind || 'fallback',
    role: source?.role || '-',
    mimeType: source?.mimeType || '-',
    urlScheme,
    loadState,
    loadStateLabel: getPreviewLoadStateLabel(loadState),
    isMock: Boolean(source?.isMock),
    isBrokenMock: Boolean(source?.isBrokenMock),
    fallbackReason,
    isMockUriBlocked: urlScheme === 'mock_uri' && !source?.url,
    rows: [
      ['source', source?.label || 'Fallback placeholder'],
      ['kind', source?.sourceKind || 'fallback'],
      ['role', source?.role || '-'],
      ['MIME', source?.mimeType || '-'],
      ['scheme', urlScheme],
      ['state', getPreviewLoadStateLabel(loadState)],
      ['mock', Boolean(source?.isMock) ? 'yes' : 'no'],
      ['broken', Boolean(source?.isBrokenMock) ? 'yes' : 'no'],
    ],
  }
}
