/**
 * MapLibre 2D 지도 — Item의 bbox/geometry를 마커로 표시
 */
import { useRef, useEffect, useMemo, useState } from 'react'
import maplibregl from 'maplibre-gl'
import { getCategoryInfo } from '../constants'
import { itemsToMapMarkers } from '../features/explorer-map/itemsToMapMarkers.js'
import { getItemsBounds } from '../features/explorer-map/getItemsBounds.js'
import { getItemStatus, getStatusInfo } from '../features/items/getItemStatus.js'
import { getItemVisibilityFlags } from '../features/items/getItemVisibilityFlags.js'

export default function MapView({ items, hoveredId, selectedId, onSelectItem }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef([])
  const hasFitVisibleItemsRef = useRef(false)
  const [mapLoaded, setMapLoaded] = useState(false)
  const mapMarkers = useMemo(() => itemsToMapMarkers(items), [items])

  // 지도 초기화
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

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
      center: [128.6, 35.9], // 한국 중부
      zoom: 7,
    })

    map.addControl(new maplibregl.NavigationControl(), 'top-right')
    map.on('load', () => setMapLoaded(true))
    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
      setMapLoaded(false)
    }
  }, [])

  // visible item 변경 시 전체 marker 범위로 맞춤
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return
    const bounds = getItemsBounds(items)
    if (!bounds) {
      hasFitVisibleItemsRef.current = false
      return
    }
    const [w, s, e, n] = bounds
    if (w === e && s === n) {
      mapRef.current.flyTo({ center: [w, s], zoom: 14, duration: hasFitVisibleItemsRef.current ? 350 : 0 })
    } else {
      mapRef.current.fitBounds([[w, s], [e, n]], {
        padding: 80,
        duration: hasFitVisibleItemsRef.current ? 350 : 0,
        maxZoom: 15,
      })
    }
    hasFitVisibleItemsRef.current = true
  }, [items, mapLoaded])

  // 선택 아이템 변경 시 선택 marker로 줌인
  useEffect(() => {
    if (!mapRef.current || !selectedId) return
    const marker = mapMarkers.find(candidate => candidate.id === selectedId)
    if (!marker) return

    const [w, s, e, n] = marker.bounds || []
    if (Number.isFinite(w) && Number.isFinite(s) && Number.isFinite(e) && Number.isFinite(n) && (w !== e || s !== n)) {
      mapRef.current.fitBounds([[w, s], [e, n]], { padding: 80, duration: 800, maxZoom: 18 })
    } else {
      mapRef.current.flyTo({ center: marker.position, zoom: 15, duration: 800 })
    }
  }, [selectedId, mapMarkers])

  // 마커 업데이트
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return

    // 기존 마커 제거
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    mapMarkers.forEach(markerData => {
      const { item, position, positionSource } = markerData

      const cat = getCategoryInfo(item.properties?.data_category)
      const status = getItemStatus(item)
      const statusInfo = getStatusInfo(status)
      const flags = getItemVisibilityFlags(item)
      const isHovered = item.id === hoveredId
      const isSelected = item.id === selectedId
      const isFallback = positionSource === 'fallback'
      const borderColor = flags.isPublished ? cat.color : statusInfo.markerColor

      const el = document.createElement('div')
      el.style.cssText = `
        width: 32px; height: 32px; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-size: 16px; cursor: pointer;
        background: ${cat.color}90;
        border: ${isFallback ? '2.5px dashed' : '2.5px solid'} ${borderColor};
        color: #fff;
        box-shadow: 0 1px 4px rgba(0,0,0,0.5);
        transition: transform 0.15s;
        ${isHovered || isSelected ? 'transform: scale(1.5); z-index: 10;' : ''}
      `
      el.textContent = cat.icon
      el.title = `${statusInfo.label} · ${item.properties?.['project:name'] || item.collection || item.id}`
      el.addEventListener('click', () => onSelectItem(item))

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat(position)
        .addTo(mapRef.current)

      markersRef.current.push(marker)
    })
  }, [mapMarkers, hoveredId, selectedId, mapLoaded])

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
  )
}
