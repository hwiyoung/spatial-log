/**
 * ReleaseViewer - Release snapshot을 읽기전용으로 렌더링
 * Scene 트리 + Cesium 캔버스 + 에셋 목록 탭
 * 4종 Entry 타입 (spatial/visual/document/note)
 */
import { useState, useCallback, useEffect } from 'react'
import {
  MapPin, ChevronRight,
  Globe, Lock, Calendar, Layers, Database as DatabaseIcon,
  Box, Image, FileText, StickyNote,
} from 'lucide-react'
import CesiumWorkspaceCanvas from '@/components/story/CesiumWorkspaceCanvas'
import EntryBalloonPopup from '@/components/story/EntryBalloonPopup'
import { useAssetStore } from '@/stores/assetStore'
import { getConvertedFileInfo } from '@/utils/previewHelpers'
import { formatFileSize } from '@/utils/storage'
import type { ReleaseData } from '@/types/story'
import type { SceneEntryData, SceneData, SceneEntryType } from '@/types/story'
import type { FileMetadata } from '@/services/api'

type TabKey = 'overview' | 'scene' | 'assets'

interface ReleaseViewerProps {
  release: ReleaseData
  isShared?: boolean
}

const ENTRY_TYPE_CONFIG: Record<SceneEntryType, { icon: typeof Box; color: string; label: string }> = {
  spatial: { icon: Box, color: 'text-blue-400', label: '3D 데이터' },
  visual: { icon: Image, color: 'text-green-400', label: '이미지' },
  document: { icon: FileText, color: 'text-purple-400', label: '문서' },
  note: { icon: StickyNote, color: 'text-amber-400', label: '메모' },
}

function getEntryTypeConfig(type: string) {
  return ENTRY_TYPE_CONFIG[type as SceneEntryType] ?? ENTRY_TYPE_CONFIG.note
}

export default function ReleaseViewer({ release, isShared = false }: ReleaseViewerProps) {
  const { files, initialize: initAssets } = useAssetStore()
  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null)
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null)
  const [activeFile, setActiveFile] = useState<FileMetadata | null>(null)
  const [cesiumDataUrl, setCesiumDataUrl] = useState<string | undefined>()
  const [cesiumDataType, setCesiumDataType] = useState<'3dtiles' | 'glb' | undefined>()
  const [balloonEntry, setBalloonEntry] = useState<SceneEntryData | null>(null)
  const [balloonPosition, setBalloonPosition] = useState<{ x: number; y: number } | null>(null)

  const { snapshot, manifest } = release
  const snapshotScenes = snapshot.scenes ?? []

  useEffect(() => {
    if (!isShared) initAssets()
  }, [initAssets, isShared])

  useEffect(() => {
    if (snapshotScenes.length > 0 && !activeSceneId) {
      setActiveSceneId(snapshotScenes[0]!.id)
    }
  }, [snapshotScenes, activeSceneId])

  const getActiveScene = (): (SceneData & { entries: SceneEntryData[] }) | undefined => {
    return snapshotScenes.find(s => s.id === activeSceneId)
  }

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

  const handleEntryClick = useCallback((entry: SceneEntryData, screenPos?: { x: number; y: number }) => {
    setActiveEntryId(entry.id)
    if (screenPos) {
      setBalloonEntry(entry)
      setBalloonPosition(screenPos)
    }
    if (entry.entryType === 'spatial' && entry.fileId) {
      loadSpatialData(entry.fileId)
      setActiveTab('scene')
    }
  }, [loadSpatialData])

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'overview', label: '개요' },
    { key: 'scene', label: 'Scene 뷰' },
    { key: 'assets', label: '에셋 목록' },
  ]

  // 에셋 목록 (snapshot entries에서 fileId가 있는 것들)
  const assetEntries = snapshotScenes.flatMap(scene =>
    (scene.entries ?? [])
      .filter(e => e.fileId)
      .map(e => ({
        ...e,
        sceneName: scene.title,
        file: files.find(f => f.id === e.fileId),
      }))
  )

  return (
    <div className="flex flex-col h-full">
      {/* 탭 바 */}
      <div className="flex border-b border-slate-700 bg-slate-900/50 flex-shrink-0">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      <div className="flex-1 min-h-0 overflow-auto">
        {activeTab === 'overview' && (
          <div className="p-6 space-y-6">
            {/* 메타 정보 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-800/50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-slate-400 text-xs mb-2">
                  <Calendar size={12} />
                  발행일
                </div>
                <div className="text-white text-sm">
                  {release.createdAt.toLocaleDateString('ko-KR', {
                    year: 'numeric', month: 'long', day: 'numeric',
                  })}
                </div>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-slate-400 text-xs mb-2">
                  {release.accessType === 'public' ? <Globe size={12} /> : <Lock size={12} />}
                  접근
                </div>
                <div className={`text-sm ${
                  release.accessType === 'public' ? 'text-emerald-400' : 'text-slate-300'
                }`}>
                  {release.accessType === 'public' ? 'Public' : 'Private'}
                </div>
              </div>
            </div>

            {/* Manifest */}
            <div className="bg-slate-800/50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-slate-400 text-xs mb-3">
                <Layers size={12} />
                매니페스트
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-xl font-bold text-white">{manifest.totalScenes}</div>
                  <div className="text-xs text-slate-500">Scenes</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-white">{manifest.totalEntries}</div>
                  <div className="text-xs text-slate-500">Entries</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-white">{manifest.totalAssets}</div>
                  <div className="text-xs text-slate-500">Assets</div>
                </div>
              </div>
              {/* Entry 타입별 카운트 */}
              {manifest.entryTypeCounts && (
                <div className="flex items-center justify-center gap-4 mt-3 pt-3 border-t border-slate-700/50">
                  {(Object.entries(manifest.entryTypeCounts) as [SceneEntryType, number][]).map(([type, count]) => {
                    if (count === 0) return null
                    const cfg = getEntryTypeConfig(type)
                    const Icon = cfg.icon
                    return (
                      <div key={type} className="flex items-center gap-1 text-xs">
                        <Icon size={10} className={cfg.color} />
                        <span className="text-slate-400">{count}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Scene 트리 */}
            <div>
              <h3 className="text-sm font-semibold text-white mb-3">Scene 구조</h3>
              <div className="space-y-2">
                {snapshotScenes.map(scene => (
                  <div key={scene.id} className="bg-slate-800/30 rounded-lg p-3">
                    <div className="text-sm font-medium text-white mb-0.5">{scene.title}</div>
                    {scene.zoneLabel && (
                      <div className="text-[10px] text-blue-400/70 mb-2">{scene.zoneLabel}</div>
                    )}
                    <div className="space-y-1 pl-3">
                      {(scene.entries ?? []).map(entry => {
                        const cfg = getEntryTypeConfig(entry.entryType)
                        const Icon = cfg.icon
                        return (
                          <div
                            key={entry.id}
                            onClick={() => handleEntryClick(entry)}
                            className="flex items-center gap-2 text-xs text-slate-400 py-1 px-2 rounded hover:bg-slate-700/50 cursor-pointer transition-colors"
                          >
                            <Icon size={12} className={cfg.color} />
                            <span className="flex-1 truncate">{entry.title || cfg.label}</span>
                            {entry.gps && (
                              <MapPin size={10} className="text-green-400" />
                            )}
                            <ChevronRight size={10} />
                          </div>
                        )
                      })}
                      {(scene.entries ?? []).length === 0 && (
                        <div className="text-xs text-slate-600 italic">엔트리 없음</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'scene' && (
          <div className="flex h-full min-h-0">
            {/* Scene 목록 */}
            <div className="w-56 border-r border-slate-700 overflow-y-auto flex-shrink-0 p-3 space-y-1">
              {snapshotScenes.map(scene => (
                <button
                  key={scene.id}
                  onClick={() => {
                    setActiveSceneId(scene.id)
                    setActiveEntryId(null)
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    activeSceneId === scene.id
                      ? 'bg-blue-500/20 text-blue-400 border-l-2 border-blue-400'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="font-medium truncate">{scene.title}</div>
                  {scene.zoneLabel && (
                    <div className="text-[10px] text-blue-400/70 truncate">{scene.zoneLabel}</div>
                  )}
                  <div className="text-xs text-slate-500 mt-0.5">
                    {(scene.entries ?? []).length} entries
                  </div>
                </button>
              ))}
            </div>

            {/* 캔버스 + Entry 목록 */}
            <div className="flex-1 flex min-w-0">
              {/* 캔버스 — 항상 Cesium */}
              <div className="flex-1 min-w-0 relative">
                <CesiumWorkspaceCanvas
                  dataUrl={cesiumDataUrl}
                  dataType={cesiumDataType}
                  spatialInfo={activeFile?.spatialInfo}
                  entries={getActiveScene()?.entries ?? []}
                  selectedEntryId={activeEntryId}
                  onEntryClick={(entry, screenPos) => handleEntryClick(entry, screenPos)}
                  isCreateMode={false}
                  onMapClick={() => {}}
                />

                {/* Balloon Popup */}
                {balloonEntry && balloonPosition && (
                  <EntryBalloonPopup
                    entry={balloonEntry}
                    position={balloonPosition}
                    file={balloonEntry.fileId ? files.find(f => f.id === balloonEntry.fileId) ?? null : null}
                    onClose={() => {
                      setBalloonEntry(null)
                      setBalloonPosition(null)
                    }}
                    onEdit={() => {}}
                    readOnly
                  />
                )}
              </div>

              {/* Entry 목록 */}
              <div className="w-64 border-l border-slate-700 overflow-y-auto flex-shrink-0 p-3">
                {getActiveScene() && (
                  <>
                    <div className="text-sm font-semibold text-white mb-3">
                      {getActiveScene()!.title}
                    </div>
                    <div className="space-y-1">
                      {(getActiveScene()!.entries ?? []).map(entry => {
                        const cfg = getEntryTypeConfig(entry.entryType)
                        const Icon = cfg.icon
                        return (
                          <div
                            key={entry.id}
                            onClick={() => handleEntryClick(entry)}
                            className={`p-2.5 rounded-lg cursor-pointer transition-colors ${
                              activeEntryId === entry.id
                                ? 'bg-blue-500/10 border border-blue-500/30'
                                : 'hover:bg-slate-800'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <Icon size={14} className={cfg.color + ' flex-shrink-0'} />
                              <span className="text-sm text-slate-200 truncate">
                                {entry.title || cfg.label}
                              </span>
                            </div>
                            {entry.body && (
                              <p className="text-xs text-slate-500 mt-1 line-clamp-2 pl-6">{entry.body}</p>
                            )}
                            {entry.gps && (
                              <div className="flex items-center gap-1 text-xs text-green-400 mt-1 pl-6">
                                <MapPin size={10} />
                                {entry.gps.latitude.toFixed(4)}, {entry.gps.longitude.toFixed(4)}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'assets' && (
          <div className="p-6">
            {assetEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                <DatabaseIcon size={48} className="opacity-30 mb-3" />
                <p className="text-sm">에셋이 없습니다</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 text-slate-400 text-left">
                      <th className="pb-3 pr-4">파일명</th>
                      <th className="pb-3 pr-4">타입</th>
                      <th className="pb-3 pr-4">포맷</th>
                      <th className="pb-3 pr-4">크기</th>
                      <th className="pb-3 pr-4">Scene</th>
                      <th className="pb-3">GPS</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-300">
                    {assetEntries.map(entry => {
                      const cfg = getEntryTypeConfig(entry.entryType)
                      const Icon = cfg.icon
                      return (
                        <tr
                          key={entry.id}
                          className="border-b border-slate-800 hover:bg-slate-800/50 cursor-pointer"
                          onClick={() => handleEntryClick(entry)}
                        >
                          <td className="py-2.5 pr-4">
                            <div className="flex items-center gap-2">
                              <Icon size={14} className={cfg.color + ' flex-shrink-0'} />
                              <span className="truncate max-w-[200px]">
                                {entry.file?.name || entry.title || '알 수 없음'}
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 pr-4">
                            <span className="text-xs text-slate-500">{cfg.label}</span>
                          </td>
                          <td className="py-2.5 pr-4">
                            <span className="px-1.5 py-0.5 bg-slate-700 rounded text-xs">
                              {entry.file?.format?.toUpperCase() || '-'}
                            </span>
                          </td>
                          <td className="py-2.5 pr-4 text-slate-500">
                            {entry.file ? formatFileSize(entry.file.size) : '-'}
                          </td>
                          <td className="py-2.5 pr-4 text-slate-500">{entry.sceneName}</td>
                          <td className="py-2.5">
                            {entry.gps ? (
                              <span className="text-green-400 flex items-center gap-1">
                                <MapPin size={10} />
                                {entry.gps.latitude.toFixed(2)}, {entry.gps.longitude.toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-slate-600">-</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
