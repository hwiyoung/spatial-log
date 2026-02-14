/**
 * ReleaseCreateDialog - Story를 불변 스냅샷으로 발행하는 다이얼로그
 * Scene 선택 + entryTypeCounts 매니페스트
 */
import { useState, useMemo } from 'react'
import { X, Globe, Lock, AlertTriangle, Loader2, CheckSquare, Square } from 'lucide-react'
import { useStoryStore } from '@/stores/storyStore'
import { useReleaseStore } from '@/stores/releaseStore'
import { useAssetStore } from '@/stores/assetStore'
import type { AccessType, ReleaseSnapshot, ReleaseManifest, SceneEntryType } from '@/types/story'

interface ReleaseCreateDialogProps {
  onClose: () => void
  onSuccess?: (releaseId: string) => void
}

export default function ReleaseCreateDialog({ onClose, onSuccess }: ReleaseCreateDialogProps) {
  const { currentStory, scenes, entries } = useStoryStore()
  const { createRelease } = useReleaseStore()
  const { files } = useAssetStore()

  const [label, setLabel] = useState('')
  const [accessType, setAccessType] = useState<AccessType>('private')
  const [isPublishing, setIsPublishing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedSceneIds, setSelectedSceneIds] = useState<Set<string>>(() => new Set(scenes.map(s => s.id)))

  const toggleScene = (id: string) => {
    setSelectedSceneIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selectedSceneIds.size === scenes.length) {
      setSelectedSceneIds(new Set())
    } else {
      setSelectedSceneIds(new Set(scenes.map(s => s.id)))
    }
  }

  // manifest 계산 + 누락 에셋 검출 (선택된 Scene만)
  const { manifest, missingAssets } = useMemo(() => {
    let totalEntries = 0
    let totalAssets = 0
    const typeCounts: Record<SceneEntryType, number> = { spatial: 0, visual: 0, document: 0, note: 0 }
    const missing: { fileName: string; sceneName: string }[] = []

    scenes.filter(s => selectedSceneIds.has(s.id)).forEach(scene => {
      const sceneEntries = entries.get(scene.id) ?? []
      totalEntries += sceneEntries.length

      sceneEntries.forEach(entry => {
        const t = entry.entryType as SceneEntryType
        if (typeCounts[t] !== undefined) typeCounts[t]++

        if (entry.fileId) {
          totalAssets++
          const file = files.find(f => f.id === entry.fileId)
          if (!file) {
            missing.push({
              fileName: entry.title || entry.fileId,
              sceneName: scene.title,
            })
          }
        }
      })
    })

    return {
      manifest: {
        totalScenes: selectedSceneIds.size,
        totalEntries,
        totalAssets,
        entryTypeCounts: typeCounts,
      } satisfies ReleaseManifest,
      missingAssets: missing,
    }
  }, [scenes, entries, files, selectedSceneIds])

  const handlePublish = async () => {
    if (!currentStory || selectedSceneIds.size === 0) return

    setIsPublishing(true)
    setError(null)

    try {
      // snapshot 생성 (선택된 Scene만)
      const snapshot: ReleaseSnapshot = {
        story: currentStory,
        scenes: scenes
          .filter(s => selectedSceneIds.has(s.id))
          .map(scene => ({
            ...scene,
            entries: entries.get(scene.id) ?? [],
          })),
      }

      const release = await createRelease(
        currentStory.id,
        snapshot,
        manifest,
        { label: label.trim() || undefined, accessType }
      )

      onSuccess?.(release.id)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Release 생성 실패')
    } finally {
      setIsPublishing(false)
    }
  }

  if (!currentStory) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full mx-4 shadow-2xl max-h-[90vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 flex-shrink-0">
          <h2 className="text-lg font-semibold text-white">Release 발행</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* 본문 */}
        <div className="px-6 py-5 space-y-5 overflow-auto flex-1">
          {/* Story 정보 */}
          <div>
            <div className="text-sm text-slate-400 mb-1">Story</div>
            <div className="text-white font-medium">{currentStory.title}</div>
            <div className="text-xs text-slate-500 mt-1">
              {manifest.totalScenes} Scenes · {manifest.totalEntries} Entries · {manifest.totalAssets} Assets
            </div>
          </div>

          {/* Scene 선택 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-slate-400">발행할 Scene 선택</label>
              <button
                onClick={toggleAll}
                className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
              >
                {selectedSceneIds.size === scenes.length ? '전체 해제' : '전체 선택'}
              </button>
            </div>
            <div className="space-y-1 max-h-40 overflow-auto bg-slate-800/50 rounded-lg p-2">
              {scenes.map(scene => {
                const selected = selectedSceneIds.has(scene.id)
                const entryCount = entries.get(scene.id)?.length ?? 0
                return (
                  <label
                    key={scene.id}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                      selected ? 'bg-blue-500/10' : 'hover:bg-slate-700/50'
                    }`}
                  >
                    <button onClick={() => toggleScene(scene.id)} className="flex-shrink-0">
                      {selected
                        ? <CheckSquare size={14} className="text-blue-400" />
                        : <Square size={14} className="text-slate-500" />
                      }
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-white truncate">{scene.title}</div>
                      <div className="text-[10px] text-slate-500 flex items-center gap-1">
                        {scene.zoneLabel && <span className="text-blue-400/70">{scene.zoneLabel} ·</span>}
                        {entryCount} entries
                      </div>
                    </div>
                  </label>
                )
              })}
            </div>
          </div>

          {/* 라벨 */}
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">라벨 (선택)</label>
            <input
              type="text"
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="예: v3 - 최종본"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* 접근 타입 */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">접근 설정</label>
            <div className="space-y-2">
              <label
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  accessType === 'private'
                    ? 'border-blue-500/50 bg-blue-500/10'
                    : 'border-slate-700 hover:border-slate-600'
                }`}
              >
                <input
                  type="radio"
                  name="accessType"
                  checked={accessType === 'private'}
                  onChange={() => setAccessType('private')}
                  className="sr-only"
                />
                <Lock size={16} className="text-slate-400" />
                <div>
                  <div className="text-sm text-white">Private</div>
                  <div className="text-xs text-slate-500">나만 볼 수 있습니다</div>
                </div>
              </label>
              <label
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  accessType === 'public'
                    ? 'border-blue-500/50 bg-blue-500/10'
                    : 'border-slate-700 hover:border-slate-600'
                }`}
              >
                <input
                  type="radio"
                  name="accessType"
                  checked={accessType === 'public'}
                  onChange={() => setAccessType('public')}
                  className="sr-only"
                />
                <Globe size={16} className="text-emerald-400" />
                <div>
                  <div className="text-sm text-white">Public</div>
                  <div className="text-xs text-slate-500">링크를 통해 누구나 열람 가능</div>
                </div>
              </label>
            </div>
          </div>

          {/* 누락 에셋 경고 */}
          {missingAssets.length > 0 && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
              <div className="flex items-center gap-2 text-yellow-400 text-sm font-medium mb-1.5">
                <AlertTriangle size={14} />
                에셋 {missingAssets.length}개를 불러올 수 없습니다
              </div>
              <ul className="text-xs text-yellow-300/70 space-y-0.5">
                {missingAssets.slice(0, 5).map((m, i) => (
                  <li key={i}>· {m.fileName} ({m.sceneName})</li>
                ))}
                {missingAssets.length > 5 && (
                  <li>...외 {missingAssets.length - 5}개</li>
                )}
              </ul>
            </div>
          )}

          {/* 에러 */}
          {error && (
            <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              {error}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-700 flex-shrink-0">
          <button
            onClick={onClose}
            disabled={isPublishing}
            className="px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors"
          >
            취소
          </button>
          <button
            onClick={handlePublish}
            disabled={isPublishing || selectedSceneIds.size === 0}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            {isPublishing ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                발행 중...
              </>
            ) : (
              '발행하기'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
