import { useState, useRef, useEffect } from 'react'
import { X, Tag } from 'lucide-react'
import { Modal } from '@/components/common'
import { isSystemTag, getUserTags } from '@/constants/tags'

interface TagEditModalProps {
  isOpen: boolean
  onClose: () => void
  fileIds: string[]
  currentTags: string[]
  allTags: string[]
  onSave: (fileIds: string[], tags: string[]) => Promise<void>
}

export default function TagEditModal({
  isOpen,
  onClose,
  fileIds,
  currentTags,
  allTags,
  onSave,
}: TagEditModalProps) {
  const [tags, setTags] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // 시스템 태그 제외
  const visibleTags = getUserTags(tags)
  const systemTags = tags.filter(isSystemTag)

  useEffect(() => {
    if (isOpen) {
      setTags([...currentTags])
      setInput('')
      setSuggestions([])
    }
  }, [isOpen, currentTags])

  useEffect(() => {
    if (input.trim()) {
      const lower = input.toLowerCase()
      const filtered = allTags.filter(
        t => t.toLowerCase().includes(lower) &&
          !tags.includes(t) &&
          !isSystemTag(t)
      )
      setSuggestions(filtered.slice(0, 5))
    } else {
      setSuggestions([])
    }
  }, [input, tags, allTags])

  const addTag = (tag: string) => {
    const trimmed = tag.trim()
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed])
    }
    setInput('')
    setSuggestions([])
    inputRef.current?.focus()
  }

  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && input.trim()) {
      e.preventDefault()
      addTag(input)
    }
    if (e.key === 'Backspace' && !input && visibleTags.length > 0) {
      removeTag(visibleTags[visibleTags.length - 1]!)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      // 시스템 태그 보존 + 사용자 태그
      const finalTags = [...systemTags, ...visibleTags]
      await onSave(fileIds, finalTags)
      onClose()
    } finally {
      setIsSaving(false)
    }
  }

  const isBatch = fileIds.length > 1

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isBatch ? `${fileIds.length}개 파일 태그 편집` : '태그 편집'}>
      <div className="space-y-4">
        {/* 현재 태그 */}
        <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 bg-slate-800 border border-slate-700 rounded-lg">
          {visibleTags.map(tag => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-sm"
            >
              <Tag size={12} />
              {tag}
              <button onClick={() => removeTag(tag)} className="hover:text-white">
                <X size={12} />
              </button>
            </span>
          ))}
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={visibleTags.length === 0 ? '태그 입력...' : ''}
            className="flex-1 min-w-[80px] bg-transparent text-sm text-white placeholder-slate-500 outline-none"
          />
        </div>

        {/* 자동완성 */}
        {suggestions.length > 0 && (
          <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
            {suggestions.map(s => (
              <button
                key={s}
                onClick={() => addTag(s)}
                className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {isBatch && (
          <p className="text-xs text-slate-500">
            일괄 편집: 설정한 태그가 선택된 모든 파일에 적용됩니다.
          </p>
        )}

        {/* 액션 */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-400 hover:text-white rounded-lg hover:bg-slate-700"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
          >
            {isSaving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
