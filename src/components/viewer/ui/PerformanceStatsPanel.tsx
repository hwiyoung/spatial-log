import { Activity } from 'lucide-react'
import {
  type QualityLevel,
  QUALITY_LABELS,
} from '@/utils/renderingOptions'
import type { PerformanceStats } from '../three/SceneHelpers'

export function PerformanceStatsPanel({
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
