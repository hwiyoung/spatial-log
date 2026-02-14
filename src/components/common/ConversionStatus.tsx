/**
 * 3D 파일 변환 상태 표시 컴포넌트
 */

import { Loader2, CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react'
import type { ConversionStatus as ConversionStatusType } from '@/services/conversionService'
import { CONVERSION_STATUS_LABELS } from '@/services/conversionService'

// 진행률 구간별 단계명
function getProgressStepLabel(progress: number): string {
  if (progress <= 10) return '준비 중...'
  if (progress <= 20) return '파일 분석 중...'
  if (progress <= 30) return '좌표계 감지 중...'
  if (progress <= 40) return '변환 시작...'
  if (progress <= 80) return '데이터 변환 중...'
  if (progress <= 95) return '후처리 중...'
  return '완료 처리 중...'
}

interface ConversionStatusProps {
  status: ConversionStatusType | null
  progress?: number
  error?: string | null
  compact?: boolean
  onRetry?: () => void
}

/**
 * 변환 상태 배지 컴포넌트
 */
export function ConversionStatusBadge({
  status,
  progress = 0,
  error,
  compact = false,
  onRetry,
}: ConversionStatusProps) {
  if (!status) return null

  const statusConfig = {
    pending: {
      icon: Clock,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
      borderColor: 'border-yellow-500/30',
    },
    converting: {
      icon: Loader2,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/30',
    },
    ready: {
      icon: CheckCircle,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/30',
    },
    failed: {
      icon: XCircle,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-500/30',
    },
  }

  const config = statusConfig[status]
  const Icon = config.icon
  const isAnimated = status === 'converting'
  const label = CONVERSION_STATUS_LABELS[status]

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs ${config.bgColor} ${config.color}`}
        title={error || label}
      >
        <Icon size={12} className={isAnimated ? 'animate-spin' : ''} />
        {status === 'converting' && <span>{progress}%</span>}
      </span>
    )
  }

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${config.bgColor} ${config.borderColor}`}
    >
      <Icon size={16} className={`${config.color} ${isAnimated ? 'animate-spin' : ''}`} />
      <span className={`text-sm font-medium ${config.color}`}>
        {status === 'converting' ? `${getProgressStepLabel(progress)} (${progress}%)` : label}
      </span>
      {status === 'failed' && onRetry && (
        <button
          onClick={onRetry}
          className="ml-2 p-1 hover:bg-white/10 rounded transition-colors"
          title="다시 시도"
        >
          <RefreshCw size={14} className="text-red-400 hover:text-red-300" />
        </button>
      )}
    </div>
  )
}

/**
 * 변환 진행률 바 컴포넌트
 */
export function ConversionProgressBar({
  status,
  progress = 0,
  error,
}: ConversionStatusProps) {
  if (!status || status === 'ready') return null

  const progressColor = {
    pending: 'bg-yellow-500',
    converting: 'bg-blue-500',
    ready: 'bg-green-500',
    failed: 'bg-red-500',
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-400">
          {status === 'converting' ? getProgressStepLabel(progress) : CONVERSION_STATUS_LABELS[status]}
        </span>
        <span className="text-xs text-slate-400">{progress}%</span>
      </div>
      <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${progressColor[status]} transition-all duration-300 ${
            status === 'converting' ? 'animate-pulse' : ''
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>
      {error && (
        <p className="mt-1 text-xs text-red-400 truncate" title={error}>
          {error}
        </p>
      )}
    </div>
  )
}

/**
 * 변환 상태 카드 컴포넌트 (상세 정보 표시)
 */
export function ConversionStatusCard({
  status,
  progress = 0,
  error,
  onRetry,
}: ConversionStatusProps & {
  fileName?: string
  conversionType?: string
}) {
  if (!status) return null

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-white">변환 상태</h4>
        <ConversionStatusBadge status={status} progress={progress} compact />
      </div>

      {status === 'converting' && (
        <ConversionProgressBar status={status} progress={progress} />
      )}

      {status === 'failed' && error && (
        <div className="mt-3">
          <p className="text-xs text-red-400 mb-2">{error}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded text-xs transition-colors"
            >
              <RefreshCw size={12} />
              다시 시도
            </button>
          )}
        </div>
      )}

      {status === 'ready' && (
        <p className="text-xs text-green-400 mt-2">
          변환이 완료되었습니다. 최적화된 포맷으로 뷰어에서 사용할 수 있습니다.
        </p>
      )}
    </div>
  )
}

export default ConversionStatusBadge
