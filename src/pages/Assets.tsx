import { useEffect, useState, useCallback } from 'react'
import {
  Grid,
  List,
  FolderPlus,
  UploadCloud,
  Folder,
  Layers,
  MoreVertical,
  Box,
  Trash2,
  Edit2,
  Check,
  X,
  Image,
  FileText,
  HardDrive,
  Loader2,
  MapPin,
  Scan,
  Download,
  Eye,
  Shield,
  Files,
  CheckSquare,
  Square,
  Terminal,
  RefreshCw,
} from 'lucide-react'
import { useAssetStore } from '@/stores/assetStore'
import { Modal, Input, FileUpload, type FileGroup } from '@/components/common'
import ThreeCanvas from '@/components/viewer/ThreeCanvas'
import IntegrityChecker from '@/components/admin/IntegrityChecker'
import DevConsole from '@/components/admin/DevConsole'
import { formatFileSize } from '@/utils/storage'
import type { FileMetadata, FolderData } from '@/services/api'
import { getFileMetadata } from '@/services/api'
import { ConversionStatusBadge } from '@/components/common/ConversionStatus'
import { needsConversion } from '@/services/conversionService'
import type { ConversionStatus } from '@/services/conversionService'

// 탭 타입
type TabType = 'files' | 'admin'

// 포맷별 아이콘 매핑
function FileIcon({ format }: { format: FileMetadata['format'] }) {
  switch (format) {
    case 'gltf':
    case 'glb':
    case 'obj':
    case 'fbx':
      return <Box size={24} className="text-blue-400" />
    case 'ply':
    case 'las':
      return <Layers size={24} className="text-green-400" />
    case 'e57':
      return <Scan size={24} className="text-emerald-400" />
    case 'image':
      return <Image size={24} className="text-purple-400" />
    default:
      return <FileText size={24} className="text-slate-400" />
  }
}

// 포맷별 배경색
function getFormatBgColor(format: FileMetadata['format']): string {
  switch (format) {
    case 'gltf':
    case 'glb':
      return 'bg-gradient-to-br from-blue-900/50 to-blue-800/30'
    case 'obj':
    case 'fbx':
      return 'bg-gradient-to-br from-cyan-900/50 to-cyan-800/30'
    case 'ply':
    case 'las':
      return 'bg-gradient-to-br from-green-900/50 to-green-800/30'
    case 'e57':
      return 'bg-gradient-to-br from-emerald-900/50 to-emerald-800/30'
    case 'image':
      return 'bg-gradient-to-br from-purple-900/50 to-purple-800/30'
    default:
      return 'bg-gradient-to-br from-slate-800/50 to-slate-700/30'
  }
}

export default function Assets() {
  const {
    files,
    folders,
    selectedFolderId,
    selectedFileIds,
    isLoading,
    viewMode,
    storageUsed,
    fileCount,
    uploadProgress,
    initialize,
    uploadFiles,
    deleteFiles,
    createFolder,
    deleteFolder,
    renameFolder,
    selectFolder,
    selectFile,
    clearSelection,
    setViewMode,
    getFileBlob,
    getRelatedFileBlobs,
  } = useAssetStore()

  // 탭 상태
  const [activeTab, setActiveTab] = useState<TabType>('files')

  // 모달 상태
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showNewFolderModal, setShowNewFolderModal] = useState(false)
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false)
  const [filesToDelete, setFilesToDelete] = useState<FileMetadata[]>([])
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteProgress, setDeleteProgress] = useState(0)
  const [newFolderName, setNewFolderName] = useState('')
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null)
  const [editingFolderName, setEditingFolderName] = useState('')
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; type: 'file' | 'folder'; id: string } | null>(null)

  // 3D 미리보기 상태
  const [previewFile, setPreviewFile] = useState<FileMetadata | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState<{ loaded: number; total: number } | null>(null)
  const [previewRelatedFiles, setPreviewRelatedFiles] = useState<{ name: string; blob: Blob; type: 'material' | 'texture' | 'other' }[]>([])


  // 다중 선택 모드
  const [multiSelectMode, setMultiSelectMode] = useState(false)

  // 개발자 콘솔
  const [showDevConsole, setShowDevConsole] = useState(false)

  // 초기화
  useEffect(() => {
    initialize()
  }, [initialize])

  // 파일 업로드 핸들러
  const handleUpload = useCallback(async (uploadedFiles: File[], groups?: FileGroup[]) => {
    await uploadFiles(uploadedFiles, groups)
    setShowUploadModal(false)
  }, [uploadFiles])

  // 새 폴더 생성
  const handleCreateFolder = useCallback(async () => {
    if (newFolderName.trim()) {
      await createFolder(newFolderName.trim(), selectedFolderId)
      setNewFolderName('')
      setShowNewFolderModal(false)
    }
  }, [newFolderName, selectedFolderId, createFolder])

  // 폴더 이름 수정 시작
  const startEditingFolder = useCallback((folder: FolderData) => {
    setEditingFolderId(folder.id)
    setEditingFolderName(folder.name)
    setContextMenu(null)
  }, [])

  // 폴더 이름 수정 완료
  const finishEditingFolder = useCallback(async () => {
    if (editingFolderId && editingFolderName.trim()) {
      await renameFolder(editingFolderId, editingFolderName.trim())
    }
    setEditingFolderId(null)
    setEditingFolderName('')
  }, [editingFolderId, editingFolderName, renameFolder])

  // 파일 선택 (다중 선택 모드 또는 Ctrl 키로 다중 선택)
  const handleFileClick = useCallback((e: React.MouseEvent, fileId: string) => {
    e.stopPropagation()
    selectFile(fileId, multiSelectMode || e.ctrlKey || e.metaKey)
  }, [selectFile, multiSelectMode])

  // 체크박스 토글 (다중 선택용)
  const handleCheckboxToggle = useCallback((e: React.MouseEvent, fileId: string) => {
    e.stopPropagation()
    selectFile(fileId, true) // 항상 다중 선택 모드로 토글
  }, [selectFile])

  // 다중 선택 모드 토글
  const toggleMultiSelectMode = useCallback(() => {
    setMultiSelectMode(prev => !prev)
    if (multiSelectMode) {
      clearSelection() // 다중 선택 모드 종료 시 선택 해제
    }
  }, [multiSelectMode, clearSelection])

  // 선택된 파일 삭제 확인 모달 열기
  const handleDeleteSelected = useCallback(() => {
    if (selectedFileIds.length > 0) {
      const selectedFiles = files.filter(f => selectedFileIds.includes(f.id))
      setFilesToDelete(selectedFiles)
      setShowDeleteConfirmModal(true)
    }
  }, [selectedFileIds, files])

  // 삭제 실행
  const executeDelete = useCallback(async () => {
    if (filesToDelete.length === 0) return

    setIsDeleting(true)
    setDeleteProgress(0)

    const ids = filesToDelete.map(f => f.id)
    const total = ids.length

    try {
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i]
        if (!id) continue
        await deleteFiles([id])
        setDeleteProgress(Math.round(((i + 1) / total) * 100))
      }
    } finally {
      setIsDeleting(false)
      setDeleteProgress(0)
      setFilesToDelete([])
      setShowDeleteConfirmModal(false)
    }
  }, [filesToDelete, deleteFiles])

  // 삭제 취소
  const cancelDelete = useCallback(() => {
    if (!isDeleting) {
      setShowDeleteConfirmModal(false)
      setFilesToDelete([])
    }
  }, [isDeleting])

  // 컨텍스트 메뉴
  const handleContextMenu = useCallback((e: React.MouseEvent, type: 'file' | 'folder', id: string) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, type, id })
  }, [])

  // 파일 다운로드 - Blob을 사용하여 API key 문제 회피
  const handleDownload = useCallback(async (file: FileMetadata) => {
    try {
      // 항상 Blob으로 직접 다운로드 (API key 문제 회피)
      const blob = await getFileBlob(file.id)
      if (!blob) {
        alert('파일을 다운로드할 수 없습니다.')
        return
      }
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = file.name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(blobUrl)
    } catch (err) {
      console.error('다운로드 실패:', err)
      alert('파일 다운로드 중 오류가 발생했습니다.')
    }
  }, [getFileBlob])

  // 3D 파일 미리보기
  const handlePreview = useCallback(async (file: FileMetadata) => {
    // 3D 파일 포맷인지 확인
    const is3DFormat = ['gltf', 'glb', 'obj', 'fbx', 'ply', 'las', 'e57'].includes(file.format)
    if (!is3DFormat) {
      alert('3D 미리보기는 GLTF, GLB, OBJ, FBX, PLY, LAS 파일만 지원합니다.')
      return
    }

    // 변환이 필요한 파일 처리 (E57, OBJ 등)
    const needsConversionFormats = ['e57', 'obj']
    if (needsConversionFormats.includes(file.format)) {
      // 최신 변환 상태 조회 (DB에서 직접 가져오기)
      let currentFile = file
      try {
        const freshMetadata = await getFileMetadata(file.id)
        if (freshMetadata) {
          currentFile = freshMetadata
        }
      } catch (err) {
        console.warn('파일 메타데이터 조회 실패, 캐시된 데이터 사용:', err)
      }

      if (currentFile.conversionStatus === 'ready' && currentFile.convertedPath) {
        // 변환 완료된 파일 사용 - 컨버터 서비스에서 직접 로드
        const converterUrl = import.meta.env.VITE_CONVERTER_URL || 'http://localhost:8200'

        // 파일 경로 결정 (E57→PLY 또는 OBJ→GLB)
        let convertedFileUrl: string
        let fileExtHint: string

        if (currentFile.format === 'e57') {
          // E57 → PLY (단일 파일)
          const filename = currentFile.convertedPath!.split('/').pop() || ''
          convertedFileUrl = `${converterUrl}/output/${filename}`
          fileExtHint = 'ply'
        } else {
          // OBJ → 3D Tiles (디렉토리 내 GLB 파일)
          // convertedPath가 디렉토리인 경우, GLB 파일 경로 구성
          const dirName = currentFile.convertedPath!.split('/').pop() || ''
          const glbName = dirName.replace('_3dtiles', '') + '.glb'
          convertedFileUrl = `${converterUrl}/output/${dirName}/${glbName}`
          fileExtHint = 'glb'
        }

        // 이전 미리보기 정리
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl)
          setPreviewUrl(null)
          setPreviewFile(null)
          setPreviewRelatedFiles([])
          await new Promise(resolve => setTimeout(resolve, 150))
        }

        setPreviewFile(file)
        setIsLoadingPreview(true)
        setDownloadProgress(null)

        try {
          // 변환된 파일 로드 (진행률 표시 포함)
          const blob = await new Promise<Blob>((resolve, reject) => {
            const xhr = new XMLHttpRequest()
            xhr.open('GET', convertedFileUrl, true)
            xhr.responseType = 'blob'

            xhr.onprogress = (event) => {
              if (event.lengthComputable) {
                setDownloadProgress({ loaded: event.loaded, total: event.total })
              }
            }

            xhr.onload = () => {
              if (xhr.status === 200) {
                resolve(xhr.response as Blob)
              } else {
                reject(new Error(`변환된 파일을 로드할 수 없습니다: ${xhr.status}`))
              }
            }

            xhr.onerror = () => reject(new Error('네트워크 오류'))
            xhr.send()
          })

          const blobUrl = URL.createObjectURL(blob) + `#file.${fileExtHint}`
          setPreviewUrl(blobUrl)
        } catch (err) {
          console.error('변환된 파일 로드 실패:', err)
          alert('변환된 파일을 로드할 수 없습니다.')
          setPreviewFile(null)
        } finally {
          setIsLoadingPreview(false)
          setDownloadProgress(null)
        }
        return
      } else if (currentFile.conversionStatus === 'converting' || currentFile.conversionStatus === 'pending') {
        alert(`${currentFile.format.toUpperCase()} 파일이 변환 중입니다. (${currentFile.conversionProgress || 0}%)\n잠시 후 다시 시도해주세요.`)
        return
      } else if (currentFile.conversionStatus === 'failed') {
        alert(`${currentFile.format.toUpperCase()} 변환 실패: ${currentFile.conversionError || '알 수 없는 오류'}`)
        return
      } else {
        // 변환이 안 된 E57/OBJ는 원본 로드 대신 변환 안내
        alert(`${currentFile.format.toUpperCase()} 파일은 변환 후 미리보기가 가능합니다.\n\n변환 서비스가 실행 중이면 자동으로 변환됩니다.`)
        return
      }
    }

    // 이전 미리보기가 있다면 먼저 닫기
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
      setPreviewFile(null)
      setPreviewRelatedFiles([])
      // WebGL 컨텍스트 정리를 위한 대기
      await new Promise(resolve => setTimeout(resolve, 150))
    }

    setPreviewFile(file)
    setIsLoadingPreview(true)

    try {
      // Blob으로 직접 다운로드하여 URL 생성 (signed URL 401 에러 회피)
      const blob = await getFileBlob(file.id)
      if (blob) {
        // blob URL에 파일 확장자 힌트 추가
        const blobUrl = URL.createObjectURL(blob) + `#file.${file.format}`
        setPreviewUrl(blobUrl)

        // OBJ 파일인 경우 연관 파일 (MTL, 텍스처) 로드
        if (file.format === 'obj') {
          try {
            const relatedBlobs = await getRelatedFileBlobs(file.id)
            setPreviewRelatedFiles(relatedBlobs.map(f => ({
              name: f.name,
              blob: f.blob,
              type: f.type as 'material' | 'texture' | 'other',
            })))
          } catch (relatedErr) {
            console.warn('연관 파일 로드 실패:', relatedErr)
          }
        }
      } else {
        alert('파일을 로드할 수 없습니다.')
        setPreviewFile(null)
      }
    } catch (err) {
      console.error('미리보기 로드 실패:', err)
      alert('파일을 로드할 수 없습니다.')
      setPreviewFile(null)
    } finally {
      setIsLoadingPreview(false)
    }
  }, [getFileBlob, getRelatedFileBlobs, previewUrl])

  // 미리보기 닫기
  const closePreview = useCallback(() => {
    if (previewUrl) {
      // hash fragment 제거 후 blob URL revoke
      const blobUrlOnly = previewUrl.split('#')[0] || previewUrl
      if (blobUrlOnly.startsWith('blob:')) {
        URL.revokeObjectURL(blobUrlOnly)
      }
    }
    setPreviewFile(null)
    setPreviewUrl(null)
    setPreviewRelatedFiles([])
  }, [previewUrl])

  // 컨텍스트 메뉴 닫기
  useEffect(() => {
    const handleClick = () => setContextMenu(null)
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  // ESC 키로 미리보기 닫기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && previewFile) {
        closePreview()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [previewFile, closePreview])

  // 현재 폴더의 파일만 필터링
  const currentFiles = selectedFolderId === null
    ? files
    : files.filter(f => f.folderId === selectedFolderId)

  // 날짜 포맷
  const formatDate = (date: Date) => {
    const d = new Date(date)
    return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* 헤더 */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-6">
          <div>
            <h1 className="text-2xl font-bold text-white">데이터 보관함</h1>
            <p className="text-slate-500 text-sm mt-1">
              {fileCount}개 파일 · {formatFileSize(storageUsed)} 사용 중
            </p>
          </div>
          {/* 탭 */}
          <div className="flex items-center bg-slate-800 rounded-lg p-1 border border-slate-700">
            <button
              onClick={() => setActiveTab('files')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'files'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Files size={16} />
              <span>파일</span>
            </button>
            <button
              onClick={() => setActiveTab('admin')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'admin'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Shield size={16} />
              <span>관리</span>
            </button>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          {/* 선택된 파일 액션 (파일 탭에서만) */}
          {activeTab === 'files' && selectedFileIds.length > 0 && (
            <div className="flex items-center space-x-2 mr-4">
              <span className="text-sm text-slate-400">{selectedFileIds.length}개 선택됨</span>
              {selectedFileIds.length === 1 && (
                <button
                  onClick={() => {
                    const file = files.find(f => f.id === selectedFileIds[0])
                    if (file) handleDownload(file)
                  }}
                  className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-lg border border-blue-600/30"
                >
                  <Download size={14} />
                  <span className="text-sm">다운로드</span>
                </button>
              )}
              <button
                onClick={handleDeleteSelected}
                className="flex items-center space-x-1 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg border border-red-600/30"
              >
                <Trash2 size={14} />
                <span className="text-sm">삭제</span>
              </button>
              <button
                onClick={clearSelection}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* 뷰 모드 토글 (파일 탭에서만) */}
          {activeTab === 'files' && (
            <>
              {/* 다중 선택 모드 토글 */}
              <button
                onClick={toggleMultiSelectMode}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg border transition-colors ${
                  multiSelectMode
                    ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                }`}
                title="다중 선택 모드"
              >
                <CheckSquare size={16} />
                <span className="text-sm">다중 선택</span>
              </button>

              <div className="bg-slate-800 rounded-lg p-1 flex border border-slate-700">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  <Grid size={16} />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  <List size={16} />
                </button>
              </div>

              <button
                onClick={() => setShowNewFolderModal(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-700"
              >
                <FolderPlus size={18} />
                <span>새 폴더</span>
              </button>
              <button
                onClick={() => setShowUploadModal(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                <UploadCloud size={18} />
                <span>파일 업로드</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* 탭 컨텐츠 */}
      {activeTab === 'admin' ? (
        <div className="flex-1 min-h-0 bg-slate-900/50 rounded-xl border border-slate-800 overflow-auto p-6">
          {/* 관리 도구 버튼들 */}
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => setShowDevConsole(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600/20 hover:bg-green-600/30 border border-green-600/50 rounded-lg text-green-400 transition-colors"
            >
              <Terminal size={18} />
              <span>개발자 콘솔</span>
            </button>
          </div>

          {/* 무결성 검사 */}
          <IntegrityChecker />
        </div>
      ) : (
      <div className="flex-1 flex gap-6 min-h-0 bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
        {/* 폴더 트리 */}
        <div className="w-60 bg-slate-900 border-r border-slate-800 p-4">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">폴더</h3>
          <ul className="space-y-1">
            {/* 전체 파일 */}
            <li
              onClick={() => selectFolder(null)}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                selectedFolderId === null
                  ? 'bg-blue-600/10 text-blue-400'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Folder size={16} className={selectedFolderId === null ? 'fill-blue-400/20' : ''} />
              <span>전체 파일</span>
              <span className="ml-auto text-xs text-slate-500">{files.length}</span>
            </li>

            {/* 동적 폴더 목록 */}
            {folders.map((folder) => (
              <li
                key={folder.id}
                onClick={() => selectFolder(folder.id)}
                onContextMenu={(e) => handleContextMenu(e, 'folder', folder.id)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg cursor-pointer transition-colors group ${
                  selectedFolderId === folder.id
                    ? 'bg-blue-600/10 text-blue-400'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Folder size={16} className={selectedFolderId === folder.id ? 'fill-blue-400/20' : ''} />
                {editingFolderId === folder.id ? (
                  <input
                    type="text"
                    value={editingFolderName}
                    onChange={(e) => setEditingFolderName(e.target.value)}
                    onBlur={finishEditingFolder}
                    onKeyDown={(e) => e.key === 'Enter' && finishEditingFolder()}
                    className="flex-1 bg-slate-800 border border-slate-600 rounded px-1 py-0.5 text-sm text-white"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <>
                    <span className="flex-1 truncate">{folder.name}</span>
                    <span className="text-xs text-slate-500">
                      {files.filter(f => f.folderId === folder.id).length}
                    </span>
                  </>
                )}
              </li>
            ))}
          </ul>

          {/* 스토리지 정보 */}
          <div className="mt-6 pt-4 border-t border-slate-800">
            <div className="flex items-center space-x-2 text-slate-500 mb-2">
              <HardDrive size={14} />
              <span className="text-xs">스토리지</span>
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full"
                style={{ width: `${Math.min((storageUsed / (500 * 1024 * 1024)) * 100, 100)}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {formatFileSize(storageUsed)} / 500 MB
            </p>
          </div>
        </div>

        {/* 파일 그리드/리스트 */}
        <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            </div>
          ) : currentFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <Box size={48} strokeWidth={1} className="mb-4" />
              <p className="font-medium">파일이 없습니다</p>
              <p className="text-sm mt-1">파일을 업로드하여 시작하세요</p>
              <button
                onClick={() => setShowUploadModal(true)}
                className="mt-4 flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                <UploadCloud size={18} />
                <span>파일 업로드</span>
              </button>
            </div>
          ) : viewMode === 'grid' ? (
            // 그리드 뷰
            <div className="grid grid-cols-5 gap-4">
              {currentFiles.map((file) => (
                <div
                  key={file.id}
                  onClick={(e) => handleFileClick(e, file.id)}
                  onDoubleClick={() => {
                    if (!multiSelectMode && ['gltf', 'glb', 'obj', 'fbx', 'ply', 'las', 'e57'].includes(file.format)) {
                      handlePreview(file)
                    }
                  }}
                  onContextMenu={(e) => handleContextMenu(e, 'file', file.id)}
                  className={`group bg-slate-800 rounded-lg p-3 border cursor-pointer transition-all hover:shadow-lg ${
                    selectedFileIds.includes(file.id)
                      ? 'border-blue-500 ring-1 ring-blue-500'
                      : 'border-slate-700 hover:border-slate-500'
                  }`}
                >
                  <div className={`aspect-square rounded-md mb-3 ${getFormatBgColor(file.format)} flex items-center justify-center relative overflow-hidden`}>
                    {file.thumbnailUrl ? (
                      <img src={file.thumbnailUrl} alt={file.name} className="w-full h-full object-cover" />
                    ) : (
                      <FileIcon format={file.format} />
                    )}

                    {/* 체크박스 (다중 선택 모드 또는 선택된 항목이 있을 때) */}
                    {(multiSelectMode || selectedFileIds.length > 0) && (
                      <button
                        onClick={(e) => handleCheckboxToggle(e, file.id)}
                        className="absolute top-2 right-2 p-1 bg-slate-900/80 rounded hover:bg-slate-700 z-10"
                      >
                        {selectedFileIds.includes(file.id) ? (
                          <CheckSquare size={16} className="text-blue-400" />
                        ) : (
                          <Square size={16} className="text-slate-400" />
                        )}
                      </button>
                    )}

                    {/* 포맷 배지 */}
                    <span className="absolute top-2 left-2 px-1.5 py-0.5 bg-slate-900/80 rounded text-[10px] font-medium text-white uppercase">
                      {file.format}
                    </span>

                    {/* GPS 위치 표시 */}
                    {file.gps && (
                      <span
                        className="absolute bottom-2 left-2 p-1 bg-green-600/80 rounded text-white"
                        title={`위치: ${file.gps.latitude.toFixed(6)}, ${file.gps.longitude.toFixed(6)}`}
                      >
                        <MapPin size={10} />
                      </span>
                    )}

                    {/* 변환 상태 표시 */}
                    {file.conversionStatus && file.conversionStatus !== 'ready' && (
                      <div className="absolute bottom-2 right-2">
                        <ConversionStatusBadge
                          status={file.conversionStatus as ConversionStatus}
                          progress={file.conversionProgress}
                          error={file.conversionError}
                          compact
                        />
                      </div>
                    )}

                    {/* 변환 필요 표시 (변환되지 않은 파일) */}
                    {!file.conversionStatus && needsConversion(file.format) && (
                      <span
                        className="absolute bottom-2 right-2 p-1 bg-cyan-600/80 rounded text-white"
                        title="변환 가능"
                      >
                        <RefreshCw size={10} />
                      </span>
                    )}

                    {/* 호버 액션 */}
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1">
                      {['gltf', 'glb', 'obj', 'fbx', 'ply', 'las', 'e57'].includes(file.format) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handlePreview(file)
                          }}
                          className="bg-slate-900/80 p-1.5 rounded hover:bg-green-600 text-white"
                          title="3D 미리보기"
                        >
                          <Eye size={12} />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDownload(file)
                        }}
                        className="bg-slate-900/80 p-1.5 rounded hover:bg-blue-600 text-white"
                        title="다운로드"
                      >
                        <Download size={12} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          e.preventDefault()
                          handleContextMenu(e, 'file', file.id)
                        }}
                        className="bg-slate-900/80 p-1.5 rounded hover:bg-blue-600 text-white"
                        title="더 보기"
                      >
                        <MoreVertical size={12} />
                      </button>
                    </div>
                  </div>
                  <div className="px-1">
                    <h4 className="text-sm font-medium text-white truncate mb-1">{file.name}</h4>
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>{formatFileSize(file.size)}</span>
                      <span>{formatDate(file.createdAt)}</span>
                    </div>
                  </div>
                </div>
              ))}

              {/* 업로드 존 */}
              <div
                onClick={() => setShowUploadModal(true)}
                className="border-2 border-dashed border-slate-700 rounded-lg flex flex-col items-center justify-center text-slate-500 hover:border-blue-500 hover:text-blue-400 hover:bg-blue-500/5 cursor-pointer transition-all aspect-square"
              >
                <UploadCloud size={32} className="mb-2" />
                <span className="text-xs">파일 추가</span>
              </div>
            </div>
          ) : (
            // 리스트 뷰
            <div className="space-y-1">
              {/* 헤더 */}
              <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-medium text-slate-500 uppercase border-b border-slate-800">
                {(multiSelectMode || selectedFileIds.length > 0) && (
                  <span className="col-span-1"></span>
                )}
                <span className={multiSelectMode || selectedFileIds.length > 0 ? 'col-span-3' : 'col-span-4'}>이름</span>
                <span className="col-span-2">포맷</span>
                <span className="col-span-2">상태</span>
                <span className="col-span-2">크기</span>
                <span className="col-span-2">수정일</span>
                <span className="col-span-1"></span>
              </div>

              {currentFiles.map((file) => (
                <div
                  key={file.id}
                  onClick={(e) => handleFileClick(e, file.id)}
                  onDoubleClick={() => {
                    if (!multiSelectMode && ['gltf', 'glb', 'obj', 'fbx', 'ply', 'las', 'e57'].includes(file.format)) {
                      handlePreview(file)
                    }
                  }}
                  onContextMenu={(e) => handleContextMenu(e, 'file', file.id)}
                  className={`grid grid-cols-12 gap-4 px-4 py-3 rounded-lg cursor-pointer transition-colors ${
                    selectedFileIds.includes(file.id)
                      ? 'bg-blue-600/10 border border-blue-500'
                      : 'hover:bg-slate-800 border border-transparent'
                  }`}
                >
                  {/* 체크박스 */}
                  {(multiSelectMode || selectedFileIds.length > 0) && (
                    <div className="col-span-1 flex items-center">
                      <button
                        onClick={(e) => handleCheckboxToggle(e, file.id)}
                        className="p-1 hover:bg-slate-700 rounded"
                      >
                        {selectedFileIds.includes(file.id) ? (
                          <CheckSquare size={18} className="text-blue-400" />
                        ) : (
                          <Square size={18} className="text-slate-500" />
                        )}
                      </button>
                    </div>
                  )}
                  <div className={`${multiSelectMode || selectedFileIds.length > 0 ? 'col-span-3' : 'col-span-4'} flex items-center space-x-3`}>
                    <div className={`w-8 h-8 rounded flex items-center justify-center ${getFormatBgColor(file.format)}`}>
                      {file.thumbnailUrl ? (
                        <img src={file.thumbnailUrl} alt="" className="w-full h-full object-cover rounded" />
                      ) : (
                        <FileIcon format={file.format} />
                      )}
                    </div>
                    <span className="text-sm text-white truncate">{file.name}</span>
                  </div>
                  <span className="col-span-2 text-sm text-slate-400 uppercase flex items-center">{file.format}</span>
                  <div className="col-span-2 flex items-center">
                    {file.conversionStatus ? (
                      <ConversionStatusBadge
                        status={file.conversionStatus as ConversionStatus}
                        progress={file.conversionProgress}
                        error={file.conversionError}
                        compact
                      />
                    ) : needsConversion(file.format) ? (
                      <span className="text-xs px-2 py-0.5 bg-cyan-500/20 text-cyan-400 rounded flex items-center gap-1">
                        <RefreshCw size={10} />
                        변환 가능
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500">-</span>
                    )}
                  </div>
                  <span className="col-span-2 text-sm text-slate-400 flex items-center">{formatFileSize(file.size)}</span>
                  <span className="col-span-2 text-sm text-slate-400 flex items-center">{formatDate(file.createdAt)}</span>
                  <div className="col-span-1 flex items-center justify-end space-x-1">
                    {['gltf', 'glb', 'obj', 'fbx', 'ply', 'las', 'e57'].includes(file.format) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handlePreview(file)
                        }}
                        className="p-1 text-slate-500 hover:text-green-400 hover:bg-slate-700 rounded"
                        title="3D 미리보기"
                      >
                        <Eye size={14} />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDownload(file)
                      }}
                      className="p-1 text-slate-500 hover:text-white hover:bg-slate-700 rounded"
                      title="다운로드"
                    >
                      <Download size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                        handleContextMenu(e, 'file', file.id)
                      }}
                      className="p-1 text-slate-500 hover:text-white hover:bg-slate-700 rounded"
                      title="더 보기"
                    >
                      <MoreVertical size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      )}

      {/* 업로드 모달 */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        title="파일 업로드"
      >
        <FileUpload onUpload={handleUpload} />
        {uploadProgress.length > 0 && (
          <div className="mt-4 space-y-2">
            {uploadProgress.map((progress) => (
              <div key={progress.fileId} className="flex items-center space-x-3">
                <div className="flex-1">
                  <p className="text-sm text-white truncate">{progress.fileName}</p>
                  <div className="h-1 bg-slate-700 rounded-full mt-1">
                    <div
                      className={`h-full rounded-full transition-all ${
                        progress.status === 'error' ? 'bg-red-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${progress.progress}%` }}
                    />
                  </div>
                </div>
                {progress.status === 'complete' && <Check size={16} className="text-green-500" />}
                {progress.status === 'error' && <X size={16} className="text-red-500" />}
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* 새 폴더 모달 */}
      <Modal
        isOpen={showNewFolderModal}
        onClose={() => setShowNewFolderModal(false)}
        title="새 폴더 만들기"
      >
        <div className="space-y-4">
          <Input
            label="폴더 이름"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="폴더 이름을 입력하세요"
            onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
            autoFocus
          />
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => setShowNewFolderModal(false)}
              className="px-4 py-2 text-slate-400 hover:text-white"
            >
              취소
            </button>
            <button
              onClick={handleCreateFolder}
              disabled={!newFolderName.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg"
            >
              생성
            </button>
          </div>
        </div>
      </Modal>

      {/* 컨텍스트 메뉴 */}
      {contextMenu && (
        <div
          className="fixed bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 z-50"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.type === 'folder' && (
            <>
              <button
                onClick={() => {
                  const folder = folders.find(f => f.id === contextMenu.id)
                  if (folder) startEditingFolder(folder)
                }}
                className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-white hover:bg-slate-700"
              >
                <Edit2 size={14} />
                <span>이름 변경</span>
              </button>
              <button
                onClick={() => {
                  deleteFolder(contextMenu.id)
                  setContextMenu(null)
                }}
                className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-red-400 hover:bg-slate-700"
              >
                <Trash2 size={14} />
                <span>삭제</span>
              </button>
            </>
          )}
          {contextMenu.type === 'file' && (
            <>
              <button
                onClick={() => {
                  const file = files.find(f => f.id === contextMenu.id)
                  if (file) handlePreview(file)
                  setContextMenu(null)
                }}
                className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-white hover:bg-slate-700"
              >
                <Eye size={14} />
                <span>3D 미리보기</span>
              </button>
              <button
                onClick={() => {
                  const file = files.find(f => f.id === contextMenu.id)
                  if (file) handleDownload(file)
                  setContextMenu(null)
                }}
                className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-white hover:bg-slate-700"
              >
                <Download size={14} />
                <span>다운로드</span>
              </button>
              <button
                onClick={() => {
                  const file = files.find(f => f.id === contextMenu.id)
                  if (file) {
                    setFilesToDelete([file])
                    setShowDeleteConfirmModal(true)
                  }
                  setContextMenu(null)
                }}
                className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-red-400 hover:bg-slate-700"
              >
                <Trash2 size={14} />
                <span>삭제</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* 삭제 확인 모달 */}
      <Modal
        isOpen={showDeleteConfirmModal}
        onClose={cancelDelete}
        title="파일 삭제 확인"
      >
        <div className="space-y-4">
          {isDeleting ? (
            // 삭제 진행 중
            <div className="py-6">
              <div className="flex flex-col items-center gap-4">
                <Loader2 size={40} className="text-red-400 animate-spin" />
                <p className="text-white font-medium">파일 삭제 중...</p>
                <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-500 transition-all duration-300"
                    style={{ width: `${deleteProgress}%` }}
                  />
                </div>
                <p className="text-slate-400 text-sm">{deleteProgress}% 완료</p>
              </div>
            </div>
          ) : (
            // 삭제 확인
            <>
              <div className="flex items-start gap-3 p-4 bg-red-900/20 border border-red-800/50 rounded-lg">
                <Trash2 className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-200 font-medium">
                    {filesToDelete.length}개 파일을 삭제하시겠습니까?
                  </p>
                  <p className="text-red-300/70 text-sm mt-1">
                    이 작업은 되돌릴 수 없습니다. 파일이 Storage와 DB에서 영구적으로 삭제됩니다.
                  </p>
                </div>
              </div>

              {/* 삭제할 파일 목록 */}
              <div className="max-h-60 overflow-y-auto bg-slate-900 rounded-lg border border-slate-700">
                {filesToDelete.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-3 px-4 py-2 border-b border-slate-800 last:border-b-0"
                  >
                    <FileIcon format={file.format} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{file.name}</p>
                      <p className="text-xs text-slate-500">{formatFileSize(file.size)}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* 총 용량 */}
              <div className="flex justify-between items-center px-4 py-2 bg-slate-800 rounded-lg">
                <span className="text-slate-400 text-sm">총 용량</span>
                <span className="text-white font-medium">
                  {formatFileSize(filesToDelete.reduce((sum, f) => sum + f.size, 0))}
                </span>
              </div>

              {/* 버튼 */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={cancelDelete}
                  className="px-4 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={executeDelete}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
                >
                  <Trash2 size={16} />
                  <span>{filesToDelete.length}개 파일 삭제</span>
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* 3D 미리보기 모달 */}
      {previewFile && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-slate-900 rounded-xl border border-slate-700 w-full max-w-5xl h-[80vh] shadow-2xl flex flex-col">
            {/* 헤더 */}
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <div className="flex items-center gap-3">
                <Box size={20} className="text-blue-400" />
                <div>
                  <h2 className="text-lg font-semibold text-white">{previewFile.name}</h2>
                  <p className="text-xs text-slate-400">
                    {previewFile.format.toUpperCase()} · {formatFileSize(previewFile.size)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownload(previewFile)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg"
                >
                  <Download size={14} />
                  다운로드
                </button>
                <button
                  onClick={closePreview}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* 3D 뷰어 */}
            <div className="flex-1 relative">
              {isLoadingPreview ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-3 text-slate-400">
                    <Loader2 size={40} className="animate-spin" />
                    <span>모델 로딩 중...</span>
                    {downloadProgress && (
                      <div className="w-48">
                        <div className="flex justify-between text-xs mb-1">
                          <span>다운로드</span>
                          <span>{Math.round((downloadProgress.loaded / downloadProgress.total) * 100)}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 transition-all duration-300"
                            style={{ width: `${(downloadProgress.loaded / downloadProgress.total) * 100}%` }}
                          />
                        </div>
                        <div className="text-xs mt-1 text-center">
                          {(downloadProgress.loaded / 1024 / 1024).toFixed(1)} / {(downloadProgress.total / 1024 / 1024).toFixed(1)} MB
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : previewUrl ? (
                <ThreeCanvas
                  modelUrl={previewUrl}
                  modelFormat={previewFile?.format}
                  relatedFiles={previewRelatedFiles}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-slate-500">
                  <span>파일을 로드할 수 없습니다</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 개발자 콘솔 */}
      <DevConsole
        files={files}
        isOpen={showDevConsole}
        onClose={() => setShowDevConsole(false)}
        onRefresh={initialize}
      />
    </div>
  )
}
