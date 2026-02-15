// Row-to-Domain mapper functions

import type { FileRow, FolderRow, StoryRow, SceneRow, SceneEntryRow, ReleaseRow } from '@/lib/database.types'
import type { StoryData, StoryStatus, SceneData, SceneEntryData, SceneEntryType, ReleaseData, ReleaseSnapshot, ReleaseManifest, AccessType, ReleaseStatus } from '@/types/story'
import type { FileMetadata, FolderData } from './types'

export function mapFileRowToMetadata(row: FileRow): FileMetadata {
  return {
    id: row.id,
    name: row.name,
    type: row.mime_type,
    size: row.size,
    format: row.format,
    folderId: row.folder_id,
    projectId: row.project_id,
    storagePath: row.storage_path ?? undefined,
    thumbnailUrl: row.thumbnail_path ?? undefined,
    description: row.description ?? undefined,
    status: (row.status as FileMetadata['status']) ?? 'active',
    assetType: (row.asset_type as FileMetadata['assetType']) ?? 'file',
    url: row.url ?? undefined,
    body: row.body ?? undefined,
    gps: row.gps_latitude && row.gps_longitude
      ? {
          latitude: row.gps_latitude,
          longitude: row.gps_longitude,
          altitude: row.gps_altitude ?? undefined,
        }
      : undefined,
    exif: row.exif_make || row.exif_model || row.exif_datetime
      ? {
          make: row.exif_make ?? undefined,
          model: row.exif_model ?? undefined,
          dateTime: row.exif_datetime ? new Date(row.exif_datetime) : undefined,
        }
      : undefined,
    tags: row.tags ?? undefined,
    // Spatial info (metadata.spatialInfo)
    spatialInfo: row.metadata?.spatialInfo ? {
      epsg: row.metadata.spatialInfo.epsg,
      isGeographic: row.metadata.spatialInfo.isGeographic,
      isKoreaTM: row.metadata.spatialInfo.isKoreaTM,
      bbox: row.metadata.spatialInfo.bbox,
      center: row.metadata.spatialInfo.center,
      pointCount: row.metadata.spatialInfo.vertexCount,
    } : undefined,
    // Conversion status
    conversionStatus: row.conversion_status as FileMetadata['conversionStatus'] ?? undefined,
    conversionProgress: row.conversion_progress ?? undefined,
    convertedPath: row.converted_path ?? undefined,
    conversionError: row.conversion_error ?? undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

export function mapFolderRowToData(row: FolderRow): FolderData {
  return {
    id: row.id,
    name: row.name,
    parentId: row.parent_id,
    color: row.color ?? undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

// localStorage FileMetadata -> api FileMetadata conversion
export function mapLocalFileToMetadata(f: import('@/utils/storage').FileMetadata): FileMetadata {
  return {
    ...f,
    projectId: f.projectId ?? null,
    storagePath: undefined,
    thumbnailUrl: f.thumbnail,
    description: f.description,
    status: (f.status as FileMetadata['status']) ?? 'active',
    assetType: (f.assetType as FileMetadata['assetType']) ?? 'file',
    url: f.url,
    body: f.body,
  }
}

export function mapStoryRowToData(row: StoryRow): StoryData {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: (row.status as StoryStatus) ?? 'draft',
    tags: row.tags ?? [],
    coverFileId: row.cover_file_id,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

export function mapSceneRowToData(row: SceneRow): SceneData {
  return {
    id: row.id,
    storyId: row.story_id,
    title: row.title,
    zoneLabel: row.zone_label ?? null,
    summary: row.summary ?? null,
    sortOrder: row.sort_order,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

export function mapSceneEntryRowToData(row: SceneEntryRow): SceneEntryData {
  return {
    id: row.id,
    sceneId: row.scene_id,
    fileId: row.file_id,
    entryType: (row.entry_type as SceneEntryType) ?? 'note',
    title: row.title,
    body: row.body,
    url: row.url ?? null,
    gps: row.gps_latitude != null && row.gps_longitude != null
      ? { latitude: row.gps_latitude, longitude: row.gps_longitude }
      : null,
    spatialAnchor: row.spatial_anchor ?? null,
    sortOrder: row.sort_order,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

export function mapReleaseRowToData(row: ReleaseRow): ReleaseData {
  return {
    id: row.id,
    storyId: row.story_id,
    version: row.version,
    label: row.label,
    snapshot: row.snapshot as unknown as ReleaseSnapshot,
    manifest: row.manifest as unknown as ReleaseManifest,
    accessType: (row.access_type as AccessType) ?? 'private',
    shareToken: row.share_token,
    status: (row.status as ReleaseStatus) ?? 'active',
    passwordProtected: !!(row as Record<string, unknown>).password_hash,
    expiresAt: (row as Record<string, unknown>).expires_at ? new Date((row as Record<string, unknown>).expires_at as string) : null,
    viewCount: ((row as Record<string, unknown>).view_count as number) ?? 0,
    createdAt: new Date(row.created_at),
  }
}
