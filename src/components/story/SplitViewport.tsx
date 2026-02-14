/**
 * SplitViewport - 분할 뷰포트 비교 모드
 * 좌/우 캔버스로 두 에셋을 나란히 비교
 */
import { useState, useRef, useCallback } from 'react'
import { GripVertical, X } from 'lucide-react'
import Viewer3D from '@/components/viewer/Viewer3D'

interface SplitViewportProps {
  leftUrl: string | null
  leftFormat?: string
  leftLabel: string
  rightUrl: string | null
  rightFormat?: string
  rightLabel: string
  onClose: () => void
}

export default function SplitViewport({
  leftUrl,
  leftFormat,
  leftLabel,
  rightUrl,
  rightFormat,
  rightLabel,
  onClose,
}: SplitViewportProps) {
  const [splitRatio, setSplitRatio] = useState(50) // 0~100
  const containerRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)

  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDraggingRef.current = true

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isDraggingRef.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const ratio = ((ev.clientX - rect.left) / rect.width) * 100
      setSplitRatio(Math.max(20, Math.min(80, ratio)))
    }

    const handleMouseUp = () => {
      isDraggingRef.current = false
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }, [])

  return (
    <div className="flex flex-col h-full">
      {/* 상단 바 */}
      <div className="h-10 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-4 text-xs">
          <span className="text-blue-400 font-medium">{leftLabel}</span>
          <span className="text-slate-600">vs</span>
          <span className="text-purple-400 font-medium">{rightLabel}</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* 분할 캔버스 */}
      <div ref={containerRef} className="flex-1 flex min-h-0 relative">
        {/* 좌측 */}
        <div style={{ width: `${splitRatio}%` }} className="h-full overflow-hidden relative">
          <Viewer3D
            modelUrl={leftUrl || undefined}
            modelFormat={leftFormat}
          />
          <div className="absolute bottom-2 left-2 px-2 py-1 bg-blue-500/20 border border-blue-500/40 rounded text-[10px] text-blue-300 backdrop-blur-sm">
            {leftLabel}
          </div>
        </div>

        {/* 분할선 */}
        <div
          className="w-1.5 bg-slate-700 hover:bg-blue-500 cursor-col-resize flex items-center justify-center flex-shrink-0 transition-colors z-10"
          onMouseDown={handleDividerMouseDown}
        >
          <GripVertical size={12} className="text-slate-500" />
        </div>

        {/* 우측 */}
        <div style={{ width: `${100 - splitRatio}%` }} className="h-full overflow-hidden relative">
          <Viewer3D
            modelUrl={rightUrl || undefined}
            modelFormat={rightFormat}
          />
          <div className="absolute bottom-2 right-2 px-2 py-1 bg-purple-500/20 border border-purple-500/40 rounded text-[10px] text-purple-300 backdrop-blur-sm">
            {rightLabel}
          </div>
        </div>
      </div>
    </div>
  )
}
