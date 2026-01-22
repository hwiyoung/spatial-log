import { create } from 'zustand'
import {
  type AnnotationData,
  createAnnotation,
  getAnnotations,
  getAnnotation,
  updateAnnotation,
  deleteAnnotation,
  isBackendConnected,
} from '@/services/api'

interface AnnotationState {
  // 데이터
  annotations: AnnotationData[]
  selectedAnnotationId: string | null
  selectedAnnotation: AnnotationData | null

  // UI 상태
  isLoading: boolean
  error: string | null

  // 필터
  projectFilter: string | null | 'all'
  statusFilter: 'all' | 'open' | 'in_progress' | 'resolved' | 'closed'
  priorityFilter: 'all' | 'low' | 'medium' | 'high' | 'critical'
  searchQuery: string

  // 백엔드 연결 상태
  isOnline: boolean

  // 액션
  initialize: (projectId?: string | null) => Promise<void>
  refreshAnnotations: () => Promise<void>

  // 어노테이션 CRUD
  createAnnotation: (
    data: Omit<AnnotationData, 'id' | 'createdAt' | 'updatedAt'>
  ) => Promise<AnnotationData>
  updateAnnotation: (
    id: string,
    updates: Partial<Omit<AnnotationData, 'id' | 'createdAt' | 'updatedAt'>>
  ) => Promise<void>
  deleteAnnotation: (id: string) => Promise<void>

  // 선택
  selectAnnotation: (id: string | null) => Promise<void>

  // 필터
  setProjectFilter: (projectId: string | null | 'all') => void
  setStatusFilter: (status: 'all' | 'open' | 'in_progress' | 'resolved' | 'closed') => void
  setPriorityFilter: (priority: 'all' | 'low' | 'medium' | 'high' | 'critical') => void
  setSearchQuery: (query: string) => void

  // 유틸리티
  getFilteredAnnotations: () => AnnotationData[]
  clearError: () => void

  // 프로젝트별 어노테이션 조회
  fetchAnnotationsByProject: (projectId: string) => Promise<AnnotationData[]>
}

export const useAnnotationStore = create<AnnotationState>((set, get) => ({
  // 초기 상태
  annotations: [],
  selectedAnnotationId: null,
  selectedAnnotation: null,
  isLoading: false,
  error: null,
  projectFilter: 'all',
  statusFilter: 'all',
  priorityFilter: 'all',
  searchQuery: '',
  isOnline: isBackendConnected(),

  // 초기화
  initialize: async (projectId?: string | null) => {
    set({ isLoading: true, error: null, isOnline: isBackendConnected() })
    try {
      const annotations = projectId !== undefined
        ? await getAnnotations(projectId)
        : await getAnnotations()
      set({ annotations, isLoading: false })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : '어노테이션 초기화 실패',
        isLoading: false,
      })
    }
  },

  // 어노테이션 목록 새로고침
  refreshAnnotations: async () => {
    try {
      const { projectFilter } = get()
      const annotations =
        projectFilter === 'all'
          ? await getAnnotations()
          : await getAnnotations(projectFilter)
      set({ annotations })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '어노테이션 목록 조회 실패' })
    }
  },

  // 어노테이션 생성
  createAnnotation: async (data) => {
    set({ isLoading: true, error: null })
    try {
      const annotation = await createAnnotation(data)
      await get().refreshAnnotations()
      set({ isLoading: false })
      return annotation
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : '어노테이션 생성 실패',
        isLoading: false,
      })
      throw err
    }
  },

  // 어노테이션 업데이트
  updateAnnotation: async (id, updates) => {
    set({ isLoading: true, error: null })
    try {
      await updateAnnotation(id, updates)
      await get().refreshAnnotations()

      // 선택된 어노테이션이 수정된 경우 갱신
      const { selectedAnnotationId } = get()
      if (selectedAnnotationId === id) {
        const updated = await getAnnotation(id)
        set({ selectedAnnotation: updated })
      }

      set({ isLoading: false })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : '어노테이션 업데이트 실패',
        isLoading: false,
      })
    }
  },

  // 어노테이션 삭제
  deleteAnnotation: async (id) => {
    set({ isLoading: true, error: null })
    try {
      await deleteAnnotation(id)
      await get().refreshAnnotations()

      // 삭제된 어노테이션이 선택되어 있으면 선택 해제
      const { selectedAnnotationId } = get()
      if (selectedAnnotationId === id) {
        set({ selectedAnnotationId: null, selectedAnnotation: null })
      }

      set({ isLoading: false })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : '어노테이션 삭제 실패',
        isLoading: false,
      })
    }
  },

  // 어노테이션 선택
  selectAnnotation: async (id) => {
    if (id === null) {
      set({ selectedAnnotationId: null, selectedAnnotation: null })
      return
    }

    set({ isLoading: true })
    try {
      const annotation = await getAnnotation(id)
      set({ selectedAnnotationId: id, selectedAnnotation: annotation, isLoading: false })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : '어노테이션 조회 실패',
        isLoading: false,
      })
    }
  },

  // 프로젝트 필터 설정
  setProjectFilter: (projectId) => {
    set({ projectFilter: projectId })
    get().refreshAnnotations()
  },

  // 상태 필터 설정
  setStatusFilter: (status) => {
    set({ statusFilter: status })
  },

  // 우선순위 필터 설정
  setPriorityFilter: (priority) => {
    set({ priorityFilter: priority })
  },

  // 검색어 설정
  setSearchQuery: (query) => {
    set({ searchQuery: query })
  },

  // 필터링된 어노테이션 목록
  getFilteredAnnotations: () => {
    const { annotations, statusFilter, priorityFilter, searchQuery } = get()

    return annotations.filter((annotation) => {
      // 상태 필터
      if (statusFilter !== 'all' && annotation.status !== statusFilter) {
        return false
      }

      // 우선순위 필터
      if (priorityFilter !== 'all' && annotation.priority !== priorityFilter) {
        return false
      }

      // 검색어 필터
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchTitle = annotation.title.toLowerCase().includes(query)
        const matchDesc = annotation.description?.toLowerCase().includes(query)
        if (!matchTitle && !matchDesc) {
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

  // 프로젝트별 어노테이션 조회
  fetchAnnotationsByProject: async (projectId: string) => {
    try {
      const annotations = await getAnnotations(projectId)
      return annotations
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '프로젝트 어노테이션 조회 실패' })
      return []
    }
  },
}))
