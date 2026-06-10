/**
 * LocationPicker — 지도 클릭으로 위치 지정하는 모달
 *
 * 3D 모델(OBJ, FBX 등) 등 지리좌표가 없는 파일의 위치를 수동 지정할 때 사용.
 * 클릭하면 마커가 찍히고, 확인 시 [lng, lat] 좌표를 반환.
 */
import { useRef, useEffect, useState } from 'react'
import maplibregl from 'maplibre-gl'

export default function LocationPicker({ initialLocation, onConfirm, onCancel }) {
  const mapContainerRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const [location, setLocation] = useState(initialLocation || null)

  useEffect(() => {
    if (!mapContainerRef.current) return

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
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
          id: 'osm', type: 'raster', source: 'osm',
          minzoom: 0, maxzoom: 19,
        }],
      },
      center: initialLocation || [128.6, 35.9],
      zoom: initialLocation ? 14 : 7,
    })

    map.addControl(new maplibregl.NavigationControl(), 'top-right')

    // 초기 마커
    if (initialLocation) {
      markerRef.current = new maplibregl.Marker({ color: '#3B82F6' })
        .setLngLat(initialLocation)
        .addTo(map)
    }

    // 클릭 시 마커 배치
    map.on('click', (e) => {
      const { lng, lat } = e.lngLat
      setLocation([lng, lat])

      if (markerRef.current) markerRef.current.remove()
      markerRef.current = new maplibregl.Marker({ color: '#3B82F6' })
        .setLngLat([lng, lat])
        .addTo(map)
    })

    mapRef.current = map
    return () => { map.remove(); mapRef.current = null }
  }, [])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: '80vw', height: '80vh', maxWidth: 1200, maxHeight: 800,
        background: 'var(--s1)', borderRadius: 12,
        border: '1px solid var(--bd)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* 헤더 */}
        <div style={{
          padding: '12px 16px', borderBottom: '1px solid var(--bd)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--t1)' }}>
            위치 지정
          </span>
          <span
            onClick={onCancel}
            style={{ fontSize: 16, color: 'var(--t3)', cursor: 'pointer' }}
          >✕</span>
        </div>

        {/* 지도 */}
        <div style={{ flex: 1, position: 'relative' }}>
          <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
          {!location && (
            <div style={{
              position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
              padding: '6px 14px', background: 'var(--s1)', borderRadius: 6,
              fontSize: 13, color: 'var(--t2)', border: '1px solid var(--bd)',
              pointerEvents: 'none',
            }}>
              지도를 클릭하여 위치를 지정하세요
            </div>
          )}
        </div>

        {/* 하단: 좌표 + 버튼 */}
        <div style={{
          padding: '10px 16px', borderTop: '1px solid var(--bd)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: 13, fontFamily: 'monospace', color: 'var(--t2)' }}>
            {location
              ? `경도 ${location[0].toFixed(6)}° / 위도 ${location[1].toFixed(6)}°`
              : '선택된 위치 없음'}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onCancel}
              style={{
                padding: '7px 16px', borderRadius: 6,
                border: '1px solid var(--bd)', background: 'transparent',
                color: 'var(--t2)', fontSize: 13, cursor: 'pointer',
              }}
            >취소</button>
            <button
              onClick={() => location && onConfirm(location)}
              disabled={!location}
              style={{
                padding: '7px 16px', borderRadius: 6, border: 'none',
                background: location ? 'var(--ac)' : 'var(--bd)',
                color: '#fff', fontSize: 13, fontWeight: 600,
                cursor: location ? 'pointer' : 'default',
              }}
            >확인</button>
          </div>
        </div>
      </div>
    </div>
  )
}
