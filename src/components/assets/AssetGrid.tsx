import { UploadCloud } from 'lucide-react'
import type { FileMetadata } from '@/services/api'
import { formatDate } from '@/utils/dateHelpers'
import AssetCard from '@/components/assets/AssetCard'

interface AssetGridProps {
  currentFiles: FileMetadata[]
  selectedFileIds: string[]
  multiSelectMode: boolean
  usageCounts: Map<string, number>
  onFileClick: (e: React.MouseEvent, fileId: string) => void
  onCheckboxToggle: (e: React.MouseEvent, fileId: string) => void
  onPreview: (file: FileMetadata) => void
  onGeoView: (file: FileMetadata) => void
  onDownload: (file: FileMetadata) => void
  onContextMenu: (e: React.MouseEvent, type: 'file' | 'folder', id: string) => void
  onShowUploadModal: () => void
}

export default function AssetGrid({
  currentFiles,
  selectedFileIds,
  multiSelectMode,
  usageCounts,
  onFileClick,
  onCheckboxToggle,
  onPreview,
  onGeoView,
  onDownload,
  onContextMenu,
  onShowUploadModal,
}: AssetGridProps) {
  return (
    <div className="grid grid-cols-5 gap-4">
      {currentFiles.map((file) => (
        <AssetCard
          key={file.id}
          file={file}
          selected={selectedFileIds.includes(file.id)}
          multiSelectMode={multiSelectMode}
          selectedCount={selectedFileIds.length}
          onFileClick={onFileClick}
          onCheckboxToggle={onCheckboxToggle}
          onPreview={onPreview}
          onGeoView={onGeoView}
          onDownload={onDownload}
          onContextMenu={onContextMenu}
          formatDate={formatDate}
          usageCount={usageCounts.get(file.id)}
        />
      ))}

      {/* 업로드 존 */}
      <div
        onClick={onShowUploadModal}
        className="border-2 border-dashed border-slate-700 rounded-lg flex flex-col items-center justify-center text-slate-500 hover:border-blue-500 hover:text-blue-400 hover:bg-blue-500/5 cursor-pointer transition-all aspect-square"
      >
        <UploadCloud size={32} className="mb-2" />
        <span className="text-xs">파일 추가</span>
      </div>
    </div>
  )
}
