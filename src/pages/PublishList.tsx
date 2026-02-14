/**
 * PublishList - 전체 Release 목록 페이지
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Globe, Lock, Loader2, Copy, Eye, MoreHorizontal,
  AlertCircle, Layers, Check,
} from 'lucide-react'
import { useReleaseStore } from '@/stores/releaseStore'
import type { ReleaseData } from '@/types/story'

function getRelativeTime(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '방금 전'
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}일 전`
  return date.toLocaleDateString('ko-KR')
}

export default function PublishList() {
  const navigate = useNavigate()
  const { releases, isLoading, loadAllReleases, revokeRelease } = useReleaseStore()
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    loadAllReleases()
  }, [loadAllReleases])

  const handleCopyLink = async (release: ReleaseData) => {
    if (!release.shareToken) return
    const url = `${window.location.origin}/shared/${release.shareToken}`
    await navigator.clipboard.writeText(url)
    setCopiedId(release.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleRevoke = async (id: string) => {
    await revokeRelease(id)
    setMenuOpenId(null)
  }

  return (
    <>
      <div className="flex justify-between items-end mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Publish</h1>
          <p className="text-slate-400 text-sm">발행된 Release 목록</p>
        </div>
      </div>

      {isLoading && releases.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 size={32} className="animate-spin text-blue-500" />
        </div>
      ) : releases.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-slate-500">
          <Layers size={64} className="opacity-30 mb-4" />
          <p className="text-lg mb-2">아직 발행된 Release가 없습니다</p>
          <p className="text-sm text-slate-600">
            Story에서 Publish 버튼으로 첫 Release를 만들어보세요.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {releases.map(release => {
            const isRevoked = release.status === 'revoked'
            const isPublic = release.accessType === 'public'

            return (
              <div
                key={release.id}
                className={`bg-slate-900/50 border rounded-xl p-5 transition-all ${
                  isRevoked
                    ? 'border-slate-800 opacity-50'
                    : 'border-slate-700 hover:border-slate-600'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    {/* 제목 행 */}
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className={`text-base font-semibold ${isRevoked ? 'line-through text-slate-500' : 'text-white'}`}>
                        {release.label || `Release v${release.version}`}
                      </h3>
                      <span className="text-xs text-slate-500">v{release.version}</span>
                      <span className="text-xs text-slate-600">{getRelativeTime(release.createdAt)}</span>
                    </div>

                    {/* Story 이름 */}
                    <div className="text-sm text-slate-400 mb-3">
                      Story: {release.snapshot.story?.title || '알 수 없음'}
                    </div>

                    {/* 배지 */}
                    <div className="flex items-center gap-3 flex-wrap">
                      {/* 접근 타입 */}
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
                        isPublic
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-slate-500/20 text-slate-400'
                      }`}>
                        {isPublic ? <Globe size={10} /> : <Lock size={10} />}
                        {isPublic ? 'public' : 'private'}
                      </span>

                      {/* 상태 */}
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        isRevoked
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-green-500/20 text-green-400'
                      }`}>
                        {isRevoked ? 'revoked' : 'active'}
                      </span>

                      {/* Manifest */}
                      <span className="text-xs text-slate-500">
                        {release.manifest.totalScenes} Scenes · {release.manifest.totalEntries} Entries · {release.manifest.totalAssets} Assets
                      </span>
                    </div>
                  </div>

                  {/* 액션 버튼 */}
                  <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                    {isPublic && !isRevoked && (
                      <button
                        onClick={() => handleCopyLink(release)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                      >
                        {copiedId === release.id ? (
                          <>
                            <Check size={12} className="text-green-400" />
                            복사됨
                          </>
                        ) : (
                          <>
                            <Copy size={12} />
                            링크 복사
                          </>
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => navigate(`/publish/${release.id}`)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      <Eye size={12} />
                      상세보기
                    </button>
                    {!isRevoked && (
                      <div className="relative">
                        <button
                          onClick={() => setMenuOpenId(menuOpenId === release.id ? null : release.id)}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                        >
                          <MoreHorizontal size={16} />
                        </button>
                        {menuOpenId === release.id && (
                          <div className="absolute right-0 top-8 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-10 py-1 min-w-[120px]">
                            <button
                              onClick={() => handleRevoke(release.id)}
                              className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-slate-700 flex items-center gap-2"
                            >
                              <AlertCircle size={12} />
                              취소 (Revoke)
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
