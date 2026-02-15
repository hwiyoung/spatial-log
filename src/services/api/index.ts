// Barrel export - re-exports everything for backward compatibility
// Existing `import ... from '@/services/api'` paths continue to work

// Types
export type {
  SpatialInfo,
  FileMetadata,
  FolderData,
  DeleteResult,
  BatchDeleteResult,
  FlightPathPoint,
  ProjectData,
  FileInsert,
  FileUpdate,
  FolderInsert,
  FolderUpdate,
  StoryInsert,
  StoryUpdate,
  SceneInsert,
  SceneUpdate,
  SceneEntryInsert,
  SceneEntryUpdate,
  ReleaseInsert,
} from './shared/types'

// Shared utils
export { isBackendConnected, getLocalItems, setLocalItems } from './shared/utils'

// Domain modules
export * from './asset'
export * from './folder'
export * from './auth'
export * from './story'
export * from './release'
export * from './search'
