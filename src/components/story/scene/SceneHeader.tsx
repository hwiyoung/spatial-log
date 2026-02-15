/**
 * SceneHeader - Scene 제목 / zoneLabel / summary 편집 영역
 */
import { useState } from 'react'
import { Check, X } from 'lucide-react'
import type { SceneData } from '@/types/story'

interface SceneHeaderProps {
  scene: SceneData
  entryCount: number
  onUpdateScene: (id: string, updates: Partial<Pick<SceneData, 'title' | 'zoneLabel' | 'summary'>>) => Promise<void>
}

export default function SceneHeader({ scene, entryCount, onUpdateScene }: SceneHeaderProps) {
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [editingZoneLabel, setEditingZoneLabel] = useState(false)
  const [zoneLabelDraft, setZoneLabelDraft] = useState('')
  const [editingSummary, setEditingSummary] = useState(false)
  const [summaryDraft, setSummaryDraft] = useState('')

  const handleSaveTitle = async () => {
    if (titleDraft.trim() && titleDraft !== scene.title) {
      await onUpdateScene(scene.id, { title: titleDraft.trim() })
    }
    setEditingTitle(false)
  }

  const handleSaveZoneLabel = async () => {
    const val = zoneLabelDraft.trim() || null
    if (val !== (scene.zoneLabel ?? null)) {
      await onUpdateScene(scene.id, { zoneLabel: val })
    }
    setEditingZoneLabel(false)
  }

  const handleSaveSummary = async () => {
    const val = summaryDraft.trim() || null
    if (val !== (scene.summary ?? null)) {
      await onUpdateScene(scene.id, { summary: val })
    }
    setEditingSummary(false)
  }

  return (
    <div className="p-4 border-b border-slate-700 space-y-2">
      {/* Title */}
      {editingTitle ? (
        <div className="flex items-center gap-1">
          <input
            autoFocus
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveTitle()
              if (e.key === 'Escape') setEditingTitle(false)
            }}
            className="flex-1 px-2 py-1 bg-slate-800 border border-blue-500 rounded text-sm text-white focus:outline-none"
          />
          <button onClick={handleSaveTitle} className="p-1 text-green-400 hover:bg-slate-700 rounded">
            <Check size={14} />
          </button>
          <button onClick={() => setEditingTitle(false)} className="p-1 text-slate-400 hover:bg-slate-700 rounded">
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <h3
            className="text-sm font-semibold text-white cursor-pointer hover:text-blue-400"
            onClick={() => {
              setTitleDraft(scene.title)
              setEditingTitle(true)
            }}
          >
            {scene.title}
          </h3>
          <span className="text-xs text-slate-500">{entryCount}개 엔트리</span>
        </div>
      )}

      {/* Zone Label */}
      {editingZoneLabel ? (
        <input
          autoFocus
          value={zoneLabelDraft}
          onChange={(e) => setZoneLabelDraft(e.target.value)}
          onBlur={handleSaveZoneLabel}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSaveZoneLabel()
            if (e.key === 'Escape') setEditingZoneLabel(false)
          }}
          placeholder="공간 라벨 (예: 3층 복도)"
          className="w-full px-2 py-1 bg-slate-800 border border-blue-500/50 rounded text-xs text-blue-300 placeholder:text-slate-600 focus:outline-none"
        />
      ) : (
        <div
          className="text-xs text-blue-400/60 cursor-pointer hover:text-blue-400 transition-colors"
          onClick={() => {
            setZoneLabelDraft(scene.zoneLabel ?? '')
            setEditingZoneLabel(true)
          }}
        >
          {scene.zoneLabel || '공간 라벨 (예: 3층 복도)'}
        </div>
      )}

      {/* Summary */}
      {editingSummary ? (
        <input
          autoFocus
          value={summaryDraft}
          onChange={(e) => setSummaryDraft(e.target.value)}
          onBlur={handleSaveSummary}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSaveSummary()
            if (e.key === 'Escape') setEditingSummary(false)
          }}
          placeholder="이 Scene의 의도를 한 줄로"
          className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs text-slate-300 placeholder:text-slate-600 focus:outline-none"
        />
      ) : (
        <div
          className="text-xs text-slate-500 cursor-pointer hover:text-slate-300 transition-colors"
          onClick={() => {
            setSummaryDraft(scene.summary ?? '')
            setEditingSummary(true)
          }}
        >
          {scene.summary || '이 Scene의 의도를 한 줄로'}
        </div>
      )}
    </div>
  )
}
