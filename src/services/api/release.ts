// Release CRUD

import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase'
import { generateId } from '@/utils/storage'
import type { ReleaseRow } from '@/lib/database.types'
import type { ReleaseData, ReleaseSnapshot, ReleaseManifest, AccessType } from '@/types/story'
import type { ReleaseInsert } from './shared/types'
import { mapReleaseRowToData } from './shared/mappers'
import { getLocalItems, setLocalItems, RELEASES_KEY } from './shared/utils'

export class ReleaseExpiredError extends Error {
  constructor() { super('Release has expired') }
}

/** Atomic view count increment (fire-and-forget, SECURITY DEFINER RPC for anon access) */
function incrementViewCount(client: ReturnType<typeof getSupabaseClient>, releaseId: string): void {
  // database.types.ts has no RPC signature, so bypass type
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(client as any).rpc('increment_view_count', { release_id: releaseId }).catch((err: unknown) => {
    console.warn('[view_count] increment failed:', err)
  })
}

export async function createRelease(
  storyId: string,
  snapshot: ReleaseSnapshot,
  manifest: ReleaseManifest,
  options: { label?: string; accessType?: AccessType; passwordHash?: string; expiresAt?: Date }
): Promise<ReleaseData> {
  const accessType = options.accessType ?? 'private'
  const shareToken = accessType === 'public' ? generateId() : null

  if (!isSupabaseConfigured()) {
    const items = getLocalItems<ReleaseData>(RELEASES_KEY)
    const existingVersions = items.filter(r => r.storyId === storyId)
    const release: ReleaseData = {
      id: generateId(),
      storyId,
      version: existingVersions.length + 1,
      label: options.label ?? null,
      snapshot,
      manifest,
      accessType,
      shareToken,
      status: 'active',
      passwordProtected: !!options.passwordHash,
      expiresAt: options.expiresAt ?? null,
      viewCount: 0,
      createdAt: new Date(),
    }
    // localStorage: store password hash as separate field (outside ReleaseData type)
    if (options.passwordHash) {
      ;(release as unknown as Record<string, unknown>).passwordHash = options.passwordHash
    }
    items.unshift(release)
    setLocalItems(RELEASES_KEY, items)
    return release
  }

  const supabase = getSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Auto-calculate version
  const { data: existing } = await supabase
    .from('releases')
    .select('version')
    .eq('story_id', storyId)
    .order('version', { ascending: false })
    .limit(1)
  const firstRelease = existing?.[0] as { version: number } | undefined
  const nextVersion = firstRelease ? firstRelease.version + 1 : 1

  const insertData: ReleaseInsert = {
    story_id: storyId,
    user_id: user?.id ?? null,
    version: nextVersion,
    label: options.label ?? null,
    snapshot: JSON.parse(JSON.stringify(snapshot)),
    manifest: JSON.parse(JSON.stringify(manifest)),
    access_type: accessType,
    share_token: shareToken,
  }

  // Password/expiration (if DB columns exist)
  if (options.passwordHash) {
    (insertData as Record<string, unknown>).password_hash = options.passwordHash
  }
  if (options.expiresAt) {
    (insertData as Record<string, unknown>).expires_at = options.expiresAt.toISOString()
  }

  const { data, error } = await supabase
    .from('releases')
    .insert(insertData as never)
    .select()
    .single()

  if (error || !data) {
    throw new Error(`Release 생성 실패: ${error?.message}`)
  }

  return mapReleaseRowToData(data as ReleaseRow)
}

export async function getAllReleases(): Promise<ReleaseData[]> {
  if (!isSupabaseConfigured()) {
    return getLocalItems<ReleaseData>(RELEASES_KEY)
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('releases')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Release 목록 조회 실패: ${error.message}`)
  }

  return ((data || []) as ReleaseRow[]).map(mapReleaseRowToData)
}

export async function getReleasesByStory(storyId: string): Promise<ReleaseData[]> {
  if (!isSupabaseConfigured()) {
    return getLocalItems<ReleaseData>(RELEASES_KEY)
      .filter(r => r.storyId === storyId)
      .sort((a, b) => b.version - a.version)
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('releases')
    .select('*')
    .eq('story_id', storyId)
    .order('version', { ascending: false })

  if (error) {
    throw new Error(`Release 목록 조회 실패: ${error.message}`)
  }

  return ((data || []) as ReleaseRow[]).map(mapReleaseRowToData)
}

export async function getRelease(id: string): Promise<ReleaseData | null> {
  if (!isSupabaseConfigured()) {
    const items = getLocalItems<ReleaseData>(RELEASES_KEY)
    return items.find(r => r.id === id) ?? null
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('releases')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) return null
  return mapReleaseRowToData(data as ReleaseRow)
}

/**
 * Load Release by share token
 * Password protected Release: return metadata only without snapshot (passwordProtected=true)
 * Public Release: return full data
 */
export async function getReleaseByShareToken(token: string): Promise<ReleaseData | null> {
  if (!isSupabaseConfigured()) {
    const items = getLocalItems<ReleaseData>(RELEASES_KEY)
    const release = items.find(r => r.shareToken === token && r.accessType === 'public' && r.status === 'active')
    if (!release) return null
    if (release.expiresAt && new Date(release.expiresAt) < new Date()) throw new ReleaseExpiredError()
    // Password protected: return without snapshot
    if (release.passwordProtected) {
      return { ...release, snapshot: { story: null as never, scenes: [] } }
    }
    release.viewCount = (release.viewCount ?? 0) + 1
    setLocalItems(RELEASES_KEY, items)
    return release
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('releases')
    .select('*')
    .eq('share_token', token)
    .eq('access_type', 'public')
    .eq('status', 'active')
    .single()

  if (error || !data) return null
  const release = mapReleaseRowToData(data as ReleaseRow)
  if (release.expiresAt && release.expiresAt < new Date()) throw new ReleaseExpiredError()

  // Password protected: return without snapshot (server-side verification needed separately)
  if (release.passwordProtected) {
    return { ...release, snapshot: { story: null as never, scenes: [] } }
  }

  // Atomic view count increment (SECURITY DEFINER RPC -- works with anon permissions)
  incrementViewCount(supabase, release.id)
  return release
}

/**
 * Verify password and load full Release data
 * Client sends SHA-256(password) hash
 */
export async function unlockReleaseWithPassword(
  token: string,
  passwordHash: string
): Promise<ReleaseData | null> {
  if (!isSupabaseConfigured()) {
    const items = getLocalItems<ReleaseData>(RELEASES_KEY)
    const release = items.find(r => r.shareToken === token && r.accessType === 'public' && r.status === 'active')
    if (!release) return null
    // localStorage: compare with stored hash
    const storedHash = (release as unknown as Record<string, unknown>).passwordHash as string | undefined
    if (storedHash && storedHash !== passwordHash) return null
    release.viewCount = (release.viewCount ?? 0) + 1
    setLocalItems(RELEASES_KEY, items)
    return release
  }

  const supabase = getSupabaseClient()
  // Password hash match check
  const { data, error } = await supabase
    .from('releases')
    .select('*')
    .eq('share_token', token)
    .eq('access_type', 'public')
    .eq('status', 'active')
    .eq('password_hash', passwordHash)
    .single()

  if (error || !data) return null
  const release = mapReleaseRowToData(data as ReleaseRow)
  if (release.expiresAt && release.expiresAt < new Date()) throw new ReleaseExpiredError()

  // Atomic view count increment (SECURITY DEFINER RPC -- works with anon permissions)
  incrementViewCount(supabase, release.id)
  return release
}

export async function revokeRelease(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    const items = getLocalItems<ReleaseData>(RELEASES_KEY)
    const release = items.find(r => r.id === id)
    if (release) {
      release.status = 'revoked'
      setLocalItems(RELEASES_KEY, items)
    }
    return
  }

  const supabase = getSupabaseClient()
  const { error } = await supabase
    .from('releases')
    .update({ status: 'revoked' } as never)
    .eq('id', id)

  if (error) {
    throw new Error(`Release 취소 실패: ${error.message}`)
  }
}
