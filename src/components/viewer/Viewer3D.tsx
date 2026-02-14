import { useState, useEffect, useMemo } from 'react'
import { MousePointer2, Ruler, PenTool, Box, Globe, RotateCcw, ZoomIn } from 'lucide-react'
import ThreeCanvas, { type ClickPosition } from './ThreeCanvas'
import MapView from './MapView'
import { AnnotationModal } from '@/components/annotation'
import { useAnnotationStore } from '@/stores/annotationStore'
import { useProjectStore } from '@/stores/projectStore'
import type { AnnotationData } from '@/services/api'

type ViewMode = 'grid' | 'map'
type Tool = 'select' | 'measure' | 'annotate'

interface Viewer3DProps {
  modelUrl?: string
  modelFile?: File
  modelFormat?: string
  // 어노테이션 관련 props
  annotations?: AnnotationData[]
  selectedAnnotationId?: string | null
  onAnnotationSelect?: (annotation: AnnotationData) => void
  // Legacy props (호환성 유지)
  legacyAnnotations?: Array<{
    id: number
    title: string
    x: string
    y: string
    priority: 'High' | 'Medium' | 'Low'
  }>
}

export default function Viewer3D({
  modelUrl,
  modelFile,
  modelFormat,
  annotations: propAnnotations,
  selectedAnnotationId: propSelectedId,
  onAnnotationSelect,
  legacyAnnotations,
}: Viewer3DProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [activeTool, setActiveTool] = useState<Tool>('select')
  const [pendingPosition, setPendingPosition] = useState<ClickPosition | null>(null)
  const [showAnnotationModal, setShowAnnotationModal] = useState(false)
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null)

  const { annotations: storeAnnotations, createAnnotation, initialize: initAnnotations } = useAnnotationStore()
  const { projects, initialize: initProjects } = useProjectStore()

  useEffect(() => {
    initProjects()
    initAnnotations()
  }, [initProjects, initAnnotations])

  // 외부에서 전달된 어노테이션이 있으면 사용, 없으면 스토어 어노테이션 사용
  const annotations = useMemo(() => propAnnotations ?? storeAnnotations, [propAnnotations, storeAnnotations])

  // 선택된 어노테이션 ID (외부 제어 또는 내부 상태)
  const selectedAnnotationId = propSelectedId ?? internalSelectedId

  // 어노테이션 클릭 핸들러
  const handleAnnotationClick = (annotation: AnnotationData) => {
    if (onAnnotationSelect) {
      onAnnotationSelect(annotation)
    } else {
      setInternalSelectedId(annotation.id)
    }
  }

  const handlePointClick = (position: ClickPosition) => {
    if (activeTool === 'annotate') {
      setPendingPosition(position)
      setShowAnnotationModal(true)
    }
  }

  const handleCreateAnnotation = async (data: Omit<AnnotationData, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const annotationData = {
        ...data,
        position: pendingPosition,
      }
      await createAnnotation(annotationData)
      setShowAnnotationModal(false)
      setPendingPosition(null)
      setActiveTool('select')
    } catch (err) {
      console.error('어노테이션 생성 실패:', err)
      alert('어노테이션 생성에 실패했습니다.')
    }
  }

  return (
    <div className="w-full h-full bg-slate-950 rounded-xl border border-slate-800 relative overflow-hidden flex flex-col">
      {/* Viewer Toolbar */}
      <div className="absolute top-4 left-4 z-10 flex flex-col space-y-2">
        {/* Tool Selection */}
        <div className="bg-slate-800/90 backdrop-blur border border-slate-700 rounded-lg p-1.5 flex flex-col space-y-1 shadow-lg">
          <button
            onClick={() => setActiveTool('select')}
            className={`p-2 rounded transition-colors flex items-center gap-1.5 ${
              activeTool === 'select'
                ? 'text-blue-400 bg-blue-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
            title="선택"
          >
            <MousePointer2 size={18} />
            <span className="text-xs hidden sm:inline">선택</span>
          </button>
          <button
            onClick={() => setActiveTool('measure')}
            className={`p-2 rounded transition-colors flex items-center gap-1.5 ${
              activeTool === 'measure'
                ? 'text-blue-400 bg-blue-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
            title="측정"
          >
            <Ruler size={18} />
            <span className="text-xs hidden sm:inline">측정</span>
          </button>
          <button
            onClick={() => setActiveTool('annotate')}
            className={`p-2 rounded transition-colors flex items-center gap-1.5 ${
              activeTool === 'annotate'
                ? 'text-orange-400 bg-orange-500/20 ring-2 ring-orange-400/50'
                : 'text-slate-400 hover:text-orange-400 hover:bg-orange-500/10'
            }`}
            title="어노테이션 추가 - 클릭하여 위치 선택"
          >
            <PenTool size={18} />
            <span className="text-xs hidden sm:inline">어노테이션</span>
          </button>
        </div>

        {/* View Mode */}
        <div className="bg-slate-800/90 backdrop-blur border border-slate-700 rounded-lg p-1.5 flex flex-col space-y-1 shadow-lg">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded transition-colors ${
              viewMode === 'grid'
                ? 'text-blue-400 bg-blue-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
            title="3D 뷰"
          >
            <Box size={18} />
          </button>
          <button
            onClick={() => setViewMode('map')}
            className={`p-2 rounded transition-colors ${
              viewMode === 'map'
                ? 'text-green-400 bg-green-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
            title="지도 뷰"
          >
            <Globe size={18} />
          </button>
        </div>

        {/* View Controls */}
        <div className="bg-slate-800/90 backdrop-blur border border-slate-700 rounded-lg p-1.5 flex flex-col space-y-1 shadow-lg">
          <button
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
            title="뷰 초기화"
          >
            <RotateCcw size={18} />
          </button>
          <button
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
            title="맞춤 확대"
          >
            <ZoomIn size={18} />
          </button>
        </div>
      </div>

      {/* 3D Viewport */}
      <div className="flex-1 relative">
        {viewMode === 'grid' ? (
          <ThreeCanvas
            modelUrl={modelUrl}
            modelFile={modelFile}
            modelFormat={modelFormat}
            annotateMode={activeTool === 'annotate'}
            onPointClick={handlePointClick}
            annotations={annotations}
            selectedAnnotationId={selectedAnnotationId}
            onAnnotationClick={handleAnnotationClick}
          />
        ) : (
          <MapView annotations={legacyAnnotations} />
        )}
      </div>

      {/* Status Bar */}
      <div className="absolute bottom-4 left-4 bg-slate-900/90 backdrop-blur border border-slate-700 px-3 py-1.5 rounded-lg text-xs text-slate-400 shadow-lg">
        {activeTool === 'annotate' ? (
          <span>
            <span className="text-orange-400 font-medium">어노테이션 모드</span> | 3D 공간을 클릭하여 마커 배치
          </span>
        ) : viewMode === 'grid' ? (
          <span>
            <span className="text-blue-400 font-medium">3D 뷰</span> | 드래그: 회전, 스크롤:
            줌, 우클릭: 이동
          </span>
        ) : (
          <span>
            <span className="text-green-400 font-medium">지도 뷰</span> | 클릭하여 마커 선택
          </span>
        )}
      </div>

      {/* 어노테이션 생성 모달 */}
      <AnnotationModal
        isOpen={showAnnotationModal}
        onClose={() => {
          setShowAnnotationModal(false)
          setPendingPosition(null)
        }}
        onSubmit={handleCreateAnnotation}
        title="새 어노테이션"
        projects={projects}
        initialPosition={pendingPosition}
      />
    </div>
  )
}
