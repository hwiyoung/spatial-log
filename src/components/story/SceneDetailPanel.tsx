/**
 * SceneDetailPanel - 우측 패널: Scene 상세 + Entry 목록/생성
 * 4종 Entry 타입 (spatial/visual/document/note) + Scene 메타(zoneLabel, summary) + GPS 상태
 *
 * Orchestrator: SceneHeader, EntryForm, EntryListItem, RelatedAssetsPanel 조합
 */
import { useState, useEffect } from 'react'
import { Layers } from 'lucide-react'
import { useStoryStore } from '@/stores/storyStore'
import { useAssetStore } from '@/stores/assetStore'
import { getRelatedAssetsByZone } from '@/services/api'
import type { FileMetadata } from '@/services/api'
import type { SceneEntryType } from '@/types/story'

import SceneHeader from './scene/SceneHeader'
import EntryForm from './scene/EntryForm'
import EntryListItem from './scene/EntryListItem'
import RelatedAssetsPanel from './scene/RelatedAssetsPanel'

interface SceneDetailPanelProps {
  onEntrySelect?: (entryId: string | null) => void
  onRequestLocate?: (entryId: string) => void
}

export default function SceneDetailPanel({ onEntrySelect, onRequestLocate }: SceneDetailPanelProps) {
  const {
    scenes, activeSceneId, activeEntryId, entries, missingAssetIds,
    updateScene, addEntry, updateEntry, deleteEntry, reorderEntries,
    setActiveEntry,
  } = useStoryStore()

  const { files } = useAssetStore()
  const { currentStory } = useStoryStore()

  const [relatedAssets, setRelatedAssets] = useState<FileMetadata[]>([])
  const [relatedOpen, setRelatedOpen] = useState(false)

  const activeScene = scenes.find(s => s.id === activeSceneId)
  const sceneEntries = activeSceneId ? entries.get(activeSceneId) ?? [] : []

  // 관련 에셋 로드 (zoneLabel 변경 시)
  useEffect(() => {
    if (!activeScene?.zoneLabel || !currentStory || !activeSceneId) {
      setRelatedAssets([])
      return
    }
    getRelatedAssetsByZone(currentStory.id, activeSceneId, activeScene.zoneLabel)
      .then(setRelatedAssets)
      .catch(() => setRelatedAssets([]))
  }, [activeScene?.zoneLabel, activeSceneId, currentStory?.id])

  if (!activeScene) {
    return (
      <div className="w-80 h-full bg-slate-900 border-l border-slate-700 flex items-center justify-center flex-shrink-0">
        <p className="text-sm text-slate-500">Scene을 선택하세요</p>
      </div>
    )
  }

  const handleAddEntry = async (data: {
    entryType: SceneEntryType
    fileId: string | null
    title: string | null
    body: string | null
    url: string | null
    gps: { latitude: number; longitude: number } | null
  }) => {
    if (!activeSceneId) return
    await addEntry(activeSceneId, data)
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

  const handleSaveEntryTitle = async (id: string, updates: Partial<Pick<import('@/types/story').SceneEntryData, 'title'>>) => {
    if (updates.title?.trim()) {
      await updateEntry(id, { title: updates.title.trim() })
    }
  }

  const handleEntryClick = (id: string) => {
    setActiveEntry(id)
    onEntrySelect?.(id)
  }

  const handleAddAssetEntry = async (file: FileMetadata, entryType: SceneEntryType) => {
    if (!activeSceneId) return
    const center = file.spatialInfo?.center
    const gps = file.gps
      ? { latitude: file.gps.latitude, longitude: file.gps.longitude }
      : (center?.latitude != null && center?.longitude != null)
        ? { latitude: center.latitude, longitude: center.longitude }
        : null
    await addEntry(activeSceneId, {
      entryType,
      fileId: file.id,
      title: file.name,
      gps,
    })
  }

  return (
    <div className="w-80 h-full bg-slate-900 border-l border-slate-700 flex flex-col flex-shrink-0">
      {/* Scene 제목 + 메타데이터 */}
      <SceneHeader
        scene={activeScene}
        entryCount={sceneEntries.length}
        onUpdateScene={updateScene}
      />

      {/* Entry 추가 폼 */}
      <EntryForm
        files={files}
        onAddEntry={handleAddEntry}
      />

      {/* Entry 목록 */}
      <div className="flex-1 overflow-auto p-2">
        {sceneEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
            <Layers size={28} className="text-slate-600 mb-2" />
            <p className="text-sm text-slate-400 mb-1">이 Scene에 재료를 추가하세요</p>
            <p className="text-xs text-slate-500">위 버튼이나 좌측 에셋 브라우저에서 드래그하세요</p>
          </div>
        ) : (
          <div className="space-y-1">
            {sceneEntries.map((entry, index) => (
              <EntryListItem
                key={entry.id}
                entry={entry}
                index={index}
                totalCount={sceneEntries.length}
                isActive={entry.id === activeEntryId}
                isMissing={!!(entry.fileId && missingAssetIds.has(entry.fileId))}
                onEntryClick={handleEntryClick}
                onMoveEntry={handleMoveEntry}
                onDeleteEntry={handleDeleteEntry}
                onUpdateEntry={handleSaveEntryTitle}
                onRequestLocate={onRequestLocate}
              />
            ))}
          </div>
        )}
      </div>

      {/* 관련 에셋 추천 (zoneLabel 있을 때만) */}
      {activeScene?.zoneLabel && (
        <RelatedAssetsPanel
          relatedAssets={relatedAssets}
          isOpen={relatedOpen}
          onToggleOpen={() => setRelatedOpen(!relatedOpen)}
          onAddAssetEntry={handleAddAssetEntry}
        />
      )}
    </div>
  )
}
