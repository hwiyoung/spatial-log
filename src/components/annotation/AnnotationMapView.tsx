import { useEffect, useMemo, useState, lazy, Suspense, useCallback, Component, type ReactNode, type ErrorInfo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet'
import L, { type LeafletMouseEvent } from 'leaflet'
import { PenTool, Map as MapIcon, Globe, Loader2 } from 'lucide-react'
import type { AnnotationData, FlightPathPoint } from '@/services/api'
import FlightPathLayer from '@/components/viewer/FlightPathLayer'
import { getPriorityColor, PRIORITY_COLORS } from '@/constants/annotation'
import 'leaflet/dist/leaflet.css'

// Cesium 컴포넌트 지연 로딩 (무거운 번들 최적화)
const AnnotationMapView3D = lazy(() => import('./AnnotationMapView3D'))

// 3D 맵 에러 바운더리
interface ErrorBoundaryProps {
  children: ReactNode
  onError: () => void
}

interface ErrorBoundaryState {
  hasError: boolean
}

class Map3DErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('3D 맵 로드 실패:', error, errorInfo)
    this.props.onError()
  }

  render() {
    if (this.state.hasError) {
      return null
    }
    return this.props.children
  }
}

type MapMode = '2D' | '3D'

interface AnnotationMapViewProps {
  annotations: AnnotationData[]
  selectedId: string | null
  onAnnotationClick: (annotation: AnnotationData) => void
  onMapClick?: (lat: number, lng: number) => void
  isCreateMode: boolean
  onCreateModeChange?: (mode: boolean) => void
  pendingPosition?: { lat: number; lng: number } | null
  onConfirmPosition?: () => void
  onCancelPosition?: () => void
  center?: [number, number]
  zoom?: number
  flightPaths?: FlightPathPoint[]
}

function createMarkerIcon(priority: string, isSelected: boolean): L.DivIcon {
  const color = getPriorityColor(priority)
  const size = isSelected ? 32 : 24
  const borderWidth = isSelected ? 3 : 2

  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background-color: ${color};
        border: ${borderWidth}px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        transform: translate(-50%, -50%);
      "></div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

function MapClickHandler({
  onMapClick,
  isCreateMode,
}: {
  onMapClick?: (lat: number, lng: number) => void
  isCreateMode: boolean
}) {
  useMapEvents({
    click: (e: LeafletMouseEvent) => {
      if (isCreateMode && onMapClick) {
        onMapClick(e.latlng.lat, e.latlng.lng)
      }
    },
  })
  return null
}

function createPendingMarkerIcon(): L.DivIcon {
  return L.divIcon({
    className: 'pending-marker',
    html: `
      <div style="
        width: 32px;
        height: 32px;
        background-color: #f97316;
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        transform: translate(-50%, -50%);
        animation: pulse 1.5s ease-in-out infinite;
      "></div>
      <style>
        @keyframes pulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          50% { transform: translate(-50%, -50%) scale(1.2); opacity: 0.8; }
        }
      </style>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  })
}

function FlyToSelected({
  selectedAnnotation,
}: {
  selectedAnnotation: AnnotationData | null
}) {
  const map = useMap()

  useEffect(() => {
    if (selectedAnnotation?.gps) {
      map.flyTo([selectedAnnotation.gps.latitude, selectedAnnotation.gps.longitude], 12, {
        duration: 0.5,
      })
    }
  }, [selectedAnnotation, map])

  return null
}

export default function AnnotationMapView({
  annotations,
  selectedId,
  onAnnotationClick,
  onMapClick,
  isCreateMode,
  onCreateModeChange,
  pendingPosition,
  onConfirmPosition,
  onCancelPosition,
  center = [36.5, 127.5],
  zoom = 7,
  flightPaths = [],
}: AnnotationMapViewProps) {
  const [mapMode, setMapMode] = useState<MapMode>('2D')
  const [map3DError, setMap3DError] = useState(false)

  // 3D 맵 에러 핸들러
  const handle3DError = useCallback(() => {
    console.warn('3D 맵 로드 실패로 2D 모드로 전환합니다.')
    setMap3DError(true)
    setMapMode('2D')
  }, [])

  const annotationsWithGps = useMemo(
    () => annotations.filter((a) => a.gps !== null),
    [annotations]
  )

  const selectedAnnotation = useMemo(
    () => annotationsWithGps.find((a) => a.id === selectedId) || null,
    [annotationsWithGps, selectedId]
  )

  return (
    <div className="relative w-full h-full">
      {/* 맵 상단 툴바 */}
      <div className="absolute top-4 left-4 z-[1000] flex items-center gap-2">
        <div className="bg-slate-900/90 backdrop-blur border border-slate-700 px-3 py-1.5 rounded-lg text-xs text-white shadow-lg">
          <span className="font-bold text-blue-400">분포 현황</span> : 전체 프로젝트 통합 뷰
        </div>

        {/* 2D/3D 토글 버튼 */}
        <div className="bg-slate-900/90 backdrop-blur border border-slate-700 rounded-lg shadow-lg flex">
          <button
            onClick={() => setMapMode('2D')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-l-lg transition-colors ${
              mapMode === '2D'
                ? 'bg-blue-500 text-white'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <MapIcon size={14} />
            <span>2D</span>
          </button>
          <button
            onClick={() => !map3DError && setMapMode('3D')}
            disabled={map3DError}
            title={map3DError ? '3D 맵을 사용할 수 없습니다' : '3D 지구본 보기'}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-r-lg transition-colors ${
              mapMode === '3D'
                ? 'bg-blue-500 text-white'
                : map3DError
                  ? 'text-slate-500 cursor-not-allowed'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Globe size={14} />
            <span>3D</span>
          </button>
        </div>

        {onCreateModeChange && (
          <button
            onClick={() => {
              onCreateModeChange(!isCreateMode)
              if (isCreateMode && onCancelPosition) {
                onCancelPosition()
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs shadow-lg transition-colors ${
              isCreateMode
                ? 'bg-orange-500/90 text-white border border-orange-400'
                : 'bg-slate-900/90 backdrop-blur border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <PenTool size={14} />
            <span>{isCreateMode ? '추가 모드 종료' : '맵에서 추가'}</span>
          </button>
        )}
      </div>

      {/* 3D 맵 (Cesium) */}
      {mapMode === '3D' && (
        <Map3DErrorBoundary onError={handle3DError}>
          <Suspense
            fallback={
              <div className="w-full h-full flex items-center justify-center bg-slate-900">
                <div className="flex flex-col items-center gap-2 text-slate-400">
                  <Loader2 size={32} className="animate-spin" />
                  <span className="text-sm">3D 지구본 로딩 중...</span>
                </div>
              </div>
            }
          >
            <AnnotationMapView3D
              annotations={annotations}
              selectedId={selectedId}
              onAnnotationClick={onAnnotationClick}
              onMapClick={onMapClick}
              isCreateMode={isCreateMode}
              pendingPosition={pendingPosition}
            />
            {/* 임시 마커 확인 UI (3D 모드) */}
            {pendingPosition && (
              <div className="absolute bottom-4 left-4 right-4 z-[1000] flex justify-center">
                <div className="bg-slate-900/95 backdrop-blur border border-slate-700 rounded-lg px-4 py-3 shadow-xl flex items-center gap-4">
                  <span className="text-sm text-slate-300">이 위치에 추가할까요?</span>
                  <div className="flex gap-2">
                    <button
                      onClick={onCancelPosition}
                      className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
                    >
                      취소
                    </button>
                    <button
                      onClick={onConfirmPosition}
                      className="px-3 py-1.5 text-xs bg-orange-500 hover:bg-orange-400 text-white rounded transition-colors"
                    >
                      추가
                    </button>
                  </div>
                </div>
              </div>
            )}
          </Suspense>
        </Map3DErrorBoundary>
      )}

      {/* 2D 맵 (Leaflet) */}
      {mapMode === '2D' && (
        <>
          {/* 추가 모드 안내 오버레이 */}
          {isCreateMode && !pendingPosition && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[999]">
              <div className="bg-orange-500/20 border-2 border-dashed border-orange-400 rounded-xl px-6 py-4 text-orange-300 text-sm backdrop-blur-sm">
                맵을 클릭하여 위치를 선택하세요
              </div>
            </div>
          )}

          <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={true}
        className="w-full h-full rounded-lg"
        style={{ background: '#1e293b' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        <MapClickHandler onMapClick={onMapClick} isCreateMode={isCreateMode} />
        <FlyToSelected selectedAnnotation={selectedAnnotation} />

        {/* 드론 비행경로 */}
        {flightPaths.length > 0 && <FlightPathLayer points={flightPaths} />}

        {/* 기존 어노테이션 마커들 */}
        {annotationsWithGps.map((annotation) => (
          <Marker
            key={annotation.id}
            position={[annotation.gps!.latitude, annotation.gps!.longitude]}
            icon={createMarkerIcon(annotation.priority, annotation.id === selectedId)}
            eventHandlers={{
              click: () => onAnnotationClick(annotation),
            }}
          >
            <Popup>
              <div className="min-w-[150px]">
                <h3 className="font-semibold text-slate-900">{annotation.title}</h3>
                {annotation.description && (
                  <p className="text-sm text-slate-600 mt-1">{annotation.description}</p>
                )}
                <div className="flex gap-2 mt-2">
                  <span
                    className="text-xs px-2 py-0.5 rounded"
                    style={{
                      backgroundColor: `${PRIORITY_COLORS[annotation.priority]}20`,
                      color: PRIORITY_COLORS[annotation.priority],
                    }}
                  >
                    {annotation.priority}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-200 text-slate-600">
                    {annotation.status}
                  </span>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* 임시 마커 (위치 선택 후) */}
        {pendingPosition && (
          <Marker
            position={[pendingPosition.lat, pendingPosition.lng]}
            icon={createPendingMarkerIcon()}
          >
            <Popup>
              <div className="min-w-[160px] p-1">
                <p className="text-sm text-slate-600 mb-3 text-center">이 위치에 추가할까요?</p>
                <div className="flex gap-2">
                  <button
                    onClick={onCancelPosition}
                    className="flex-1 px-2 py-1.5 text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 rounded transition-colors"
                  >
                    취소
                  </button>
                  <button
                    onClick={onConfirmPosition}
                    className="flex-1 px-2 py-1.5 text-xs bg-orange-500 hover:bg-orange-400 text-white rounded transition-colors"
                  >
                    추가
                  </button>
                </div>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>
        </>
      )}
    </div>
  )
}
