import { create } from 'zustand'
import type { StoryData, StoryStatus, SceneData, SceneEntryData, SceneEntryType } from '@/types/story'
import {
  createStory,
  getStories,
  getStory,
  updateStory,
  deleteStory,
  getScenesByStory,
  createScene,
  updateScene,
  deleteScene,
  reorderScenes,
  getEntriesByStory,
  createSceneEntry,
  updateSceneEntry,
  deleteSceneEntry,
  reorderEntries,
  getSceneCountsByStories,
} from '@/services/api'

interface StoryState {
  // 데이터
  stories: StoryData[]
  currentStory: StoryData | null
  scenes: SceneData[]
  entries: Map<string, SceneEntryData[]>
  activeSceneId: string | null
  activeEntryId: string | null
  sceneCounts: Map<string, number>  // storyId → scene count (목록용)

  // UI 상태
  isLoading: boolean
  error: string | null

  // Story CRUD
  initStories: () => Promise<void>
  loadStory: (id: string) => Promise<void>
  createStory: (title: string, description?: string | null, tags?: string[]) => Promise<StoryData>
  updateStory: (id: string, updates: Partial<Pick<StoryData, 'title' | 'description' | 'status' | 'tags'>>) => Promise<void>
  deleteStory: (id: string) => Promise<void>
  setStoryStatus: (id: string, status: StoryStatus) => Promise<void>

  // Scene CRUD
  addScene: (title: string, options?: { zoneLabel?: string | null; summary?: string | null }) => Promise<SceneData | null>
  updateScene: (id: string, updates: Partial<Pick<SceneData, 'title' | 'zoneLabel' | 'summary'>>) => Promise<void>
  deleteScene: (id: string) => Promise<void>
  reorderScenes: (orderedIds: string[]) => Promise<void>

  // Entry CRUD
  addEntry: (sceneId: string, data: {
    entryType: SceneEntryType
    fileId?: string | null
    title?: string | null
    body?: string | null
    url?: string | null
    gps?: { latitude: number; longitude: number } | null
    spatialAnchor?: { x: number; y: number; z: number } | null
  }) => Promise<SceneEntryData | null>
  updateEntry: (id: string, updates: Partial<Pick<SceneEntryData, 'title' | 'body' | 'url' | 'gps' | 'spatialAnchor' | 'fileId'>>) => Promise<void>
  deleteEntry: (id: string) => Promise<void>
  reorderEntries: (sceneId: string, orderedIds: string[]) => Promise<void>

  // 네비게이션
  setActiveScene: (id: string | null) => void
  setActiveEntry: (id: string | null) => void

  // UI
  clearError: () => void
}

export const useStoryStore = create<StoryState>((set, get) => ({
  stories: [],
  currentStory: null,
  scenes: [],
  entries: new Map(),
  activeSceneId: null,
  activeEntryId: null,
  sceneCounts: new Map(),
  isLoading: false,
  error: null,

  // Story 목록 로드
  initStories: async () => {
    set({ isLoading: true, error: null })
    try {
      const stories = await getStories()
      const sceneCounts = await getSceneCountsByStories(stories.map(s => s.id))
      set({ stories, sceneCounts, isLoading: false })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Story 목록 조회 실패',
        isLoading: false,
      })
    }
  },

  // 특정 Story 로드 (Scene + Entry 포함)
  loadStory: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      const [story, scenes, entriesMap] = await Promise.all([
        getStory(id),
        getScenesByStory(id),
        getEntriesByStory(id),
      ])

      if (!story) {
        set({ error: 'Story를 찾을 수 없습니다.', isLoading: false })
        return
      }

      const firstSceneId = scenes[0]?.id ?? null

      set({
        currentStory: story,
        scenes,
        entries: entriesMap,
        activeSceneId: firstSceneId,
        activeEntryId: null,
        isLoading: false,
      })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Story 로드 실패',
        isLoading: false,
      })
    }
  },

  // Story 생성
  createStory: async (title: string, description?: string | null, tags?: string[]) => {
    set({ isLoading: true, error: null })
    try {
      const story = await createStory(title, description ?? null, tags ?? [])
      set((state) => ({
        stories: [story, ...state.stories],
        isLoading: false,
      }))
      return story
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Story 생성 실패',
        isLoading: false,
      })
      throw err
    }
  },

  // Story 업데이트
  updateStory: async (id: string, updates) => {
    set({ error: null })
    try {
      const updated = await updateStory(id, updates)
      if (!updated) return

      set((state) => ({
        stories: state.stories.map(s => s.id === id ? updated : s),
        currentStory: state.currentStory?.id === id ? updated : state.currentStory,
      }))
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Story 수정 실패' })
    }
  },

  // Story 삭제
  deleteStory: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      await deleteStory(id)
      set((state) => ({
        stories: state.stories.filter(s => s.id !== id),
        currentStory: state.currentStory?.id === id ? null : state.currentStory,
        isLoading: false,
      }))
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Story 삭제 실패',
        isLoading: false,
      })
    }
  },

  // Story 상태 변경
  setStoryStatus: async (id: string, status: StoryStatus) => {
    await get().updateStory(id, { status })
  },

  // Scene 추가
  addScene: async (title: string, options?: { zoneLabel?: string | null; summary?: string | null }) => {
    const { currentStory } = get()
    if (!currentStory) return null

    set({ error: null })
    try {
      const scene = await createScene(currentStory.id, title, undefined, options)
      set((state) => {
        const newEntries = new Map(state.entries)
        newEntries.set(scene.id, [])
        return {
          scenes: [...state.scenes, scene],
          entries: newEntries,
          activeSceneId: scene.id,
        }
      })
      return scene
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Scene 추가 실패' })
      return null
    }
  },

  // Scene 업데이트
  updateScene: async (id: string, updates) => {
    set({ error: null })
    try {
      const updated = await updateScene(id, updates)
      if (!updated) return

      set((state) => ({
        scenes: state.scenes.map(s => s.id === id ? updated : s),
      }))
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Scene 수정 실패' })
    }
  },

  // Scene 삭제
  deleteScene: async (id: string) => {
    set({ error: null })
    try {
      await deleteScene(id)
      set((state) => {
        const newEntries = new Map(state.entries)
        newEntries.delete(id)
        const newScenes = state.scenes.filter(s => s.id !== id)
        return {
          scenes: newScenes,
          entries: newEntries,
          activeSceneId: state.activeSceneId === id
            ? (newScenes[0]?.id ?? null)
            : state.activeSceneId,
          activeEntryId: state.activeSceneId === id ? null : state.activeEntryId,
        }
      })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Scene 삭제 실패' })
    }
  },

  // Scene 순서 변경
  reorderScenes: async (orderedIds: string[]) => {
    const { currentStory } = get()
    if (!currentStory) return

    // 낙관적 업데이트
    set((state) => {
      const reordered = orderedIds
        .map((id, index) => {
          const scene = state.scenes.find(s => s.id === id)
          return scene ? { ...scene, sortOrder: index } : null
        })
        .filter((s): s is SceneData => s !== null)
      return { scenes: reordered }
    })

    try {
      await reorderScenes(currentStory.id, orderedIds)
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Scene 순서 변경 실패' })
      // 실패 시 다시 로드
      await get().loadStory(currentStory.id)
    }
  },

  // Entry 추가
  addEntry: async (sceneId: string, data) => {
    set({ error: null })
    try {
      const entry = await createSceneEntry(sceneId, data)
      set((state) => {
        const newEntries = new Map(state.entries)
        const list = [...(newEntries.get(sceneId) || []), entry]
        newEntries.set(sceneId, list)
        return { entries: newEntries }
      })
      return entry
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Entry 추가 실패' })
      return null
    }
  },

  // Entry 업데이트
  updateEntry: async (id: string, updates) => {
    set({ error: null })
    try {
      const updated = await updateSceneEntry(id, updates)
      if (!updated) return

      set((state) => {
        const newEntries = new Map(state.entries)
        for (const [sceneId, list] of newEntries) {
          const idx = list.findIndex(e => e.id === id)
          if (idx !== -1) {
            const newList = [...list]
            newList[idx] = updated
            newEntries.set(sceneId, newList)
            break
          }
        }
        return { entries: newEntries }
      })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Entry 수정 실패' })
    }
  },

  // Entry 삭제
  deleteEntry: async (id: string) => {
    set({ error: null })
    try {
      await deleteSceneEntry(id)
      set((state) => {
        const newEntries = new Map(state.entries)
        for (const [sceneId, list] of newEntries) {
          const filtered = list.filter(e => e.id !== id)
          if (filtered.length !== list.length) {
            newEntries.set(sceneId, filtered)
            break
          }
        }
        return {
          entries: newEntries,
          activeEntryId: state.activeEntryId === id ? null : state.activeEntryId,
        }
      })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Entry 삭제 실패' })
    }
  },

  // Entry 순서 변경
  reorderEntries: async (sceneId: string, orderedIds: string[]) => {
    // 낙관적 업데이트
    set((state) => {
      const newEntries = new Map(state.entries)
      const list = newEntries.get(sceneId) || []
      const reordered = orderedIds
        .map((id, index) => {
          const entry = list.find(e => e.id === id)
          return entry ? { ...entry, sortOrder: index } : null
        })
        .filter((e): e is SceneEntryData => e !== null)
      newEntries.set(sceneId, reordered)
      return { entries: newEntries }
    })

    try {
      await reorderEntries(sceneId, orderedIds)
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Entry 순서 변경 실패' })
    }
  },

  // 네비게이션
  setActiveScene: (id: string | null) => {
    set({ activeSceneId: id, activeEntryId: null })
  },

  setActiveEntry: (id: string | null) => {
    set({ activeEntryId: id })
  },

  clearError: () => {
    set({ error: null })
  },
}))
