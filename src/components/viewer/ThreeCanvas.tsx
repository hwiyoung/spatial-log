import { Suspense, useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { OrbitControls, Grid, Environment, PerspectiveCamera } from '@react-three/drei'
import { Box as BoxIcon, AlertTriangle, Loader2, Settings, Activity } from 'lucide-react'
import * as THREE from 'three'
import ModelViewer from './ModelViewer'
import { AnnotationMarkers3D } from './AnnotationMarker3D'
import { SimpleLighting } from './LightingSystem'
import { type LoadProgress, type LoadedModel, type RelatedFile } from '../../utils/modelLoader'
import type { AnnotationData } from '@/services/api'
import {
  type QualityLevel,
  QUALITY_PRESETS,
  QUALITY_LABELS,
  loadQualitySettings,
  saveQualitySettings,
  getQualityOptions,
} from '@/utils/renderingOptions'

// WebGL 컨텍스트 손실 방지를 위한 지연 시간 (ms)
const CANVAS_MOUNT_DELAY = 100

// FPS 모니터링 상태 타입
interface PerformanceStats {
  fps: number
  frameTime: number
  triangles: number
  drawCalls: number
  memory?: number
}

export interface ClickPosition {
  x: number
  y: number
  z: number
}

interface ThreeCanvasProps {
  modelUrl?: string
  modelFile?: File
  modelFormat?: string // 명시적 포맷 지정 (blob URL 사용 시)
  relatedFiles?: RelatedFile[] // 연관 파일 (MTL, 텍스처 등)
  annotateMode?: boolean
  onPointClick?: (position: ClickPosition) => void
  // 어노테이션 관련 props
  annotations?: AnnotationData[]
  selectedAnnotationId?: string | null
  onAnnotationClick?: (annotation: AnnotationData) => void
  // 품질 설정 관련
  showQualitySettings?: boolean
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

// 성능 모니터링 컴포넌트 (씬 내부)
function PerformanceMonitor({ onStats }: { onStats: (stats: PerformanceStats) => void }) {
  const { gl } = useThree()
  const frameTimesRef = useRef<number[]>([])
  const lastTimeRef = useRef(performance.now())

  useFrame(() => {
    const now = performance.now()
    const frameTime = now - lastTimeRef.current
    lastTimeRef.current = now

    // 최근 60개 프레임 시간 저장
    frameTimesRef.current.push(frameTime)
    if (frameTimesRef.current.length > 60) {
      frameTimesRef.current.shift()
    }

    // 매 30프레임마다 통계 업데이트
    if (frameTimesRef.current.length % 30 === 0) {
      const avgFrameTime = frameTimesRef.current.reduce((a, b) => a + b, 0) / frameTimesRef.current.length
      const fps = 1000 / avgFrameTime

      const info = gl.info
      onStats({
        fps: Math.round(fps),
        frameTime: Math.round(avgFrameTime * 100) / 100,
        triangles: info.render?.triangles || 0,
        drawCalls: info.render?.calls || 0,
        memory: (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize,
      })
    }
  })

  return null
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
  relatedFiles?: RelatedFile[]
  annotateMode: boolean
  onProgress: (progress: LoadProgress) => void
  onError: (error: Error) => void
  onLoad: (model: LoadedModel) => void
  onPointClick?: (position: ClickPosition) => void
  // 어노테이션 관련 props
  annotations?: AnnotationData[]
  selectedAnnotationId?: string | null
  onAnnotationClick?: (annotation: AnnotationData) => void
  // 성능 모니터링
  onStats?: (stats: PerformanceStats) => void
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
  relatedFiles,
  annotateMode,
  onProgress,
  onError,
  onLoad,
  onPointClick,
  annotations = [],
  selectedAnnotationId,
  onAnnotationClick,
  onStats,
}: SceneContentProps) {
  const hasModel = !!(modelUrl || modelFile)

  // 선택된 어노테이션의 위치 찾기
  const selectedAnnotation = annotations.find((a) => a.id === selectedAnnotationId)
  const targetPosition = selectedAnnotation?.position || null

  return (
    <>
      <PerspectiveCamera makeDefault position={[5, 5, 5]} fov={50} />
      <OrbitControls
        makeDefault
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
          relatedFiles={relatedFiles}
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

      {/* 성능 모니터링 */}
      {onStats && <PerformanceMonitor onStats={onStats} />}
    </>
  )
}

export default function ThreeCanvas({
  modelUrl,
  modelFile,
  modelFormat,
  relatedFiles,
  annotateMode = false,
  onPointClick,
  annotations = [],
  selectedAnnotationId,
  onAnnotationClick,
  showQualitySettings = true,
}: ThreeCanvasProps) {
  const [progress, setProgress] = useState<LoadProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [modelInfo, setModelInfo] = useState<LoadedModel | null>(null)
  const [isCanvasReady, setIsCanvasReady] = useState(false)
  const [currentModelKey, setCurrentModelKey] = useState<string | null>(null)
  const canvasContainerRef = useRef<HTMLDivElement>(null)

  // 품질 설정
  const [qualityLevel, setQualityLevel] = useState<QualityLevel>(() => loadQualitySettings())
  const [showQualityMenu, setShowQualityMenu] = useState(false)
  const qualityOptions = useMemo(() => getQualityOptions(qualityLevel), [qualityLevel])

  // 성능 모니터링
  const [showStats, setShowStats] = useState(false)
  const [perfStats, setPerfStats] = useState<PerformanceStats | null>(null)

  // 품질 변경 핸들러
  const handleQualityChange = useCallback((level: QualityLevel) => {
    setQualityLevel(level)
    saveQualitySettings(level)
    setShowQualityMenu(false)
  }, [])

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
          shadows={qualityOptions.shadowsEnabled}
          dpr={qualityOptions.pixelRatio}
          gl={{
            antialias: qualityOptions.antialias,
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
            relatedFiles={relatedFiles}
            annotateMode={annotateMode}
            onProgress={handleProgress}
            onError={handleError}
            onLoad={handleLoad}
            onPointClick={onPointClick}
            annotations={annotations}
            selectedAnnotationId={selectedAnnotationId}
            onAnnotationClick={onAnnotationClick}
            onStats={showStats ? setPerfStats : undefined}
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

      {/* 품질 설정 버튼 */}
      {showQualitySettings && (
        <div className="absolute top-4 left-4 flex items-start gap-2">
          <div>
            <button
              onClick={() => setShowQualityMenu(!showQualityMenu)}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/90 backdrop-blur border border-slate-700 rounded-lg text-xs text-white shadow-lg hover:bg-slate-800/90 transition-colors"
            >
              <Settings size={14} />
              <span>품질: {QUALITY_LABELS[qualityLevel].label}</span>
            </button>

            {/* 품질 선택 드롭다운 */}
            {showQualityMenu && (
              <div className="absolute top-full left-0 mt-1 bg-slate-900/95 backdrop-blur border border-slate-700 rounded-lg shadow-xl overflow-hidden min-w-48 z-10">
                {(['low', 'medium', 'high', 'ultra'] as QualityLevel[]).map((level) => (
                  <button
                    key={level}
                    onClick={() => handleQualityChange(level)}
                    className={`w-full flex flex-col items-start px-4 py-2.5 text-left hover:bg-slate-800 transition-colors ${
                      qualityLevel === level ? 'bg-blue-600/20 border-l-2 border-blue-500' : ''
                    }`}
                  >
                    <span className={`text-sm font-medium ${qualityLevel === level ? 'text-blue-400' : 'text-white'}`}>
                      {QUALITY_LABELS[level].label}
                    </span>
                    <span className="text-xs text-slate-400 mt-0.5">
                      {QUALITY_LABELS[level].description}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 성능 모니터 토글 버튼 */}
          <button
            onClick={() => setShowStats(!showStats)}
            className={`flex items-center gap-2 px-3 py-1.5 backdrop-blur border rounded-lg text-xs shadow-lg transition-colors ${
              showStats
                ? 'bg-green-600/20 border-green-600 text-green-400 hover:bg-green-600/30'
                : 'bg-slate-900/90 border-slate-700 text-white hover:bg-slate-800/90'
            }`}
            title="성능 모니터링"
          >
            <Activity size={14} />
            <span>FPS</span>
          </button>
        </div>
      )}

      {/* 성능 통계 패널 */}
      {showStats && perfStats && (
        <div className="absolute bottom-4 left-4 bg-slate-900/95 backdrop-blur border border-slate-700 rounded-lg shadow-xl p-3 min-w-44">
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-700">
            <Activity size={14} className="text-green-400" />
            <span className="text-xs font-medium text-white">성능 모니터</span>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">FPS</span>
              <span className={`font-mono font-bold ${
                perfStats.fps >= 55 ? 'text-green-400' :
                perfStats.fps >= 30 ? 'text-yellow-400' :
                'text-red-400'
              }`}>
                {perfStats.fps}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">프레임 시간</span>
              <span className="text-white font-mono">{perfStats.frameTime}ms</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">삼각형</span>
              <span className="text-white font-mono">{perfStats.triangles.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">드로우 콜</span>
              <span className="text-white font-mono">{perfStats.drawCalls}</span>
            </div>
            {perfStats.memory && (
              <div className="flex justify-between items-center">
                <span className="text-slate-400">메모리</span>
                <span className="text-white font-mono">
                  {Math.round(perfStats.memory / 1024 / 1024)}MB
                </span>
              </div>
            )}
          </div>
          {/* 품질 수준 표시 */}
          <div className="mt-2 pt-2 border-t border-slate-700">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">품질 설정</span>
              <span className={`font-medium ${
                qualityLevel === 'ultra' ? 'text-purple-400' :
                qualityLevel === 'high' ? 'text-blue-400' :
                qualityLevel === 'medium' ? 'text-yellow-400' :
                'text-slate-400'
              }`}>
                {QUALITY_LABELS[qualityLevel].label}
              </span>
            </div>
          </div>
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
