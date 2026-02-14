/**
 * StoryList - Story 목록 페이지
 * 카드 그리드 + 검색/필터 + 생성 다이얼로그
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Plus, Search, Loader2, MoreVertical, Trash2, Edit2 } from 'lucide-react'
import { useStoryStore } from '@/stores/storyStore'
import type { StoryData, StoryStatus } from '@/types/story'

const STATUS_BADGE: Record<StoryStatus, { label: string; color: string }> = {
  draft: { label: '초안', color: 'bg-slate-500/20 text-slate-400' },
  ready: { label: '준비됨', color: 'bg-green-500/20 text-green-400' },
  archived: { label: '보관됨', color: 'bg-slate-500/20 text-slate-500' },
}

export default function StoryList() {
  const navigate = useNavigate()
  const { stories, isLoading, sceneCounts, initStories, createStory, deleteStory, updateStory } = useStoryStore()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StoryStatus | 'all'>('all')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [contextMenuId, setContextMenuId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')

  useEffect(() => {
    initStories()
  }, [initStories])

  const filtered = stories.filter((s) => {
    if (statusFilter !== 'all' && s.status !== statusFilter) return false
    if (search && !s.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const handleCreate = async () => {
    if (!newTitle.trim()) return
    try {
      const story = await createStory(newTitle.trim())
      setShowCreateDialog(false)
      setNewTitle('')
      navigate(`/story/${story.id}`)
    } catch {
      // error is set in store
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('이 Story를 삭제하시겠습니까?')) return
    await deleteStory(id)
    setContextMenuId(null)
  }

  const handleRename = async (id: string) => {
    if (!editTitle.trim()) return
    await updateStory(id, { title: editTitle.trim() })
    setEditingId(null)
  }

  const getSceneCount = (story: StoryData): number => {
    return sceneCounts.get(story.id) ?? 0
  }

  return (
    <div className="h-full flex flex-col">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
        <h1 className="text-xl font-bold text-white">Story</h1>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 w-48"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StoryStatus | 'all')}
            className="px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
          >
            <option value="all">전체</option>
            <option value="draft">초안</option>
            <option value="ready">준비됨</option>
            <option value="archived">보관됨</option>
          </select>
          <button
            onClick={() => setShowCreateDialog(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            새 Story
          </button>
        </div>
      </div>

      {/* 컨텐츠 */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 size={32} className="animate-spin text-blue-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-500">
            <BookOpen size={64} className="opacity-30 mb-4" />
            <p className="text-lg mb-2">
              {stories.length === 0 ? '아직 Story가 없습니다' : '검색 결과가 없습니다'}
            </p>
            {stories.length === 0 && (
              <button
                onClick={() => setShowCreateDialog(true)}
                className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm"
              >
                새 Story 만들기
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filtered.map((story) => {
              const badge = STATUS_BADGE[story.status]
              return (
                <div
                  key={story.id}
                  className="group bg-slate-900 rounded-xl border border-slate-700 hover:border-blue-500/50 transition-colors cursor-pointer relative"
                  onClick={() => {
                    if (editingId !== story.id) navigate(`/story/${story.id}`)
                  }}
                >
                  {/* 커버 placeholder */}
                  <div className="h-32 bg-slate-800 rounded-t-xl flex items-center justify-center">
                    <BookOpen size={32} className="text-slate-600" />
                  </div>

                  <div className="p-3">
                    {editingId === story.id ? (
                      <input
                        autoFocus
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onBlur={() => handleRename(story.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRename(story.id)
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full bg-slate-800 border border-blue-500 rounded px-2 py-1 text-sm text-white focus:outline-none"
                      />
                    ) : (
                      <h3 className="text-sm font-medium text-white truncate">{story.title}</h3>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`px-2 py-0.5 text-[10px] rounded ${badge.color}`}>
                        {badge.label}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {new Date(story.updatedAt).toLocaleDateString('ko-KR')}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {getSceneCount(story)} Scene
                      </span>
                    </div>
                  </div>

                  {/* 컨텍스트 메뉴 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setContextMenuId(contextMenuId === story.id ? null : story.id)
                    }}
                    className="absolute top-2 right-2 p-1 rounded hover:bg-slate-700 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MoreVertical size={14} className="text-slate-400" />
                  </button>

                  {contextMenuId === story.id && (
                    <div
                      className="absolute top-8 right-2 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-10 py-1 min-w-[120px]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => {
                          setEditingId(story.id)
                          setEditTitle(story.title)
                          setContextMenuId(null)
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700"
                      >
                        <Edit2 size={14} />
                        이름 변경
                      </button>
                      <button
                        onClick={() => handleDelete(story.id)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-slate-700"
                      >
                        <Trash2 size={14} />
                        삭제
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 생성 다이얼로그 */}
      {showCreateDialog && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm">
            <h2 className="text-lg font-semibold text-white mb-4">새 Story</h2>
            <input
              autoFocus
              type="text"
              placeholder="Story 제목"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowCreateDialog(false); setNewTitle('') }}
                className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleCreate}
                disabled={!newTitle.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
              >
                생성
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
