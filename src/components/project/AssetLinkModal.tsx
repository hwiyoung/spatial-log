import { useState, useEffect } from 'react'
import { X, Search, Check, FolderOpen, FileImage, File } from 'lucide-react'
import { useAssetStore } from '@/stores/assetStore'
import type { FileMetadata } from '@/services/api'
import { formatFileSize } from '@/utils/storage'

interface AssetLinkModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  onLinked: () => void
}

export default function AssetLinkModal({
  isOpen,
  onClose,
  projectId,
  onLinked,
}: AssetLinkModalProps) {
  const { files, initialize, linkToProject, isLoading } = useAssetStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  useEffect(() => {
    if (isOpen) {
      initialize()
      setSelectedIds([])
      setSearchQuery('')
    }
  }, [isOpen, initialize])

  if (!isOpen) return null

  // 프로젝트에 연결되지 않은 파일만 표시
  const availableFiles = files.filter((f) => f.projectId === null)

  // 검색 필터
  const filteredFiles = availableFiles.filter((file) =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((fid) => fid !== id) : [...prev, id]
    )
  }

  const handleSelectAll = () => {
    if (selectedIds.length === filteredFiles.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredFiles.map((f) => f.id))
    }
  }

  const handleLink = async () => {
    if (selectedIds.length === 0) return
    await linkToProject(selectedIds, projectId)
    onLinked()
  }

  const getFileIcon = (file: FileMetadata) => {
    if (file.format === 'image') return FileImage
    if (['gltf', 'glb', 'obj', 'fbx', 'ply', 'las', 'e57'].includes(file.format)) return File
    return FolderOpen
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-xl border border-slate-700 w-full max-w-2xl shadow-2xl max-h-[80vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex justify-between items-center p-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">에셋 추가</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-800 rounded transition-colors"
          >
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        {/* 검색 */}
        <div className="p-4 border-b border-slate-700">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="파일 검색..."
              className="w-full pl-10 pr-4 py-2 bg-slate-800 text-white border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* 선택 정보 및 전체 선택 */}
        <div className="flex justify-between items-center px-4 py-2 bg-slate-800/50">
          <span className="text-sm text-slate-400">
            {selectedIds.length > 0
              ? `${selectedIds.length}개 선택됨`
              : `${filteredFiles.length}개의 사용 가능한 에셋`}
          </span>
          <button
            onClick={handleSelectAll}
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            {selectedIds.length === filteredFiles.length ? '선택 해제' : '전체 선택'}
          </button>
        </div>

        {/* 파일 목록 */}
        <div className="flex-1 overflow-auto p-4">
          {filteredFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <FolderOpen size={48} className="opacity-30 mb-4" />
              <span>
                {availableFiles.length === 0
                  ? '연결 가능한 에셋이 없습니다'
                  : '검색 결과가 없습니다'}
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {filteredFiles.map((file) => {
                const FileIcon = getFileIcon(file)
                const isSelected = selectedIds.includes(file.id)
                return (
                  <div
                    key={file.id}
                    onClick={() => handleSelect(file.id)}
                    className={`relative p-3 rounded-lg cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-blue-500/20 ring-2 ring-blue-500'
                        : 'bg-slate-800 hover:bg-slate-700'
                    }`}
                  >
                    {/* 선택 체크 */}
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                        <Check size={14} className="text-white" />
                      </div>
                    )}

                    <div className="flex flex-col items-center text-center">
                      {file.thumbnailUrl ? (
                        <img
                          src={file.thumbnailUrl}
                          alt={file.name}
                          className="w-12 h-12 object-cover rounded mb-2"
                        />
                      ) : (
                        <FileIcon size={32} className="text-slate-500 mb-2" />
                      )}
                      <span className="text-sm text-white truncate w-full">
                        {file.name}
                      </span>
                      <span className="text-xs text-slate-500">
                        {formatFileSize(file.size)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex justify-end gap-3 p-4 border-t border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleLink}
            disabled={selectedIds.length === 0 || isLoading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition-colors"
          >
            {isLoading ? '연결 중...' : `${selectedIds.length}개 연결`}
          </button>
        </div>
      </div>
    </div>
  )
}
