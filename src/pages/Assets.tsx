import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  Grid,
  List,
  FolderPlus,
  UploadCloud,
  Box,
  Trash2,
  Edit2,
  Check,
  X,
  Loader2,
  Download,
  Eye,
  Shield,
  Files,
  CheckSquare,
  Terminal,
  Globe,
  Search,
  Tag,
  Link,
  StickyNote,
  Plus,
} from 'lucide-react'
import { useAssetStore } from '@/stores/assetStore'
import { Modal, Input, FileUpload, type FileGroup, type UploadOptions } from '@/components/common'
import { GeoViewer } from '@/components/viewer'
import IntegrityChecker from '@/components/admin/IntegrityChecker'
import DevConsole from '@/components/admin/DevConsole'
import { formatFileSize } from '@/utils/storage'
import { isGeoViewableFormat } from '@/constants/formats'
import type { FileMetadata, FolderData } from '@/services/api'
import { updateFile, createLinkAsset, createNoteAsset } from '@/services/api'
import TagEditModal from '@/components/assets/TagEditModal'
import FolderSidebar from '@/components/assets/FolderSidebar'
import AssetGrid from '@/components/assets/AssetGrid'
import AssetList from '@/components/assets/AssetList'
import PreviewModal from '@/components/assets/PreviewModal'
import DeleteConfirmModal from '@/components/assets/DeleteConfirmModal'
import { useAssetPreview } from '@/hooks/useAssetPreview'

// 탭 타입
type TabType = 'files' | 'admin'

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
    searchTerm,
    formatFilter,
    statusFilter,
    assetTypeFilter,
    tagFilter,
    setSearchTerm,
    setFormatFilter,
    setStatusFilter,
    setAssetTypeFilter,
    setTagFilter,
    getFilteredFiles,
    getAllTags,
    usageCounts,
  } = useAssetStore()

  // Preview hook
  const {
    previewFile,
    previewUrl,
    previewActualFormat,
    isLoadingPreview,
    downloadProgress,
    previewRelatedFiles,
    geoViewerFile,
    geoViewerUrl,
    geoViewerDataType,
    handlePreview,
    closePreview,
    handleGeoView,
    closeGeoViewer,
  } = useAssetPreview()

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

  // 다중 선택 모드
  const [multiSelectMode, setMultiSelectMode] = useState(false)

  // 태그 편집 상태
  const [tagEditFileIds, setTagEditFileIds] = useState<string[]>([])
  const [showTagEditModal, setShowTagEditModal] = useState(false)

  // 링크/노트 에셋 등록
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [showAddDropdown, setShowAddDropdown] = useState(false)
  const [linkName, setLinkName] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [noteName, setNoteName] = useState('')
  const [noteBody, setNoteBody] = useState('')

  // 개발자 콘솔
  const [showDevConsole, setShowDevConsole] = useState(false)

  // 초기화
  useEffect(() => {
    initialize()
  }, [initialize])

  // 파일 업로드 핸들러
  const handleUpload = useCallback(async (uploadedFiles: File[], groups?: FileGroup[], options?: UploadOptions) => {
    await uploadFiles(uploadedFiles, groups, options)
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

  // 태그 편집
  const openTagEdit = useCallback((fileIds: string[]) => {
    setTagEditFileIds(fileIds)
    setShowTagEditModal(true)
    setContextMenu(null)
  }, [])

  const handleTagSave = useCallback(async (fileIds: string[], tags: string[]) => {
    for (const id of fileIds) {
      await updateFile(id, { tags })
    }
    await useAssetStore.getState().refreshFiles()
  }, [])

  // 컨텍스트 메뉴
  const handleContextMenu = useCallback((e: React.MouseEvent, type: 'file' | 'folder', id: string) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, type, id })
  }, [])

  // 링크 에셋 생성
  const handleCreateLink = useCallback(async () => {
    if (!linkName.trim() || !linkUrl.trim()) return
    try {
      await createLinkAsset(linkName.trim(), linkUrl.trim(), { folderId: selectedFolderId })
      await useAssetStore.getState().refreshFiles()
      setShowLinkModal(false)
      setLinkName('')
      setLinkUrl('')
    } catch (err) {
      alert(err instanceof Error ? err.message : '링크 생성 실패')
    }
  }, [linkName, linkUrl, selectedFolderId])

  // 노트 에셋 생성
  const handleCreateNote = useCallback(async () => {
    if (!noteName.trim() || !noteBody.trim()) return
    try {
      await createNoteAsset(noteName.trim(), noteBody.trim(), { folderId: selectedFolderId })
      await useAssetStore.getState().refreshFiles()
      setShowNoteModal(false)
      setNoteName('')
      setNoteBody('')
    } catch (err) {
      alert(err instanceof Error ? err.message : '노트 생성 실패')
    }
  }, [noteName, noteBody, selectedFolderId])

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

  // 필터링된 파일 목록
  const filteredFiles = getFilteredFiles()
  const currentFiles = selectedFolderId === null
    ? filteredFiles
    : filteredFiles.filter(f => f.folderId === selectedFolderId)
  const allTags = useMemo(() => getAllTags(), [files]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* 헤더 */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Assets</h1>
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
          {activeTab === 'files' && (
            selectedFileIds.length > 0 ? (
              <>
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
                  onClick={() => openTagEdit(selectedFileIds)}
                  className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-lg border border-blue-600/30"
                >
                  <Tag size={14} />
                  <span className="text-sm">태그 편집</span>
                </button>
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
                <div className="h-5 border-l border-slate-600" />
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                  <UploadCloud size={18} />
                  <span>파일 업로드</span>
                </button>
              </>
            ) : (
              <>
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
                <div className="relative">
                  <button
                    onClick={() => setShowAddDropdown(!showAddDropdown)}
                    className="flex items-center p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-700"
                    title="링크/노트 추가"
                  >
                    <Plus size={18} />
                  </button>
                  {showAddDropdown && (
                    <div className="absolute right-0 top-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 z-50 w-36">
                      <button
                        onClick={() => { setShowLinkModal(true); setShowAddDropdown(false) }}
                        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-white hover:bg-slate-700"
                      >
                        <Link size={14} className="text-blue-400" />
                        <span>링크 추가</span>
                      </button>
                      <button
                        onClick={() => { setShowNoteModal(true); setShowAddDropdown(false) }}
                        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-white hover:bg-slate-700"
                      >
                        <StickyNote size={14} className="text-amber-400" />
                        <span>노트 추가</span>
                      </button>
                    </div>
                  )}
                </div>
              </>
            )
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
      <div className="flex-1 flex min-h-0 bg-slate-900/50 rounded-xl border border-slate-700 overflow-hidden">
        {/* 폴더 트리 */}
        <FolderSidebar
          folders={folders}
          files={files}
          selectedFolderId={selectedFolderId}
          editingFolderId={editingFolderId}
          editingFolderName={editingFolderName}
          storageUsed={storageUsed}
          selectFolder={selectFolder}
          handleContextMenu={handleContextMenu}
          startEditingFolder={startEditingFolder}
          finishEditingFolder={finishEditingFolder}
          setEditingFolderName={setEditingFolderName}
        />

        {/* 파일 그리드/리스트 */}
        <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
          {/* 검색/필터 바 */}
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <select
              value={assetTypeFilter ?? ''}
              onChange={(e) => setAssetTypeFilter(e.target.value || null)}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-blue-500"
            >
              <option value="">전체 타입</option>
              <option value="file">파일</option>
              <option value="link">링크</option>
              <option value="note">노트</option>
            </select>
            <select
              value={formatFilter ?? ''}
              onChange={(e) => setFormatFilter(e.target.value || null)}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-blue-500"
            >
              <option value="">전체 포맷</option>
              <option value="gltf">glTF</option>
              <option value="glb">GLB</option>
              <option value="obj">OBJ</option>
              <option value="fbx">FBX</option>
              <option value="ply">PLY</option>
              <option value="las">LAS</option>
              <option value="e57">E57</option>
              <option value="3dtiles">3D Tiles</option>
              <option value="splat">Splat</option>
              <option value="image">Image</option>
            </select>
            {allTags.length > 0 && (
              <select
                value={tagFilter[0] ?? ''}
                onChange={(e) => setTagFilter(e.target.value ? [e.target.value] : [])}
                className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-blue-500"
              >
                <option value="">전체 태그</option>
                {allTags.map(tag => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
            )}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-blue-500"
            >
              <option value="active">활성</option>
              <option value="hidden">숨김</option>
              <option value="archived">보관</option>
              <option value="all">전체</option>
            </select>
          </div>

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
            <AssetGrid
              currentFiles={currentFiles}
              selectedFileIds={selectedFileIds}
              multiSelectMode={multiSelectMode}
              usageCounts={usageCounts}
              onFileClick={handleFileClick}
              onCheckboxToggle={handleCheckboxToggle}
              onPreview={handlePreview}
              onGeoView={handleGeoView}
              onDownload={handleDownload}
              onContextMenu={handleContextMenu}
              onShowUploadModal={() => setShowUploadModal(true)}
            />
          ) : (
            <AssetList
              currentFiles={currentFiles}
              selectedFileIds={selectedFileIds}
              multiSelectMode={multiSelectMode}
              onFileClick={handleFileClick}
              onCheckboxToggle={handleCheckboxToggle}
              onPreview={handlePreview}
              onGeoView={handleGeoView}
              onDownload={handleDownload}
              onContextMenu={handleContextMenu}
            />
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
              {/* 지리좌표 가시화 (변환 완료된 파일만) */}
              {(() => {
                const file = files.find(f => f.id === contextMenu.id)
                if (file?.conversionStatus === 'ready' && isGeoViewableFormat(file.format)) {
                  return (
                    <button
                      onClick={() => {
                        handleGeoView(file)
                        setContextMenu(null)
                      }}
                      className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-cyan-400 hover:bg-slate-700"
                    >
                      <Globe size={14} />
                      <span>지도에서 보기</span>
                    </button>
                  )
                }
                return null
              })()}
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
                onClick={() => openTagEdit([contextMenu.id])}
                className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-white hover:bg-slate-700"
              >
                <Tag size={14} />
                <span>태그 편집</span>
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
      <DeleteConfirmModal
        isOpen={showDeleteConfirmModal}
        filesToDelete={filesToDelete}
        isDeleting={isDeleting}
        deleteProgress={deleteProgress}
        onDelete={executeDelete}
        onCancel={cancelDelete}
      />

      {/* 3D 미리보기 모달 */}
      {previewFile && (
        <PreviewModal
          previewFile={previewFile}
          previewUrl={previewUrl}
          previewActualFormat={previewActualFormat}
          isLoadingPreview={isLoadingPreview}
          downloadProgress={downloadProgress}
          previewRelatedFiles={previewRelatedFiles}
          onClose={closePreview}
          onDownload={handleDownload}
        />
      )}

      {/* 지리좌표 기반 가시화 (Cesium) */}
      {geoViewerFile && geoViewerUrl && (
        <GeoViewer
          dataUrl={geoViewerUrl}
          dataType={geoViewerDataType}
          spatialInfo={geoViewerFile.spatialInfo}
          fileName={geoViewerFile.name}
          onClose={closeGeoViewer}
        />
      )}

      {/* 개발자 콘솔 */}
      <DevConsole
        files={files}
        isOpen={showDevConsole}
        onClose={() => setShowDevConsole(false)}
        onRefresh={initialize}
      />

      {/* 태그 편집 모달 */}
      <TagEditModal
        isOpen={showTagEditModal}
        onClose={() => setShowTagEditModal(false)}
        fileIds={tagEditFileIds}
        currentTags={
          tagEditFileIds.length === 1
            ? (files.find(f => f.id === tagEditFileIds[0])?.tags ?? [])
            : tagEditFileIds.reduce<string[]>((acc, id, idx) => {
                const tags = files.find(f => f.id === id)?.tags ?? []
                return idx === 0 ? tags : acc.filter(t => tags.includes(t))
              }, [])
        }
        allTags={allTags}
        onSave={handleTagSave}
      />

      {/* 링크 추가 모달 */}
      <Modal isOpen={showLinkModal} onClose={() => setShowLinkModal(false)} title="링크 추가">
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">이름</label>
            <input
              type="text"
              value={linkName}
              onChange={(e) => setLinkName(e.target.value)}
              placeholder="링크 이름"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">URL</label>
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setShowLinkModal(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-white rounded-lg hover:bg-slate-700">취소</button>
            <button onClick={handleCreateLink} disabled={!linkName.trim() || !linkUrl.trim()} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50">추가</button>
          </div>
        </div>
      </Modal>

      {/* 노트 추가 모달 */}
      <Modal isOpen={showNoteModal} onClose={() => setShowNoteModal(false)} title="노트 추가">
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">제목</label>
            <input
              type="text"
              value={noteName}
              onChange={(e) => setNoteName(e.target.value)}
              placeholder="노트 제목"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">내용</label>
            <textarea
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
              placeholder="노트 내용..."
              rows={5}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setShowNoteModal(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-white rounded-lg hover:bg-slate-700">취소</button>
            <button onClick={handleCreateNote} disabled={!noteName.trim() || !noteBody.trim()} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50">추가</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
