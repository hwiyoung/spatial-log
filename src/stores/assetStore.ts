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
  getFilesByProject,
  linkFilesToProject,
  unlinkFilesFromProject,
  getRelatedFiles,
} from '@/services/api'
import type { FileGroup } from '@/components/common/FileUpload'

// ZIP 파일인지 확인
function isZipFile(file: File): boolean {
  const ext = file.name.toLowerCase().split('.').pop()
  return ext === 'zip'
}

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
  uploadFiles: (files: File[], groups?: FileGroup[]) => Promise<void>
  deleteFiles: (ids: string[]) => Promise<void>
  moveFiles: (ids: string[], folderId: string | null) => Promise<void>
  renameFile: (id: string, name: string) => Promise<void>
  getFileBlob: (id: string) => Promise<Blob | null>
  getFileDownloadUrl: (id: string) => Promise<string | null>
  getRelatedFileBlobs: (parentFileId: string) => Promise<{ name: string; blob: Blob; type: string }[]>

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

  // 프로젝트 연결 액션
  fetchFilesByProject: (projectId: string) => Promise<FileMetadata[]>
  linkToProject: (fileIds: string[], projectId: string) => Promise<void>
  unlinkFromProject: (fileIds: string[]) => Promise<void>
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
  uploadFiles: async (filesToUpload: File[], groups?: FileGroup[]) => {
    const { selectedFolderId } = get()

    // 그룹 정보를 파일명 기반으로 매핑
    const fileGroupMap = new Map<string, { groupId: string; isMain: boolean; mainFileName?: string }>()
    if (groups && groups.length > 0) {
      for (const group of groups) {
        if (group.mainFile) {
          fileGroupMap.set(group.mainFile.name, { groupId: group.groupId, isMain: true })
          // 연관 파일들에 메인 파일 정보 추가
          for (const mtl of group.materialFiles) {
            fileGroupMap.set(mtl.name, { groupId: group.groupId, isMain: false, mainFileName: group.mainFile.name })
          }
          for (const tex of group.textureFiles) {
            fileGroupMap.set(tex.name, { groupId: group.groupId, isMain: false, mainFileName: group.mainFile.name })
          }
        }
      }
    }

    // 업로드 진행 상태 초기화 (메인 파일만 표시)
    const mainFilesToUpload = filesToUpload.filter(file => {
      const groupInfo = fileGroupMap.get(file.name)
      return !groupInfo || groupInfo.isMain
    })

    const progress: UploadProgress[] = mainFilesToUpload.map((file, index) => ({
      fileId: `temp-${index}`,
      fileName: file.name,
      progress: 0,
      status: 'pending',
    }))
    set({ uploadProgress: progress })

    // 메인 파일 ID 매핑 (연관 파일 업로드 시 사용)
    const mainFileIds = new Map<string, string>()
    let progressIndex = 0

    // 메인 파일 먼저 업로드
    for (const file of filesToUpload) {
      const groupInfo = fileGroupMap.get(file.name)
      if (groupInfo && !groupInfo.isMain) continue // 연관 파일은 나중에

      try {
        // 업로드 시작
        const currentIndex = progressIndex++
        set((state) => ({
          uploadProgress: state.uploadProgress.map((p, idx) =>
            idx === currentIndex ? { ...p, status: 'uploading', progress: 20 } : p
          ),
        }))

        // 업로드 옵션 설정
        const options = groupInfo ? {
          groupId: groupInfo.groupId,
          tags: ['group:main'],
        } : undefined

        set((state) => ({
          uploadProgress: state.uploadProgress.map((p, idx) =>
            idx === currentIndex ? { ...p, progress: 50 } : p
          ),
        }))

        const metadata = await uploadFile(file, selectedFolderId, options)

        // 메인 파일 ID 저장
        if (groupInfo) {
          mainFileIds.set(file.name, metadata.id)
        }

        // 업로드 완료
        set((state) => ({
          uploadProgress: state.uploadProgress.map((p, idx) =>
            idx === currentIndex ? { ...p, fileId: metadata.id, status: 'complete', progress: 100 } : p
          ),
        }))
      } catch (err) {
        const currentIndex = progressIndex - 1
        set((state) => ({
          uploadProgress: state.uploadProgress.map((p, idx) =>
            idx === currentIndex
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

    // 연관 파일 업로드 (MTL, 텍스처 등)
    for (const file of filesToUpload) {
      const groupInfo = fileGroupMap.get(file.name)
      if (!groupInfo || groupInfo.isMain) continue // 메인 파일은 이미 업로드됨

      const parentFileId = groupInfo.mainFileName ? mainFileIds.get(groupInfo.mainFileName) : undefined
      if (!parentFileId) {
        console.warn(`연관 파일 ${file.name}의 부모 파일을 찾을 수 없습니다.`)
        continue
      }

      try {
        // 연관 파일 업로드 (진행바에 표시하지 않음)
        await uploadFile(file, selectedFolderId, {
          groupId: groupInfo.groupId,
          parentFileId,
          tags: [file.name.toLowerCase().endsWith('.mtl') ? 'group:material' : 'group:texture'],
        })
      } catch (err) {
        console.warn(`연관 파일 ${file.name} 업로드 실패:`, err)
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

  // 연관 파일 Blob들 가져오기 (MTL, 텍스처 등) - 병렬 다운로드
  getRelatedFileBlobs: async (parentFileId: string) => {
    const relatedFiles = await getRelatedFiles(parentFileId)

    // 모든 파일을 병렬로 다운로드
    const downloadPromises = relatedFiles.map(async (fileMetadata) => {
      try {
        const result = await getFile(fileMetadata.id)
        if (result?.blob) {
          // 파일 타입 결정 (태그에서 추출)
          let type = 'other'
          if (fileMetadata.tags?.includes('group:material') || fileMetadata.name.toLowerCase().endsWith('.mtl')) {
            type = 'material'
          } else if (fileMetadata.tags?.includes('group:texture') || /\.(jpg|jpeg|png|gif|webp|tiff|tif|bmp|dds|ktx|ktx2)$/i.test(fileMetadata.name)) {
            type = 'texture'
          }
          return { name: fileMetadata.name, blob: result.blob, type }
        }
      } catch (err) {
        console.warn(`연관 파일 ${fileMetadata.name} 로드 실패:`, err)
      }
      return null
    })

    const results = await Promise.all(downloadPromises)
    return results.filter((r): r is { name: string; blob: Blob; type: string } => r !== null)
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

  // 프로젝트별 파일 조회
  fetchFilesByProject: async (projectId: string) => {
    try {
      const files = await getFilesByProject(projectId)
      return files
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '프로젝트 파일 조회 실패' })
      return []
    }
  },

  // 파일을 프로젝트에 연결
  linkToProject: async (fileIds: string[], projectId: string) => {
    set({ isLoading: true, error: null })
    try {
      await linkFilesToProject(fileIds, projectId)
      await get().refreshFiles()
      set({ isLoading: false })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : '프로젝트 연결 실패',
        isLoading: false,
      })
    }
  },

  // 파일의 프로젝트 연결 해제
  unlinkFromProject: async (fileIds: string[]) => {
    set({ isLoading: true, error: null })
    try {
      await unlinkFilesFromProject(fileIds)
      await get().refreshFiles()
      set({ isLoading: false })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : '프로젝트 연결 해제 실패',
        isLoading: false,
      })
    }
  },
}))
