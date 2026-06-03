/**
 * MapLibre 2D 지도 — Item의 bbox/geometry를 마커로 표시
 */
import { useRef, useEffect, useState } from 'react'
import maplibregl from 'maplibre-gl'
import { getCategoryInfo, getItemStatus } from '../constants'

export default function MapView({ items, hoveredId, selectedId, onSelectItem }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef([])
  const [mapLoaded, setMapLoaded] = useState(false)

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

  // 선택 아이템 변경 시 bbox로 줌인
  useEffect(() => {
    if (!mapRef.current || !selectedId) return
    const item = items.find(i => i.id === selectedId)
    if (!item) return

    const bbox = item.bbox
    if (bbox && bbox.length >= 4) {
      const [w, s, e, n] = [bbox[0], bbox[1], bbox[2], bbox[3]]
      if (isValidLngLat(w, s) && isValidLngLat(e, n)) {
        if (Math.abs(e - w) < 0.0001 && Math.abs(n - s) < 0.0001) {
          mapRef.current.flyTo({ center: [(w + e) / 2, (s + n) / 2], zoom: 16, duration: 800 })
        } else {
          mapRef.current.fitBounds([[w, s], [e, n]], { padding: 80, duration: 800, maxZoom: 18 })
        }
        return
      }
    }

    const center = getItemCenter(item)
    if (center) {
      mapRef.current.flyTo({ center, zoom: 15, duration: 800 })
    }
  }, [selectedId])

  // 마커 업데이트
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return

    // 기존 마커 제거
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    items.forEach(item => {
      const center = getItemCenter(item)
      if (!center) return

      const cat = getCategoryInfo(item.properties?.data_category)
      const status = getItemStatus(item)
      const isHovered = item.id === hoveredId
      const isSelected = item.id === selectedId
      const isFallback = item.properties?.['mock:spatial_state'] === 'fallback'
      const borderColor = status === 'draft' ? '#D7B84A' : cat.color

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
      el.addEventListener('click', () => onSelectItem(item))

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat(center)
        .addTo(mapRef.current)

      markersRef.current.push(marker)
    })
  }, [items, hoveredId, selectedId, mapLoaded])

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
  )
}

function isValidLngLat(lng, lat) {
  return lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90
    && !(lng === 0 && lat === 0)
}

function getItemCenter(item) {
  const bbox = item.bbox
  if (bbox && bbox.length >= 4) {
    const lng = (bbox[0] + bbox[2]) / 2
    const lat = (bbox[1] + bbox[3]) / 2
    if (isValidLngLat(lng, lat)) return [lng, lat]
  }
  const geom = item.geometry
  if (geom?.type === 'Point' && geom.coordinates) {
    const [lng, lat] = geom.coordinates
    if (isValidLngLat(lng, lat)) return [lng, lat]
  }
  if (geom?.type === 'Polygon' && geom.coordinates?.[0]) {
    const ring = geom.coordinates[0]
    const lngs = ring.map(c => c[0])
    const lats = ring.map(c => c[1])
    const lng = (Math.min(...lngs) + Math.max(...lngs)) / 2
    const lat = (Math.min(...lats) + Math.max(...lats)) / 2
    if (isValidLngLat(lng, lat)) return [lng, lat]
  }
  const fallbackCenter = item.properties?.['mock:fallback_center']
  if (Array.isArray(fallbackCenter) && fallbackCenter.length >= 2) {
    const [lng, lat] = fallbackCenter
    if (isValidLngLat(lng, lat)) return [lng, lat]
  }
  return null
}
