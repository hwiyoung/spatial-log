import { Suspense, useState, useCallback, useRef, useEffect } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { OrbitControls, Grid, Environment, PerspectiveCamera } from '@react-three/drei'
import { Box as BoxIcon, AlertTriangle, Loader2 } from 'lucide-react'
import * as THREE from 'three'
import ModelViewer from './ModelViewer'
import { AnnotationMarkers3D } from './AnnotationMarker3D'
import { type LoadProgress, type LoadedModel } from '../../utils/modelLoader'
import type { AnnotationData } from '@/services/api'

// WebGL 컨텍스트 손실 방지를 위한 지연 시간 (ms)
const CANVAS_MOUNT_DELAY = 100

export interface ClickPosition {
  x: number
  y: number
  z: number
}

interface ThreeCanvasProps {
  modelUrl?: string
  modelFile?: File
  modelFormat?: string // 명시적 포맷 지정 (blob URL 사용 시)
  annotateMode?: boolean
  onPointClick?: (position: ClickPosition) => void
  // 어노테이션 관련 props
  annotations?: AnnotationData[]
  selectedAnnotationId?: string | null
  onAnnotationClick?: (annotation: AnnotationData) => void
}

function GridFloor() {
  return (
    <Grid
      args={[100, 100]}
      cellSize={1}
      cellThickness={0.5}
      cellColor="#334155"
      sectionSize={5}
      sectionThickness={1}
      sectionColor="#475569"
      fadeDistance={50}
      fadeStrength={1}
      followCamera={false}
      infiniteGrid={true}
    />
  )
}

function PlaceholderBox() {
  return (
    <mesh position={[0, 0.5, 0]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#3b82f6" wireframe />
    </mesh>
  )
}

// 씬 전체 레이캐스팅 핸들러 (어노테이션 배치용)
interface SceneRaycasterProps {
  onPointClick?: (position: ClickPosition) => void
  annotateMode: boolean
}

function SceneRaycaster({ onPointClick, annotateMode }: SceneRaycasterProps) {
  const { camera, scene, raycaster, gl } = useThree()
  const fallbackPlaneRef = useRef<THREE.Mesh>(null)

  useEffect(() => {
    // 포인트 클라우드 레이캐스팅 임계값 설정
    raycaster.params.Points.threshold = 0.1
  }, [raycaster])

  const handleClick = useCallback((event: MouseEvent) => {
    if (!annotateMode || !onPointClick) return

    // 마우스 좌표를 정규화된 디바이스 좌표로 변환
    const rect = gl.domElement.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1

    const mouse = new THREE.Vector2(x, y)
    raycaster.setFromCamera(mouse, camera)

    // 씬의 모든 객체에 대해 레이캐스팅 (재귀적)
    const intersects = raycaster.intersectObjects(scene.children, true)

    // Grid와 fallback plane은 제외하고 실제 모델만 찾기
    const modelIntersect = intersects.find((i) => {
      // Grid helper와 fallback plane 제외
      if (i.object === fallbackPlaneRef.current) return false
      if (i.object.type === 'GridHelper') return false
      if (i.object.name === 'fallbackPlane') return false
      // visible이 false인 객체 제외
      if (!i.object.visible) return false
      return true
    })

    if (modelIntersect) {
      const point = modelIntersect.point
      onPointClick({
        x: Math.round(point.x * 100) / 100,
        y: Math.round(point.y * 100) / 100,
        z: Math.round(point.z * 100) / 100,
      })
    } else if (fallbackPlaneRef.current) {
      // 모델이 없으면 바닥면에서 위치 가져오기
      const planeIntersects = raycaster.intersectObject(fallbackPlaneRef.current)
      if (planeIntersects.length > 0) {
        const point = planeIntersects[0]?.point
        if (point) {
          onPointClick({
            x: Math.round(point.x * 100) / 100,
            y: Math.round(point.y * 100) / 100,
            z: Math.round(point.z * 100) / 100,
          })
        }
      }
    }
  }, [annotateMode, onPointClick, camera, scene, raycaster, gl])

  useEffect(() => {
    const canvas = gl.domElement
    canvas.addEventListener('click', handleClick)
    return () => canvas.removeEventListener('click', handleClick)
  }, [gl, handleClick])

  // 폴백 바닥면 (모델이 없을 때 사용)
  return (
    <mesh
      ref={fallbackPlaneRef}
      name="fallbackPlane"
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
      visible={false}
    >
      <planeGeometry args={[200, 200]} />
      <meshBasicMaterial transparent opacity={0} />
    </mesh>
  )
}

function CanvasLoadingFallback() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-slate-950">
      <div className="text-slate-600 flex flex-col items-center p-8 rounded-xl bg-slate-900/50 backdrop-blur-sm border border-slate-800">
        <BoxIcon size={64} strokeWidth={1} className="animate-pulse" />
        <p className="mt-4 text-sm font-medium">캔버스 초기화 중...</p>
      </div>
    </div>
  )
}

interface ModelLoadingOverlayProps {
  progress: LoadProgress | null
  error: string | null
}

function ModelLoadingOverlay({ progress, error }: ModelLoadingOverlayProps) {
  if (error) {
    return (
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="bg-red-900/80 backdrop-blur-sm px-6 py-4 rounded-lg border border-red-700 text-center">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-red-200 text-sm font-medium">모델 로드 실패</p>
          <p className="text-red-300 text-xs mt-1">{error}</p>
        </div>
      </div>
    )
  }

  if (progress && progress.percent < 100) {
    return (
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="bg-slate-900/80 backdrop-blur-sm px-6 py-4 rounded-lg border border-slate-700 text-center">
          <Loader2 className="w-8 h-8 text-blue-400 mx-auto mb-2 animate-spin" />
          <p className="text-white text-sm font-medium">모델 로딩 중...</p>
          <div className="mt-2 w-48 h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <p className="text-slate-400 text-xs mt-1">{progress.percent}%</p>
        </div>
      </div>
    )
  }

  return null
}

interface SceneContentProps {
  modelUrl?: string
  modelFile?: File
  modelFormat?: string
  annotateMode: boolean
  onProgress: (progress: LoadProgress) => void
  onError: (error: Error) => void
  onLoad: (model: LoadedModel) => void
  onPointClick?: (position: ClickPosition) => void
  // 어노테이션 관련 props
  annotations?: AnnotationData[]
  selectedAnnotationId?: string | null
  onAnnotationClick?: (annotation: AnnotationData) => void
}

// 카메라 컨트롤러 (선택된 어노테이션으로 이동)
function CameraFlyTo({ targetPosition }: { targetPosition: { x: number; y: number; z: number } | null }) {
  const { camera } = useThree()
  const isAnimating = useRef(false)
  const startPosition = useRef(new THREE.Vector3())
  const endPosition = useRef(new THREE.Vector3())
  const progress = useRef(0)
  const prevTarget = useRef<{ x: number; y: number; z: number } | null>(null)

  useEffect(() => {
    if (!targetPosition) {
      isAnimating.current = false
      return
    }

    if (
      prevTarget.current &&
      prevTarget.current.x === targetPosition.x &&
      prevTarget.current.y === targetPosition.y &&
      prevTarget.current.z === targetPosition.z
    ) {
      return
    }

    prevTarget.current = targetPosition
    startPosition.current.copy(camera.position)
    endPosition.current.set(
      targetPosition.x + 3,
      targetPosition.y + 3,
      targetPosition.z + 3
    )
    progress.current = 0
    isAnimating.current = true
  }, [targetPosition, camera])

  useFrame((_, delta) => {
    if (!isAnimating.current || !prevTarget.current) return

    progress.current += delta / 1.0 // 1초 duration

    if (progress.current >= 1) {
      progress.current = 1
      isAnimating.current = false
    }

    const t = 1 - Math.pow(1 - progress.current, 3)
    camera.position.lerpVectors(startPosition.current, endPosition.current, t)
    camera.lookAt(prevTarget.current.x, prevTarget.current.y, prevTarget.current.z)
  })

  return null
}

function SceneContent({
  modelUrl,
  modelFile,
  modelFormat,
  annotateMode,
  onProgress,
  onError,
  onLoad,
  onPointClick,
  annotations = [],
  selectedAnnotationId,
  onAnnotationClick,
}: SceneContentProps) {
  const hasModel = !!(modelUrl || modelFile)

  // 선택된 어노테이션의 위치 찾기
  const selectedAnnotation = annotations.find((a) => a.id === selectedAnnotationId)
  const targetPosition = selectedAnnotation?.position || null

  return (
    <>
      <PerspectiveCamera makeDefault position={[5, 5, 5]} fov={50} />
      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        minDistance={0.5}
        maxDistance={100}
        maxPolarAngle={Math.PI / 2.1}
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

      {/* Scene raycaster for annotation placement */}
      <SceneRaycaster onPointClick={onPointClick} annotateMode={annotateMode} />

      {/* Model or Placeholder */}
      {hasModel ? (
        <ModelViewer
          url={modelUrl}
          file={modelFile}
          format={modelFormat}
          onProgress={onProgress}
          onError={onError}
          onLoad={onLoad}
        />
      ) : (
        <PlaceholderBox />
      )}

      {/* 어노테이션 마커 */}
      {onAnnotationClick && (
        <AnnotationMarkers3D
          annotations={annotations}
          selectedId={selectedAnnotationId || null}
          onAnnotationClick={onAnnotationClick}
        />
      )}

      {/* 선택된 어노테이션으로 카메라 이동 */}
      <CameraFlyTo targetPosition={targetPosition} />
    </>
  )
}

export default function ThreeCanvas({
  modelUrl,
  modelFile,
  modelFormat,
  annotateMode = false,
  onPointClick,
  annotations = [],
  selectedAnnotationId,
  onAnnotationClick,
}: ThreeCanvasProps) {
  const [progress, setProgress] = useState<LoadProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [modelInfo, setModelInfo] = useState<LoadedModel | null>(null)
  const [isCanvasReady, setIsCanvasReady] = useState(false)
  const [currentModelKey, setCurrentModelKey] = useState<string | null>(null)
  const canvasContainerRef = useRef<HTMLDivElement>(null)

  // 모델 변경 시 상태 초기화 및 약간의 지연 후 로드
  useEffect(() => {
    const newKey = modelUrl || modelFile?.name || null
    if (newKey !== currentModelKey) {
      setProgress(null)
      setError(null)
      setModelInfo(null)
      setIsCanvasReady(false)

      // WebGL 컨텍스트 안정화를 위한 지연
      const timer = setTimeout(() => {
        setCurrentModelKey(newKey)
        setIsCanvasReady(true)
      }, CANVAS_MOUNT_DELAY)

      return () => clearTimeout(timer)
    }
  }, [modelUrl, modelFile, currentModelKey])

  const handleProgress = useCallback((p: LoadProgress) => {
    setProgress(p)
    setError(null)
  }, [])

  const handleError = useCallback((err: Error) => {
    setError(err.message)
    setProgress(null)
  }, [])

  const handleLoad = useCallback((model: LoadedModel) => {
    setModelInfo(model)
    setProgress({ loaded: 100, total: 100, percent: 100 })
    setError(null)
  }, [])

  const hasModel = !!(modelUrl || modelFile)

  return (
    <div ref={canvasContainerRef} className={`w-full h-full relative ${annotateMode ? 'cursor-crosshair' : ''}`}>
      {!isCanvasReady ? (
        <CanvasLoadingFallback />
      ) : (
      <Suspense fallback={<CanvasLoadingFallback />}>
        <Canvas
          shadows
          gl={{
            antialias: true,
            powerPreference: 'high-performance',
            failIfMajorPerformanceCaveat: false,
            preserveDrawingBuffer: true,
          }}
          onCreated={({ gl }) => {
            // WebGL 컨텍스트 손실 처리
            let contextLostTimeout: number | null = null
            gl.domElement.addEventListener('webglcontextlost', (e) => {
              e.preventDefault()
              console.warn('WebGL context lost, attempting recovery...')
              // 일시적인 컨텍스트 손실일 수 있으므로 짧은 대기 후 에러 표시
              contextLostTimeout = window.setTimeout(() => {
                setError('WebGL 컨텍스트 손실. 다시 시도해 주세요.')
              }, 500)
            })
            gl.domElement.addEventListener('webglcontextrestored', () => {
              console.log('WebGL context restored')
              // 복구되면 타이머 취소 및 에러 해제
              if (contextLostTimeout) {
                clearTimeout(contextLostTimeout)
                contextLostTimeout = null
              }
              setError(null)
            })
          }}
        >
          <SceneContent
            modelUrl={modelUrl}
            modelFile={modelFile}
            modelFormat={modelFormat}
            annotateMode={annotateMode}
            onProgress={handleProgress}
            onError={handleError}
            onLoad={handleLoad}
            onPointClick={onPointClick}
            annotations={annotations}
            selectedAnnotationId={selectedAnnotationId}
            onAnnotationClick={onAnnotationClick}
          />
        </Canvas>
      </Suspense>
      )}

      {/* Loading/Error overlay - 모델 로드 성공 시 에러 오버레이 숨김 */}
      <ModelLoadingOverlay progress={progress} error={modelInfo ? null : error} />

      {/* Model info badge */}
      {modelInfo && !error && (
        <div className="absolute top-4 right-4 bg-slate-900/90 backdrop-blur border border-slate-700 px-3 py-1.5 rounded-lg text-xs text-white shadow-lg">
          <span className="font-bold text-blue-400">{modelInfo.format.toUpperCase()}</span>
          <span className="text-slate-400 ml-2">
            {modelInfo.type === 'points' ? '포인트 클라우드' : '3D 모델'}
          </span>
        </div>
      )}

      {/* Empty state overlay */}
      {!hasModel && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-slate-500 text-center bg-slate-900/70 backdrop-blur-sm px-6 py-4 rounded-lg border border-slate-700">
            <p className="text-sm font-medium">마우스로 회전/줌 가능</p>
            <p className="text-xs mt-1">데이터를 선택하면 3D 모델이 표시됩니다</p>
            <div className="mt-3 flex flex-wrap justify-center gap-1">
              {['OBJ', 'FBX', 'GLTF', 'GLB', 'PLY', 'LAS'].map((format) => (
                <span
                  key={format}
                  className="px-2 py-0.5 bg-slate-800 rounded text-xs text-slate-400"
                >
                  {format}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
