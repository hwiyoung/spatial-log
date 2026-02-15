// Story + Scene + Entry CRUD

import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase'
import { generateId } from '@/utils/storage'
import type { StoryRow, SceneRow, SceneEntryRow } from '@/lib/database.types'
import type { StoryData, SceneData, SceneEntryData, SceneEntryType } from '@/types/story'
import type { FileMetadata, StoryInsert, StoryUpdate, SceneInsert, SceneUpdate, SceneEntryInsert, SceneEntryUpdate } from './shared/types'
import { mapStoryRowToData, mapSceneRowToData, mapSceneEntryRowToData, mapFileRowToMetadata } from './shared/mappers'
import { getLocalItems, setLocalItems, STORIES_KEY, SCENES_KEY, SCENE_ENTRIES_KEY, RELEASES_KEY } from './shared/utils'
import { getFiles } from './asset'
import type { FileRow } from '@/lib/database.types'

/** Detect entry type from file format */
export function detectEntryTypeFromFormat(format: string): SceneEntryType {
  const spatialFormats = ['gltf', 'glb', 'obj', 'fbx', 'ply', 'las', 'e57', '3dtiles', 'splat']
  if (spatialFormats.includes(format)) return 'spatial'
  if (format === 'image') return 'visual'
  return 'document'
}

// === Story CRUD ===

export async function createStory(
  title: string,
  description: string | null = null,
  tags: string[] = []
): Promise<StoryData> {
  if (!isSupabaseConfigured()) {
    const now = new Date()
    const story: StoryData = {
      id: generateId(),
      title,
      description,
      status: 'draft',
      tags,
      coverFileId: null,
      createdAt: now,
      updatedAt: now,
    }
    const items = getLocalItems<StoryData>(STORIES_KEY)
    items.unshift(story)
    setLocalItems(STORIES_KEY, items)
    return story
  }

  const supabase = getSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const insertData: StoryInsert = {
    title,
    description,
    tags,
    user_id: user?.id ?? null,
  }

  const { data, error } = await supabase
    .from('stories')
    .insert(insertData as never)
    .select()
    .single()

  if (error || !data) {
    throw new Error(`Story 생성 실패: ${error?.message}`)
  }

  return mapStoryRowToData(data as StoryRow)
}

export async function getStories(): Promise<StoryData[]> {
  if (!isSupabaseConfigured()) {
    return getLocalItems<StoryData>(STORIES_KEY)
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('stories')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) {
    throw new Error(`Story 목록 조회 실패: ${error.message}`)
  }

  return ((data || []) as StoryRow[]).map(mapStoryRowToData)
}

export async function getSceneCountsByStories(storyIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  if (storyIds.length === 0) return counts

  if (!isSupabaseConfigured()) {
    const scenes = getLocalItems<SceneData>(SCENES_KEY)
    for (const id of storyIds) {
      counts.set(id, scenes.filter(s => s.storyId === id).length)
    }
    return counts
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('scenes')
    .select('story_id')
    .in('story_id', storyIds)

  if (error) {
    console.error('Scene count 조회 실패:', error.message)
    return counts
  }

  for (const row of ((data || []) as Array<{ story_id: string }>)) {
    counts.set(row.story_id, (counts.get(row.story_id) || 0) + 1)
  }
  return counts
}

export async function getStory(id: string): Promise<StoryData | null> {
  if (!isSupabaseConfigured()) {
    const items = getLocalItems<StoryData>(STORIES_KEY)
    return items.find(s => s.id === id) ?? null
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('stories')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) return null
  return mapStoryRowToData(data as StoryRow)
}

export async function updateStory(
  id: string,
  updates: Partial<Pick<StoryData, 'title' | 'description' | 'status' | 'tags' | 'coverFileId'>>
): Promise<StoryData | null> {
  if (!isSupabaseConfigured()) {
    const items = getLocalItems<StoryData>(STORIES_KEY)
    const idx = items.findIndex(s => s.id === id)
    if (idx === -1) return null
    const current = items[idx]!
    const updated = { ...current, ...updates, updatedAt: new Date() }
    items[idx] = updated
    setLocalItems(STORIES_KEY, items)
    return updated
  }

  const supabase = getSupabaseClient()
  const updateData: StoryUpdate = {
    title: updates.title,
    description: updates.description,
    status: updates.status,
    tags: updates.tags,
    cover_file_id: updates.coverFileId,
  }

  const { data, error } = await supabase
    .from('stories')
    .update(updateData as never)
    .eq('id', id)
    .select()
    .single()

  if (error || !data) return null
  return mapStoryRowToData(data as StoryRow)
}

export async function deleteStory(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    const stories = getLocalItems<StoryData>(STORIES_KEY)
    setLocalItems(STORIES_KEY, stories.filter(s => s.id !== id))

    const scenes = getLocalItems<SceneData>(SCENES_KEY)
    const sceneIds = scenes.filter(s => s.storyId === id).map(s => s.id)
    setLocalItems(SCENES_KEY, scenes.filter(s => s.storyId !== id))

    const entries = getLocalItems<SceneEntryData>(SCENE_ENTRIES_KEY)
    setLocalItems(SCENE_ENTRIES_KEY, entries.filter(e => !sceneIds.includes(e.sceneId)))

    const releases = getLocalItems<import('@/types/story').ReleaseData>(RELEASES_KEY)
    setLocalItems(RELEASES_KEY, releases.filter(r => r.storyId !== id))
    return
  }

  const supabase = getSupabaseClient()
  const { error } = await supabase.from('stories').delete().eq('id', id)
  if (error) {
    throw new Error(`Story 삭제 실패: ${error.message}`)
  }
}

// === Scene CRUD ===

export async function getScenesByStory(storyId: string): Promise<SceneData[]> {
  if (!isSupabaseConfigured()) {
    return getLocalItems<SceneData>(SCENES_KEY)
      .filter(s => s.storyId === storyId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('scenes')
    .select('*')
    .eq('story_id', storyId)
    .order('sort_order', { ascending: true })

  if (error) {
    throw new Error(`Scene 목록 조회 실패: ${error.message}`)
  }

  return ((data || []) as SceneRow[]).map(mapSceneRowToData)
}

export async function createScene(
  storyId: string,
  title: string,
  sortOrder?: number,
  options?: { zoneLabel?: string | null; summary?: string | null }
): Promise<SceneData> {
  if (!isSupabaseConfigured()) {
    const items = getLocalItems<SceneData>(SCENES_KEY)
    const existingScenes = items.filter(s => s.storyId === storyId)
    const now = new Date()
    const scene: SceneData = {
      id: generateId(),
      storyId,
      title,
      zoneLabel: options?.zoneLabel ?? null,
      summary: options?.summary ?? null,
      sortOrder: sortOrder ?? existingScenes.length,
      createdAt: now,
      updatedAt: now,
    }
    items.push(scene)
    setLocalItems(SCENES_KEY, items)
    return scene
  }

  const supabase = getSupabaseClient()

  let order = sortOrder
  if (order === undefined) {
    const { data: existing } = await supabase
      .from('scenes')
      .select('sort_order')
      .eq('story_id', storyId)
      .order('sort_order', { ascending: false })
      .limit(1)
    const first = existing?.[0] as { sort_order: number } | undefined
    order = first ? first.sort_order + 1 : 0
  }

  const insertData: SceneInsert = {
    story_id: storyId,
    title,
    zone_label: options?.zoneLabel ?? null,
    summary: options?.summary ?? null,
    sort_order: order,
  }

  const { data, error } = await supabase
    .from('scenes')
    .insert(insertData as never)
    .select()
    .single()

  if (error || !data) {
    throw new Error(`Scene 생성 실패: ${error?.message}`)
  }

  return mapSceneRowToData(data as SceneRow)
}

export async function updateScene(
  id: string,
  updates: Partial<Pick<SceneData, 'title' | 'sortOrder' | 'zoneLabel' | 'summary'>>
): Promise<SceneData | null> {
  if (!isSupabaseConfigured()) {
    const items = getLocalItems<SceneData>(SCENES_KEY)
    const idx = items.findIndex(s => s.id === id)
    if (idx === -1) return null
    const current = items[idx]!
    if (updates.title !== undefined) current.title = updates.title
    if (updates.sortOrder !== undefined) current.sortOrder = updates.sortOrder
    if (updates.zoneLabel !== undefined) current.zoneLabel = updates.zoneLabel
    if (updates.summary !== undefined) current.summary = updates.summary
    current.updatedAt = new Date()
    setLocalItems(SCENES_KEY, items)
    return current
  }

  const supabase = getSupabaseClient()
  const updateData: SceneUpdate = {
    title: updates.title,
    sort_order: updates.sortOrder,
    zone_label: updates.zoneLabel,
    summary: updates.summary,
  }

  const { data, error } = await supabase
    .from('scenes')
    .update(updateData as never)
    .eq('id', id)
    .select()
    .single()

  if (error || !data) return null
  return mapSceneRowToData(data as SceneRow)
}

export async function deleteScene(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    const scenes = getLocalItems<SceneData>(SCENES_KEY)
    setLocalItems(SCENES_KEY, scenes.filter(s => s.id !== id))
    const entries = getLocalItems<SceneEntryData>(SCENE_ENTRIES_KEY)
    setLocalItems(SCENE_ENTRIES_KEY, entries.filter(e => e.sceneId !== id))
    return
  }

  const supabase = getSupabaseClient()
  const { error } = await supabase.from('scenes').delete().eq('id', id)
  if (error) {
    throw new Error(`Scene 삭제 실패: ${error.message}`)
  }
}

export async function reorderScenes(storyId: string, orderedIds: string[]): Promise<void> {
  if (!isSupabaseConfigured()) {
    const items = getLocalItems<SceneData>(SCENES_KEY)
    orderedIds.forEach((id, index) => {
      const scene = items.find(s => s.id === id)
      if (scene) scene.sortOrder = index
    })
    setLocalItems(SCENES_KEY, items)
    return
  }

  const supabase = getSupabaseClient()
  const updates = orderedIds.map((id, index) =>
    supabase.from('scenes').update({ sort_order: index } as never).eq('id', id).eq('story_id', storyId)
  )
  await Promise.all(updates)
}

// === Scene Entry CRUD ===

export async function getEntriesByScene(sceneId: string): Promise<SceneEntryData[]> {
  if (!isSupabaseConfigured()) {
    return getLocalItems<SceneEntryData>(SCENE_ENTRIES_KEY)
      .filter(e => e.sceneId === sceneId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('scene_entries')
    .select('*')
    .eq('scene_id', sceneId)
    .order('sort_order', { ascending: true })

  if (error) {
    throw new Error(`Entry 목록 조회 실패: ${error.message}`)
  }

  return ((data || []) as SceneEntryRow[]).map(mapSceneEntryRowToData)
}

export async function getEntriesByStory(storyId: string): Promise<Map<string, SceneEntryData[]>> {
  const result = new Map<string, SceneEntryData[]>()

  if (!isSupabaseConfigured()) {
    const scenes = getLocalItems<SceneData>(SCENES_KEY).filter(s => s.storyId === storyId)
    const entries = getLocalItems<SceneEntryData>(SCENE_ENTRIES_KEY)
    for (const scene of scenes) {
      result.set(
        scene.id,
        entries.filter(e => e.sceneId === scene.id).sort((a, b) => a.sortOrder - b.sortOrder)
      )
    }
    return result
  }

  const supabase = getSupabaseClient()

  const { data: sceneData } = await supabase
    .from('scenes')
    .select('id')
    .eq('story_id', storyId)

  if (!sceneData || sceneData.length === 0) return result

  const sceneIds = (sceneData as { id: string }[]).map(s => s.id)

  const { data, error } = await supabase
    .from('scene_entries')
    .select('*')
    .in('scene_id', sceneIds)
    .order('sort_order', { ascending: true })

  if (error) {
    throw new Error(`Entry 일괄 조회 실패: ${error.message}`)
  }

  for (const sceneId of sceneIds) {
    result.set(sceneId, [])
  }
  for (const row of (data || []) as SceneEntryRow[]) {
    const entry = mapSceneEntryRowToData(row)
    const list = result.get(entry.sceneId) || []
    list.push(entry)
    result.set(entry.sceneId, list)
  }

  return result
}

export async function createSceneEntry(
  sceneId: string,
  entryData: {
    entryType: SceneEntryType
    fileId?: string | null
    title?: string | null
    body?: string | null
    url?: string | null
    gps?: { latitude: number; longitude: number } | null
    spatialAnchor?: { x: number; y: number; z: number } | null
  }
): Promise<SceneEntryData> {
  if (!isSupabaseConfigured()) {
    const items = getLocalItems<SceneEntryData>(SCENE_ENTRIES_KEY)
    const existingEntries = items.filter(e => e.sceneId === sceneId)
    const now = new Date()
    const entry: SceneEntryData = {
      id: generateId(),
      sceneId,
      fileId: entryData.fileId ?? null,
      entryType: entryData.entryType,
      title: entryData.title ?? null,
      body: entryData.body ?? null,
      url: entryData.url ?? null,
      gps: entryData.gps ?? null,
      spatialAnchor: entryData.spatialAnchor ?? null,
      sortOrder: existingEntries.length,
      createdAt: now,
      updatedAt: now,
    }
    items.push(entry)
    setLocalItems(SCENE_ENTRIES_KEY, items)
    return entry
  }

  const supabase = getSupabaseClient()

  const { data: existing } = await supabase
    .from('scene_entries')
    .select('sort_order')
    .eq('scene_id', sceneId)
    .order('sort_order', { ascending: false })
    .limit(1)
  const firstEntry = existing?.[0] as { sort_order: number } | undefined
  const nextOrder = firstEntry ? firstEntry.sort_order + 1 : 0

  const insertData: SceneEntryInsert = {
    scene_id: sceneId,
    entry_type: entryData.entryType,
    file_id: entryData.fileId ?? null,
    title: entryData.title ?? null,
    body: entryData.body ?? null,
    url: entryData.url ?? null,
    gps_latitude: entryData.gps?.latitude ?? null,
    gps_longitude: entryData.gps?.longitude ?? null,
    spatial_anchor: entryData.spatialAnchor ? JSON.parse(JSON.stringify(entryData.spatialAnchor)) : null,
    sort_order: nextOrder,
  }

  const { data, error } = await supabase
    .from('scene_entries')
    .insert(insertData as never)
    .select()
    .single()

  if (error || !data) {
    throw new Error(`Entry 생성 실패: ${error?.message}`)
  }

  return mapSceneEntryRowToData(data as SceneEntryRow)
}

export async function updateSceneEntry(
  id: string,
  updates: Partial<Pick<SceneEntryData, 'title' | 'body' | 'url' | 'gps' | 'spatialAnchor' | 'sortOrder' | 'fileId'>>
): Promise<SceneEntryData | null> {
  if (!isSupabaseConfigured()) {
    const items = getLocalItems<SceneEntryData>(SCENE_ENTRIES_KEY)
    const idx = items.findIndex(e => e.id === id)
    if (idx === -1) return null
    const current = items[idx]!
    if (updates.title !== undefined) current.title = updates.title
    if (updates.body !== undefined) current.body = updates.body
    if (updates.url !== undefined) current.url = updates.url
    if (updates.gps !== undefined) current.gps = updates.gps
    if (updates.spatialAnchor !== undefined) current.spatialAnchor = updates.spatialAnchor
    if (updates.sortOrder !== undefined) current.sortOrder = updates.sortOrder
    if (updates.fileId !== undefined) current.fileId = updates.fileId
    current.updatedAt = new Date()
    setLocalItems(SCENE_ENTRIES_KEY, items)
    return current
  }

  const supabase = getSupabaseClient()
  const updateData: SceneEntryUpdate = {
    title: updates.title,
    body: updates.body,
    url: updates.url,
    gps_latitude: updates.gps !== undefined ? (updates.gps?.latitude ?? null) : undefined,
    gps_longitude: updates.gps !== undefined ? (updates.gps?.longitude ?? null) : undefined,
    spatial_anchor: updates.spatialAnchor !== undefined
      ? (updates.spatialAnchor ? JSON.parse(JSON.stringify(updates.spatialAnchor)) : null)
      : undefined,
    sort_order: updates.sortOrder,
    file_id: updates.fileId,
  }

  const { data, error } = await supabase
    .from('scene_entries')
    .update(updateData as never)
    .eq('id', id)
    .select()
    .single()

  if (error || !data) return null
  return mapSceneEntryRowToData(data as SceneEntryRow)
}

export async function deleteSceneEntry(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    const items = getLocalItems<SceneEntryData>(SCENE_ENTRIES_KEY)
    setLocalItems(SCENE_ENTRIES_KEY, items.filter(e => e.id !== id))
    return
  }

  const supabase = getSupabaseClient()
  const { error } = await supabase.from('scene_entries').delete().eq('id', id)
  if (error) {
    throw new Error(`Entry 삭제 실패: ${error.message}`)
  }
}

export async function reorderEntries(sceneId: string, orderedIds: string[]): Promise<void> {
  if (!isSupabaseConfigured()) {
    const items = getLocalItems<SceneEntryData>(SCENE_ENTRIES_KEY)
    orderedIds.forEach((id, index) => {
      const entry = items.find(e => e.id === id)
      if (entry) entry.sortOrder = index
    })
    setLocalItems(SCENE_ENTRIES_KEY, items)
    return
  }

  const supabase = getSupabaseClient()
  const updates = orderedIds.map((id, index) =>
    supabase.from('scene_entries').update({ sort_order: index } as never).eq('id', id).eq('scene_id', sceneId)
  )
  await Promise.all(updates)
}

// zoneLabel-based related asset recommendation
export async function getRelatedAssetsByZone(
  storyId: string,
  sceneId: string,
  zoneLabel: string
): Promise<FileMetadata[]> {
  if (!zoneLabel.trim()) return []
  const limit = 20

  if (!isSupabaseConfigured()) {
    const scenes = getLocalItems<SceneData>(SCENES_KEY)
    const entries = getLocalItems<SceneEntryData>(SCENE_ENTRIES_KEY)
    const allFiles = await getFiles(undefined, { status: 'all' })
    const fileMap = new Map(allFiles.map(f => [f.id, f]))

    const currentEntries = entries.filter(e => e.sceneId === sceneId)
    const currentFileIds = new Set(currentEntries.map(e => e.fileId).filter(Boolean))

    const resultIds = new Set<string>()
    const result: FileMetadata[] = []

    const addFile = (id: string) => {
      if (resultIds.has(id) || currentFileIds.has(id) || result.length >= limit) return
      const f = fileMap.get(id)
      if (f) { resultIds.add(id); result.push(f) }
    }

    const sameStoryScenes = scenes.filter(s => s.storyId === storyId && s.id !== sceneId && s.zoneLabel === zoneLabel)
    for (const s of sameStoryScenes) {
      entries.filter(e => e.sceneId === s.id && e.fileId).forEach(e => addFile(e.fileId!))
    }

    const otherScenes = scenes.filter(s => s.storyId !== storyId && s.zoneLabel === zoneLabel)
    for (const s of otherScenes) {
      entries.filter(e => e.sceneId === s.id && e.fileId).forEach(e => addFile(e.fileId!))
    }

    const q = zoneLabel.toLowerCase()
    for (const f of allFiles) {
      if (f.name.toLowerCase().includes(q) || f.tags?.some(t => t.toLowerCase().includes(q))) {
        addFile(f.id)
      }
    }

    return result
  }

  const supabase = getSupabaseClient()
  const q = zoneLabel.toLowerCase()

  const { data: currentEntries } = await supabase
    .from('scene_entries').select('file_id').eq('scene_id', sceneId).not('file_id', 'is', null)
  const currentFileIds = new Set((currentEntries as Array<{ file_id: string }> ?? []).map(e => e.file_id))

  const { data: relatedScenes } = await supabase
    .from('scenes').select('id').eq('zone_label', zoneLabel).neq('id', sceneId)
  const relatedSceneIds = (relatedScenes as Array<{ id: string }> ?? []).map(s => s.id)

  const resultIds = new Set<string>()
  if (relatedSceneIds.length > 0) {
    const { data: relatedEntries } = await supabase
      .from('scene_entries').select('file_id').in('scene_id', relatedSceneIds).not('file_id', 'is', null)
    for (const e of (relatedEntries as Array<{ file_id: string }> ?? [])) {
      if (!currentFileIds.has(e.file_id)) resultIds.add(e.file_id)
    }
  }

  const { data: nameMatches } = await supabase
    .from('files').select('id').ilike('name', `%${q}%`).eq('status', 'active').limit(limit)
  for (const f of (nameMatches as Array<{ id: string }> ?? [])) {
    if (!currentFileIds.has(f.id)) resultIds.add(f.id)
  }

  if (resultIds.size === 0) return []
  const ids = [...resultIds].slice(0, limit)
  const { data: files } = await supabase.from('files').select('*').in('id', ids)
  return ((files ?? []) as FileRow[]).map(mapFileRowToMetadata)
}

// Validate missing assets in a Story (entries with fileId but no actual file)
export async function validateStoryAssets(storyId: string): Promise<string[]> {
  if (!isSupabaseConfigured()) {
    const scenes = getLocalItems<SceneData>(SCENES_KEY).filter(s => s.storyId === storyId)
    const entries = getLocalItems<SceneEntryData>(SCENE_ENTRIES_KEY)
    const sceneIds = new Set(scenes.map(s => s.id))
    const storyEntries = entries.filter(e => sceneIds.has(e.sceneId))
    const fileIds = [...new Set(storyEntries.map(e => e.fileId).filter((id): id is string => !!id))]
    if (fileIds.length === 0) return []

    const allFiles = await getFiles(undefined, { status: 'all' })
    const existingIds = new Set(allFiles.map(f => f.id))
    return fileIds.filter(id => !existingIds.has(id))
  }

  const supabase = getSupabaseClient()
  const { data: scenes } = await supabase.from('scenes').select('id').eq('story_id', storyId)
  if (!scenes || scenes.length === 0) return []

  const sceneIds = (scenes as Array<{ id: string }>).map(s => s.id)
  const { data: entryData } = await supabase
    .from('scene_entries')
    .select('file_id')
    .in('scene_id', sceneIds)
    .not('file_id', 'is', null)

  if (!entryData || entryData.length === 0) return []
  const fileIds = [...new Set((entryData as Array<{ file_id: string }>).map(e => e.file_id))]

  const { data: existingFiles } = await supabase.from('files').select('id').in('id', fileIds)
  const existingIds = new Set(((existingFiles ?? []) as Array<{ id: string }>).map(f => f.id))
  return fileIds.filter(id => !existingIds.has(id))
}

// Asset usage count (how many stories use each asset)
export async function getAssetUsageCounts(fileIds: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>()
  if (fileIds.length === 0) return result

  if (!isSupabaseConfigured()) {
    const scenes = getLocalItems<SceneData>(SCENES_KEY)
    const entries = getLocalItems<SceneEntryData>(SCENE_ENTRIES_KEY)
    const sceneStoryMap = new Map<string, string>()
    for (const scene of scenes) {
      sceneStoryMap.set(scene.id, scene.storyId)
    }
    const fileStoryLocal = new Map<string, Set<string>>()
    for (const entry of entries) {
      if (entry.fileId && fileIds.includes(entry.fileId)) {
        const storyId = sceneStoryMap.get(entry.sceneId)
        if (storyId) {
          if (!fileStoryLocal.has(entry.fileId)) {
            fileStoryLocal.set(entry.fileId, new Set())
          }
          fileStoryLocal.get(entry.fileId)!.add(storyId)
        }
      }
    }
    for (const [fileId, storyIds] of fileStoryLocal) {
      result.set(fileId, storyIds.size)
    }
    return result
  }

  const supabase = getSupabaseClient()
  const { data: entries, error } = await supabase
    .from('scene_entries')
    .select('file_id, scenes!inner(story_id)')
    .in('file_id', fileIds)
    .not('file_id', 'is', null)

  if (error || !entries) return result

  const fileStoryMap = new Map<string, Set<string>>()
  for (const row of entries as Array<{ file_id: string; scenes: { story_id: string } }>) {
    if (!row.file_id) continue
    if (!fileStoryMap.has(row.file_id)) {
      fileStoryMap.set(row.file_id, new Set())
    }
    fileStoryMap.get(row.file_id)!.add(row.scenes.story_id)
  }
  for (const [fileId, storyIds] of fileStoryMap) {
    result.set(fileId, storyIds.size)
  }
  return result
}

// === localStorage migration: entry type refactor ===

const MIGRATION_KEY = 'spatial-log-entry-type-migrated'

export function migrateLocalStorageEntryTypes(): void {
  if (window.localStorage.getItem(MIGRATION_KEY)) return

  try {
    // Scene migration: add zoneLabel, summary
    const scenes = getLocalItems<SceneData & { zoneLabel?: string | null; summary?: string | null }>(SCENES_KEY)
    for (const scene of scenes) {
      if (scene.zoneLabel === undefined) scene.zoneLabel = null
      if (scene.summary === undefined) scene.summary = null
    }
    setLocalItems(SCENES_KEY, scenes)

    // Entry migration: asset/memo -> 4 types + url
    const entries = getLocalItems<SceneEntryData & { url?: string | null }>(SCENE_ENTRIES_KEY)
    const files = getLocalItems<{ id: string; format: string }>('spatial-log-files')
    for (const entry of entries) {
      if (entry.url === undefined) entry.url = null
      if ((entry.entryType as string) === 'memo') {
        entry.entryType = 'note'
      } else if ((entry.entryType as string) === 'asset') {
        if (entry.fileId) {
          const file = files.find(f => f.id === entry.fileId)
          entry.entryType = file ? detectEntryTypeFromFormat(file.format) : 'spatial'
        } else {
          entry.entryType = 'note'
        }
      }
    }
    setLocalItems(SCENE_ENTRIES_KEY, entries)

    window.localStorage.setItem(MIGRATION_KEY, '1')
  } catch (err) {
    console.error('localStorage 마이그레이션 실패:', err)
  }
}
