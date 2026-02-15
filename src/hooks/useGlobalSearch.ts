import { useState, useEffect, useRef, useCallback } from 'react'
import { globalSearch } from '@/services/api'
import type { FileMetadata } from '@/services/api'
import type { StoryData, ReleaseData } from '@/types/story'

interface GlobalSearchResults {
  files: FileMetadata[]
  stories: StoryData[]
  releases: ReleaseData[]
}

export function useGlobalSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GlobalSearchResults>({ files: [], stories: [], releases: [] })
  const [isOpen, setIsOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  // 300ms debounce + stale 플래그로 경합 조건 방지
  useEffect(() => {
    if (!query.trim()) {
      setResults({ files: [], stories: [], releases: [] })
      setIsOpen(false)
      return
    }

    let stale = false
    const timer = setTimeout(async () => {
      try {
        const res = await globalSearch(query)
        if (stale) return
        setResults(res)
        const hasResults = res.files.length > 0 || res.stories.length > 0 || res.releases.length > 0
        setIsOpen(hasResults)
      } catch {
        if (!stale) setResults({ files: [], stories: [], releases: [] })
      }
    }, 300)

    return () => {
      stale = true
      clearTimeout(timer)
    }
  }, [query])

  // 바깥 클릭 감지
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
    setQuery('')
  }, [])

  return { query, setQuery, results, isOpen, setIsOpen, searchRef, close }
}
