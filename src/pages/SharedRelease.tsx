/**
 * SharedRelease - 공개 Release 뷰어 (인증 불필요)
 */
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Globe, Loader2, AlertTriangle } from 'lucide-react'
import { useReleaseStore } from '@/stores/releaseStore'
import ReleaseViewer from '@/components/release/ReleaseViewer'

export default function SharedRelease() {
  const { token } = useParams<{ token: string }>()
  const { currentRelease, isLoading, loadReleaseByToken } = useReleaseStore()
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (token) {
      loadReleaseByToken(token).then(result => {
        if (!result) setNotFound(true)
      })
    }
  }, [token, loadReleaseByToken])

  if (isLoading) {
    return (
      <div className="h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={40} className="animate-spin text-blue-500" />
          <p className="text-slate-400 text-sm">Release 로딩 중...</p>
        </div>
      </div>
    )
  }

  if (notFound || !currentRelease) {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-500">
        <AlertTriangle size={64} className="opacity-30 mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">Release를 찾을 수 없습니다</h2>
        <p className="text-sm">
          링크가 올바르지 않거나, Release가 취소되었을 수 있습니다.
        </p>
      </div>
    )
  }

  if (currentRelease.status === 'revoked') {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-500">
        <AlertTriangle size={64} className="opacity-30 mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">이 Release는 취소되었습니다</h2>
        <p className="text-sm">발행자에 의해 취소된 Release입니다.</p>
      </div>
    )
  }

  return (
    <div className="h-screen bg-slate-950 flex flex-col">
      {/* 상단 바 */}
      <div className="h-12 bg-slate-900 border-b border-slate-700 flex items-center justify-between px-6 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Globe size={16} className="text-emerald-400" />
          <h1 className="text-sm font-semibold text-white">
            {currentRelease.snapshot.story?.title || 'Release'}
          </h1>
          {currentRelease.label && (
            <span className="text-xs text-slate-400">· {currentRelease.label}</span>
          )}
          <span className="text-xs text-slate-500">v{currentRelease.version}</span>
        </div>
        <span className="text-xs text-slate-500 bg-slate-800 px-2.5 py-1 rounded">
          읽기 전용
        </span>
      </div>

      {/* 뷰어 */}
      <div className="flex-1 min-h-0">
        <ReleaseViewer release={currentRelease} isShared />
      </div>
    </div>
  )
}
