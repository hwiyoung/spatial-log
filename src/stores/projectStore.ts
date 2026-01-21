import { create } from 'zustand'
import {
  type ProjectData,
  createProject,
  getProjects,
  getProject,
  updateProject,
  deleteProject,
  isBackendConnected,
} from '@/services/api'

interface ProjectState {
  // 데이터
  projects: ProjectData[]
  selectedProjectId: string | null
  selectedProject: ProjectData | null

  // UI 상태
  isLoading: boolean
  error: string | null

  // 필터
  statusFilter: 'all' | 'active' | 'review' | 'completed' | 'archived'
  searchQuery: string

  // 백엔드 연결 상태
  isOnline: boolean

  // 액션
  initialize: () => Promise<void>
  refreshProjects: () => Promise<void>

  // 프로젝트 CRUD
  createProject: (name: string, description?: string, tags?: string[]) => Promise<ProjectData>
  updateProject: (
    id: string,
    updates: Partial<Pick<ProjectData, 'name' | 'description' | 'thumbnailUrl' | 'status' | 'tags'>>
  ) => Promise<void>
  deleteProject: (id: string) => Promise<void>

  // 선택
  selectProject: (id: string | null) => Promise<void>

  // 필터
  setStatusFilter: (status: 'all' | 'active' | 'review' | 'completed' | 'archived') => void
  setSearchQuery: (query: string) => void

  // 유틸리티
  getFilteredProjects: () => ProjectData[]
  clearError: () => void
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  // 초기 상태
  projects: [],
  selectedProjectId: null,
  selectedProject: null,
  isLoading: false,
  error: null,
  statusFilter: 'all',
  searchQuery: '',
  isOnline: isBackendConnected(),

  // 초기화
  initialize: async () => {
    set({ isLoading: true, error: null, isOnline: isBackendConnected() })
    try {
      const projects = await getProjects()
      set({ projects, isLoading: false })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : '프로젝트 초기화 실패',
        isLoading: false,
      })
    }
  },

  // 프로젝트 목록 새로고침
  refreshProjects: async () => {
    try {
      const projects = await getProjects()
      set({ projects })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '프로젝트 목록 조회 실패' })
    }
  },

  // 프로젝트 생성
  createProject: async (name: string, description?: string, tags: string[] = []) => {
    set({ isLoading: true, error: null })
    try {
      const project = await createProject(name, description ?? null, tags)
      await get().refreshProjects()
      set({ isLoading: false })
      return project
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : '프로젝트 생성 실패',
        isLoading: false,
      })
      throw err
    }
  },

  // 프로젝트 업데이트
  updateProject: async (id: string, updates) => {
    set({ isLoading: true, error: null })
    try {
      await updateProject(id, updates)
      await get().refreshProjects()

      // 선택된 프로젝트가 수정된 경우 갱신
      const { selectedProjectId } = get()
      if (selectedProjectId === id) {
        const updated = await getProject(id)
        set({ selectedProject: updated })
      }

      set({ isLoading: false })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : '프로젝트 업데이트 실패',
        isLoading: false,
      })
    }
  },

  // 프로젝트 삭제
  deleteProject: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      await deleteProject(id)
      await get().refreshProjects()

      // 삭제된 프로젝트가 선택되어 있으면 선택 해제
      const { selectedProjectId } = get()
      if (selectedProjectId === id) {
        set({ selectedProjectId: null, selectedProject: null })
      }

      set({ isLoading: false })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : '프로젝트 삭제 실패',
        isLoading: false,
      })
    }
  },

  // 프로젝트 선택
  selectProject: async (id: string | null) => {
    if (id === null) {
      set({ selectedProjectId: null, selectedProject: null })
      return
    }

    set({ isLoading: true })
    try {
      const project = await getProject(id)
      set({ selectedProjectId: id, selectedProject: project, isLoading: false })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : '프로젝트 조회 실패',
        isLoading: false,
      })
    }
  },

  // 상태 필터 설정
  setStatusFilter: (status) => {
    set({ statusFilter: status })
  },

  // 검색어 설정
  setSearchQuery: (query) => {
    set({ searchQuery: query })
  },

  // 필터링된 프로젝트 목록
  getFilteredProjects: () => {
    const { projects, statusFilter, searchQuery } = get()

    return projects.filter((project) => {
      // 상태 필터
      if (statusFilter !== 'all' && project.status !== statusFilter) {
        return false
      }

      // 검색어 필터
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchName = project.name.toLowerCase().includes(query)
        const matchDesc = project.description?.toLowerCase().includes(query)
        const matchTags = project.tags.some((tag) => tag.toLowerCase().includes(query))
        if (!matchName && !matchDesc && !matchTags) {
          return false
        }
      }

      return true
    })
  },

  // 에러 초기화
  clearError: () => {
    set({ error: null })
  },
}))
