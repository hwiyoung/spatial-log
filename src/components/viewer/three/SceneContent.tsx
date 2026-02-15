import { OrbitControls, Environment, PerspectiveCamera } from '@react-three/drei'
import ModelViewer from '../ModelViewer'
import MeasurementOverlay, { type MeasurementPoint } from '../MeasurementOverlay'
import { type LoadProgress, type LoadedModel, type RelatedFile } from '../../../utils/modelLoader'
import type { ClickPosition } from '../ThreeCanvas'
import type { PerformanceStats } from './SceneHelpers'
import { GridFloor, PlaceholderBox, PerformanceMonitor } from './SceneHelpers'
import { SceneRaycaster } from './SceneRaycaster'
import { ClickPositionMarker } from './ClickPositionMarker'

export interface SceneContentProps {
  modelUrl?: string
  modelFile?: File
  modelFormat?: string
  relatedFiles?: RelatedFile[]
  onProgress: (progress: LoadProgress) => void
  onError: (error: Error) => void
  onLoad: (model: LoadedModel) => void
  // 성능 모니터링
  onStats?: (stats: PerformanceStats) => void
  // 좌표 확인 모드
  showCoordinates: boolean
  clickedPosition: ClickPosition | null
  onCoordinateClick?: (position: ClickPosition) => void
  // 측정 모드
  measureMode: boolean
  measurePoints: MeasurementPoint[]
  onMeasureClick?: (position: ClickPosition) => void
}

export function SceneContent({
  modelUrl,
  modelFile,
  modelFormat,
  relatedFiles,
  onProgress,
  onError,
  onLoad,
  onStats,
  showCoordinates,
  clickedPosition,
  onCoordinateClick,
  measureMode,
  measurePoints,
  onMeasureClick,
}: SceneContentProps) {
  const hasModel = !!(modelUrl || modelFile)

  return (
    <>
      <PerspectiveCamera makeDefault position={[5, 5, 5]} fov={50} />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.05}
        minDistance={0.1}
        maxDistance={500}
      />

      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[10, 10, 5]}
        intensity={1}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <directionalLight position={[-5, 5, -5]} intensity={0.3} />

      {/* Environment */}
      <Environment preset="city" />

      {/* Grid */}
      <GridFloor />

      {/* Scene raycaster for coordinate inspection and measurement */}
      <SceneRaycaster
        onCoordinateClick={onCoordinateClick}
        onMeasureClick={onMeasureClick}
        showCoordinates={showCoordinates}
        measureMode={measureMode}
      />

      {/* Model or Placeholder */}
      {hasModel ? (
        <ModelViewer
          url={modelUrl}
          file={modelFile}
          format={modelFormat}
          relatedFiles={relatedFiles}
          onProgress={onProgress}
          onError={onError}
          onLoad={onLoad}
        />
      ) : (
        <PlaceholderBox />
      )}

      {/* 클릭 위치 마커 (좌표 확인 모드) */}
      {showCoordinates && <ClickPositionMarker position={clickedPosition} />}

      {/* 측정 오버레이 */}
      {measureMode && (
        <MeasurementOverlay
          points={measurePoints}
          activePointIndex={measurePoints.length % 2 === 1 ? measurePoints.length - 1 : null}
        />
      )}

      {/* 성능 모니터링 */}
      {onStats && <PerformanceMonitor onStats={onStats} />}
    </>
  )
}
