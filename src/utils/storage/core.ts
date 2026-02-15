// IndexedDB core: DB constants, initialization, clear, ID generation

export const DB_NAME = 'spatial-log-db'
export const DB_VERSION = 4

// Store names
export const STORES = {
  FILES: 'files',
  FOLDERS: 'folders',
  METADATA: 'metadata',
  PROJECTS: 'projects',
  ANNOTATIONS: 'annotations',
} as const

// DB instance cache (module-scoped)
let dbInstance: IDBDatabase | null = null

// DB initialization
export function initDB(): Promise<IDBDatabase> {
  if (dbInstance) {
    return Promise.resolve(dbInstance)
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      reject(new Error('IndexedDB 열기 실패'))
    }

    request.onsuccess = () => {
      dbInstance = request.result
      resolve(dbInstance)
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      // File store (Blob storage)
      if (!db.objectStoreNames.contains(STORES.FILES)) {
        db.createObjectStore(STORES.FILES, { keyPath: 'id' })
      }

      // Folder store
      if (!db.objectStoreNames.contains(STORES.FOLDERS)) {
        const folderStore = db.createObjectStore(STORES.FOLDERS, { keyPath: 'id' })
        folderStore.createIndex('parentId', 'parentId', { unique: false })
      }

      // Metadata store
      if (!db.objectStoreNames.contains(STORES.METADATA)) {
        const metaStore = db.createObjectStore(STORES.METADATA, { keyPath: 'id' })
        metaStore.createIndex('folderId', 'folderId', { unique: false })
        metaStore.createIndex('projectId', 'projectId', { unique: false })
        metaStore.createIndex('format', 'format', { unique: false })
        metaStore.createIndex('name', 'name', { unique: false })
      } else {
        // Add projectId index to existing store (v4 upgrade)
        const transaction = (event.target as IDBOpenDBRequest).transaction
        if (transaction) {
          const metaStore = transaction.objectStore(STORES.METADATA)
          if (!metaStore.indexNames.contains('projectId')) {
            metaStore.createIndex('projectId', 'projectId', { unique: false })
          }
        }
      }

      // Project store (kept for backwards compatibility)
      if (!db.objectStoreNames.contains(STORES.PROJECTS)) {
        const projectStore = db.createObjectStore(STORES.PROJECTS, { keyPath: 'id' })
        projectStore.createIndex('status', 'status', { unique: false })
        projectStore.createIndex('name', 'name', { unique: false })
      }

      // Annotation store (kept for backwards compatibility)
      if (!db.objectStoreNames.contains(STORES.ANNOTATIONS)) {
        const annotationStore = db.createObjectStore(STORES.ANNOTATIONS, { keyPath: 'id' })
        annotationStore.createIndex('projectId', 'projectId', { unique: false })
        annotationStore.createIndex('status', 'status', { unique: false })
        annotationStore.createIndex('priority', 'priority', { unique: false })
        annotationStore.createIndex('fileId', 'fileId', { unique: false })
      }
    }
  })
}

// Clear all data
export async function clearAllData(): Promise<void> {
  const db = await initDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      [STORES.FILES, STORES.FOLDERS, STORES.METADATA, STORES.PROJECTS, STORES.ANNOTATIONS],
      'readwrite'
    )

    transaction.onerror = () => reject(new Error('데이터 초기화 실패'))

    transaction.objectStore(STORES.FILES).clear()
    transaction.objectStore(STORES.FOLDERS).clear()
    transaction.objectStore(STORES.METADATA).clear()
    transaction.objectStore(STORES.PROJECTS).clear()
    transaction.objectStore(STORES.ANNOTATIONS).clear()

    transaction.oncomplete = () => resolve()
  })
}

// UUID generation (with browser compatibility fallback)
export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Fallback: RFC4122 v4 UUID generation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
