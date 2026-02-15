/**
 * EntryListItem - 단일 Entry 렌더링 (타입 아이콘, 제목 편집, GPS, 액션 버튼)
 */
import { useState } from 'react'
import {
  ChevronUp, ChevronDown, Trash2, Edit2,
  MapPin, MapPinOff, Target, ExternalLink, AlertTriangle,
} from 'lucide-react'
import type { SceneEntryData, SceneEntryType } from '@/types/story'
import { sanitizeUrl } from '@/utils/urlHelpers'
import { ENTRY_TYPES } from '@/constants/entries'

interface EntryListItemProps {
  entry: SceneEntryData
  index: number
  totalCount: number
  isActive: boolean
  isMissing: boolean
  onEntryClick: (id: string) => void
  onMoveEntry: (index: number, direction: 'up' | 'down') => Promise<void>
  onDeleteEntry: (id: string) => Promise<void>
  onUpdateEntry: (id: string, updates: Partial<Pick<SceneEntryData, 'title'>>) => Promise<void>
  onRequestLocate?: (entryId: string) => void
}

function getEntryConfig(type: SceneEntryType) {
  return ENTRY_TYPES.find(t => t.type === type) ?? ENTRY_TYPES[3]!
}

export default function EntryListItem({
  entry,
  index,
  totalCount,
  isActive,
  isMissing,
  onEntryClick,
  onMoveEntry,
  onDeleteEntry,
  onUpdateEntry,
  onRequestLocate,
}: EntryListItemProps) {
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')

  const cfg = getEntryConfig(entry.entryType)
  const EntryIcon = cfg.icon
  const hasGps = !!entry.gps

  const handleSaveTitle = async () => {
    if (titleDraft.trim()) {
      await onUpdateEntry(entry.id, { title: titleDraft.trim() })
    }
    setEditingTitle(false)
  }

  return (
    <div
      onClick={() => onEntryClick(entry.id)}
      className={`group flex items-start gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
        isMissing
          ? 'border border-red-500/30 bg-red-500/5'
          : isActive
            ? 'bg-blue-500/10 border border-blue-500/30'
            : 'hover:bg-slate-800 border border-transparent'
      }`}
    >
      {/* 타입 아이콘 */}
      <div className={`flex-shrink-0 w-7 h-7 rounded ${isMissing ? 'bg-red-500/20' : cfg.bgColor} flex items-center justify-center`}>
        {isMissing ? (
          <AlertTriangle size={14} className="text-red-400" />
        ) : (
          <EntryIcon size={14} className={cfg.color} />
        )}
      </div>

      {/* 내용 */}
      <div className="flex-1 min-w-0">
        {editingTitle ? (
          <input
            autoFocus
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={() => handleSaveTitle()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveTitle()
              if (e.key === 'Escape') setEditingTitle(false)
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-slate-800 border border-blue-500 rounded px-2 py-0.5 text-xs text-white focus:outline-none"
          />
        ) : (
          <div className="text-xs text-white truncate">
            {entry.title || cfg.label}
          </div>
        )}
        {isMissing && (
          <div className="flex items-center gap-1 text-xs text-red-400 mt-0.5">
            <AlertTriangle size={12} />
            원본 파일 없음
            <button
              onClick={(e) => { e.stopPropagation(); onDeleteEntry(entry.id) }}
              className="ml-1 px-1.5 py-0.5 text-xs text-red-300 hover:bg-red-500/20 rounded"
            >
              참조 제거
            </button>
          </div>
        )}
        {entry.body && (
          <div className="text-xs text-slate-500 line-clamp-2 mt-0.5">{entry.body}</div>
        )}
        {entry.url && sanitizeUrl(entry.url) && (
          <a
            href={sanitizeUrl(entry.url)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mt-0.5"
          >
            <ExternalLink size={12} />
            <span className="truncate">{entry.url}</span>
          </a>
        )}
        {/* GPS 상태 */}
        {hasGps ? (
          <div className="flex items-center gap-1 text-xs text-green-400 mt-0.5">
            <MapPin size={12} />
            {entry.gps!.latitude.toFixed(4)}, {entry.gps!.longitude.toFixed(4)}
          </div>
        ) : (
          <div
            className="flex items-center gap-1 text-xs text-orange-400 mt-0.5 cursor-pointer hover:text-orange-300"
            onClick={(e) => {
              e.stopPropagation()
              onRequestLocate?.(entry.id)
            }}
          >
            <MapPinOff size={12} />
            위치 미지정
            <Target size={12} className="ml-0.5" />
          </div>
        )}
      </div>

      {/* 액션 버튼 (hover) */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        {/* GPS 위치 (재)지정 */}
        {onRequestLocate && (
          <button
            onClick={(e) => { e.stopPropagation(); onRequestLocate(entry.id) }}
            className="p-0.5 hover:bg-slate-700 rounded text-slate-400 hover:text-orange-400"
            title={hasGps ? '위치 변경' : '위치 지정'}
          >
            <Target size={14} />
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onMoveEntry(index, 'up') }}
          disabled={index === 0}
          className="p-0.5 hover:bg-slate-700 rounded disabled:opacity-30 text-slate-400"
        >
          <ChevronUp size={14} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onMoveEntry(index, 'down') }}
          disabled={index === totalCount - 1}
          className="p-0.5 hover:bg-slate-700 rounded disabled:opacity-30 text-slate-400"
        >
          <ChevronDown size={14} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            setTitleDraft(entry.title || '')
            setEditingTitle(true)
          }}
          className="p-0.5 hover:bg-slate-700 rounded text-slate-400"
        >
          <Edit2 size={14} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDeleteEntry(entry.id) }}
          className="p-0.5 hover:bg-red-500/20 rounded text-slate-400 hover:text-red-400"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}
