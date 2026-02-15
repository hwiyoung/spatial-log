import { Suspense, useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { Settings, Activity, MapPin, Ruler, Trash2 } from 'lucide-react'
import { type MeasurementPoint } from './MeasurementOverlay'
import { type LoadProgress, type LoadedModel, type RelatedFile } from '../../utils/modelLoader'
import {
  type QualityLevel,
  QUALITY_LABELS,
  loadQualitySettings,
  saveQualitySettings,
  getQualityOptions,
} from '@/utils/renderingOptions'

// Sub-components
import type { PerformanceStats } from './three/SceneHelpers'
import { CanvasLoadingFallback } from './three/SceneHelpers'
import { SceneContent } from './three/SceneContent'
import { PerformanceStatsPanel } from './ui/PerformanceStatsPanel'
import { CoordinatePanel } from './ui/CoordinatePanel'
import { ModelLoadingOverlay } from './ui/ModelLoadingOverlay'

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
  relatedFiles?: RelatedFile[] // 연관 파일 (MTL, 텍스처 등)
  // 품질 설정 관련
  showQualitySettings?: boolean
  // 좌표 확인 모드
  showCoordinateMode?: boolean
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
