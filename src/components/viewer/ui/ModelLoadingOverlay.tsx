import { AlertTriangle, Loader2 } from 'lucide-react'
import { type LoadProgress } from '../../../utils/modelLoader'

interface ModelLoadingOverlayProps {
  progress: LoadProgress | null
  error: string | null
}

export function ModelLoadingOverlay({ progress, error }: ModelLoadingOverlayProps) {
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
