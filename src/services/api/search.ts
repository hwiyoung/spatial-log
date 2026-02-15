// Global search (Assets, Story, Release)

import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase'
import type { FileRow, StoryRow, ReleaseRow } from '@/lib/database.types'
import type { StoryData, ReleaseData } from '@/types/story'
import type { FileMetadata } from './shared/types'
import { mapFileRowToMetadata, mapStoryRowToData, mapReleaseRowToData } from './shared/mappers'
import { getLocalItems, STORIES_KEY, RELEASES_KEY } from './shared/utils'
import { getFiles } from './asset'

export async function globalSearch(query: string): Promise<{
  files: FileMetadata[]
  stories: StoryData[]
  releases: ReleaseData[]
}> {
  const q = query.trim().toLowerCase()
  if (!q) return { files: [], stories: [], releases: [] }

  if (!isSupabaseConfigured()) {
    const allFiles = await getFiles()
    const files = allFiles
      .filter(f => f.name.toLowerCase().includes(q) || f.tags?.some(t => t.toLowerCase().includes(q)) || f.description?.toLowerCase().includes(q))
      .slice(0, 5)

    const stories = getLocalItems<StoryData>(STORIES_KEY)
      .filter(s => s.title.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q) || s.tags?.some(t => t.toLowerCase().includes(q)))
      .slice(0, 5)

    const releases = getLocalItems<ReleaseData>(RELEASES_KEY)
      .filter(r => r.label?.toLowerCase().includes(q) || r.snapshot?.story?.title?.toLowerCase().includes(q))
      .slice(0, 5)

    return { files, stories, releases }
  }

  const supabase = getSupabaseClient()
  const pattern = `%${q}%`

  // Safe .ilike() usage (.or() string injection prevention)
  const [filesNameRes, filesDescRes, filesTagRes, storiesNameRes, storiesDescRes, releasesRes] = await Promise.all([
    supabase.from('files').select('*').ilike('name', pattern).eq('status', 'active').limit(5),
    supabase.from('files').select('*').ilike('description', pattern).eq('status', 'active').limit(5),
    supabase.from('files').select('*').contains('tags', [q]).eq('status', 'active').limit(5),
    supabase.from('stories').select('*').ilike('title', pattern).limit(5),
    supabase.from('stories').select('*').ilike('description', pattern).limit(5),
    supabase.from('releases').select('*').ilike('label', pattern).eq('status', 'active').limit(5),
  ])

  const filesRes = { data: [...(filesNameRes.data || []), ...(filesDescRes.data || [])] }
  const storiesRes = { data: [...(storiesNameRes.data || []), ...(storiesDescRes.data || [])] }

  // Merge file results (deduplicate)
  const allFileRows = [...(filesRes.data || []), ...(filesTagRes.data || [])] as FileRow[]
  const uniqueFileIds = new Set<string>()
  const uniqueFiles = allFileRows.filter(f => {
    if (uniqueFileIds.has(f.id)) return false
    uniqueFileIds.add(f.id)
    return true
  }).slice(0, 5)

  // Deduplicate Story results
  const allStoryRows = (storiesRes.data || []) as StoryRow[]
  const uniqueStoryIds = new Set<string>()
  const uniqueStories = allStoryRows.filter(s => {
    if (uniqueStoryIds.has(s.id)) return false
    uniqueStoryIds.add(s.id)
    return true
  }).slice(0, 5)

  return {
    files: uniqueFiles.map(mapFileRowToMetadata),
    stories: uniqueStories.map(mapStoryRowToData),
    releases: ((releasesRes.data || []) as ReleaseRow[]).map(mapReleaseRowToData),
  }
}
