import { Suspense, useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { OrbitControls, Grid, Environment, PerspectiveCamera, Html } from '@react-three/drei'
import { Box as BoxIcon, AlertTriangle, Loader2, Settings, Activity, Copy, Check, MapPin, Ruler, Trash2 } from 'lucide-react'
import * as THREE from 'three'
import ModelViewer from './ModelViewer'
import MeasurementOverlay, { type MeasurementPoint } from './MeasurementOverlay'
import { type LoadProgress, type LoadedModel, type RelatedFile } from '../../utils/modelLoader'
import {
  type QualityLevel,
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
  // 품질 설정 관련
  showQualitySettings?: boolean
  // 좌표 확인 모드
  showCoordinateMode?: boolean
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

// 씬 전체 레이캐스팅 핸들러 (좌표 확인 및 측정용)
interface SceneRaycasterProps {
  onCoordinateClick?: (position: ClickPosition) => void
  onMeasureClick?: (position: ClickPosition) => void
  showCoordinates: boolean
  measureMode: boolean
}

function SceneRaycaster({ onCoordinateClick, onMeasureClick, showCoordinates, measureMode }: SceneRaycasterProps) {
  const { camera, scene, raycaster, gl } = useThree()
  const fallbackPlaneRef = useRef<THREE.Mesh>(null)

  useEffect(() => {
    // 포인트 클라우드 레이캐스팅 임계값 설정 (클릭 감지 범위)
    raycaster.params.Points.threshold = 0.15
  }, [raycaster])

  const handleClick = useCallback((event: MouseEvent) => {
    if (!showCoordinates && !measureMode) return
    if (showCoordinates && !onCoordinateClick) return
    if (measureMode && !onMeasureClick) return

    // 마우스 좌표를 정규화된 디바이스 좌표로 변환
    const rect = gl.domElement.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1

    const mouse = new THREE.Vector2(x, y)
    raycaster.setFromCamera(mouse, camera)

    // 씬의 모든 객체에 대해 레이캐스팅 (재귀적)
    const intersects = raycaster.intersectObjects(scene.children, true)

    // Grid와 fallback plane, 클릭 마커는 제외하고 실제 모델만 찾기
    const modelIntersect = intersects.find((i) => {
      // Grid helper와 fallback plane, 클릭 마커 제외
      if (i.object === fallbackPlaneRef.current) return false
      if (i.object.type === 'GridHelper') return false
      if (i.object.name === 'fallbackPlane') return false
      if (i.object.name === 'clickPositionMarker') return false
      // visible이 false인 객체 제외
      if (!i.object.visible) return false
      return true
    })

    let clickedPosition: ClickPosition | null = null

    if (modelIntersect) {
      const point = modelIntersect.point
      clickedPosition = {
        x: Math.round(point.x * 1000) / 1000,
        y: Math.round(point.y * 1000) / 1000,
        z: Math.round(point.z * 1000) / 1000,
      }
    } else if (fallbackPlaneRef.current) {
      // 모델이 없으면 바닥면에서 위치 가져오기
      const planeIntersects = raycaster.intersectObject(fallbackPlaneRef.current)
      if (planeIntersects.length > 0) {
        const point = planeIntersects[0]?.point
        if (point) {
          clickedPosition = {
            x: Math.round(point.x * 1000) / 1000,
            y: Math.round(point.y * 1000) / 1000,
            z: Math.round(point.z * 1000) / 1000,
          }
        }
      }
    }

    if (clickedPosition) {
      // 측정 모드일 때
      if (measureMode && onMeasureClick) {
        onMeasureClick(clickedPosition)
      }
      // 좌표 확인 모드일 때
      if (showCoordinates && onCoordinateClick) {
        onCoordinateClick(clickedPosition)
      }
    }
  }, [showCoordinates, measureMode, onCoordinateClick, onMeasureClick, camera, scene, raycaster, gl])

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

// 클릭 위치 임시 마커 컴포넌트
interface ClickPositionMarkerProps {
  position: ClickPosition | null
}

function ClickPositionMarker({ position }: ClickPositionMarkerProps) {
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (!meshRef.current || !position) return
    // 펄스 애니메이션
    const scale = 1 + Math.sin(state.clock.elapsedTime * 4) * 0.15
    meshRef.current.scale.setScalar(scale)
  })

  if (!position) return null

  return (
    <group position={[position.x, position.y, position.z]}>
      {/* 마커 구체 */}
      <mesh ref={meshRef} name="clickPositionMarker">
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial
          color="#3b82f6"
          emissive="#3b82f6"
          emissiveIntensity={0.5}
          transparent
          opacity={0.9}
        />
      </mesh>
      {/* 외곽 링 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} name="clickPositionMarker">
        <ringGeometry args={[0.12, 0.15, 32]} />
        <meshBasicMaterial color="#3b82f6" transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
      {/* 수직선 (바닥까지) */}
      {position.y > 0.1 && (
        <line>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              array={new Float32Array([0, 0, 0, 0, -position.y, 0])}
              count={2}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#3b82f6" opacity={0.4} transparent />
        </line>
      )}
      {/* 좌표 레이블 */}
      <Html
        position={[0, 0.25, 0]}
        center
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <div
          className="px-2 py-1 rounded text-xs whitespace-nowrap font-mono"
          style={{
            backgroundColor: 'rgba(59, 130, 246, 0.9)',
            color: 'white',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}
        >
          ({position.x.toFixed(3)}, {position.y.toFixed(3)}, {position.z.toFixed(3)})
        </div>
      </Html>
    </group>
  )
}

// 성능 통계 패널 컴포넌트
function PerformanceStatsPanel({
  stats,
  qualityLevel,
}: {
  stats: PerformanceStats
  qualityLevel: QualityLevel
}) {
  return (
    <div className="absolute bottom-4 left-4 bg-slate-900/95 backdrop-blur border border-slate-700 rounded-lg shadow-xl p-3 min-w-44">
      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-700">
        <Activity size={14} className="text-green-400" />
        <span className="text-xs font-medium text-white">성능 모니터</span>
      </div>
      <div className="space-y-1.5 text-xs">
        <div className="flex justify-between items-center">
          <span className="text-slate-400">FPS</span>
          <span className={`font-mono font-bold ${
            stats.fps >= 55 ? 'text-green-400' :
            stats.fps >= 30 ? 'text-yellow-400' :
            'text-red-400'
          }`}>
            {stats.fps}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-400">프레임 시간</span>
          <span className="text-white font-mono">{stats.frameTime}ms</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-400">삼각형</span>
          <span className="text-white font-mono">{stats.triangles.toLocaleString()}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-400">드로우 콜</span>
          <span className="text-white font-mono">{stats.drawCalls}</span>
        </div>
        {stats.memory && (
          <div className="flex justify-between items-center">
            <span className="text-slate-400">메모리</span>
            <span className="text-white font-mono">
              {Math.round(stats.memory / 1024 / 1024)}MB
            </span>
          </div>
        )}
      </div>
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
  )
}

// 좌표 확인 패널 컴포넌트
function CoordinatePanel({
  position,
  onCopyText,
  onCopyJson,
  copied,
}: {
  position: ClickPosition | null
  onCopyText: () => void
  onCopyJson: () => void
  copied: boolean
}) {
  return (
    <div className="absolute bottom-4 right-4 bg-slate-900/95 backdrop-blur border border-blue-600/50 rounded-lg shadow-xl p-3 min-w-56">
      <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <MapPin size={14} className="text-blue-400" />
          <span className="text-xs font-medium text-white">좌표 확인</span>
        </div>
        {position && (
          <button
            onClick={onCopyText}
            className="p-1 hover:bg-slate-700 rounded transition-colors"
            title="좌표 복사 (x, y, z)"
          >
            {copied ? (
              <Check size={12} className="text-green-400" />
            ) : (
              <Copy size={12} className="text-slate-400" />
            )}
          </button>
        )}
      </div>

      {position ? (
        <div className="space-y-2">
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-red-400 font-medium">X</span>
              <span className="text-white font-mono">{position.x.toFixed(4)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-green-400 font-medium">Y</span>
              <span className="text-white font-mono">{position.y.toFixed(4)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-blue-400 font-medium">Z</span>
              <span className="text-white font-mono">{position.z.toFixed(4)}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-700 flex gap-2">
            <button
              onClick={onCopyText}
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-xs text-slate-300 transition-colors"
            >
              <Copy size={12} />
              <span>복사</span>
            </button>
            <button
              onClick={onCopyJson}
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-xs text-slate-300 transition-colors"
            >
              <Copy size={12} />
              <span>JSON</span>
            </button>
          </div>

          {copied && (
            <div className="text-center text-xs text-green-400 animate-pulse">
              클립보드에 복사되었습니다!
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-4">
          <p className="text-slate-400 text-xs">모델을 클릭하여</p>
          <p className="text-slate-400 text-xs">좌표를 확인하세요</p>
        </div>
      )}
    </div>
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

function SceneContent({
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

export default function ThreeCanvas({
  modelUrl,
  modelFile,
  modelFormat,
  relatedFiles,
  showQualitySettings = true,
  showCoordinateMode = false,
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

  // 좌표 확인 모드
  const [showCoordinates, setShowCoordinates] = useState(showCoordinateMode)
  const [clickedPosition, setClickedPosition] = useState<ClickPosition | null>(null)
  const [copied, setCopied] = useState(false)

  // 측정 모드
  const [measureMode, setMeasureMode] = useState(false)
  const [measurePoints, setMeasurePoints] = useState<MeasurementPoint[]>([])
  const measureIdCounter = useRef(0)

  // WebGL 컨텍스트 손실 타이머 ref (언마운트 시 정리용)
  const contextLostTimeoutRef = useRef<number | null>(null)
  useEffect(() => {
    return () => {
      if (contextLostTimeoutRef.current) clearTimeout(contextLostTimeoutRef.current)
    }
  }, [])

  // 측정 클릭 핸들러
  const handleMeasureClick = useCallback((position: ClickPosition) => {
    setMeasurePoints(prev => {
      // 짝수개면 새로운 시작점 추가, 홀수개면 끝점 추가
      const newPoint: MeasurementPoint = {
        position,
        id: measureIdCounter.current++,
      }
      return [...prev, newPoint]
    })
  }, [])

  // 측정 초기화
  const clearMeasurements = useCallback(() => {
    setMeasurePoints([])
  }, [])

  // 좌표 클릭 핸들러
  const handleCoordinateClick = useCallback((position: ClickPosition) => {
    setClickedPosition(position)
    setCopied(false)
  }, [])

  // 좌표 복사 핸들러
  const handleCopyCoordinates = useCallback(() => {
    if (!clickedPosition) return
    const coordText = `${clickedPosition.x}, ${clickedPosition.y}, ${clickedPosition.z}`
    navigator.clipboard.writeText(coordText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => { /* clipboard permission denied */ })
  }, [clickedPosition])

  // 좌표 JSON 복사 핸들러
  const handleCopyCoordinatesJson = useCallback(() => {
    if (!clickedPosition) return
    const coordJson = JSON.stringify(clickedPosition, null, 2)
    navigator.clipboard.writeText(coordJson).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => { /* clipboard permission denied */ })
  }, [clickedPosition])

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
    <div ref={canvasContainerRef} className={`w-full h-full relative ${showCoordinates ? 'cursor-crosshair' : ''}`}>
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
            gl.domElement.addEventListener('webglcontextlost', (e) => {
              e.preventDefault()
              console.warn('WebGL context lost, attempting recovery...')
              contextLostTimeoutRef.current = window.setTimeout(() => {
                setError('WebGL 컨텍스트 손실. 다시 시도해 주세요.')
              }, 500)
            })
            gl.domElement.addEventListener('webglcontextrestored', () => {
              console.log('WebGL context restored')
              if (contextLostTimeoutRef.current) {
                clearTimeout(contextLostTimeoutRef.current)
                contextLostTimeoutRef.current = null
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
            onProgress={handleProgress}
            onError={handleError}
            onLoad={handleLoad}
            onStats={showStats ? setPerfStats : undefined}
            showCoordinates={showCoordinates}
            clickedPosition={clickedPosition}
            onCoordinateClick={handleCoordinateClick}
            measureMode={measureMode}
            measurePoints={measurePoints}
            onMeasureClick={handleMeasureClick}
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

          {/* 좌표 확인 모드 토글 버튼 */}
          <button
            onClick={() => {
              setShowCoordinates(!showCoordinates)
              if (!showCoordinates) {
                setClickedPosition(null)
              }
            }}
            className={`flex items-center gap-2 px-3 py-1.5 backdrop-blur border rounded-lg text-xs shadow-lg transition-colors ${
              showCoordinates
                ? 'bg-blue-600/20 border-blue-600 text-blue-400 hover:bg-blue-600/30'
                : 'bg-slate-900/90 border-slate-700 text-white hover:bg-slate-800/90'
            }`}
            title="좌표 확인 모드"
          >
            <MapPin size={14} />
            <span>좌표</span>
          </button>

          {/* 측정 모드 토글 버튼 */}
          <button
            onClick={() => {
              setMeasureMode(!measureMode)
              if (measureMode) {
                clearMeasurements()
              }
            }}
            className={`flex items-center gap-2 px-3 py-1.5 backdrop-blur border rounded-lg text-xs shadow-lg transition-colors ${
              measureMode
                ? 'bg-amber-600/20 border-amber-600 text-amber-400 hover:bg-amber-600/30'
                : 'bg-slate-900/90 border-slate-700 text-white hover:bg-slate-800/90'
            }`}
            title="거리 측정 모드"
          >
            <Ruler size={14} />
            <span>측정</span>
          </button>

          {/* 측정 초기화 버튼 (측정 모드이고 포인트가 있을 때) */}
          {measureMode && measurePoints.length > 0 && (
            <button
              onClick={clearMeasurements}
              className="flex items-center gap-2 px-3 py-1.5 backdrop-blur border border-red-600/50 rounded-lg text-xs shadow-lg text-red-400 hover:bg-red-600/20 transition-colors"
              title="측정 초기화"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      )}

      {/* 성능 통계 패널 */}
      {showStats && perfStats && (
        <PerformanceStatsPanel stats={perfStats} qualityLevel={qualityLevel} />
      )}

      {/* 좌표 확인 패널 */}
      {showCoordinates && (
        <CoordinatePanel
          position={clickedPosition}
          onCopyText={handleCopyCoordinates}
          onCopyJson={handleCopyCoordinatesJson}
          copied={copied}
        />
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
