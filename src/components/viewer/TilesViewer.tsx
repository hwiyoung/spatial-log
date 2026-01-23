// 3D Tiles 뷰어 컴포넌트
// Cesium을 사용하여 3D Tiles 형식을 렌더링합니다.

import { useEffect, useRef, useState } from 'react'
import {
  Viewer,
  Cesium3DTileset,
  Camera,
  CameraFlyTo,
} from 'resium'
import {
  Cesium3DTileset as CesiumTileset,
  Cesium3DTileStyle,
  Cartesian3,
  Color,
  HeadingPitchRange,
  Ion,
  IonResource,
  Math as CesiumMath,
} from 'cesium'
import { Loader2, AlertCircle } from 'lucide-react'

// 스타일 프리셋
export const TILES_STYLE_PRESETS = {
  default: new Cesium3DTileStyle({
    color: 'color("white")',
  }),

  heightGradient: new Cesium3DTileStyle({
    color: {
      conditions: [
        ['${Height} >= 100', 'color("red")'],
        ['${Height} >= 50', 'color("orange")'],
        ['${Height} >= 20', 'color("yellow")'],
        ['true', 'color("lime")'],
      ],
    },
  }),

  classification: new Cesium3DTileStyle({
    color: {
      conditions: [
        ['${Classification} === 1', 'color("gray")'],
        ['${Classification} === 2', 'color("brown")'],
        ['${Classification} === 3', 'color("blue")'],
        ['true', 'color("white")'],
      ],
    },
  }),

  transparent: new Cesium3DTileStyle({
    color: 'color("white", 0.7)',
  }),
}

interface TilesViewerProps {
  tilesetUrl: string
  style?: keyof typeof TILES_STYLE_PRESETS | Cesium3DTileStyle
  ionAssetId?: number
  className?: string
}

export default function TilesViewer({
  tilesetUrl,
  style = 'default',
  ionAssetId,
  className = '',
}: TilesViewerProps) {
  const viewerRef = useRef<{ cesiumElement?: { cesiumWidget?: { scene?: unknown } } }>(null)
  const [tileset, setTileset] = useState<CesiumTileset | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 타일셋 스타일 결정
  const tilesetStyle = typeof style === 'string' ? TILES_STYLE_PRESETS[style] : style

  // 타일셋 로드 완료 핸들러
  const handleReady = (loadedTileset: CesiumTileset) => {
    setTileset(loadedTileset)
    setIsLoading(false)
    setError(null)

    // 타일셋에 맞게 카메라 이동
    if (viewerRef.current?.cesiumElement) {
      const viewer = viewerRef.current.cesiumElement as unknown as { zoomTo: (target: CesiumTileset, offset?: HeadingPitchRange) => void }
      viewer.zoomTo(
        loadedTileset,
        new HeadingPitchRange(
          0,
          CesiumMath.toRadians(-45),
          loadedTileset.boundingSphere.radius * 2
        )
      )
    }
  }

  // 타일셋 리소스 URL (Ion Asset 또는 직접 URL)
  const [tilesetResource, setTilesetResource] = useState<string | IonResource | null>(null)

  useEffect(() => {
    const loadResource = async () => {
      try {
        if (ionAssetId) {
          // Ion Asset 사용
          const resource = await IonResource.fromAssetId(ionAssetId)
          setTilesetResource(resource as unknown as IonResource)
        } else {
          // 직접 URL 사용
          setTilesetResource(tilesetUrl)
        }
      } catch (err) {
        console.error('타일셋 리소스 로드 실패:', err)
        setError(err instanceof Error ? err.message : '리소스 로드 실패')
        setIsLoading(false)
      }
    }

    loadResource()
  }, [tilesetUrl, ionAssetId])

  return (
    <div className={`relative w-full h-full ${className}`}>
      {/* Cesium Viewer */}
      <Viewer
        ref={viewerRef as React.RefObject<never>}
        full
        timeline={false}
        animation={false}
        homeButton={false}
        sceneModePicker={false}
        baseLayerPicker={false}
        navigationHelpButton={false}
        geocoder={false}
        fullscreenButton={false}
        selectionIndicator={false}
        infoBox={false}
      >
        {/* 3D Tileset */}
        {tilesetResource && (
          <Cesium3DTileset
            url={tilesetResource as string}
            style={tilesetStyle}
            onReady={handleReady}
            maximumScreenSpaceError={16}
            maximumMemoryUsage={512}
          />
        )}

        {/* 카메라 초기 위치 (대한민국 중심) */}
        <Camera
          defaultView={{
            destination: Cartesian3.fromDegrees(127.5, 36.5, 500000),
          }}
        />
      </Viewer>

      {/* 로딩 오버레이 */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 text-white">
            <Loader2 size={40} className="animate-spin text-blue-400" />
            <span className="text-sm">3D Tiles 로딩 중...</span>
          </div>
        </div>
      )}

      {/* 에러 오버레이 */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 text-red-400 max-w-md text-center px-4">
            <AlertCircle size={40} />
            <span className="text-sm">{error}</span>
          </div>
        </div>
      )}

      {/* 타일셋 정보 */}
      {tileset && !isLoading && (
        <div className="absolute top-4 right-4 bg-slate-900/90 backdrop-blur border border-slate-700 px-3 py-1.5 rounded-lg text-xs text-white shadow-lg">
          <span className="font-bold text-green-400">3D TILES</span>
          <span className="text-slate-400 ml-2">
            {tileset.tilesLoaded} 타일 로드됨
          </span>
        </div>
      )}
    </div>
  )
}
