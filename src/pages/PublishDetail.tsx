/**
 * PublishDetail - Release 상세 (읽기전용 snapshot 렌더링)
 */
import { useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Globe, Lock, Loader2, Copy, AlertTriangle } from 'lucide-react'
import { useReleaseStore } from '@/stores/releaseStore'
import ReleaseViewer from '@/components/release/ReleaseViewer'

export default function PublishDetail() {
  const { releaseId } = useParams<{ releaseId: string }>()
  const navigate = useNavigate()
  const { currentRelease, isLoading, error, loadRelease } = useReleaseStore()

  useEffect(() => {
    if (releaseId) {
      loadRelease(releaseId)
    }
  }, [releaseId, loadRelease])

  const handleCopyLink = async () => {
    if (!currentRelease?.shareToken) return
    const url = `${window.location.origin}/shared/${currentRelease.shareToken}`
    await navigator.clipboard.writeText(url)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="animate-spin text-blue-500" />
      </div>
    )
  }

  if (error || !currentRelease) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500">
        <AlertTriangle size={48} className="opacity-50 mb-4" />
        <p className="text-lg mb-2">{error || 'Release를 찾을 수 없습니다'}</p>
        <Link
          to="/publish"
          className="text-sm text-blue-400 hover:text-blue-300 mt-2"
        >
          Publish 목록으로
        </Link>
      </div>
    )
  }

  const isRevoked = currentRelease.status === 'revoked'
  const isPublic = currentRelease.accessType === 'public'

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/publish')}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white">
                {currentRelease.label || `Release v${currentRelease.version}`}
              </h1>
              <span className="text-sm text-slate-500">v{currentRelease.version}</span>
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Story: {currentRelease.snapshot.story?.title || '알 수 없음'}
            </div>
          </div>

          {/* 배지 */}
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
            isPublic
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'bg-slate-500/20 text-slate-400'
          }`}>
            {isPublic ? <Globe size={10} /> : <Lock size={10} />}
            {isPublic ? 'public' : 'private'}
          </span>

          {isRevoked && (
            <span className="px-2 py-0.5 rounded text-xs bg-red-500/20 text-red-400">
              revoked
            </span>
          )}
        </div>

        {isPublic && currentRelease.shareToken && !isRevoked && (
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors"
          >
            <Copy size={14} />
            공유 링크 복사
          </button>
        )}
      </div>

      {/* Release Viewer */}
      <div className="flex-1 min-h-0 bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
        <ReleaseViewer release={currentRelease} />
      </div>
    </div>
  )
}
