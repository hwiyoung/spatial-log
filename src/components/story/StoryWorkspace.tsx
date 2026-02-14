/**
 * StoryWorkspace - Scene 기반 3-Panel 워크스페이스
 * SceneNavigator(좌) | Cesium Canvas(중앙) | SceneDetailPanel(우)
 * 캔버스는 항상 Cesium. 모든 Entry는 공간 위에 존재한다.
 */
import { useState, useCallback, useEffect, useRef } from 'react'
import { X, Globe, MapPinPlus, Box, Image, FileText, StickyNote } from 'lucide-react'
import SceneNavigator from './SceneNavigator'
import SceneDetailPanel from './SceneDetailPanel'
import CesiumWorkspaceCanvas from './CesiumWorkspaceCanvas'
import EntryBalloonPopup from './EntryBalloonPopup'
import ReleaseCreateDialog from '@/components/release/ReleaseCreateDialog'
import { useStoryStore } from '@/stores/storyStore'
import { useAssetStore } from '@/stores/assetStore'
import { getConvertedFileInfo } from '@/utils/previewHelpers'
import { detectEntryTypeFromFormat } from '@/services/api'
import type { FileMetadata } from '@/services/api'
import type { StoryStatus, SceneEntryData, SceneEntryType } from '@/types/story'

const STATUS_OPTIONS: { value: StoryStatus; label: string }[] = [
  { value: 'draft', label: '초안' },
  { value: 'ready', label: '준비됨' },
  { value: 'archived', label: '보관됨' },
]

const STATUS_COLORS: Record<StoryStatus, string> = {
  draft: 'bg-slate-500/20 text-slate-400',
  ready: 'bg-green-500/20 text-green-400',
  archived: 'bg-slate-500/20 text-slate-500',
}

interface StoryWorkspaceProps {
  onClose: () => void
}

export default function StoryWorkspace({ onClose }: StoryWorkspaceProps) {
  const {
    currentStory, entries, activeSceneId, activeEntryId,
    updateStory, setActiveEntry, addEntry, updateEntry,
  } = useStoryStore()
  const { files, initialize: initAssets } = useAssetStore()

  // Cesium data state
  const [cesiumDataUrl, setCesiumDataUrl] = useState<string | undefined>()
  const [cesiumDataType, setCesiumDataType] = useState<'3dtiles' | 'glb' | undefined>()
  const [activeFile, setActiveFile] = useState<FileMetadata | null>(null)

  // Header state
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [showPublishDialog, setShowPublishDialog] = useState(false)

  // Balloon popup state
  const [balloonEntry, setBalloonEntry] = useState<SceneEntryData | null>(null)
  const [balloonPosition, setBalloonPosition] = useState<{ x: number; y: number } | null>(null)

  // Locate mode (GPS 수동 지정)
  const [isLocateMode, setIsLocateMode] = useState(false)
  const [locateTargetEntryId, setLocateTargetEntryId] = useState<string | null>(null)

  // Workflow C: 지도 클릭 우선 추가
  const [isAddFromMapMode, setIsAddFromMapMode] = useState(false)
  const [pendingMapGps, setPendingMapGps] = useState<{ latitude: number; longitude: number } | null>(null)
  const [showMapAddDialog, setShowMapAddDialog] = useState(false)

  // Canvas wrapper ref for drag-drop coordinate mapping
  const canvasWrapperRef = useRef<HTMLDivElement>(null)

  // Init assets
  useEffect(() => {
    initAssets()
  }, [initAssets])

  // Load spatial data when active entry changes
  useEffect(() => {
    if (!activeEntryId) {
      // No entry selected - try first spatial entry with converted data
      const sceneEntries = activeSceneId ? entries.get(activeSceneId) ?? [] : []
      const firstSpatial = sceneEntries.find(e => e.entryType === 'spatial' && e.fileId)
      if (firstSpatial?.fileId) {
        loadSpatialData(firstSpatial.fileId)
      } else {
        clearSpatialData()
      }
      setBalloonEntry(null)
      setBalloonPosition(null)
      return
    }

    // Find the entry
    for (const [, list] of entries) {
      const entry = list.find(e => e.id === activeEntryId)
      if (entry) {
        if (entry.entryType === 'spatial' && entry.fileId) {
          loadSpatialData(entry.fileId)
        } else {
          clearSpatialData()
        }
        break
      }
    }
  }, [activeEntryId, activeSceneId, entries, files])

  const clearSpatialData = useCallback(() => {
    setCesiumDataUrl(undefined)
    setCesiumDataType(undefined)
    setActiveFile(null)
  }, [])

  const loadSpatialData = useCallback((fileId: string) => {
    const file = files.find(f => f.id === fileId)
    if (!file) return
    setActiveFile(file)
    const convertedInfo = getConvertedFileInfo(file)
    if (convertedInfo && file.conversionStatus === 'ready') {
      setCesiumDataUrl(convertedInfo.url)
      setCesiumDataType(convertedInfo.geoDataType as '3dtiles' | 'glb')
    } else {
      setCesiumDataUrl(undefined)
      setCesiumDataType(undefined)
    }
  }, [files])

  // Handle entry click on Cesium marker
  const handleCesiumEntryClick = useCallback((entry: SceneEntryData, screenPos: { x: number; y: number }) => {
    setActiveEntry(entry.id)
    setBalloonEntry(entry)
    setBalloonPosition(screenPos)
    if (entry.entryType === 'spatial' && entry.fileId) {
      loadSpatialData(entry.fileId)
    }
  }, [setActiveEntry, loadSpatialData])

  // Handle map click (for locate mode or add-from-map mode)
  const handleMapClick = useCallback((gps: { latitude: number; longitude: number }) => {
    if (isLocateMode && locateTargetEntryId) {
      // GPS 수동 지정 모드
      updateEntry(locateTargetEntryId, { gps })
      setIsLocateMode(false)
      setLocateTargetEntryId(null)
    } else if (isAddFromMapMode) {
      // 지도 클릭 우선 추가 모드
      setPendingMapGps(gps)
      setShowMapAddDialog(true)
      setIsAddFromMapMode(false)
    }
  }, [isLocateMode, locateTargetEntryId, isAddFromMapMode, updateEntry])

  // Handle locate request from SceneDetailPanel
  const handleRequestLocate = useCallback((entryId: string) => {
    setIsLocateMode(true)
    setLocateTargetEntryId(entryId)
    setBalloonEntry(null)
    setBalloonPosition(null)
  }, [])

  // Handle entry select from SceneDetailPanel
  const handleEntrySelect = useCallback((entryId: string | null) => {
    setActiveEntry(entryId)
    setBalloonEntry(null)
    setBalloonPosition(null)
  }, [setActiveEntry])

  // Handle asset select from SceneNavigator
  const handleAssetSelect = useCallback((file: FileMetadata) => {
    const type = detectEntryTypeFromFormat(file.format)
    if (type === 'spatial') {
      loadSpatialData(file.id)
    }
    // visual/document는 파일 선택만 (Cesium에 로드할 3D 데이터 아님)
  }, [loadSpatialData])

  // Drag-and-drop: Cesium 캔버스에서 GPS 좌표 계산 후 Entry 생성
  const handleFileDrop = useCallback(async (
    data: { fileId: string; format: string; name: string; gps?: { latitude: number; longitude: number } | null },
    dropGps: { latitude: number; longitude: number } | null
  ) => {
    if (!activeSceneId) return
    try {
      const entryType = detectEntryTypeFromFormat(data.format)
      // 우선순위: 드롭 위치 GPS > 파일 메타 GPS > null
      const gps = dropGps ?? data.gps ?? null
      await addEntry(activeSceneId, {
        entryType,
        fileId: data.fileId,
        title: data.name,
        gps,
      })
    } catch (err) {
      console.error('드롭 처리 실패:', err)
    }
  }, [activeSceneId, addEntry])

  // Map-add dialog: Entry 생성 후 우측 패널에서 파일 선택 유도
  const handleMapAddEntry = useCallback(async (type: SceneEntryType) => {
    if (!pendingMapGps || !activeSceneId) return
    const defaultTitles: Record<SceneEntryType, string> = {
      spatial: '새 3D 데이터',
      visual: '새 이미지',
      document: '새 문서',
      note: '새 메모',
    }
    const newEntry = await addEntry(activeSceneId, {
      entryType: type,
      title: defaultTitles[type],
      gps: pendingMapGps,
    })
    setShowMapAddDialog(false)
    setPendingMapGps(null)
    // 생성된 Entry를 선택하여 우측 패널에서 파일 첨부 가능하도록 유도
    if (newEntry) {
      setActiveEntry(newEntry.id)
    }
  }, [pendingMapGps, activeSceneId, addEntry, setActiveEntry])

  // Header actions
  const handleTitleSave = async () => {
    if (currentStory && titleDraft.trim() && titleDraft !== currentStory.title) {
      await updateStory(currentStory.id, { title: titleDraft.trim() })
    }
    setEditingTitle(false)
  }

  const handleStatusChange = async (status: StoryStatus) => {
    if (currentStory) {
      await updateStory(currentStory.id, { status })
    }
    setShowStatusMenu(false)
  }

  if (!currentStory) return null

  const statusColor = STATUS_COLORS[currentStory.status]
  const statusLabel = STATUS_OPTIONS.find(o => o.value === currentStory.status)?.label ?? currentStory.status
  const isCreateMode = isLocateMode || isAddFromMapMode
  const sceneEntries = activeSceneId ? (entries.get(activeSceneId) ?? []) : []

  // Find balloon file for popup
  const balloonFile = balloonEntry?.fileId ? files.find(f => f.id === balloonEntry.fileId) : null

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col">
      {/* 헤더 */}
      <div className="h-12 bg-slate-900 border-b border-slate-700 flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors text-sm"
          >
            &larr;
          </button>

          {editingTitle ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleTitleSave()
                if (e.key === 'Escape') setEditingTitle(false)
              }}
              className="px-2 py-1 bg-slate-800 border border-blue-500 rounded text-sm text-white focus:outline-none w-64"
            />
          ) : (
            <h2
              className="text-sm font-semibold text-white cursor-pointer hover:text-blue-400"
              onClick={() => {
                setTitleDraft(currentStory.title)
                setEditingTitle(true)
              }}
            >
              {currentStory.title}
            </h2>
          )}

          <div className="relative">
            <button
              onClick={() => setShowStatusMenu(!showStatusMenu)}
              className={`px-2 py-0.5 text-[10px] rounded cursor-pointer ${statusColor}`}
            >
              {statusLabel}
            </button>
            {showStatusMenu && (
              <div className="absolute top-6 left-0 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-20 py-1 min-w-[100px]">
                {STATUS_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => handleStatusChange(opt.value)}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-700 ${
                      opt.value === currentStory.status ? 'text-blue-400' : 'text-slate-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* 워크플로우 C: 위치에 추가 */}
          <button
            onClick={() => {
              setIsAddFromMapMode(!isAddFromMapMode)
              setIsLocateMode(false)
              setBalloonEntry(null)
              setBalloonPosition(null)
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors font-medium ${
              isAddFromMapMode
                ? 'bg-orange-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <MapPinPlus size={14} />
            위치에 추가
          </button>
          {currentStory.status !== 'archived' && (
            <button
              onClick={() => setShowPublishDialog(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors font-medium"
            >
              <Globe size={14} />
              Publish
            </button>
          )}
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* 3-Panel 레이아웃 */}
      <div className="flex-1 flex min-h-0">
        {/* 좌측: Scene Navigator */}
        <SceneNavigator onAssetSelect={handleAssetSelect} />

        {/* 중앙: Cesium Canvas (항상) */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div
            ref={canvasWrapperRef}
            className="flex-1 min-h-0 relative"
          >
            <CesiumWorkspaceCanvas
              dataUrl={cesiumDataUrl}
              dataType={cesiumDataType}
              spatialInfo={activeFile?.spatialInfo}
              entries={sceneEntries}
              selectedEntryId={activeEntryId}
              onEntryClick={handleCesiumEntryClick}
              isCreateMode={isCreateMode}
              onMapClick={handleMapClick}
              onFileDrop={handleFileDrop}
            />

            {/* Balloon Popup */}
            {balloonEntry && balloonPosition && !isCreateMode && (
              <EntryBalloonPopup
                entry={balloonEntry}
                position={balloonPosition}
                file={balloonFile ?? null}
                onClose={() => {
                  setBalloonEntry(null)
                  setBalloonPosition(null)
                }}
                onEdit={(entryId) => {
                  setActiveEntry(entryId)
                  setBalloonEntry(null)
                  setBalloonPosition(null)
                }}
              />
            )}

            {/* Locate mode banner */}
            {isLocateMode && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
                <div className="bg-orange-500/20 border border-orange-400/50 rounded-lg px-4 py-2 text-orange-300 text-sm backdrop-blur-sm flex items-center gap-2">
                  지도를 클릭하여 위치를 지정하세요
                  <button
                    onClick={() => { setIsLocateMode(false); setLocateTargetEntryId(null) }}
                    className="ml-2 text-orange-400 hover:text-orange-200"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* Add-from-map mode banner */}
            {isAddFromMapMode && !isLocateMode && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
                <div className="bg-orange-500/20 border border-orange-400/50 rounded-lg px-4 py-2 text-orange-300 text-sm backdrop-blur-sm flex items-center gap-2">
                  지구본을 클릭하여 위치를 선택하세요
                  <button
                    onClick={() => setIsAddFromMapMode(false)}
                    className="ml-2 text-orange-400 hover:text-orange-200"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* Map-add dialog */}
            {showMapAddDialog && pendingMapGps && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
                <div className="bg-slate-900 border border-slate-600 rounded-xl shadow-2xl p-4 min-w-[240px]">
                  <div className="text-sm text-white font-medium mb-1">이 위치에 Entry 추가</div>
                  <div className="text-[10px] text-slate-500 mb-3">
                    {pendingMapGps.latitude.toFixed(6)}, {pendingMapGps.longitude.toFixed(6)}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { type: 'spatial' as const, icon: Box, label: '3D 데이터', color: 'text-blue-400' },
                      { type: 'visual' as const, icon: Image, label: '이미지', color: 'text-green-400' },
                      { type: 'document' as const, icon: FileText, label: '문서', color: 'text-purple-400' },
                      { type: 'note' as const, icon: StickyNote, label: '메모', color: 'text-amber-400' },
                    ]).map(({ type, icon: TypeIcon, label, color }) => (
                      <button
                        key={type}
                        onClick={() => handleMapAddEntry(type)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs text-slate-300 transition-colors"
                      >
                        <TypeIcon size={12} className={color} />
                        {label}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => { setShowMapAddDialog(false); setPendingMapGps(null) }}
                    className="w-full mt-2 px-3 py-1.5 text-xs text-slate-500 hover:text-white transition-colors text-center"
                  >
                    취소
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 우측: Scene Detail Panel */}
        <SceneDetailPanel
          onEntrySelect={handleEntrySelect}
          onRequestLocate={handleRequestLocate}
        />
      </div>

      {/* Release 발행 다이얼로그 */}
      {showPublishDialog && (
        <ReleaseCreateDialog
          onClose={() => setShowPublishDialog(false)}
        />
      )}
    </div>
  )
}
