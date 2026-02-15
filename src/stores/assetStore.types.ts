import type { FileMetadata, FolderData } from '@/services/api'
import type { FileGroup, UploadOptions } from '@/components/common/FileUpload'

export interface UploadProgress {
  fileId: string
  fileName: string
  progress: number
  status: 'pending' | 'uploading' | 'complete' | 'error'
  error?: string
}

export interface AssetState {
  // 데이터
  files: FileMetadata[]
  folders: FolderData[]
  selectedFolderId: string | null
  selectedFileIds: string[]

  // 사용처 카운트
  usageCounts: Map<string, number>

  // 검색/필터
  searchTerm: string
  formatFilter: string | null
  statusFilter: string
  tagFilter: string[]
  assetTypeFilter: string | null

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
  uploadFiles: (files: File[], groups?: FileGroup[], conversionOptions?: UploadOptions) => Promise<void>
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

  // 검색/필터 액션
  setSearchTerm: (term: string) => void
  setFormatFilter: (format: string | null) => void
  setStatusFilter: (status: string) => void
  setTagFilter: (tags: string[]) => void
  setAssetTypeFilter: (type: string | null) => void
  getFilteredFiles: () => FileMetadata[]
  getAllTags: () => string[]

  // 변환 액션
  retryConversion: (fileId: string) => Promise<void>
}
