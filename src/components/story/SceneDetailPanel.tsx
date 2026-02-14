/**
 * SceneDetailPanel - 우측 패널: Scene 상세 + Entry 목록/생성
 * 4종 Entry 타입 (spatial/visual/document/note) + Scene 메타(zoneLabel, summary) + GPS 상태
 */
import { useState } from 'react'
import {
  ChevronUp, ChevronDown, Trash2, Edit2, Check, X,
  Box, Image, FileText, StickyNote, MapPin, MapPinOff, Search, Target,
} from 'lucide-react'
import { useStoryStore } from '@/stores/storyStore'
import { useAssetStore } from '@/stores/assetStore'
import { detectEntryTypeFromFormat } from '@/services/api'
import type { SceneEntryType } from '@/types/story'

interface SceneDetailPanelProps {
  onEntrySelect?: (entryId: string | null) => void
  onRequestLocate?: (entryId: string) => void
}

const ENTRY_TYPES: { type: SceneEntryType; icon: typeof Box; label: string; color: string; fileRequired: boolean }[] = [
  { type: 'spatial', icon: Box, label: 'Spatial', color: 'text-blue-400', fileRequired: true },
  { type: 'visual', icon: Image, label: 'Visual', color: 'text-green-400', fileRequired: true },
  { type: 'document', icon: FileText, label: 'Document', color: 'text-purple-400', fileRequired: true },
  { type: 'note', icon: StickyNote, label: 'Note', color: 'text-amber-400', fileRequired: false },
]

const FILE_FORMAT_FILTERS: Record<string, (format: string) => boolean> = {
  spatial: (f) => ['gltf', 'glb', 'obj', 'fbx', 'ply', 'las', 'e57', '3dtiles', 'splat'].includes(f),
  visual: (f) => f === 'image',
  document: (f) => f === 'other',
}

export default function SceneDetailPanel({ onEntrySelect, onRequestLocate }: SceneDetailPanelProps) {
  const {
    scenes, activeSceneId, activeEntryId, entries,
    updateScene, addEntry, updateEntry, deleteEntry, reorderEntries,
    setActiveEntry,
  } = useStoryStore()

  const [editingSceneTitle, setEditingSceneTitle] = useState(false)
  const [sceneTitleDraft, setSceneTitleDraft] = useState('')
  const [zoneLabelDraft, setZoneLabelDraft] = useState('')
  const [summaryDraft, setSummaryDraft] = useState('')
  const [editingZoneLabel, setEditingZoneLabel] = useState(false)
  const [editingSummary, setEditingSummary] = useState(false)
  const [showAddForm, setShowAddForm] = useState<SceneEntryType | null>(null)
  const [formTitle, setFormTitle] = useState('')
  const [formBody, setFormBody] = useState('')
  const [formUrl, setFormUrl] = useState('')
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [editEntryTitle, setEditEntryTitle] = useState('')
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null)
  const [fileSearch, setFileSearch] = useState('')

  const { files } = useAssetStore()

  const activeScene = scenes.find(s => s.id === activeSceneId)
  const sceneEntries = activeSceneId ? entries.get(activeSceneId) ?? [] : []

  if (!activeScene) {
    return (
      <div className="w-80 h-full bg-slate-900 border-l border-slate-700 flex items-center justify-center flex-shrink-0">
        <p className="text-sm text-slate-500">Scene을 선택하세요</p>
      </div>
    )
  }

  // File list filter based on entry type
  const filteredFiles = files.filter(f => {
    if (fileSearch && !f.name.toLowerCase().includes(fileSearch.toLowerCase())) return false
    if (showAddForm && FILE_FORMAT_FILTERS[showAddForm]) {
      return FILE_FORMAT_FILTERS[showAddForm]!(f.format)
    }
    return true
  })

  const handleSaveSceneTitle = async () => {
    if (sceneTitleDraft.trim() && sceneTitleDraft !== activeScene.title) {
      await updateScene(activeScene.id, { title: sceneTitleDraft.trim() })
    }
    setEditingSceneTitle(false)
  }

  const handleSaveZoneLabel = async () => {
    const val = zoneLabelDraft.trim() || null
    if (val !== (activeScene.zoneLabel ?? null)) {
      await updateScene(activeScene.id, { zoneLabel: val })
    }
    setEditingZoneLabel(false)
  }

  const handleSaveSummary = async () => {
    const val = summaryDraft.trim() || null
    if (val !== (activeScene.summary ?? null)) {
      await updateScene(activeScene.id, { summary: val })
    }
    setEditingSummary(false)
  }

  const resetForm = () => {
    setShowAddForm(null)
    setFormTitle('')
    setFormBody('')
    setFormUrl('')
    setSelectedFileId(null)
    setFileSearch('')
  }

  const handleAddEntry = async () => {
    if (!showAddForm || !activeSceneId) return

    const isFileType = showAddForm !== 'note'
    const selectedFile = isFileType && selectedFileId ? files.find(f => f.id === selectedFileId) : null

    // GPS 추출
    let gps: { latitude: number; longitude: number } | null = null
    if (selectedFile?.gps) {
      gps = { latitude: selectedFile.gps.latitude, longitude: selectedFile.gps.longitude }
    } else if (selectedFile?.spatialInfo?.center?.latitude != null && selectedFile?.spatialInfo?.center?.longitude != null) {
      gps = { latitude: selectedFile.spatialInfo!.center!.latitude!, longitude: selectedFile.spatialInfo!.center!.longitude! }
    }

    const title = formTitle.trim() || (isFileType ? selectedFile?.name ?? null : null)

    await addEntry(activeSceneId, {
      entryType: showAddForm,
      fileId: isFileType ? selectedFileId : null,
      title,
      body: showAddForm === 'note' ? formBody || null : null,
      url: showAddForm === 'note' ? formUrl || null : null,
      gps,
    })

    resetForm()
  }

  const handleMoveEntry = async (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= sceneEntries.length) return
    const ids = sceneEntries.map(e => e.id)
    ;[ids[index], ids[newIndex]] = [ids[newIndex]!, ids[index]!]
    await reorderEntries(activeSceneId!, ids)
  }

  const handleDeleteEntry = async (id: string) => {
    if (!window.confirm('이 Entry를 삭제하시겠습니까?')) return
    await deleteEntry(id)
  }

  const handleSaveEntryTitle = async (id: string) => {
    if (editEntryTitle.trim()) {
      await updateEntry(id, { title: editEntryTitle.trim() })
    }
    setEditingEntryId(null)
  }

  const handleEntryClick = (id: string) => {
    setActiveEntry(id)
    onEntrySelect?.(id)
  }

  const getEntryConfig = (type: SceneEntryType) => {
    return ENTRY_TYPES.find(t => t.type === type) ?? ENTRY_TYPES[3]!
  }

  return (
    <div className="w-80 h-full bg-slate-900 border-l border-slate-700 flex flex-col flex-shrink-0">
      {/* Scene 제목 + 메타데이터 */}
      <div className="p-4 border-b border-slate-700 space-y-2">
        {/* Title */}
        {editingSceneTitle ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={sceneTitleDraft}
              onChange={(e) => setSceneTitleDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveSceneTitle()
                if (e.key === 'Escape') setEditingSceneTitle(false)
              }}
              className="flex-1 px-2 py-1 bg-slate-800 border border-blue-500 rounded text-sm text-white focus:outline-none"
            />
            <button onClick={handleSaveSceneTitle} className="p-1 text-green-400 hover:bg-slate-700 rounded">
              <Check size={14} />
            </button>
            <button onClick={() => setEditingSceneTitle(false)} className="p-1 text-slate-400 hover:bg-slate-700 rounded">
              <X size={14} />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <h3
              className="text-sm font-semibold text-white cursor-pointer hover:text-blue-400"
              onClick={() => {
                setSceneTitleDraft(activeScene.title)
                setEditingSceneTitle(true)
              }}
            >
              {activeScene.title}
            </h3>
            <span className="text-[10px] text-slate-500">{sceneEntries.length}개 엔트리</span>
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
            placeholder="구역 라벨 예: 1층 로비"
            className="w-full px-2 py-1 bg-slate-800 border border-blue-500/50 rounded text-[11px] text-blue-300 placeholder:text-slate-600 focus:outline-none"
          />
        ) : (
          <div
            className="text-[11px] text-blue-400/60 cursor-pointer hover:text-blue-400 transition-colors"
            onClick={() => {
              setZoneLabelDraft(activeScene.zoneLabel ?? '')
              setEditingZoneLabel(true)
            }}
          >
            {activeScene.zoneLabel || '+ 구역 라벨 추가'}
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
            placeholder="한줄 요약"
            className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-[11px] text-slate-300 placeholder:text-slate-600 focus:outline-none"
          />
        ) : (
          <div
            className="text-[11px] text-slate-500 cursor-pointer hover:text-slate-300 transition-colors"
            onClick={() => {
              setSummaryDraft(activeScene.summary ?? '')
              setEditingSummary(true)
            }}
          >
            {activeScene.summary || '+ 한줄 요약 추가'}
          </div>
        )}
      </div>

      {/* 4종 Entry 추가 버튼 (2x2 그리드) */}
      <div className="grid grid-cols-2 gap-1.5 p-3 border-b border-slate-700">
        {ENTRY_TYPES.map(({ type, icon: Icon, label, color }) => (
          <button
            key={type}
            onClick={() => setShowAddForm(showAddForm === type ? null : type)}
            className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium transition-colors ${
              showAddForm === type
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Icon size={12} className={showAddForm === type ? 'text-white' : color} />
            {label}
          </button>
        ))}
      </div>

      {/* 인라인 추가 폼 */}
      {showAddForm && (
        <div className="p-3 border-b border-slate-700 bg-slate-800/50">
          {/* 파일 기반 타입: 파일 선택 */}
          {showAddForm !== 'note' && (
            <div className="mb-2">
              <div className="relative mb-1">
                <Search size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  autoFocus
                  type="text"
                  placeholder="파일 검색..."
                  value={fileSearch}
                  onChange={(e) => setFileSearch(e.target.value)}
                  className="w-full pl-6 pr-2 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-[11px] text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="max-h-32 overflow-auto bg-slate-800 border border-slate-600 rounded-lg">
                {filteredFiles.slice(0, 30).map(file => {
                  const fileEntryType = detectEntryTypeFromFormat(file.format)
                  const cfg = getEntryConfig(fileEntryType)
                  const FileIcon = cfg.icon
                  const hasGps = !!(file.gps || (file.spatialInfo?.center?.latitude != null))
                  return (
                    <button
                      key={file.id}
                      onClick={() => {
                        setSelectedFileId(file.id)
                        if (!formTitle.trim()) setFormTitle(file.name)
                      }}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 text-left text-[11px] transition-colors ${
                        selectedFileId === file.id
                          ? 'bg-blue-500/20 text-blue-300'
                          : 'text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      <FileIcon size={10} className={cfg.color + ' flex-shrink-0'} />
                      <span className="truncate flex-1">{file.name}</span>
                      {hasGps ? (
                        <MapPin size={8} className="text-green-400 flex-shrink-0" />
                      ) : (
                        <MapPinOff size={8} className="text-orange-400/50 flex-shrink-0" />
                      )}
                    </button>
                  )
                })}
                {filteredFiles.length === 0 && (
                  <div className="text-center text-[10px] text-slate-500 py-3">해당 타입 파일 없음</div>
                )}
              </div>
              {/* GPS 상태 표시 */}
              {selectedFileId && (() => {
                const sf = files.find(f => f.id === selectedFileId)
                if (!sf) return null
                const hasGps = !!(sf.gps || (sf.spatialInfo?.center?.latitude != null))
                return hasGps ? (
                  <div className="flex items-center gap-1 mt-1.5 text-[10px] text-green-400">
                    <MapPin size={9} />
                    GPS 자동 추출됨
                    {sf.gps
                      ? ` (${sf.gps.latitude.toFixed(4)}, ${sf.gps.longitude.toFixed(4)})`
                      : ` (${sf.spatialInfo!.center!.latitude!.toFixed(4)}, ${sf.spatialInfo!.center!.longitude!.toFixed(4)})`
                    }
                  </div>
                ) : (
                  <div className="flex items-center gap-1 mt-1.5 text-[10px] text-orange-400">
                    <MapPinOff size={9} />
                    GPS 정보 없음 (저장 후 위치 지정 가능)
                  </div>
                )
              })()}
            </div>
          )}

          {/* 제목 */}
          <input
            type="text"
            placeholder={showAddForm === 'note' ? '메모 제목' : '제목 (선택)'}
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            autoFocus={showAddForm === 'note'}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 mb-2"
          />

          {/* Note: 본문 + URL */}
          {showAddForm === 'note' && (
            <>
              <textarea
                placeholder="메모 내용..."
                value={formBody}
                onChange={(e) => setFormBody(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 mb-2 resize-none"
              />
              <input
                type="text"
                placeholder="URL 링크 (선택)"
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 mb-2"
              />
            </>
          )}

          <div className="flex justify-end gap-2">
            <button
              onClick={resetForm}
              className="px-3 py-1 text-xs text-slate-400 hover:text-white"
            >
              취소
            </button>
            <button
              onClick={handleAddEntry}
              disabled={showAddForm !== 'note' && !selectedFileId}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-xs"
            >
              저장
            </button>
          </div>
        </div>
      )}

      {/* Entry 목록 */}
      <div className="flex-1 overflow-auto p-2">
        {sceneEntries.length === 0 ? (
          <div className="text-center text-slate-500 text-xs py-8">
            위 버튼으로 Entry를 추가하세요
          </div>
        ) : (
          <div className="space-y-1">
            {sceneEntries.map((entry, index) => {
              const isActive = entry.id === activeEntryId
              const cfg = getEntryConfig(entry.entryType)
              const EntryIcon = cfg.icon
              const hasGps = !!entry.gps

              return (
                <div
                  key={entry.id}
                  onClick={() => handleEntryClick(entry.id)}
                  className={`group flex items-start gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                    isActive
                      ? 'bg-blue-500/10 border border-blue-500/30'
                      : 'hover:bg-slate-800 border border-transparent'
                  }`}
                >
                  {/* 타입 아이콘 */}
                  <div className="flex-shrink-0 mt-0.5">
                    <EntryIcon size={14} className={cfg.color} />
                  </div>

                  {/* 내용 */}
                  <div className="flex-1 min-w-0">
                    {editingEntryId === entry.id ? (
                      <input
                        autoFocus
                        value={editEntryTitle}
                        onChange={(e) => setEditEntryTitle(e.target.value)}
                        onBlur={() => handleSaveEntryTitle(entry.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEntryTitle(entry.id)
                          if (e.key === 'Escape') setEditingEntryId(null)
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full bg-slate-800 border border-blue-500 rounded px-2 py-0.5 text-xs text-white focus:outline-none"
                      />
                    ) : (
                      <div className="text-xs text-white truncate">
                        {entry.title || cfg.label}
                      </div>
                    )}
                    {entry.body && (
                      <div className="text-[10px] text-slate-500 truncate mt-0.5">{entry.body}</div>
                    )}
                    {/* GPS 상태 */}
                    {hasGps ? (
                      <div className="flex items-center gap-1 text-[9px] text-green-400 mt-0.5">
                        <MapPin size={8} />
                        {entry.gps!.latitude.toFixed(4)}, {entry.gps!.longitude.toFixed(4)}
                      </div>
                    ) : (
                      <div
                        className="flex items-center gap-1 text-[9px] text-orange-400 mt-0.5 cursor-pointer hover:text-orange-300"
                        onClick={(e) => {
                          e.stopPropagation()
                          onRequestLocate?.(entry.id)
                        }}
                      >
                        <MapPinOff size={8} />
                        위치 미지정
                        <Target size={8} className="ml-0.5" />
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
                        <Target size={10} />
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleMoveEntry(index, 'up') }}
                      disabled={index === 0}
                      className="p-0.5 hover:bg-slate-700 rounded disabled:opacity-30 text-slate-400"
                    >
                      <ChevronUp size={10} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleMoveEntry(index, 'down') }}
                      disabled={index === sceneEntries.length - 1}
                      className="p-0.5 hover:bg-slate-700 rounded disabled:opacity-30 text-slate-400"
                    >
                      <ChevronDown size={10} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingEntryId(entry.id)
                        setEditEntryTitle(entry.title || '')
                      }}
                      className="p-0.5 hover:bg-slate-700 rounded text-slate-400"
                    >
                      <Edit2 size={10} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteEntry(entry.id) }}
                      className="p-0.5 hover:bg-red-500/20 rounded text-slate-400 hover:text-red-400"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
