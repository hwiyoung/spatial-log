import {
  MoreVertical,
  Eye,
  Download,
  MapPin,
  CheckSquare,
  Square,
  RefreshCw,
  Globe,
  Link,
  StickyNote,
  EyeOff,
  Archive,
  BookOpen,
} from 'lucide-react'
import type { FileMetadata } from '@/services/api'
import { formatFileSize } from '@/utils/storage'
import { is3DFormat, isGeoViewableFormat } from '@/constants/formats'
import { getFileIconProps, getFormatBgColor } from '@/utils/fileFormatUtils'
import { ConversionStatusBadge } from '@/components/common/ConversionStatus'
import { needsConversion } from '@/services/conversionService'
import type { ConversionStatus } from '@/services/conversionService'
import { getUserTags } from '@/constants/tags'

interface AssetCardProps {
  file: FileMetadata
  selected: boolean
  multiSelectMode: boolean
  selectedCount: number
  onFileClick: (e: React.MouseEvent, fileId: string) => void
  onCheckboxToggle: (e: React.MouseEvent, fileId: string) => void
  onPreview: (file: FileMetadata) => void
  onGeoView: (file: FileMetadata) => void
  onDownload: (file: FileMetadata) => void
  onContextMenu: (e: React.MouseEvent, type: 'file' | 'folder', id: string) => void
  formatDate: (date: Date) => string
  usageCount?: number
}

function FileIcon({ format, size = 24 }: { format: FileMetadata['format']; size?: number }) {
  const { icon: Icon, className } = getFileIconProps(format)
  return <Icon size={size} className={className} />
}

function AssetTypeIcon({ assetType }: { assetType: FileMetadata['assetType'] }) {
  if (assetType === 'link') return <Link size={20} className="text-blue-400" />
  if (assetType === 'note') return <StickyNote size={20} className="text-amber-400" />
  return null
}

export default function AssetCard({
  file,
  selected,
  multiSelectMode,
  selectedCount,
  onFileClick,
  onCheckboxToggle,
  onPreview,
  onGeoView,
  onDownload,
  onContextMenu,
  usageCount,
  formatDate,
}: AssetCardProps) {
  const isNonFile = file.assetType !== 'file'
  const isInactive = file.status !== 'active'

  return (
    <div
      onClick={(e) => onFileClick(e, file.id)}
      onDoubleClick={() => {
        if (!multiSelectMode && file.assetType === 'file' && is3DFormat(file.format)) {
          onPreview(file)
        }
      }}
      onContextMenu={(e) => onContextMenu(e, 'file', file.id)}
      className={`group bg-slate-800 rounded-lg p-3 border cursor-pointer transition-all hover:shadow-lg ${
        selected
          ? 'border-blue-500 ring-1 ring-blue-500'
          : 'border-slate-700 hover:border-slate-500'
      } ${isInactive ? 'opacity-60' : ''}`}
    >
      <div className={`aspect-square rounded-md mb-3 ${
        isNonFile
          ? (file.assetType === 'link' ? 'bg-blue-500/10' : 'bg-amber-500/10')
          : getFormatBgColor(file.format)
      } flex items-center justify-center relative overflow-hidden`}>
        {/* 카드 내용: 파일/링크/노트 분기 */}
        {isNonFile ? (
          <AssetTypeIcon assetType={file.assetType} />
        ) : file.thumbnailUrl ? (
          <img src={file.thumbnailUrl} alt={file.name} className="w-full h-full object-cover" />
        ) : (
          <FileIcon format={file.format} />
        )}

        {/* 체크박스 */}
        {(multiSelectMode || selectedCount > 0) && (
          <button
            onClick={(e) => onCheckboxToggle(e, file.id)}
            className="absolute top-2 right-2 p-1 bg-slate-900/80 rounded hover:bg-slate-700 z-10"
          >
            {selected ? (
              <CheckSquare size={16} className="text-blue-400" />
            ) : (
              <Square size={16} className="text-slate-400" />
            )}
          </button>
        )}

        {/* 포맷/타입 배지 */}
        <span className="absolute top-2 left-2 px-1.5 py-0.5 bg-slate-900/80 rounded text-[10px] font-medium text-white uppercase">
          {isNonFile ? file.assetType : file.format}
        </span>

        {/* 상태 배지 (hidden/archived) */}
        {file.status === 'hidden' && (
          <span className="absolute bottom-2 left-2 p-1 bg-slate-600/80 rounded text-slate-300" title="숨김">
            <EyeOff size={10} />
          </span>
        )}
        {file.status === 'archived' && (
          <span className="absolute bottom-2 left-2 p-1 bg-orange-600/80 rounded text-white" title="보관됨">
            <Archive size={10} />
          </span>
        )}

        {/* GPS 위치 표시 (파일만) */}
        {!isNonFile && file.gps && (
          <span
            className="absolute bottom-2 left-2 p-1 bg-green-600/80 rounded text-white"
            title={`위치: ${file.gps.latitude.toFixed(6)}, ${file.gps.longitude.toFixed(6)}`}
          >
            <MapPin size={10} />
          </span>
        )}

        {/* 변환 상태 표시 (파일만) */}
        {!isNonFile && file.conversionStatus && file.conversionStatus !== 'ready' && (
          <div className="absolute bottom-2 right-2">
            <ConversionStatusBadge
              status={file.conversionStatus as ConversionStatus}
              progress={file.conversionProgress}
              error={file.conversionError}
              compact
            />
          </div>
        )}

        {/* 변환 필요 표시 (파일만) */}
        {!isNonFile && !file.conversionStatus && needsConversion(file.format) && (
          <span className="absolute bottom-2 right-2 p-1 bg-cyan-600/80 rounded text-white" title="변환 가능">
            <RefreshCw size={10} />
          </span>
        )}

        {/* 호버 액션 */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1">
          {file.assetType === 'file' && is3DFormat(file.format) && (
            <button
              onClick={(e) => { e.stopPropagation(); onPreview(file) }}
              className="bg-slate-900/80 p-1.5 rounded hover:bg-green-600 text-white"
              title="3D 미리보기"
            >
              <Eye size={12} />
            </button>
          )}
          {file.assetType === 'file' && file.conversionStatus === 'ready' && isGeoViewableFormat(file.format) && (
            <button
              onClick={(e) => { e.stopPropagation(); onGeoView(file) }}
              className="bg-slate-900/80 p-1.5 rounded hover:bg-cyan-600 text-white"
              title="지리좌표 기반 가시화 (Cesium)"
            >
              <Globe size={12} />
            </button>
          )}
          {file.assetType === 'file' && (
            <button
              onClick={(e) => { e.stopPropagation(); onDownload(file) }}
              className="bg-slate-900/80 p-1.5 rounded hover:bg-blue-600 text-white"
              title="다운로드"
            >
              <Download size={12} />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); onContextMenu(e, 'file', file.id) }}
            className="bg-slate-900/80 p-1.5 rounded hover:bg-blue-600 text-white"
            title="더 보기"
          >
            <MoreVertical size={12} />
          </button>
        </div>
      </div>
      <div className="px-1">
        <h4 className="text-sm font-medium text-white truncate mb-0.5">{file.name}</h4>
        {file.description && (
          <p className="text-xs text-slate-400 truncate mb-1">{file.description}</p>
        )}
        <div className="flex justify-between items-center text-[10px] text-slate-400">
          <span>{isNonFile ? file.assetType : formatFileSize(file.size)}</span>
          {(usageCount ?? 0) > 0 ? (
            <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded text-[10px]">
              <BookOpen size={9} />
              Story {usageCount}
            </span>
          ) : (
            <span>{formatDate(file.createdAt)}</span>
          )}
        </div>
        {/* 태그 칩 (최대 2개 + N) */}
        {file.tags && getUserTags(file.tags).length > 0 && (
          <div className="flex gap-1 mt-1.5 overflow-hidden">
            {getUserTags(file.tags)
              .slice(0, 2)
              .map(tag => (
                <span key={tag} className="px-1.5 py-0.5 bg-slate-700 text-slate-300 rounded text-[10px] truncate max-w-[60px]">
                  {tag}
                </span>
              ))}
            {getUserTags(file.tags).length > 2 && (
              <span className="px-1 py-0.5 bg-slate-700 text-slate-400 rounded text-[10px]">
                +{getUserTags(file.tags).length - 2}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
