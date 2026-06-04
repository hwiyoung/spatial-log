import { useEffect, useMemo, useState } from 'react'
import { getPreviewAssetSource } from '../features/preview/getPreviewAssetSource.js'
import {
  canUseImageControls,
  getHumanFallbackReason,
  getInitialPreviewLoadState,
  PREVIEW_LOAD_STATES,
} from '../features/preview/previewDeliveryPolicy.js'
import PreviewSourceDiagnostics from './PreviewSourceDiagnostics'
import ViewerImageToolbar from './ViewerImageToolbar'

export default function ViewerImage({
  item,
  contract,
  previewAssets = null,
  label = 'Image shell',
}) {
  const source = useMemo(
    () => getPreviewAssetSource(item, contract, previewAssets),
    [item, contract, previewAssets],
  )
  const [loadState, setLoadState] = useState(getInitialPreviewLoadState(source))
  const [scale, setScale] = useState(1)

  useEffect(() => {
    setLoadState(getInitialPreviewLoadState(source))
    setScale(1)
  }, [source.url, source.isLoadableImage, source.mimeType])

  const showImage = source.isLoadableImage && source.url && loadState !== PREVIEW_LOAD_STATES.error
  const canControl = canUseImageControls(loadState, source)

  return (
    <section style={sectionStyle}>
      <div style={mediaFrameStyle}>
        {showImage ? (
          <>
            <ViewerImageToolbar
              scale={scale}
              canControl={canControl}
              onZoomIn={() => setScale(prev => Math.min(3, Number((prev + 0.25).toFixed(2))))}
              onZoomOut={() => setScale(prev => Math.max(0.5, Number((prev - 0.25).toFixed(2))))}
              onReset={() => setScale(1)}
            />
            <img
              src={source.url}
              alt={contract.displayLabel}
              onLoad={() => setLoadState(PREVIEW_LOAD_STATES.loaded)}
              onError={() => setLoadState(PREVIEW_LOAD_STATES.error)}
              style={{
                ...imageStyle,
                transform: `scale(${scale})`,
              }}
            />
            {loadState === PREVIEW_LOAD_STATES.loading && (
              <div style={loadingOverlayStyle}>
                이미지 로딩 중...
              </div>
            )}
          </>
        ) : (
          <ImageFallback label={label} contract={contract} source={source} loadState={loadState} />
        )}
      </div>
      <PreviewSourceDiagnostics source={source} loadState={loadState} />
    </section>
  )
}

function ImageFallback({ label, contract, source, loadState }) {
  const title = loadState === PREVIEW_LOAD_STATES.error
    ? 'Image load failed'
    : loadState === PREVIEW_LOAD_STATES.unsupported
      ? 'Unsupported preview source'
      : label
  const body = getHumanFallbackReason(source, loadState)

  return (
    <div style={placeholderStyle}>
      <div style={placeholderTitleStyle}>{title}</div>
      <div style={placeholderTextStyle}>{contract.placeholderLabel}</div>
      <div style={fallbackReasonStyle}>{body}</div>
    </div>
  )
}

const sectionStyle = { display: 'grid', gap: 10 }

const mediaFrameStyle = {
  position: 'relative',
  minHeight: 360,
  borderRadius: 8,
  overflow: 'hidden',
  border: '1px solid var(--bd)',
  background: 'var(--s2)',
}

const imageStyle = {
  width: '100%',
  height: 360,
  objectFit: 'contain',
  display: 'block',
  transformOrigin: 'center center',
  transition: 'transform 0.16s ease',
}

const loadingOverlayStyle = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--t1)',
  background: 'rgba(19,22,31,0.62)',
  fontSize: 13,
  fontWeight: 900,
}

const placeholderStyle = {
  minHeight: 360,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  padding: 24,
  textAlign: 'center',
  background: 'linear-gradient(145deg, rgba(74,114,255,0.12), rgba(19,22,31,0.22))',
}

const placeholderTitleStyle = {
  color: 'var(--t1)',
  fontSize: 18,
  fontWeight: 900,
}

const placeholderTextStyle = {
  color: 'var(--t3)',
  fontSize: 13,
  fontWeight: 800,
}

const fallbackReasonStyle = {
  maxWidth: 520,
  color: 'var(--t2)',
  fontSize: 12,
  lineHeight: 1.45,
}
