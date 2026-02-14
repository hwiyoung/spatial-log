import { create } from 'zustand'
import type { ReleaseData, ReleaseSnapshot, ReleaseManifest, AccessType } from '@/types/story'
import {
  createRelease,
  getAllReleases,
  getReleasesByStory,
  getRelease,
  getReleaseByShareToken,
  revokeRelease,
} from '@/services/api'

interface ReleaseState {
  // 데이터
  releases: ReleaseData[]
  currentRelease: ReleaseData | null

  // UI 상태
  isLoading: boolean
  error: string | null

  // 액션
  loadAllReleases: () => Promise<void>
  loadReleases: (storyId: string) => Promise<void>
  createRelease: (
    storyId: string,
    snapshot: ReleaseSnapshot,
    manifest: ReleaseManifest,
    options: { label?: string; accessType?: AccessType }
  ) => Promise<ReleaseData>
  revokeRelease: (id: string) => Promise<void>
  loadRelease: (id: string) => Promise<void>
  loadReleaseByToken: (token: string) => Promise<ReleaseData | null>

  // UI
  clearError: () => void
}

export const useReleaseStore = create<ReleaseState>((set) => ({
  releases: [],
  currentRelease: null,
  isLoading: false,
  error: null,

  // 전체 Release 목록 로드
  loadAllReleases: async () => {
    set({ isLoading: true, error: null })
    try {
      const releases = await getAllReleases()
      set({ releases, isLoading: false })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Release 목록 조회 실패',
        isLoading: false,
      })
    }
  },

  // 특정 Story의 Release 목록 로드
  loadReleases: async (storyId: string) => {
    set({ isLoading: true, error: null })
    try {
      const releases = await getReleasesByStory(storyId)
      set({ releases, isLoading: false })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Release 목록 조회 실패',
        isLoading: false,
      })
    }
  },

  // Release 생성
  createRelease: async (storyId, snapshot, manifest, options) => {
    set({ isLoading: true, error: null })
    try {
      const release = await createRelease(storyId, snapshot, manifest, options)
      set((state) => ({
        releases: [release, ...state.releases],
        isLoading: false,
      }))
      return release
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Release 생성 실패',
        isLoading: false,
      })
      throw err
    }
  },

  // Release 취소 (revoke)
  revokeRelease: async (id: string) => {
    set({ error: null })
    try {
      await revokeRelease(id)
      set((state) => ({
        releases: state.releases.map(r =>
          r.id === id ? { ...r, status: 'revoked' as const } : r
        ),
        currentRelease: state.currentRelease?.id === id
          ? { ...state.currentRelease, status: 'revoked' as const }
          : state.currentRelease,
      }))
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Release 취소 실패' })
    }
  },

  // 단일 Release 로드
  loadRelease: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      const release = await getRelease(id)
      set({
        currentRelease: release,
        isLoading: false,
      })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Release 로드 실패',
        isLoading: false,
      })
    }
  },

  // 공유 토큰으로 Release 로드
  loadReleaseByToken: async (token: string) => {
    set({ isLoading: true, error: null })
    try {
      const release = await getReleaseByShareToken(token)
      set({
        currentRelease: release,
        isLoading: false,
      })
      return release
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Release 조회 실패',
        isLoading: false,
      })
      return null
    }
  },

  clearError: () => {
    set({ error: null })
  },
}))
