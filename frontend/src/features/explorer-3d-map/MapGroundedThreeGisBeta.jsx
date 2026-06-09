import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import { getCategoryInfo } from '../../constants.js'
import Explorer3dControls from '../../components/Explorer3dControls.jsx'
import Explorer3dFocusCard from '../../components/Explorer3dFocusCard.jsx'
import Explorer3dLegend from '../../components/Explorer3dLegend.jsx'
import Explorer3dTooltip from '../../components/Explorer3dTooltip.jsx'
import { getItemsBounds } from '../explorer-map/getItemsBounds.js'
import { getItemMapPosition } from '../explorer-map/getItemMapPosition.js'
import { getAsset3dSummary } from '../explorer-3d/getAsset3dSummary.js'
import { MapGroundedThreeLayer } from './MapGroundedThreeLayer.js'
import { getMapGroundedAssetItems } from './itemToMercatorTransform.js'

const LAYER_ID = 'map-grounded-three-assets'
const NEAREST_HIT_PX = 34

function getCategoryCounts(items) {
  return (items || []).reduce((counts, item) => {
    const category = item.properties?.data_category || 'unknown'
    counts[category] = (counts[category] || 0) + 1
    return counts
  }, {})
}

function getNearestAsset(map, assets, point, maxDistancePx = NEAREST_HIT_PX) {
  if (!map || !point) return null
  let nearest = null
  let nearestDistance = Infinity

  assets.forEach(asset => {
    const projected = map.project(asset.lngLat)
    const dx = projected.x - point.x
    const dy = projected.y - point.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearest = asset
    }
  })

  return nearestDistance <= maxDistancePx ? nearest : null
}

function getScreenAsset(map, asset) {
  if (!map || !asset) return null
  const point = map.project(asset.lngLat)
  const canvas = map.getCanvas()
  const rect = canvas.getBoundingClientRect()
  return {
    ...asset,
    x: Math.min(94, Math.max(6, (point.x / rect.width) * 100)),
    y: Math.min(92, Math.max(8, (point.y / rect.height) * 100)),
    height: 12,
  }
}

function fitMapToItems(map, items, animated = false) {
  const bounds = getItemsBounds(items)
  if (!map || !bounds) return
  const [w, s, e, n] = bounds
  if (w === e && s === n) {
    map.easeTo({
      center: [w, s],
      zoom: 15,
      pitch: 58,
      bearing: -22,
      duration: animated ? 500 : 0,
    })
    return
  }
  map.fitBounds([[w, s], [e, n]], {
    padding: 96,
    maxZoom: 15,
    duration: animated ? 500 : 0,
    pitch: 58,
    bearing: -22,
  })
}

export default function MapGroundedThreeGisBeta({
  items = [],
  collections = [],
  selectedId,
  onSelectItem,
  relationOverlayEnabled = false,
  relationOverlayModel = null,
  relationRecords = [],
  mockMode = false,
  onLayerUnavailable,
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const layerRef = useRef(null)
  const hasFitItemsRef = useRef(false)
  const hoverRafRef = useRef(null)
  const hoverProjectionRafRef = useRef(null)
  const hoverPointRef = useRef(null)
  const hoveredIdRef = useRef(null)
  const groundedAssetsRef = useRef([])
  const [mapLoaded, setMapLoaded] = useState(false)
  const [hoveredId, setHoveredId] = useState(null)
  const [hoverScreenAsset, setHoverScreenAsset] = useState(null)
  const [layerFailed, setLayerFailed] = useState(false)

  const groundedAssets = useMemo(() => getMapGroundedAssetItems(items), [items])
  const assetById = useMemo(
    () => new Map(groundedAssets.map(asset => [asset.itemId, asset])),
    [groundedAssets],
  )
  const categoryCounts = useMemo(() => getCategoryCounts(items), [items])
  const activeRels = useMemo(
    () => new Set((relationOverlayModel?.visibleRelations || []).map(relation => relation.rel)),
    [relationOverlayModel],
  )
  const selectedAsset = selectedId ? assetById.get(selectedId) : null
  const hoveredAsset = hoveredId ? assetById.get(hoveredId) : null
  const selectedSummary = selectedAsset
    ? getAsset3dSummary(selectedAsset, {
      collections,
      relationRecords,
      relationOverlayModel,
      mockMode,
    })
    : null
  const hoverSummary = hoveredAsset
    ? getAsset3dSummary(hoveredAsset, {
      collections,
      relationRecords,
      relationOverlayModel,
      mockMode,
    })
    : null

  useEffect(() => {
    groundedAssetsRef.current = groundedAssets
  }, [groundedAssets])

  useEffect(() => {
    if (!hoveredIdRef.current) return
    if (assetById.has(hoveredIdRef.current)) return
    hoveredIdRef.current = null
    setHoveredId(null)
    setHoverScreenAsset(null)
  }, [assetById])

  const setStableHoveredAsset = useCallback((asset) => {
    const nextId = asset?.itemId || null
    if (hoveredIdRef.current !== nextId) {
      hoveredIdRef.current = nextId
      setHoveredId(nextId)
      setHoverScreenAsset(getScreenAsset(mapRef.current, asset))
      return
    }
    if (asset) {
      setHoverScreenAsset(getScreenAsset(mapRef.current, asset))
    }
  }, [])

  const scheduleHoverFromPoint = useCallback((point) => {
    hoverPointRef.current = point
    if (hoverRafRef.current) return

    hoverRafRef.current = requestAnimationFrame(() => {
      hoverRafRef.current = null
      const map = mapRef.current
      const currentPoint = hoverPointRef.current
      const hitThreshold = hoveredIdRef.current ? NEAREST_HIT_PX + 8 : NEAREST_HIT_PX
      const nearest = getNearestAsset(map, groundedAssetsRef.current, currentPoint, hitThreshold)
      setStableHoveredAsset(nearest)
      if (map) map.getCanvas().style.cursor = nearest ? 'pointer' : ''
    })
  }, [setStableHoveredAsset])

  const scheduleHoverProjection = useCallback(() => {
    if (!hoveredIdRef.current || hoverProjectionRafRef.current) return

    hoverProjectionRafRef.current = requestAnimationFrame(() => {
      hoverProjectionRafRef.current = null
      const hoveredAsset = groundedAssetsRef.current.find(asset => asset.itemId === hoveredIdRef.current)
      if (hoveredAsset) {
        setHoverScreenAsset(getScreenAsset(mapRef.current, hoveredAsset))
      }
    })
  }, [])

  const handleLayerError = useCallback((error) => {
    setLayerFailed(true)
    onLayerUnavailable?.(error)
  }, [onLayerUnavailable])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap',
          },
        },
        layers: [{
          id: 'osm',
          type: 'raster',
          source: 'osm',
          minzoom: 0,
          maxzoom: 19,
        }],
      },
      center: [128.6, 35.9],
      zoom: 7,
      pitch: 58,
      bearing: -22,
      antialias: true,
    })

    const handleLoad = () => setMapLoaded(true)
    const handleMapMove = () => scheduleHoverProjection()

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right')
    map.on('load', handleLoad)
    map.on('move', handleMapMove)
    mapRef.current = map

    return () => {
      if (hoverRafRef.current) cancelAnimationFrame(hoverRafRef.current)
      if (hoverProjectionRafRef.current) cancelAnimationFrame(hoverProjectionRafRef.current)
      map.off('load', handleLoad)
      map.off('move', handleMapMove)
      if (map.getLayer(LAYER_ID)) {
        map.removeLayer(LAYER_ID)
      } else {
        layerRef.current?.dispose?.()
      }
      layerRef.current = null
      map.remove()
      mapRef.current = null
      setMapLoaded(false)
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded || layerRef.current) return

    try {
      const layer = new MapGroundedThreeLayer({
        id: LAYER_ID,
        assets: groundedAssets,
        selectedId,
        relationOverlayEnabled,
        relationOverlayModel,
        onError: handleLayerError,
      })
      map.addLayer(layer)
      layerRef.current = layer
      setLayerFailed(false)
    } catch (error) {
      console.warn('Map-grounded custom layer add failed:', error)
      handleLayerError(error)
    }
  }, [
    mapLoaded,
    groundedAssets,
    selectedId,
    relationOverlayEnabled,
    relationOverlayModel,
    handleLayerError,
  ])

  useEffect(() => {
    layerRef.current?.update({
      assets: groundedAssets,
      selectedId,
      relationOverlayEnabled,
      relationOverlayModel,
    })
  }, [groundedAssets, selectedId, relationOverlayEnabled, relationOverlayModel])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return
    if (!items || items.length === 0) {
      hasFitItemsRef.current = false
      return
    }
    fitMapToItems(map, items, hasFitItemsRef.current)
    hasFitItemsRef.current = true
  }, [items, mapLoaded])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !selectedId) return
    const item = items.find(candidate => candidate.id === selectedId)
    const mapPosition = getItemMapPosition(item)
    if (!mapPosition?.position) return
    map.easeTo({
      center: mapPosition.position,
      zoom: Math.max(map.getZoom(), 15),
      pitch: 60,
      duration: 650,
    })
  }, [selectedId, items])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return undefined

    const handleMove = event => {
      scheduleHoverFromPoint(event.point)
    }
    const handleClick = event => {
      const nearest = getNearestAsset(map, groundedAssets, event.point)
      if (nearest?.item) onSelectItem?.(nearest.item)
    }
    const handleLeave = () => {
      hoveredIdRef.current = null
      setHoveredId(null)
      setHoverScreenAsset(null)
      map.getCanvas().style.cursor = ''
    }

    map.on('mousemove', handleMove)
    map.on('click', handleClick)
    map.on('mouseleave', handleLeave)

    return () => {
      map.off('mousemove', handleMove)
      map.off('click', handleClick)
      map.off('mouseleave', handleLeave)
      map.getCanvas().style.cursor = ''
    }
  }, [mapLoaded, groundedAssets, onSelectItem, scheduleHoverFromPoint])

  const resetView = useCallback(() => {
    hoveredIdRef.current = null
    setHoveredId(null)
    setHoverScreenAsset(null)
    fitMapToItems(mapRef.current, items, true)
  }, [items])

  return (
    <div style={rootStyle}>
      <div ref={containerRef} style={mapContainerStyle} />
      <BetaBadge count={items.length} layerFailed={layerFailed} />
      <Explorer3dControls
        focusSelected={Boolean(selectedId)}
        selectedLabel={selectedSummary?.label}
        relationOverlayEnabled={relationOverlayEnabled}
        onResetView={resetView}
      />
      <SceneCategoryCounts categoryCounts={categoryCounts} />
      <GroundedNotice
        selectedAsset={selectedAsset}
        layerFailed={layerFailed}
        relationOverlayEnabled={relationOverlayEnabled}
        missingCount={relationOverlayModel?.missingTargets?.length || 0}
      />
      <Explorer3dLegend
        activeRels={activeRels}
        relationOverlayEnabled={relationOverlayEnabled}
        missingTargets={relationOverlayModel?.missingTargets || []}
      />
      <Explorer3dFocusCard
        asset={selectedAsset}
        summary={selectedSummary}
        relationOverlayEnabled={relationOverlayEnabled}
      />
      <Explorer3dTooltip asset={hoverScreenAsset} summary={hoverSummary} />
      {(!items || items.length === 0) && (
        <div style={emptyStyle}>
          <div style={emptyTitleStyle}>검색 결과 없음</div>
          <div style={emptyHintStyle}>검색어와 필터를 조정하면 map-grounded 3D asset map이 다시 표시됩니다.</div>
        </div>
      )}
    </div>
  )
}

function BetaBadge({ count, layerFailed }) {
  return (
    <div style={{
      ...betaBadgeStyle,
      borderColor: layerFailed ? 'rgba(240,180,42,0.36)' : 'rgba(80,170,175,0.42)',
      color: layerFailed ? '#F0B42A' : '#50AAAF',
    }}>
      Map-grounded 3D · {count} assets
    </div>
  )
}

function SceneCategoryCounts({ categoryCounts }) {
  return (
    <div style={countRowStyle}>
      {Object.entries(categoryCounts).map(([category, count]) => {
        const cat = getCategoryInfo(category)
        return (
          <span key={category} style={{
            padding: '3px 7px',
            borderRadius: 4,
            background: 'rgba(19,22,31,0.82)',
            border: `1px solid ${cat.color}35`,
            color: cat.color,
            fontSize: 11,
            fontWeight: 900,
          }}>
            {cat.icon} {count}
          </span>
        )
      })}
    </div>
  )
}

function GroundedNotice({ selectedAsset, layerFailed, relationOverlayEnabled, missingCount }) {
  return (
    <div style={{
      ...noticeStyle,
      top: selectedAsset ? 296 : 82,
    }}>
      <span style={noticeStrongStyle}>
        {layerFailed ? 'Custom layer fallback needed' : 'MapLibre custom layer + Three.js'}
      </span>
      <span> · screen-nearest click/hover fallback</span>
      {relationOverlayEnabled && <span> · selected 1-depth relation lines</span>}
      {missingCount > 0 && <span style={noticeWarningStyle}> · missing targets {missingCount}</span>}
    </div>
  )
}

const rootStyle = {
  position: 'relative',
  width: '100%',
  height: '100%',
  overflow: 'hidden',
  background: '#11151F',
}

const mapContainerStyle = {
  position: 'absolute',
  inset: 0,
}

const betaBadgeStyle = {
  position: 'absolute',
  top: 48,
  left: 12,
  zIndex: 740,
  padding: '4px 10px',
  borderRadius: 4,
  background: 'rgba(19,22,31,0.92)',
  border: '1px solid rgba(80,170,175,0.42)',
  color: '#50AAAF',
  fontSize: 12,
  fontWeight: 900,
}

const countRowStyle = {
  position: 'absolute',
  top: 84,
  right: 12,
  zIndex: 710,
  display: 'flex',
  gap: 5,
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
  maxWidth: 430,
}

const noticeStyle = {
  position: 'absolute',
  left: 12,
  zIndex: 720,
  maxWidth: 440,
  padding: '7px 10px',
  borderRadius: 6,
  border: '1px solid rgba(80,170,175,0.22)',
  background: 'rgba(12,14,20,0.72)',
  color: 'var(--t3)',
  fontSize: 11,
  fontWeight: 800,
}

const noticeStrongStyle = {
  color: '#F4F6FA',
}

const noticeWarningStyle = {
  color: 'var(--warn)',
}

const emptyStyle = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  color: 'var(--t3)',
  textAlign: 'center',
  padding: 24,
  background: 'rgba(13,17,26,0.66)',
  pointerEvents: 'none',
  zIndex: 690,
}

const emptyTitleStyle = {
  color: 'var(--t1)',
  fontSize: 15,
  fontWeight: 900,
}

const emptyHintStyle = {
  color: 'var(--t3)',
  fontSize: 13,
}
