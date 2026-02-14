/**
 * Story / Scene / Entry / Release 타입 정의
 * 3축 아키텍처: Assets(files) → Story(composition) → Publish(release)
 */

// --- Story ---

export type StoryStatus = 'draft' | 'ready' | 'archived'

export interface StoryData {
  id: string
  title: string
  description: string | null
  status: StoryStatus
  tags: string[]
  coverFileId: string | null
  createdAt: Date
  updatedAt: Date
}

// --- Scene ---

export interface SceneData {
  id: string
  storyId: string
  title: string
  zoneLabel: string | null
  summary: string | null
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}

// --- Scene Entry ---

export type SceneEntryType = 'spatial' | 'visual' | 'document' | 'note'

export interface SceneEntryData {
  id: string
  sceneId: string
  fileId: string | null
  entryType: SceneEntryType
  title: string | null
  body: string | null
  url: string | null
  gps: { latitude: number; longitude: number } | null
  spatialAnchor: { x: number; y: number; z: number } | null
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}

// --- Release ---

export type AccessType = 'private' | 'public'
export type ReleaseStatus = 'active' | 'revoked'

export interface ReleaseData {
  id: string
  storyId: string
  version: number
  label: string | null
  snapshot: ReleaseSnapshot
  manifest: ReleaseManifest
  accessType: AccessType
  shareToken: string | null
  status: ReleaseStatus
  createdAt: Date
}

export interface ReleaseSnapshot {
  story: StoryData
  scenes: Array<SceneData & { entries: SceneEntryData[] }>
}

export interface ReleaseManifest {
  totalScenes: number
  totalEntries: number
  totalAssets: number
  entryTypeCounts?: { spatial: number; visual: number; document: number; note: number }
}
