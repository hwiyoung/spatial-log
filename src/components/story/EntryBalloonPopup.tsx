/**
 * EntryBalloonPopup - Cesium 마커 클릭 시 나타나는 말풍선 팝업
 * 타입별 콘텐츠: spatial(파일정보), visual(썸네일), document(다운로드), note(텍스트)
 */
import { useState, useEffect, useRef } from 'react'
import { X, Edit2, Download, ExternalLink, Box, Image, FileText, StickyNote, MapPin } from 'lucide-react'
import { useAssetStore } from '@/stores/assetStore'
import type { SceneEntryData, SceneEntryType } from '@/types/story'
import type { FileMetadata } from '@/services/api'

interface EntryBalloonPopupProps {
  entry: SceneEntryData
  position: { x: number; y: number }
  file: FileMetadata | null
  onClose: () => void
  onEdit: (entryId: string) => void
  readOnly?: boolean
}

const TYPE_CONFIG: Record<SceneEntryType, { icon: typeof Box; color: string; label: string }> = {
  spatial: { icon: Box, color: 'text-blue-400', label: '3D 데이터' },
  visual: { icon: Image, color: 'text-green-400', label: '이미지' },
  document: { icon: FileText, color: 'text-purple-400', label: '문서' },
  note: { icon: StickyNote, color: 'text-amber-400', label: '메모' },
}

const FORMAT_BADGE_COLORS: Record<string, string> = {
  gltf: 'bg-blue-500/20 text-blue-300',
  glb: 'bg-blue-500/20 text-blue-300',
  obj: 'bg-cyan-500/20 text-cyan-300',
  fbx: 'bg-indigo-500/20 text-indigo-300',
  ply: 'bg-sky-500/20 text-sky-300',
  las: 'bg-teal-500/20 text-teal-300',
  e57: 'bg-teal-500/20 text-teal-300',
  '3dtiles': 'bg-violet-500/20 text-violet-300',
  splat: 'bg-fuchsia-500/20 text-fuchsia-300',
  image: 'bg-green-500/20 text-green-300',
}

export default function EntryBalloonPopup({
  entry,
  position,
  file,
  onClose,
  onEdit,
  readOnly = false,
}: EntryBalloonPopupProps) {
  const { getFileBlob } = useAssetStore()
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const [adjustedPos, setAdjustedPos] = useState(position)

  const config = TYPE_CONFIG[entry.entryType] ?? TYPE_CONFIG.note
  const Icon = config.icon

  // Load thumbnail for visual entries
  useEffect(() => {
    if (entry.entryType !== 'visual' || !file) return

    // file.thumbnailUrl이 있으면 blob 로드 없이 바로 사용
    if (file.thumbnailUrl) {
      setThumbnailUrl(file.thumbnailUrl)
      return
    }

    let revoked = false
    let blobUrl: string | null = null
    const load = async () => {
      try {
        const blob = await getFileBlob(file.id)
        if (blob && !revoked) {
          blobUrl = URL.createObjectURL(blob)
          setThumbnailUrl(blobUrl)
        }
      } catch {
        // ignore
      }
    }
    load()
    return () => {
      revoked = true
      if (blobUrl) URL.revokeObjectURL(blobUrl)
    }
  }, [entry.entryType, file?.id, file?.thumbnailUrl, getFileBlob])

  // Adjust position to keep popup within viewport
  useEffect(() => {
    if (!popupRef.current) return
    const rect = popupRef.current.getBoundingClientRect()
    const parentRect = popupRef.current.parentElement?.getBoundingClientRect()
    if (!parentRect) return

    let x = position.x
    let y = position.y

    // Keep within parent bounds
    if (x + rect.width / 2 > parentRect.width) {
      x = parentRect.width - rect.width / 2 - 8
    }
    if (x - rect.width / 2 < 0) {
      x = rect.width / 2 + 8
    }
    if (y - rect.height - 20 < 0) {
      y = rect.height + 20 + 8
    }

    setAdjustedPos({ x, y })
  }, [position])

  const handleDownload = async () => {
    if (!file) return
    try {
      const blob = await getFileBlob(file.id)
      if (blob) {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = file.name
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch {
      // ignore
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div
      ref={popupRef}
      className="absolute z-30 pointer-events-auto"
      style={{
        left: adjustedPos.x,
        top: adjustedPos.y - 20,
        transform: 'translate(-50%, -100%)',
      }}
    >
      <div className="bg-slate-900 border border-slate-600 rounded-xl shadow-2xl max-w-[280px] min-w-[200px] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700">
          <div className="flex items-center gap-1.5">
            <Icon size={14} className={config.color} />
            <span className="text-xs font-medium text-slate-300">{config.label}</span>
          </div>
          <button
            onClick={onClose}
            className="p-0.5 hover:bg-slate-700 rounded text-slate-500 hover:text-white transition-colors"
          >
            <X size={12} />
          </button>
        </div>

        {/* Content - type specific */}
        <div className="px-3 py-2.5">
          {entry.entryType === 'spatial' && (
            <div className="space-y-1.5">
              <div className="text-sm text-white font-medium truncate">
                {entry.title || file?.name || '3D 데이터'}
              </div>
              {file && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${FORMAT_BADGE_COLORS[file.format] ?? 'bg-slate-700 text-slate-300'}`}>
                    {file.format.toUpperCase()}
                  </span>
                  <span className="text-[10px] text-slate-500">{formatSize(file.size)}</span>
                </div>
              )}
            </div>
          )}

          {entry.entryType === 'visual' && (
            <div className="space-y-2">
              {thumbnailUrl && (
                <img
                  src={thumbnailUrl}
                  alt={entry.title || '이미지'}
                  className="w-full max-h-[160px] object-cover rounded-lg"
                />
              )}
              <div className="text-sm text-white font-medium truncate">
                {entry.title || file?.name || '이미지'}
              </div>
            </div>
          )}

          {entry.entryType === 'document' && (
            <div className="space-y-2">
              <div className="text-sm text-white font-medium truncate">
                {entry.title || file?.name || '문서'}
              </div>
              {file && (
                <div className="flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${FORMAT_BADGE_COLORS[file.format] ?? 'bg-slate-700 text-slate-300'}`}>
                    {file.format.toUpperCase()}
                  </span>
                  <span className="text-[10px] text-slate-500">{formatSize(file.size)}</span>
                </div>
              )}
              <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 rounded-lg text-xs transition-colors w-full justify-center"
              >
                <Download size={12} />
                다운로드
              </button>
            </div>
          )}

          {entry.entryType === 'note' && (
            <div className="space-y-1.5">
              {entry.title && (
                <div className="text-sm text-white font-medium">{entry.title}</div>
              )}
              {entry.body && (
                <div className="text-xs text-slate-400 line-clamp-3">{entry.body}</div>
              )}
              {entry.url && (
                <a
                  href={entry.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <ExternalLink size={10} />
                  <span className="truncate">{entry.url}</span>
                </a>
              )}
              {!entry.title && !entry.body && !entry.url && (
                <div className="text-xs text-slate-500 italic">내용 없음</div>
              )}
            </div>
          )}

          {/* GPS */}
          {entry.gps && (
            <div className="flex items-center gap-1 text-[10px] text-green-400/70 mt-2">
              <MapPin size={9} />
              {entry.gps.latitude.toFixed(5)}, {entry.gps.longitude.toFixed(5)}
            </div>
          )}
        </div>

        {/* Footer */}
        {!readOnly && (
          <div className="flex items-center justify-end gap-1 px-3 py-2 border-t border-slate-700/50">
            <button
              onClick={() => onEdit(entry.id)}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
            >
              <Edit2 size={10} />
              편집
            </button>
          </div>
        )}
      </div>

      {/* Balloon tail */}
      <div className="flex justify-center">
        <div
          className="w-0 h-0"
          style={{
            borderLeft: '8px solid transparent',
            borderRight: '8px solid transparent',
            borderTop: '8px solid rgb(71 85 105)',  // slate-600
          }}
        />
      </div>
    </div>
  )
}
