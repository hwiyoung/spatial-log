import { MapPin, Copy, Check } from 'lucide-react'
import type { ClickPosition } from '../ThreeCanvas'

export function CoordinatePanel({
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
