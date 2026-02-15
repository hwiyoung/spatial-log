import { create } from 'zustand'
import {
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
  getRelatedFiles,
  getAssetUsageCounts,
} from '@/services/api'
import { needsConversion } from '@/services/conversionService'
import { TAG, isSystemTag } from '@/constants/tags'
import type { FileGroup, UploadOptions } from '@/components/common/FileUpload'
import { triggerConversionForFile, buildFileGroupMap } from '@/stores/helpers/conversionHelpers'
import type { AssetState, UploadProgress } from './assetStore.types'

export type { AssetState, UploadProgress } from './assetStore.types'

export const useAssetStore = create<AssetState>((set, get) => ({
  // 초기 상태
  files: [],
  folders: [],
  selectedFolderId: null,
  selectedFileIds: [],
  searchTerm: '',
  usageCounts: new Map(),
  formatFilter: null,
  statusFilter: 'active',
  tagFilter: [],
  assetTypeFilter: null,
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
        getFiles(undefined, { status: 'all' }),
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
      // 사용처 카운트 비동기 로드
      getAssetUsageCounts(files.map(f => f.id)).then(counts => {
        set({ usageCounts: counts })
      }).catch(err => console.warn('사용처 카운트 로드 실패:', err))
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
      const files = await getFiles(selectedFolderId, { status: 'all' })
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
  uploadFiles: async (filesToUpload: File[], groups?: FileGroup[], conversionOptions?: UploadOptions) => {
    const { selectedFolderId } = get()

    // 그룹 정보를 파일명 기반으로 매핑
    const fileGroupMap = buildFileGroupMap(groups)

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
          tags: [TAG.GROUP_MAIN],
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

        // 변환이 필요한 파일인지 확인하고 자동 변환 트리거
        if (needsConversion(metadata.format) && metadata.storagePath) {
          // 비동기로 변환 시작 (백그라운드에서 실행, 에러는 무시)
          triggerConversionForFile(metadata.id, metadata.storagePath, metadata.format, metadata.name, get().refreshFiles, conversionOptions)
        }
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
          tags: [file.name.toLowerCase().endsWith('.mtl') ? TAG.GROUP_MATERIAL : TAG.GROUP_TEXTURE],
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
          if (fileMetadata.tags?.includes(TAG.GROUP_MATERIAL) || fileMetadata.name.toLowerCase().endsWith('.mtl')) {
            type = 'material'
          } else if (fileMetadata.tags?.includes(TAG.GROUP_TEXTURE) || /\.(jpg|jpeg|png|gif|webp|tiff|tif|bmp|dds|ktx|ktx2)$/i.test(fileMetadata.name)) {
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

  // 검색/필터
  setSearchTerm: (term: string) => set({ searchTerm: term }),
  setFormatFilter: (format: string | null) => set({ formatFilter: format }),
  setStatusFilter: (status: string) => set({ statusFilter: status }),
  setTagFilter: (tags: string[]) => set({ tagFilter: tags }),
  setAssetTypeFilter: (type: string | null) => set({ assetTypeFilter: type }),

  getFilteredFiles: () => {
    const { files, searchTerm, formatFilter, statusFilter, tagFilter, assetTypeFilter } = get()
    let result = files

    // status 필터 (API에서 기본 active만 반환하지만 클라이언트에서 all 조회 시 필터)
    if (statusFilter && statusFilter !== 'all') {
      result = result.filter(f => f.status === statusFilter)
    }

    if (searchTerm) {
      const lower = searchTerm.toLowerCase()
      result = result.filter(f =>
        f.name.toLowerCase().includes(lower) ||
        f.description?.toLowerCase().includes(lower) ||
        f.tags?.some(t => t.toLowerCase().includes(lower))
      )
    }

    if (formatFilter) {
      result = result.filter(f => f.format === formatFilter)
    }

    if (assetTypeFilter) {
      result = result.filter(f => f.assetType === assetTypeFilter)
    }

    if (tagFilter.length > 0) {
      result = result.filter(f =>
        tagFilter.every(tag => f.tags?.includes(tag))
      )
    }

    return result
  },

  getAllTags: () => {
    const { files } = get()
    const tagSet = new Set<string>()
    for (const f of files) {
      if (f.tags) {
        for (const t of f.tags) {
          if (!isSystemTag(t)) {
            tagSet.add(t)
          }
        }
      }
    }
    return Array.from(tagSet).sort()
  },

  // 변환 재시도
  retryConversion: async (fileId: string) => {
    const file = get().files.find((f) => f.id === fileId)
    if (!file) {
      set({ error: '파일을 찾을 수 없습니다.' })
      return
    }

    if (!file.storagePath) {
      set({ error: '파일 저장 경로가 없습니다.' })
      return
    }

    if (!needsConversion(file.format)) {
      set({ error: '변환이 필요하지 않은 파일입니다.' })
      return
    }

    try {
      // 변환 상태 초기화 및 재시도
      await triggerConversionForFile(
        fileId,
        file.storagePath,
        file.format,
        file.name,
        get().refreshFiles
      )

      // 파일 목록 새로고침하여 UI 업데이트
      await get().refreshFiles()
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : '변환 재시도 실패',
      })
    }
  },
}))
