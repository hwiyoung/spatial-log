/**
 * GeoViewer - 지리좌표 기반 3D 데이터 가시화 컴포넌트
 * Cesium 기반으로 포인트 클라우드, 3D Tiles 등을 지구본 위에 표시
 */
import { useRef, useEffect, useState } from 'react'
import {
  Viewer as CesiumViewer,
  Cartesian3,
  Color,
  Ion,
} from 'cesium'
import { AlertTriangle, Loader2, Globe, Map, RotateCw } from 'lucide-react'
import type { SpatialInfo } from '@/services/api'
import type { Entity } from 'cesium'
import { load3DTiles, loadGLB, setEntityOrientation } from './cesiumLoaders'

interface GeoViewerProps {
  // 데이터 URL (PLY, 3D Tiles tileset.json 등)
  dataUrl: string
  // 데이터 타입
  dataType: 'ply' | '3dtiles' | 'glb'
  // 공간 정보 (좌표계, 중심점 등)
  spatialInfo?: SpatialInfo
  // 파일명
  fileName?: string
  // 닫기 콜백
  onClose?: () => void
}

export default function GeoViewer({
  dataUrl,
  dataType,
  spatialInfo,
  fileName,
  onClose,
}: GeoViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<CesiumViewer | null>(null)
  const entityRef = useRef<Entity | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadingStatus, setLoadingStatus] = useState('지도 초기화 중...')
  const [error, setError] = useState<string | null>(null)
  const [heading, setHeading] = useState(0) // 모델 방향 (도 단위)

  useEffect(() => {
    if (!containerRef.current) return

    let viewer: CesiumViewer | null = null

    const initViewer = async () => {
      try {
        setLoadingStatus('Cesium 초기화 중...')

        // Cesium Ion 토큰 설정 (환경변수에서 가져오거나 비활성화)
        const ionToken = import.meta.env.VITE_CESIUM_ION_TOKEN
        if (ionToken) {
          Ion.defaultAccessToken = ionToken
        }

        // Cesium Viewer 생성 (Ion 토큰 없으면 기본 이미지 사용)
        viewer = new CesiumViewer(containerRef.current!, {
          timeline: false,
          animation: false,
          homeButton: true,
          sceneModePicker: true,
          baseLayerPicker: false, // Ion 없이는 비활성화
          navigationHelpButton: false,
          fullscreenButton: false,
          geocoder: false,
          infoBox: true,
          selectionIndicator: true,
          baseLayer: ionToken ? undefined : false, // Ion 없으면 이미지 비활성화
          terrainProvider: undefined, // 지형 비활성화 (성능)
        })

        viewerRef.current = viewer

        // Ion 토큰 없으면 지구 표면 색상 설정
        if (!ionToken) {
          viewer.scene.globe.baseColor = Color.fromCssColorString('#2d4a5e')
        }
        viewer.scene.backgroundColor = Color.fromCssColorString('#0f0f1a')

        // 초기 카메라 위치 (대한민국 중심 또는 데이터 중심)
        // center에 longitude/latitude가 없으면 기본 위치 사용
        const hasGeoCenter = spatialInfo?.center?.longitude !== undefined && spatialInfo?.center?.latitude !== undefined
        const centerLon = hasGeoCenter ? spatialInfo!.center!.longitude! : 127.5
        const centerLat = hasGeoCenter ? spatialInfo!.center!.latitude! : 36.5
        const defaultAltitude = 500000 // 500km

        viewer.camera.flyTo({
          destination: Cartesian3.fromDegrees(
            centerLon,
            centerLat,
            defaultAltitude
          ),
          duration: 0,
        })

        // 데이터 타입에 따라 로드
        setLoadingStatus('3D 데이터 로딩 중...')

        if (dataType === '3dtiles') {
          await load3DTiles(viewer, dataUrl, spatialInfo)
        } else if (dataType === 'glb') {
          const entity = await loadGLB(viewer, dataUrl, spatialInfo, 0)
          entityRef.current = entity
        } else if (dataType === 'ply') {
          setError('E57/PLY 파일의 Cesium 지리 가시화는 아직 지원되지 않습니다. 3D 미리보기를 이용해주세요.')
        }

        setIsLoading(false)
      } catch (err) {
        console.error('GeoViewer 초기화 오류:', err)
        setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.')
        setIsLoading(false)
      }
    }

    initViewer()

    // Cleanup
    return () => {
      if (viewer && !viewer.isDestroyed()) {
        viewer.destroy()
      }
      viewerRef.current = null
      entityRef.current = null
    }
  }, [dataUrl, dataType, spatialInfo])

  // heading 변경 시 Entity orientation 업데이트
  useEffect(() => {
    const entity = entityRef.current
    const viewer = viewerRef.current
    if (!entity || !viewer || dataType !== 'glb') return

    // 위치 정보 가져오기
    const hasGeoCenter = spatialInfo?.center?.longitude !== undefined && spatialInfo?.center?.latitude !== undefined
    const longitude = hasGeoCenter ? spatialInfo!.center!.longitude! : 127.0
    const latitude = hasGeoCenter ? spatialInfo!.center!.latitude! : 36.5
    let altitude = 0
    if (spatialInfo?.bbox) {
      const modelHeightM = Math.abs(spatialInfo.bbox.maxZ - spatialInfo.bbox.minZ)
      altitude = modelHeightM / 2
    }

    const position = Cartesian3.fromDegrees(longitude, latitude, altitude)
    setEntityOrientation(entity, position, heading)
    console.log('Heading updated:', heading, 'degrees')
  }, [heading, dataType, spatialInfo])

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
      <div className="bg-slate-900 rounded-xl border border-slate-700 w-full max-w-6xl h-[85vh] shadow-2xl flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <Globe size={20} className="text-green-400" />
            <div>
              <h2 className="text-lg font-semibold text-white">
                지리 좌표 기반 가시화
              </h2>
              {fileName && (
                <p className="text-xs text-slate-400">{fileName}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* 좌표 정보 표시 */}
            {spatialInfo?.center?.longitude !== undefined && spatialInfo?.center?.latitude !== undefined ? (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Map size={14} />
                <span>
                  {spatialInfo.center.latitude.toFixed(4)}°N,{' '}
                  {spatialInfo.center.longitude.toFixed(4)}°E
                </span>
                {spatialInfo.epsg && (
                  <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded">
                    EPSG:{spatialInfo.epsg}
                  </span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-yellow-400">
                <AlertTriangle size={14} />
                <span>지리 좌표 정보 없음 (기본 위치에 표시)</span>
              </div>
            )}
            {/* 방향 조정 슬라이더 (GLB만 지원) */}
            {dataType === 'glb' && !isLoading && (
              <div className="flex items-center gap-2 px-3 py-1 bg-slate-800 rounded-lg">
                <RotateCw size={14} className="text-slate-400" />
                <span className="text-xs text-slate-400 w-12">방향</span>
                <input
                  type="range"
                  min="0"
                  max="360"
                  step="5"
                  value={heading}
                  onChange={(e) => setHeading(Number(e.target.value))}
                  className="w-24 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <span className="text-xs text-slate-300 w-10 text-right">{heading}°</span>
              </div>
            )}
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* 뷰어 영역 */}
        <div className="flex-1 relative">
          {error ? (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
              <div className="flex flex-col items-center gap-3 text-center p-6">
                <AlertTriangle className="w-12 h-12 text-yellow-500" />
                <h3 className="text-white font-semibold">데이터를 불러올 수 없습니다</h3>
                <p className="text-slate-400 text-sm max-w-md">{error}</p>
              </div>
            </div>
          ) : isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900 z-10">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-green-400 animate-spin" />
                <span className="text-slate-400 text-sm">{loadingStatus}</span>
              </div>
            </div>
          ) : null}
          <div ref={containerRef} className="w-full h-full" />
        </div>

        {/* 푸터 - 도움말 */}
        <div className="px-4 py-2 bg-slate-800/50 border-t border-slate-700 text-xs text-slate-500">
          <span>마우스 드래그로 회전 | 스크롤로 확대/축소 | Ctrl+드래그로 기울기 조절</span>
        </div>
      </div>
    </div>
  )
}
