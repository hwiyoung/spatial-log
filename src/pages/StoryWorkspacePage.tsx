/**
 * StoryWorkspacePage - URL 파라미터로 Story 로드 → 워크스페이스 마운트
 */
import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useStoryStore } from '@/stores/storyStore'
import StoryWorkspace from '@/components/story/StoryWorkspace'

export default function StoryWorkspacePage() {
  const { storyId } = useParams<{ storyId: string }>()
  const navigate = useNavigate()
  const { currentStory, isLoading, error, loadStory } = useStoryStore()

  useEffect(() => {
    if (storyId) {
      loadStory(storyId)
    }
  }, [storyId, loadStory])

  if (isLoading) {
    return (
      <div className="h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-blue-500" />
      </div>
    )
  }

  if (error || !currentStory) {
    return (
      <div className="h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || 'Story를 찾을 수 없습니다.'}</p>
          <button
            onClick={() => navigate('/story')}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
          >
            Story 목록으로
          </button>
        </div>
      </div>
    )
  }

  return <StoryWorkspace onClose={() => navigate('/story')} />
}
