/**
 * SceneNavigator - 좌측 패널: Scene 목록 + 에셋 브라우저
 */
import { useState } from 'react'
import {
  Plus, ChevronUp, ChevronDown, Trash2, ChevronRight,
  Search, MapPin, Image, Box, FileText, StickyNote, GripVertical,
} from 'lucide-react'
import { useStoryStore } from '@/stores/storyStore'
import { useAssetStore } from '@/stores/assetStore'
import { detectEntryTypeFromFormat } from '@/services/api'
import { formatFileSize } from '@/utils/storage'
import type { FileMetadata } from '@/services/api'
import type { SceneEntryType } from '@/types/story'

interface SceneNavigatorProps {
  onAssetSelect?: (file: FileMetadata) => void
}

const ENTRY_TYPE_ICON: Record<SceneEntryType, typeof Box> = {
  spatial: Box,
  visual: Image,
  document: FileText,
  note: StickyNote,
}

const ENTRY_TYPE_ICON_COLOR: Record<SceneEntryType, string> = {
  spatial: 'text-blue-400',
  visual: 'text-green-400',
  document: 'text-purple-400',
  note: 'text-amber-400',
}

export default function SceneNavigator({ onAssetSelect }: SceneNavigatorProps) {
  const {
    scenes, activeSceneId, entries,
    addScene, deleteScene, reorderScenes, setActiveScene,
    addEntry,
  } = useStoryStore()
  const { files } = useAssetStore()

  const [newSceneTitle, setNewSceneTitle] = useState('')
  const [showAddScene, setShowAddScene] = useState(false)
  const [assetBrowserOpen, setAssetBrowserOpen] = useState(false)
  const [assetSearch, setAssetSearch] = useState('')

  const handleAddScene = async () => {
    if (!newSceneTitle.trim()) return
    await addScene(newSceneTitle.trim())
    setNewSceneTitle('')
    setShowAddScene(false)
  }

  const handleMoveScene = async (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= scenes.length) return
    const ids = scenes.map(s => s.id)
    ;[ids[index], ids[newIndex]] = [ids[newIndex]!, ids[index]!]
    await reorderScenes(ids)
  }

  const handleDeleteScene = async (id: string) => {
    if (!window.confirm('이 Scene을 삭제하시겠습니까?')) return
    await deleteScene(id)
  }

  const handleAddAssetToScene = async (file: FileMetadata) => {
    if (!activeSceneId) return
    const entryType = detectEntryTypeFromFormat(file.format)
    const gps = file.gps
      ? { latitude: file.gps.latitude, longitude: file.gps.longitude }
      : (file.spatialInfo?.center?.latitude != null && file.spatialInfo?.center?.longitude != null)
        ? { latitude: file.spatialInfo!.center!.latitude!, longitude: file.spatialInfo!.center!.longitude! }
        : null
    await addEntry(activeSceneId, {
      entryType,
      fileId: file.id,
      title: file.name,
      gps,
    })
  }

  const handleDragStart = (e: React.DragEvent, file: FileMetadata) => {
    const gps = file.gps
      ? { latitude: file.gps.latitude, longitude: file.gps.longitude }
      : (file.spatialInfo?.center?.latitude != null && file.spatialInfo?.center?.longitude != null)
        ? { latitude: file.spatialInfo!.center!.latitude!, longitude: file.spatialInfo!.center!.longitude! }
        : null
    e.dataTransfer.setData('application/spatial-log-file', JSON.stringify({
      fileId: file.id,
      format: file.format,
      name: file.name,
      gps,
    }))
    e.dataTransfer.effectAllowed = 'copy'
  }

  const filteredAssets = files.filter(f => {
    if (assetSearch && !f.name.toLowerCase().includes(assetSearch.toLowerCase())) return false
    return true
  })

  const getAssetIcon = (format: string) => {
    const entryType = detectEntryTypeFromFormat(format)
    const IconComponent = ENTRY_TYPE_ICON[entryType]
    const iconColor = ENTRY_TYPE_ICON_COLOR[entryType]
    return <IconComponent size={12} className={iconColor} />
  }

  return (
    <div className="w-72 h-full bg-slate-900 border-r border-slate-700 flex flex-col flex-shrink-0">
      {/* Scene 목록 헤더 */}
      <div className="p-3 border-b border-slate-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Scenes</span>
          <button
            onClick={() => setShowAddScene(!showAddScene)}
            className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
          >
            <Plus size={14} />
          </button>
        </div>
        {showAddScene && (
          <div className="flex gap-1">
            <input
              autoFocus
              value={newSceneTitle}
              onChange={(e) => setNewSceneTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddScene()
                if (e.key === 'Escape') { setShowAddScene(false); setNewSceneTitle('') }
              }}
              placeholder="Scene 제목"
              className="flex-1 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={handleAddScene}
              disabled={!newSceneTitle.trim()}
              className="px-2 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded text-xs"
            >
              추가
            </button>
          </div>
        )}
      </div>

      {/* Scene 목록 */}
      <div className="flex-1 overflow-auto">
        {scenes.length === 0 ? (
          <div className="p-4 text-center text-slate-500 text-xs">
            Scene을 추가하여 시작하세요
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {scenes.map((scene, index) => {
              const isActive = scene.id === activeSceneId
              const entryCount = entries.get(scene.id)?.length ?? 0
              return (
                <div
                  key={scene.id}
                  onClick={() => setActiveScene(scene.id)}
                  className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                    isActive
                      ? 'bg-blue-500/20 border-l-2 border-blue-400'
                      : 'hover:bg-slate-800 border-l-2 border-transparent'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white truncate">{scene.title}</div>
                    {scene.zoneLabel && (
                      <div className="text-[10px] text-blue-400/70 truncate">{scene.zoneLabel}</div>
                    )}
                    <div className="text-[10px] text-slate-500">{entryCount}개 엔트리</div>
                  </div>

                  {/* 정렬 + 삭제 버튼 (hover) */}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleMoveScene(index, 'up') }}
                      disabled={index === 0}
                      className="p-0.5 hover:bg-slate-700 rounded disabled:opacity-30 text-slate-400"
                    >
                      <ChevronUp size={12} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleMoveScene(index, 'down') }}
                      disabled={index === scenes.length - 1}
                      className="p-0.5 hover:bg-slate-700 rounded disabled:opacity-30 text-slate-400"
                    >
                      <ChevronDown size={12} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteScene(scene.id) }}
                      className="p-0.5 hover:bg-red-500/20 rounded text-slate-400 hover:text-red-400"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 에셋 브라우저 (접기 섹션) */}
      <div className="border-t border-slate-700">
        <button
          onClick={() => setAssetBrowserOpen(!assetBrowserOpen)}
          className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:bg-slate-800"
        >
          <span>에셋 브라우저</span>
          <ChevronRight
            size={14}
            className={`transition-transform ${assetBrowserOpen ? 'rotate-90' : ''}`}
          />
        </button>

        {assetBrowserOpen && (
          <div className="p-2 max-h-64 overflow-auto">
            {/* 검색 */}
            <div className="relative mb-2">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="에셋 검색..."
                value={assetSearch}
                onChange={(e) => setAssetSearch(e.target.value)}
                className="w-full pl-7 pr-2 py-1 bg-slate-800 border border-slate-600 rounded text-[11px] text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* 에셋 목록 */}
            <div className="space-y-1">
              {filteredAssets.slice(0, 50).map(file => (
                <div
                  key={file.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-800 cursor-pointer group"
                  onClick={() => onAssetSelect?.(file)}
                  draggable
                  onDragStart={(e) => handleDragStart(e, file)}
                >
                  <div className="flex-shrink-0 opacity-0 group-hover:opacity-50 cursor-grab">
                    <GripVertical size={10} className="text-slate-500" />
                  </div>
                  <div className="flex-shrink-0">
                    {getAssetIcon(file.format)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] text-slate-200 truncate">{file.name}</div>
                    <div className="flex items-center gap-1 text-[9px] text-slate-500">
                      <span className="uppercase">{file.format}</span>
                      <span>{formatFileSize(file.size)}</span>
                      {file.gps && <MapPin size={8} className="text-green-400" />}
                    </div>
                  </div>
                  {activeSceneId && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleAddAssetToScene(file)
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 bg-blue-600 hover:bg-blue-500 rounded text-white transition-opacity"
                      title="Scene에 추가"
                    >
                      <Plus size={10} />
                    </button>
                  )}
                </div>
              ))}
              {filteredAssets.length === 0 && (
                <div className="text-center text-[10px] text-slate-500 py-4">에셋 없음</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
