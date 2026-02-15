/**
 * RelatedAssetsPanel - zoneLabel 기반 관련 에셋 추천 패널
 */
import { ChevronRight, Plus } from 'lucide-react'
import type { FileMetadata } from '@/services/api'
import type { SceneEntryType } from '@/types/story'
import { detectEntryTypeFromFormat } from '@/services/api'
import { ENTRY_TYPES } from '@/constants/entries'

interface RelatedAssetsPanelProps {
  relatedAssets: FileMetadata[]
  isOpen: boolean
  onToggleOpen: () => void
  onAddAssetEntry: (file: FileMetadata, entryType: SceneEntryType) => Promise<void>
}

function getEntryConfig(type: SceneEntryType) {
  return ENTRY_TYPES.find(t => t.type === type) ?? ENTRY_TYPES[3]!
}

export default function RelatedAssetsPanel({
  relatedAssets,
  isOpen,
  onToggleOpen,
  onAddAssetEntry,
}: RelatedAssetsPanelProps) {
  if (relatedAssets.length === 0) return null

  return (
    <div className="border-t border-slate-700 flex-shrink-0">
      <button
        onClick={onToggleOpen}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:bg-slate-800"
      >
        <span>관련 에셋 ({relatedAssets.length})</span>
        <ChevronRight
          size={14}
          className={`transition-transform ${isOpen ? 'rotate-90' : ''}`}
        />
      </button>
      {isOpen && (
        <div className="p-2 max-h-48 overflow-auto space-y-1">
          {relatedAssets.map(file => {
            const entryType = detectEntryTypeFromFormat(file.format)
            const cfg = getEntryConfig(entryType)
            const FileIcon = cfg.icon
            return (
              <div
                key={file.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-800 text-xs"
              >
                <FileIcon size={12} className={cfg.color + ' flex-shrink-0'} />
                <span className="flex-1 truncate text-slate-300">{file.name}</span>
                <button
                  onClick={() => onAddAssetEntry(file, entryType)}
                  className="p-1 bg-blue-600 hover:bg-blue-500 rounded text-white flex-shrink-0"
                  title="Scene에 추가"
                >
                  <Plus size={10} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
