import {
  MoreVertical,
  Eye,
  Download,
  CheckSquare,
  Square,
  RefreshCw,
  Globe,
} from 'lucide-react'
import type { FileMetadata } from '@/services/api'
import { formatFileSize } from '@/utils/storage'
import { is3DFormat, isGeoViewableFormat } from '@/constants/formats'
import { getFileIconProps, getFormatBgColor } from '@/utils/fileFormatUtils'
import { formatDate } from '@/utils/dateHelpers'
import { ConversionStatusBadge } from '@/components/common/ConversionStatus'
import { needsConversion } from '@/services/conversionService'
import type { ConversionStatus } from '@/services/conversionService'

function FileIcon({ format, size = 24 }: { format: FileMetadata['format']; size?: number }) {
  const { icon: Icon, className } = getFileIconProps(format)
  return <Icon size={size} className={className} />
}

interface AssetListProps {
  currentFiles: FileMetadata[]
  selectedFileIds: string[]
  multiSelectMode: boolean
  onFileClick: (e: React.MouseEvent, fileId: string) => void
  onCheckboxToggle: (e: React.MouseEvent, fileId: string) => void
  onPreview: (file: FileMetadata) => void
  onGeoView: (file: FileMetadata) => void
  onDownload: (file: FileMetadata) => void
  onContextMenu: (e: React.MouseEvent, type: 'file' | 'folder', id: string) => void
}

export default function AssetList({
  currentFiles,
  selectedFileIds,
  multiSelectMode,
  onFileClick,
  onCheckboxToggle,
  onPreview,
  onGeoView,
  onDownload,
  onContextMenu,
}: AssetListProps) {
  return (
    <div className="space-y-1">
      {/* 헤더 */}
      <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-medium text-slate-500 uppercase border-b border-slate-800">
        <span className="col-span-1"></span>
        <span className="col-span-3">이름</span>
        <span className="col-span-2">포맷</span>
        <span className="col-span-2">상태</span>
        <span className="col-span-2">크기</span>
        <span className="col-span-2">수정일</span>
      </div>

      {currentFiles.map((file) => (
        <div
          key={file.id}
          onClick={(e) => onFileClick(e, file.id)}
          onDoubleClick={() => {
            if (!multiSelectMode && is3DFormat(file.format)) {
              onPreview(file)
            }
          }}
          onContextMenu={(e) => onContextMenu(e, 'file', file.id)}
          className={`grid grid-cols-12 gap-4 px-4 py-3 rounded-lg cursor-pointer transition-colors ${
            selectedFileIds.includes(file.id)
              ? 'bg-blue-600/10 border border-blue-500'
              : 'hover:bg-slate-800 border border-transparent'
          }`}
        >
          {/* 체크박스 */}
          <div className="col-span-1 flex items-center justify-center">
            {(multiSelectMode || selectedFileIds.length > 0) && (
              <button
                onClick={(e) => onCheckboxToggle(e, file.id)}
                className="p-1 hover:bg-slate-700 rounded"
              >
                {selectedFileIds.includes(file.id) ? (
                  <CheckSquare size={18} className="text-blue-400" />
                ) : (
                  <Square size={18} className="text-slate-500" />
                )}
              </button>
            )}
          </div>
          <div className="col-span-3 flex items-center space-x-3">
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
            {is3DFormat(file.format) && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onPreview(file)
                }}
                className="p-1 text-slate-500 hover:text-green-400 hover:bg-slate-700 rounded"
                title="3D 미리보기"
              >
                <Eye size={14} />
              </button>
            )}
            {/* 지리좌표 가시화 버튼 (변환 완료된 파일만) */}
            {file.conversionStatus === 'ready' && isGeoViewableFormat(file.format) && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onGeoView(file)
                }}
                className="p-1 text-slate-500 hover:text-cyan-400 hover:bg-slate-700 rounded"
                title="지리좌표 기반 가시화"
              >
                <Globe size={14} />
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDownload(file)
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
                onContextMenu(e, 'file', file.id)
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
  )
}
