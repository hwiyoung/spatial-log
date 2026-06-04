export const PREVIEW_LOAD_STATES = {
  idle: 'idle',
  loading: 'loading',
  loaded: 'loaded',
  error: 'error',
  fallback: 'fallback',
  unsupported: 'unsupported',
}

export const PREVIEW_LOAD_STATE_LABELS = {
  idle: 'Idle',
  loading: 'Loading',
  loaded: 'Loaded',
  error: 'Error',
  fallback: 'Fallback',
  unsupported: 'Unsupported',
}

export function getPreviewLoadStateLabel(loadState) {
  return PREVIEW_LOAD_STATE_LABELS[loadState] || PREVIEW_LOAD_STATE_LABELS.fallback
}

export function getInitialPreviewLoadState(source) {
  if (!source) return PREVIEW_LOAD_STATES.idle
  if (source.isLoadableImage && source.url) return PREVIEW_LOAD_STATES.loading
  if (source.url) return PREVIEW_LOAD_STATES.unsupported
  return PREVIEW_LOAD_STATES.fallback
}

export function canUseImageControls(loadState, source) {
  return Boolean(source?.isLoadableImage && source?.url && loadState === PREVIEW_LOAD_STATES.loaded)
}

export function getHumanFallbackReason(source, loadState) {
  if (loadState === PREVIEW_LOAD_STATES.error) {
    return 'The browser could not load this preview URL. The shell is showing a fallback card.'
  }
  if (source?.fallbackReason) return source.fallbackReason
  if (loadState === PREVIEW_LOAD_STATES.unsupported) {
    return 'The selected source exists, but it is not supported as a browser-loadable preview in this phase.'
  }
  if (loadState === PREVIEW_LOAD_STATES.fallback) {
    return 'No loadable preview source is available.'
  }
  return null
}
