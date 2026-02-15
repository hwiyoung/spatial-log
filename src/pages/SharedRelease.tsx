/**
 * SharedRelease - 공개 Release 뷰어 (인증 불필요)
 */
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Globe, Loader2, AlertTriangle, Lock, Calendar } from 'lucide-react'
import { useReleaseStore } from '@/stores/releaseStore'
import { ReleaseExpiredError, unlockReleaseWithPassword } from '@/services/api'
import ReleaseViewer from '@/components/release/ReleaseViewer'

/** SHA-256 해시 생성 (ReleaseCreateDialog와 동일한 알고리즘) */
async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password.trim())
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export default function SharedRelease() {
  const { token } = useParams<{ token: string }>()
  const { currentRelease, isLoading, loadReleaseByToken } = useReleaseStore()
  const [notFound, setNotFound] = useState(false)
  const [expired, setExpired] = useState(false)
  const [needsPassword, setNeedsPassword] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState(false)
  const [unlocking, setUnlocking] = useState(false)

  useEffect(() => {
    if (token) {
      loadReleaseByToken(token).then(result => {
        if (!result) setNotFound(true)
        else if (result.passwordProtected) setNeedsPassword(true)
      }).catch(err => {
        if (err instanceof ReleaseExpiredError) setExpired(true)
        else setNotFound(true)
      })
    }
  }, [token, loadReleaseByToken])

  const handlePasswordSubmit = async () => {
    if (!passwordInput.trim()) {
      setPasswordError(true)
      return
    }
    if (!token || !currentRelease) return

    setUnlocking(true)
    setPasswordError(false)
    try {
      const hash = await hashPassword(passwordInput)
      const unlocked = await unlockReleaseWithPassword(token, hash)
      if (unlocked) {
        // Store에 전체 데이터 반영
        useReleaseStore.setState({ currentRelease: unlocked })
        setNeedsPassword(false)
      } else {
        setPasswordError(true)
      }
    } catch {
      setPasswordError(true)
    } finally {
      setUnlocking(false)
    }
  }

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

  if (expired) {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-500">
        <Calendar size={64} className="opacity-30 mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">이 Release는 만료되었습니다</h2>
        <p className="text-sm">
          공유 기한이 지나 더 이상 열람할 수 없습니다.
        </p>
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

  if (needsPassword) {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center">
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 max-w-sm w-full mx-4">
          <div className="flex flex-col items-center mb-6">
            <Lock size={32} className="text-emerald-400 mb-3" />
            <h2 className="text-lg font-semibold text-white">비밀번호가 필요합니다</h2>
            <p className="text-sm text-slate-400 mt-1">이 Release는 비밀번호로 보호됩니다</p>
          </div>
          <input
            type="password"
            value={passwordInput}
            onChange={e => { setPasswordInput(e.target.value); setPasswordError(false) }}
            onKeyDown={e => { if (e.key === 'Enter') handlePasswordSubmit() }}
            placeholder="비밀번호 입력"
            className={`w-full px-4 py-3 bg-slate-800 border rounded-lg text-white placeholder:text-slate-500 focus:outline-none mb-3 ${
              passwordError ? 'border-red-500' : 'border-slate-600 focus:border-blue-500'
            }`}
            autoFocus
            disabled={unlocking}
          />
          {passwordError && <p className="text-xs text-red-400 mb-2">비밀번호가 올바르지 않습니다</p>}
          <button
            onClick={handlePasswordSubmit}
            disabled={unlocking}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            {unlocking && <Loader2 size={14} className="animate-spin" />}
            확인
          </button>
        </div>
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

      {/* 브랜딩 푸터 */}
      <div className="h-8 bg-slate-900 border-t border-slate-700 flex items-center justify-center gap-2 flex-shrink-0">
        <Globe size={12} className="text-emerald-400" />
        <span className="text-xs text-slate-500">Spatial Log · v{currentRelease.version} · {new Date(currentRelease.createdAt).toLocaleDateString('ko-KR')}</span>
      </div>
    </div>
  )
}
