/**
 * MapLibre 2D 지도 — Item의 bbox/geometry를 마커로 표시
 */
import { useRef, useEffect, useState } from 'react'
import maplibregl from 'maplibre-gl'
import { getCategoryInfo } from '../constants'

export default function MapView({ items, hoveredId, selectedId, onSelectItem }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef([])

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
    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // 마커 업데이트
  useEffect(() => {
    if (!mapRef.current) return

    // 기존 마커 제거
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    items.forEach(item => {
      const center = getItemCenter(item)
      if (!center) return

      const cat = getCategoryInfo(item.properties?.data_category)
      const isHovered = item.id === hoveredId
      const isSelected = item.id === selectedId

      const el = document.createElement('div')
      el.style.cssText = `
        width: 24px; height: 24px; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-size: 14px; cursor: pointer;
        background: ${cat.color}30;
        border: 2px solid ${cat.color};
        color: ${cat.color};
        transition: transform 0.15s;
        ${isHovered || isSelected ? 'transform: scale(1.4); z-index: 10;' : ''}
      `
      el.textContent = cat.icon
      el.addEventListener('click', () => onSelectItem(item))

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat(center)
        .addTo(mapRef.current)

      markersRef.current.push(marker)
    })
  }, [items, hoveredId, selectedId])

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
  )
}

function getItemCenter(item) {
  const bbox = item.bbox
  if (bbox && bbox.length >= 4) {
    return [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2]
  }
  const geom = item.geometry
  if (geom?.type === 'Point' && geom.coordinates) {
    return geom.coordinates
  }
  if (geom?.type === 'Polygon' && geom.coordinates?.[0]) {
    const ring = geom.coordinates[0]
    const lngs = ring.map(c => c[0])
    const lats = ring.map(c => c[1])
    return [(Math.min(...lngs) + Math.max(...lngs)) / 2, (Math.min(...lats) + Math.max(...lats)) / 2]
  }
  return null
}
