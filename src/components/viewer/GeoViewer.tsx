/**
 * GeoViewer - 지리좌표 기반 3D 데이터 가시화 컴포넌트
 * Cesium 기반으로 포인트 클라우드, 3D Tiles 등을 지구본 위에 표시
 */
import { useRef, useEffect, useState } from 'react'
import {
  Viewer as CesiumViewer,
  Cartesian3,
  Color,
  Cesium3DTileset,
  HeadingPitchRange,
  Math as CesiumMath,
  Transforms,
  HeadingPitchRoll,
  Ion,
} from 'cesium'
import { AlertTriangle, Loader2, Globe, Map, RotateCw } from 'lucide-react'
import type { SpatialInfo } from '@/services/api'
import type { Entity } from 'cesium'

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
    let tileset: Cesium3DTileset | null = null

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
    const headingRad = CesiumMath.toRadians(heading)
    const orientation = Transforms.headingPitchRollQuaternion(
      position,
      new HeadingPitchRoll(headingRad, 0, 0)
    )

    // Entity orientation 업데이트
    entity.orientation = orientation as any
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

/**
 * 3D Tiles 로드
 */
async function load3DTiles(
  viewer: CesiumViewer,
  url: string,
  spatialInfo?: SpatialInfo
) {
  try {
    console.log('=== Loading 3D Tiles ===')
    console.log('URL:', url)
    console.log('Spatial info:', JSON.stringify(spatialInfo, null, 2))

    // tileset.json 내용 확인
    try {
      const tilesetResponse = await fetch(url)
      const tilesetJson = await tilesetResponse.json()
      console.log('tileset.json content:', JSON.stringify(tilesetJson, null, 2))
      console.log('Has root transform:', !!tilesetJson.root?.transform)
      console.log('Bounding volume:', tilesetJson.root?.boundingVolume)
    } catch (e) {
      console.warn('Could not fetch tileset.json for debugging:', e)
    }

    // 3D Tileset 로드 (fromUrl은 이미 ready 상태의 tileset을 반환)
    const tileset = await Cesium3DTileset.fromUrl(url)

    // 타일 로드 에러 캡처
    tileset.tileFailed.addEventListener((event: { url: string; message: string }) => {
      console.error('Tile failed to load:', event.url, event.message)
    })

    tileset.tileLoad.addEventListener((tile: { content?: { url?: string } }) => {
      console.log('Tile loaded:', tile.content?.url)
    })

    viewer.scene.primitives.add(tileset)

    console.log('Tileset loaded and ready')
    console.log('Tileset bounding sphere center:', tileset.boundingSphere.center)
    console.log('Tileset bounding sphere radius:', tileset.boundingSphere.radius)
    console.log('Tileset root transform:', tileset.root?.transform)
    console.log('Tileset root boundingVolume:', (tileset.root as any)?.boundingVolume)

    // 바운딩 스피어 반지름이 유효한지 확인
    const radius = tileset.boundingSphere.radius
    if (radius <= 0 || !isFinite(radius)) {
      console.warn('Invalid bounding sphere radius, using default zoom')
      // 좌표 정보가 있으면 해당 위치로 이동
      if (spatialInfo?.center?.longitude && spatialInfo?.center?.latitude) {
        viewer.camera.flyTo({
          destination: Cartesian3.fromDegrees(
            spatialInfo.center.longitude,
            spatialInfo.center.latitude,
            500 // 500m 고도
          ),
          duration: 2,
        })
      }
      return tileset
    }

    // 줌 거리 계산 - 모델 크기에 비례하되 최소/최대 제한
    // 작은 모델(20m)의 경우 너무 멀리 떨어지지 않도록
    let zoomDistance = radius * 3
    zoomDistance = Math.max(zoomDistance, 200) // 최소 200m (더 여유있게)
    zoomDistance = Math.min(zoomDistance, 10000) // 최대 10km

    console.log('Calculated zoom distance:', zoomDistance)

    // 타일셋의 실제 바운딩 영역으로 자동 줌
    try {
      await viewer.zoomTo(tileset, new HeadingPitchRange(
        CesiumMath.toRadians(0),
        CesiumMath.toRadians(-30), // 더 위에서 내려다봄
        zoomDistance
      ))
      console.log('Camera zoomed to tileset successfully')
    } catch (zoomError) {
      console.error('zoomTo failed:', zoomError)
      // 직접 카메라 이동 시도
      if (spatialInfo?.center?.longitude && spatialInfo?.center?.latitude) {
        console.log('Falling back to direct camera flyTo')
        viewer.camera.flyTo({
          destination: Cartesian3.fromDegrees(
            spatialInfo.center.longitude,
            spatialInfo.center.latitude,
            zoomDistance
          ),
          duration: 2,
        })
      }
    }

    // 카메라 현재 위치 로그
    const cameraPos = viewer.camera.positionCartographic
    console.log('Camera position (cartographic):', {
      longitude: CesiumMath.toDegrees(cameraPos.longitude),
      latitude: CesiumMath.toDegrees(cameraPos.latitude),
      height: cameraPos.height
    })

    return tileset
  } catch (err) {
    console.error('3D Tiles 로드 실패:', err)
    throw new Error(`3D Tiles 데이터를 로드할 수 없습니다: ${err instanceof Error ? err.message : String(err)}`)
  }
}

/**
 * GLB 모델 로드 (Entity API 사용)
 *
 * WGS84 변환된 GLB 모델:
 * - 좌표가 로컬 미터 단위로 변환됨 (중심점 기준)
 * - gltf-transform center로 센터링됨 (원점 중심)
 * - 스케일 1.0으로 사용 (이미 미터 단위)
 */
async function loadGLB(
  viewer: CesiumViewer,
  url: string,
  spatialInfo?: SpatialInfo,
  headingDeg: number = 0  // 방향 (도 단위)
) {
  try {
    console.log('=== Loading GLB ===')
    console.log('URL:', url)
    console.log('Spatial info:', JSON.stringify(spatialInfo, null, 2))
    console.log('Heading:', headingDeg, 'degrees')

    // 위치 결정 (center.longitude/latitude가 있으면 사용, 없으면 기본값)
    const hasGeoCenter = spatialInfo?.center?.longitude !== undefined && spatialInfo?.center?.latitude !== undefined
    const longitude = hasGeoCenter ? spatialInfo!.center!.longitude! : 127.0
    const latitude = hasGeoCenter ? spatialInfo!.center!.latitude! : 36.5

    // 고도 계산
    // WGS84 변환된 GLB는 센터링되어 있으므로, 건물 높이의 절반만큼 올려서 바닥이 지면에 닿도록
    let altitude = 0
    let modelHeightM = 0

    if (spatialInfo?.bbox) {
      // bbox.maxZ - bbox.minZ = 높이 (이미 미터 단위)
      modelHeightM = Math.abs(spatialInfo.bbox.maxZ - spatialInfo.bbox.minZ)
      altitude = modelHeightM / 2  // 센터링된 모델의 바닥이 지면에 닿도록
    }

    console.log('GLB positioning at:', { longitude, latitude, altitude, modelHeightM, hasGeoCenter })

    const position = Cartesian3.fromDegrees(longitude, latitude, altitude)

    const headingRad = CesiumMath.toRadians(headingDeg)
    const pitch = 0
    const roll = 0
    const orientation = Transforms.headingPitchRollQuaternion(
      position,
      new HeadingPitchRoll(headingRad, pitch, roll)
    )

    // 모델 스케일 계산
    let modelScale = 1.0

    if (spatialInfo?.isGeographic && spatialInfo?.bbox) {
      // WGS84 변환된 GLB: 이미 미터 단위로 변환됨, 스케일 1.0 사용
      modelScale = 1.0
      console.log('WGS84 converted GLB: scale=1.0 (already in meters)')
    } else if (spatialInfo?.bbox) {
      const bboxWidth = Math.abs(spatialInfo.bbox.maxX - spatialInfo.bbox.minX)
      const bboxHeight = Math.abs(spatialInfo.bbox.maxY - spatialInfo.bbox.minY)
      const bboxDepth = Math.abs(spatialInfo.bbox.maxZ - spatialInfo.bbox.minZ)
      const maxDim = Math.max(bboxWidth, bboxHeight, bboxDepth)

      console.log('BBox dimensions:', { bboxWidth, bboxHeight, bboxDepth, maxDim })

      // Korea TM 좌표계 (bbox가 큰 미터 단위)인 경우
      if (spatialInfo.isKoreaTM || maxDim > 1000) {
        modelScale = 1.0  // 미터 단위 그대로 사용
        console.log('Korea TM or large model: scale=1.0')
      } else if (maxDim < 1) {
        // 매우 작은 모델 (정규화된 경우)
        modelScale = 50
        console.log('Small model scale applied:', modelScale)
      }
    } else {
      // bbox가 없으면 기본 스케일 사용
      modelScale = 1.0
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
