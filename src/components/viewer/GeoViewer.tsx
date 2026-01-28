/**
 * GeoViewer - 지리좌표 기반 3D 데이터 가시화 컴포넌트
 * Cesium 기반으로 포인트 클라우드, 3D Tiles 등을 지구본 위에 표시
 */
import { useRef, useEffect, useState } from 'react'
import {
  Viewer as CesiumViewer,
  Cartesian3,
  Color,
  OpenStreetMapImageryProvider,
  Cesium3DTileset,
  HeadingPitchRange,
  Math as CesiumMath,
  IonResource,
  Resource,
  PointPrimitiveCollection,
  PointPrimitive,
  BoundingSphere,
  Transforms,
  Matrix4,
  HeadingPitchRoll,
} from 'cesium'
import { AlertTriangle, Loader2, Globe, Box, Map } from 'lucide-react'
import type { SpatialInfo } from '@/services/api'

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
  const [isLoading, setIsLoading] = useState(true)
  const [loadingStatus, setLoadingStatus] = useState('지도 초기화 중...')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    let viewer: CesiumViewer | null = null
    let tileset: Cesium3DTileset | null = null

    const initViewer = async () => {
      try {
        setLoadingStatus('Cesium 초기화 중...')

        // OpenStreetMap 이미저리 프로바이더
        const osmProvider = new OpenStreetMapImageryProvider({
          url: 'https://tile.openstreetmap.org/',
        })

        // Cesium Viewer 생성
        viewer = new CesiumViewer(containerRef.current!, {
          timeline: false,
          animation: false,
          homeButton: true,
          sceneModePicker: true,
          baseLayerPicker: false,
          navigationHelpButton: false,
          fullscreenButton: false,
          geocoder: false,
          infoBox: true,
          selectionIndicator: true,
          baseLayer: false,
        })

        // OSM 레이어 추가
        viewer.imageryLayers.addImageryProvider(osmProvider)
        viewerRef.current = viewer

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
          await loadGLB(viewer, dataUrl, spatialInfo)
        } else if (dataType === 'ply') {
          // PLY는 현재 직접 지원하지 않음, 3D Tiles로 변환 필요
          setError('PLY 파일의 지리 가시화는 3D Tiles 변환 후 지원됩니다.')
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
      if (tileset) {
        viewer?.scene.primitives.remove(tileset)
      }
      if (viewer && !viewer.isDestroyed()) {
        viewer.destroy()
      }
      viewerRef.current = null
    }
  }, [dataUrl, dataType, spatialInfo])

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

/**
 * 3D Tiles 로드
 */
async function load3DTiles(
  viewer: CesiumViewer,
  url: string,
  spatialInfo?: SpatialInfo
) {
  try {
    console.log('Loading 3D Tiles from:', url)
    console.log('Spatial info:', spatialInfo)

    // 3D Tileset 로드
    const tileset = await Cesium3DTileset.fromUrl(url)
    viewer.scene.primitives.add(tileset)

    // tileset.json에 transform이 있으면 Cesium이 자동으로 적용
    // spatialInfo가 있으면 카메라 위치로만 사용
    const hasGeoCenter = spatialInfo?.center?.longitude !== undefined && spatialInfo?.center?.latitude !== undefined
    const longitude = hasGeoCenter ? spatialInfo!.center!.longitude! : 127.0
    const latitude = hasGeoCenter ? spatialInfo!.center!.latitude! : 36.5
    const altitude = spatialInfo?.center?.altitude ?? 100

    console.log('Camera target:', { longitude, latitude, altitude, hasGeoCenter })

    // 타일셋 바운딩 볼륨 확인 및 자동 줌
    tileset.readyEvent.addEventListener(() => {
      console.log('Tileset ready')
      console.log('Tileset bounding sphere:', tileset.boundingSphere)
      console.log('Tileset root transform:', tileset.root?.transform)

      // 타일셋의 실제 바운딩 영역으로 자동 줌
      viewer.zoomTo(tileset, new HeadingPitchRange(
        CesiumMath.toRadians(0),
        CesiumMath.toRadians(-45),
        tileset.boundingSphere.radius * 3
      ))
    })

    return tileset
  } catch (err) {
    console.error('3D Tiles 로드 실패:', err)
    throw new Error(`3D Tiles 데이터를 로드할 수 없습니다: ${err instanceof Error ? err.message : String(err)}`)
  }
}

/**
 * GLB 모델 로드 (Entity API 사용)
 */
async function loadGLB(
  viewer: CesiumViewer,
  url: string,
  spatialInfo?: SpatialInfo
) {
  try {
    console.log('=== Loading GLB ===')
    console.log('URL:', url)
    console.log('Spatial info:', JSON.stringify(spatialInfo, null, 2))

    // 위치 결정 (center.longitude/latitude가 있으면 사용, 없으면 기본값)
    const hasGeoCenter = spatialInfo?.center?.longitude !== undefined && spatialInfo?.center?.latitude !== undefined
    const longitude = hasGeoCenter ? spatialInfo!.center!.longitude! : 127.0
    const latitude = hasGeoCenter ? spatialInfo!.center!.latitude! : 36.5
    // 고도: 지표면 위에 모델 배치 (기본 10m, 너무 높으면 안보임)
    const altitude = spatialInfo?.center?.altitude ?? 10

    console.log('GLB positioning at:', { longitude, latitude, altitude, hasGeoCenter })

    const position = Cartesian3.fromDegrees(longitude, latitude, altitude)

    const heading = CesiumMath.toRadians(0)
    const pitch = 0
    const roll = 0
    const orientation = Transforms.headingPitchRollQuaternion(
      position,
      new HeadingPitchRoll(heading, pitch, roll)
    )

    // 모델 스케일 계산
    // 변환된 GLB는 이미 정규화된 좌표를 가지므로 스케일 조정이 필요할 수 있음
    let modelScale = 1.0

    if (spatialInfo?.bbox) {
      const bboxWidth = Math.abs(spatialInfo.bbox.maxX - spatialInfo.bbox.minX)
      const bboxHeight = Math.abs(spatialInfo.bbox.maxY - spatialInfo.bbox.minY)
      const bboxDepth = Math.abs(spatialInfo.bbox.maxZ - spatialInfo.bbox.minZ)
      const maxDim = Math.max(bboxWidth, bboxHeight, bboxDepth)

      console.log('BBox dimensions:', { bboxWidth, bboxHeight, bboxDepth, maxDim })

      // GLB는 obj2gltf에서 Y-up으로 변환됨
      // Korea TM 좌표계 (bbox가 큰 미터 단위)인 경우 스케일 조정
      if (spatialInfo.isKoreaTM || (!spatialInfo.isGeographic && maxDim > 1000)) {
        // 모델 크기를 적당한 크기로 스케일링 (100m 정도로)
        modelScale = 100 / maxDim
        console.log('Korea TM scale applied:', modelScale)
      } else if (maxDim > 100) {
        // 일반적인 큰 모델
        modelScale = 50 / maxDim
        console.log('Large model scale applied:', modelScale)
      } else if (maxDim < 1) {
        // 매우 작은 모델 (정규화된 경우)
        modelScale = 50
        console.log('Small model scale applied:', modelScale)
      }
    } else {
      // bbox가 없으면 기본 스케일 사용
      modelScale = 10
      console.log('Default scale applied (no bbox):', modelScale)
    }

    const entity = viewer.entities.add({
      name: 'glb-model',
      position: position,
      orientation: orientation as any,
      model: {
        uri: url,
        minimumPixelSize: 128,
        maximumScale: 50000,
        scale: modelScale,
        shadows: 1, // ENABLED
        silhouetteColor: Color.YELLOW,
        silhouetteSize: 0, // 0 = 비활성화
      },
    })

    console.log('Entity created:', entity.id)

    // 카메라를 모델 위치로 이동 (더 가까이)
    const viewDistance = Math.max(modelScale * 200, 500) // 최소 500m, 스케일에 비례
    console.log('View distance:', viewDistance)

    await viewer.flyTo(entity, {
      duration: 2,
      offset: new HeadingPitchRange(
        CesiumMath.toRadians(0),
        CesiumMath.toRadians(-30),
        viewDistance
      ),
    })

    return entity
  } catch (err) {
    console.error('GLB 로드 실패:', err)
    throw new Error(`GLB 모델을 로드할 수 없습니다: ${err instanceof Error ? err.message : String(err)}`)
  }
}
