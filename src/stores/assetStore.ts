import { create } from 'zustand'
import {
  type FileMetadata,
  type FolderData,
  uploadFile,
  getFiles,
  getFile,
  getFileUrl,
  deleteFile,
  updateFile,
  createFolder,
  getFolders,
  updateFolder,
  deleteFolder,
  getStorageUsage,
  isBackendConnected,
} from '@/services/api'

interface UploadProgress {
  fileId: string
  fileName: string
  progress: number
  status: 'pending' | 'uploading' | 'complete' | 'error'
  error?: string
}

interface AssetState {
  // 데이터
  files: FileMetadata[]
  folders: FolderData[]
  selectedFolderId: string | null
  selectedFileIds: string[]

  // UI 상태
  isLoading: boolean
  error: string | null
  uploadProgress: UploadProgress[]
  viewMode: 'grid' | 'list'

  // 스토리지 정보
  storageUsed: number
  fileCount: number

  // 백엔드 연결 상태
  isOnline: boolean

  // 액션
  initialize: () => Promise<void>
  refreshFiles: () => Promise<void>
  refreshFolders: () => Promise<void>

  // 파일 액션
  uploadFiles: (files: File[]) => Promise<void>
  deleteFiles: (ids: string[]) => Promise<void>
  moveFiles: (ids: string[], folderId: string | null) => Promise<void>
  renameFile: (id: string, name: string) => Promise<void>
  getFileBlob: (id: string) => Promise<Blob | null>
  getFileDownloadUrl: (id: string) => Promise<string | null>

  // 폴더 액션
  createFolder: (name: string, parentId?: string | null) => Promise<void>
  deleteFolder: (id: string) => Promise<void>
  renameFolder: (id: string, name: string) => Promise<void>
  selectFolder: (id: string | null) => void

  // 선택 액션
  selectFile: (id: string, multi?: boolean) => void
  clearSelection: () => void
  selectAll: () => void

  // UI 액션
  setViewMode: (mode: 'grid' | 'list') => void
  clearError: () => void
}

export const useAssetStore = create<AssetState>((set, get) => ({
  // 초기 상태
  files: [],
  folders: [],
  selectedFolderId: null,
  selectedFileIds: [],
  isLoading: false,
  error: null,
  uploadProgress: [],
  viewMode: 'grid',
  storageUsed: 0,
  fileCount: 0,
  isOnline: isBackendConnected(),

  // 초기화
  initialize: async () => {
    set({ isLoading: true, error: null, isOnline: isBackendConnected() })
    try {
      const [files, folders, storage] = await Promise.all([
        getFiles(),
        getFolders(),
        getStorageUsage(),
      ])
      set({
        files,
        folders,
        storageUsed: storage.used,
        fileCount: storage.files,
        isLoading: false,
      })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : '초기화 실패',
        isLoading: false,
      })
    }
  },

  // 파일 새로고침
  refreshFiles: async () => {
    try {
      const { selectedFolderId } = get()
      const files = await getFiles(selectedFolderId)
      const storage = await getStorageUsage()
      set({ files, storageUsed: storage.used, fileCount: storage.files })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '파일 목록 조회 실패' })
    }
  },

  // 폴더 새로고침
  refreshFolders: async () => {
    try {
      const folders = await getFolders()
      set({ folders })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '폴더 목록 조회 실패' })
    }
  },

  // 파일 업로드
  uploadFiles: async (filesToUpload: File[]) => {
    const { selectedFolderId } = get()

    // 업로드 진행 상태 초기화
    const progress: UploadProgress[] = filesToUpload.map((file, index) => ({
      fileId: `temp-${index}`,
      fileName: file.name,
      progress: 0,
      status: 'pending',
    }))
    set({ uploadProgress: progress })

    for (let i = 0; i < filesToUpload.length; i++) {
      const file = filesToUpload[i]
      if (!file) continue

      try {
        // 업로드 시작
        set((state) => ({
          uploadProgress: state.uploadProgress.map((p, idx) =>
            idx === i ? { ...p, status: 'uploading', progress: 50 } : p
          ),
        }))

        // 파일 업로드 (API 레이어 사용)
        const metadata = await uploadFile(file, selectedFolderId)

        // 업로드 완료
        set((state) => ({
          uploadProgress: state.uploadProgress.map((p, idx) =>
            idx === i ? { ...p, fileId: metadata.id, status: 'complete', progress: 100 } : p
          ),
        }))
      } catch (err) {
        // 에러 처리
        set((state) => ({
          uploadProgress: state.uploadProgress.map((p, idx) =>
            idx === i
              ? {
                  ...p,
                  status: 'error',
                  error: err instanceof Error ? err.message : '업로드 실패',
                }
              : p
          ),
        }))
      }
    }

    // 파일 목록 새로고침
    await get().refreshFiles()

    // 잠시 후 진행 상태 초기화
    setTimeout(() => {
      set({ uploadProgress: [] })
    }, 3000)
  },

  // 파일 삭제
  deleteFiles: async (ids: string[]) => {
    set({ isLoading: true, error: null })
    try {
      await Promise.all(ids.map((id) => deleteFile(id)))
      await get().refreshFiles()
      set((state) => ({
        selectedFileIds: state.selectedFileIds.filter((id) => !ids.includes(id)),
        isLoading: false,
      }))
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : '파일 삭제 실패',
        isLoading: false,
      })
    }
  },

  // 파일 이동
  moveFiles: async (ids: string[], folderId: string | null) => {
    set({ isLoading: true, error: null })
    try {
      await Promise.all(ids.map((id) => updateFile(id, { folderId })))
      await get().refreshFiles()
      set({ isLoading: false })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : '파일 이동 실패',
        isLoading: false,
      })
    }
  },

  // 파일 이름 변경
  renameFile: async (id: string, name: string) => {
    set({ isLoading: true, error: null })
    try {
      await updateFile(id, { name })
      await get().refreshFiles()
      set({ isLoading: false })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : '파일 이름 변경 실패',
        isLoading: false,
      })
    }
  },

  // 파일 Blob 가져오기
  getFileBlob: async (id: string) => {
    const result = await getFile(id)
    return result?.blob ?? null
  },

  // 파일 다운로드 URL 가져오기
  getFileDownloadUrl: async (id: string) => {
    return await getFileUrl(id)
  },

  // 폴더 생성
  createFolder: async (name: string, parentId: string | null = null) => {
    set({ isLoading: true, error: null })
    try {
      await createFolder(name, parentId)
      await get().refreshFolders()
      set({ isLoading: false })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : '폴더 생성 실패',
        isLoading: false,
      })
    }
  },

  // 폴더 삭제
  deleteFolder: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      await deleteFolder(id)
      await Promise.all([get().refreshFolders(), get().refreshFiles()])
      set((state) => ({
        selectedFolderId: state.selectedFolderId === id ? null : state.selectedFolderId,
        isLoading: false,
      }))
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : '폴더 삭제 실패',
        isLoading: false,
      })
    }
  },

  // 폴더 이름 변경
  renameFolder: async (id: string, name: string) => {
    set({ isLoading: true, error: null })
    try {
      await updateFolder(id, { name })
      await get().refreshFolders()
      set({ isLoading: false })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : '폴더 이름 변경 실패',
        isLoading: false,
      })
    }
  },

  // 폴더 선택
  selectFolder: (id: string | null) => {
    set({ selectedFolderId: id, selectedFileIds: [] })
    get().refreshFiles()
  },

  // 파일 선택
  selectFile: (id: string, multi = false) => {
    set((state) => {
      if (multi) {
        const isSelected = state.selectedFileIds.includes(id)
        return {
          selectedFileIds: isSelected
            ? state.selectedFileIds.filter((fid) => fid !== id)
            : [...state.selectedFileIds, id],
        }
      }
      return { selectedFileIds: [id] }
    })
  },

  // 선택 해제
  clearSelection: () => {
    set({ selectedFileIds: [] })
  },

  // 전체 선택
  selectAll: () => {
    set((state) => ({
      selectedFileIds: state.files.map((f) => f.id),
    }))
  },

  // 뷰 모드 변경
  setViewMode: (mode: 'grid' | 'list') => {
    set({ viewMode: mode })
  },

  // 에러 초기화
  clearError: () => {
    set({ error: null })
  },
}))
