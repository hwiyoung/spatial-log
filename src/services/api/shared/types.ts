// API shared types

import type { InsertTables, UpdateTables } from '@/lib/database.types'

// Insert/Update type aliases
export type FileInsert = InsertTables<'files'>
export type FileUpdate = UpdateTables<'files'>
export type FolderInsert = InsertTables<'folders'>
export type FolderUpdate = UpdateTables<'folders'>
export type StoryInsert = InsertTables<'stories'>
export type StoryUpdate = UpdateTables<'stories'>
export type SceneInsert = InsertTables<'scenes'>
export type SceneUpdate = UpdateTables<'scenes'>
export type SceneEntryInsert = InsertTables<'scene_entries'>
export type SceneEntryUpdate = UpdateTables<'scene_entries'>
export type ReleaseInsert = InsertTables<'releases'>

// Spatial coordinate info
export interface SpatialInfo {
  // Coordinate system
  epsg?: number
  isGeographic?: boolean
  isKoreaTM?: boolean
  // Bounding Box (original coordinate system)
  bbox?: {
    minX: number
    minY: number
    minZ: number
    maxX: number
    maxY: number
    maxZ: number
  }
  // Center point
  center?: {
    x?: number
    y?: number
    z?: number
    longitude?: number
    latitude?: number
    altitude?: number
  }
  // Point count (point cloud/vertices)
  pointCount?: number
}

// Unified file metadata type
export interface FileMetadata {
  id: string
  name: string
  type: string
  size: number
  format: 'gltf' | 'glb' | 'obj' | 'fbx' | 'ply' | 'las' | 'e57' | '3dtiles' | 'splat' | 'image' | 'other'
  folderId: string | null
  projectId: string | null
  storagePath?: string
  thumbnailUrl?: string
  description?: string
  status: 'active' | 'hidden' | 'archived'
  assetType: 'file' | 'link' | 'note'
  url?: string
  body?: string
  gps?: {
    latitude: number
    longitude: number
    altitude?: number
  }
  exif?: {
    make?: string
    model?: string
    dateTime?: Date
  }
  tags?: string[]
  // 3D spatial info
  spatialInfo?: SpatialInfo
  // 3D conversion status
  conversionStatus?: 'pending' | 'converting' | 'ready' | 'failed' | null
  conversionProgress?: number
  convertedPath?: string
  conversionError?: string
  createdAt: Date
  updatedAt: Date
}

// Unified folder type
export interface FolderData {
  id: string
  name: string
  parentId: string | null
  color?: string
  createdAt: Date
  updatedAt: Date
}

// Project type (legacy, still referenced by ProjectModal and assetStore)
export interface ProjectData {
  id: string
  name: string
  description: string | null
  thumbnailUrl: string | null
  status: 'active' | 'review' | 'completed' | 'archived'
  tags: string[]
  createdAt: Date
  updatedAt: Date
}

// Delete result types
export interface DeleteResult {
  success: boolean
  deletedAt: Date
  softDeleted?: boolean
}

export interface BatchDeleteResult {
  success: string[]
  failed: { id: string; error: string }[]
}

// Flight path point
export interface FlightPathPoint {
  fileId: string
  fileName: string
  latitude: number
  longitude: number
  altitude?: number
  datetime: string
}
