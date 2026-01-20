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
  ChevronRight,
  HardDrive,
  Loader2,
  MapPin,
  Scan,
} from 'lucide-react'
import { useAssetStore } from '@/stores/assetStore'
import { Modal, Input, FileUpload } from '@/components/common'
import { formatFileSize } from '@/utils/storage'
import type { FileMetadata, FolderData } from '@/services/api'

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
  } = useAssetStore()

  // 모달 상태
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showNewFolderModal, setShowNewFolderModal] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null)
  const [editingFolderName, setEditingFolderName] = useState('')
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; type: 'file' | 'folder'; id: string } | null>(null)

  // 초기화
  useEffect(() => {
    initialize()
  }, [initialize])

  // 파일 업로드 핸들러
  const handleUpload = useCallback(async (uploadedFiles: File[]) => {
    await uploadFiles(uploadedFiles)
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

  // 파일 선택 (Ctrl 키로 다중 선택)
  const handleFileClick = useCallback((e: React.MouseEvent, fileId: string) => {
    selectFile(fileId, e.ctrlKey || e.metaKey)
  }, [selectFile])

  // 선택된 파일 삭제
  const handleDeleteSelected = useCallback(async () => {
    if (selectedFileIds.length > 0) {
      await deleteFiles(selectedFileIds)
    }
  }, [selectedFileIds, deleteFiles])

  // 컨텍스트 메뉴
  const handleContextMenu = useCallback((e: React.MouseEvent, type: 'file' | 'folder', id: string) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, type, id })
  }, [])

  // 컨텍스트 메뉴 닫기
  useEffect(() => {
    const handleClick = () => setContextMenu(null)
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

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
        <div>
          <h1 className="text-2xl font-bold text-white">데이터 보관함</h1>
          <p className="text-slate-500 text-sm mt-1">
            {fileCount}개 파일 · {formatFileSize(storageUsed)} 사용 중
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {/* 선택된 파일 액션 */}
          {selectedFileIds.length > 0 && (
            <div className="flex items-center space-x-2 mr-4">
              <span className="text-sm text-slate-400">{selectedFileIds.length}개 선택됨</span>
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

          {/* 뷰 모드 토글 */}
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
        </div>
      </div>

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

                    {/* 호버 액션 */}
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1">
                      <button className="bg-slate-900/80 p-1.5 rounded hover:bg-blue-600 text-white">
                        <ChevronRight size={12} />
                      </button>
                      <button className="bg-slate-900/80 p-1.5 rounded hover:bg-blue-600 text-white">
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
                <span className="col-span-5">이름</span>
                <span className="col-span-2">포맷</span>
                <span className="col-span-2">크기</span>
                <span className="col-span-2">수정일</span>
                <span className="col-span-1"></span>
              </div>

              {currentFiles.map((file) => (
                <div
                  key={file.id}
                  onClick={(e) => handleFileClick(e, file.id)}
                  onContextMenu={(e) => handleContextMenu(e, 'file', file.id)}
                  className={`grid grid-cols-12 gap-4 px-4 py-3 rounded-lg cursor-pointer transition-colors ${
                    selectedFileIds.includes(file.id)
                      ? 'bg-blue-600/10 border border-blue-500'
                      : 'hover:bg-slate-800 border border-transparent'
                  }`}
                >
                  <div className="col-span-5 flex items-center space-x-3">
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
                  <span className="col-span-2 text-sm text-slate-400 flex items-center">{formatFileSize(file.size)}</span>
                  <span className="col-span-2 text-sm text-slate-400 flex items-center">{formatDate(file.createdAt)}</span>
                  <div className="col-span-1 flex items-center justify-end">
                    <button className="p-1 text-slate-500 hover:text-white hover:bg-slate-700 rounded opacity-0 group-hover:opacity-100">
                      <MoreVertical size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

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
                  deleteFiles([contextMenu.id])
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
    </div>
  )
}
