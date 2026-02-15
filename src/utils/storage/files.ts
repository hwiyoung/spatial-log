// File CRUD operations + FileMetadata/StoredFile types + thumbnail generation

import { extractExifFromFile } from '../exifParser'
import { initDB, STORES, generateId } from './core'
import { detectFileFormat, resizeImageOnCanvas } from './utilities'

// File metadata type
export interface FileMetadata {
  id: string
  name: string
  type: string // MIME type
  size: number
  format: 'gltf' | 'glb' | 'obj' | 'fbx' | 'ply' | 'las' | 'e57' | '3dtiles' | 'splat' | 'image' | 'other'
  folderId: string | null
  projectId: string | null
  createdAt: Date
  updatedAt: Date
  thumbnail?: string // Base64 or blob URL
  tags?: string[]
  description?: string
  status?: string
  assetType?: string
  url?: string
  body?: string
  // GPS info (extracted from image EXIF)
  gps?: {
    latitude: number
    longitude: number
    altitude?: number
  }
  // EXIF metadata (images)
  exif?: {
    make?: string
    model?: string
    dateTime?: Date
    orientation?: number
  }
}

// Stored file (metadata + Blob)
export interface StoredFile {
  metadata: FileMetadata
  blob: Blob
}

// Create image thumbnail (uses shared resizeImageOnCanvas, returns base64)
export async function createImageThumbnail(file: File, maxSize = 200): Promise<string> {
  const canvas = await resizeImageOnCanvas(file, maxSize)
  return canvas.toDataURL('image/jpeg', 0.7)
}

// Save file
export async function saveFile(file: File, folderId: string | null = null): Promise<FileMetadata> {
  const db = await initDB()
  const id = generateId()
  const now = new Date()

  const metadata: FileMetadata = {
    id,
    name: file.name,
    type: file.type,
    size: file.size,
    format: detectFileFormat(file.name),
    folderId,
    projectId: null,
    status: 'active',
    assetType: 'file',
    createdAt: now,
    updatedAt: now,
  }

  // Generate thumbnail and extract EXIF for images
  if (metadata.format === 'image') {
    metadata.thumbnail = await createImageThumbnail(file)

    // Extract EXIF data (including GPS coordinates)
    try {
      const exifData = await extractExifFromFile(file)
      if (exifData) {
        // GPS info
        if (exifData.latitude !== undefined && exifData.longitude !== undefined) {
          metadata.gps = {
            latitude: exifData.latitude,
            longitude: exifData.longitude,
            altitude: exifData.altitude,
          }
        }
        // EXIF metadata
        if (exifData.make || exifData.model || exifData.dateTime) {
          metadata.exif = {
            make: exifData.make,
            model: exifData.model,
            dateTime: exifData.dateTime,
            orientation: exifData.orientation,
          }
        }
      }
    } catch (err) {
      console.warn('EXIF 추출 실패:', err)
    }
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.FILES, STORES.METADATA], 'readwrite')

    transaction.onerror = () => reject(new Error('파일 저장 실패'))

    // Save Blob
    const fileStore = transaction.objectStore(STORES.FILES)
    fileStore.put({ id, blob: file })

    // Save metadata
    const metaStore = transaction.objectStore(STORES.METADATA)
    metaStore.put(metadata)

    transaction.oncomplete = () => resolve(metadata)
  })
}

// Get file
export async function getFile(id: string): Promise<StoredFile | null> {
  const db = await initDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.FILES, STORES.METADATA], 'readonly')

    transaction.onerror = () => reject(new Error('파일 조회 실패'))

    const fileStore = transaction.objectStore(STORES.FILES)
    const metaStore = transaction.objectStore(STORES.METADATA)

    const fileRequest = fileStore.get(id)
    const metaRequest = metaStore.get(id)

    let fileData: { id: string; blob: Blob } | undefined
    let metadata: FileMetadata | undefined

    fileRequest.onsuccess = () => {
      fileData = fileRequest.result
    }

    metaRequest.onsuccess = () => {
      metadata = metaRequest.result
    }

    transaction.oncomplete = () => {
      if (fileData && metadata) {
        resolve({ metadata, blob: fileData.blob })
      } else {
        resolve(null)
      }
    }
  })
}

// Delete file
export async function deleteFile(id: string): Promise<void> {
  const db = await initDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.FILES, STORES.METADATA], 'readwrite')

    transaction.onerror = () => reject(new Error('파일 삭제 실패'))

    const fileStore = transaction.objectStore(STORES.FILES)
    const metaStore = transaction.objectStore(STORES.METADATA)

    fileStore.delete(id)
    metaStore.delete(id)

    transaction.oncomplete = () => resolve()
  })
}

// Get all file metadata
export async function getAllFileMetadata(): Promise<FileMetadata[]> {
  const db = await initDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.METADATA], 'readonly')
    const store = transaction.objectStore(STORES.METADATA)
    const request = store.getAll()

    request.onerror = () => reject(new Error('메타데이터 조회 실패'))
    request.onsuccess = () => resolve(request.result)
  })
}

// Get file metadata by folder
export async function getFilesByFolder(folderId: string | null): Promise<FileMetadata[]> {
  const db = await initDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.METADATA], 'readonly')
    const store = transaction.objectStore(STORES.METADATA)
    const index = store.index('folderId')
    const request = index.getAll(folderId)

    request.onerror = () => reject(new Error('폴더별 파일 조회 실패'))
    request.onsuccess = () => resolve(request.result)
  })
}

// Update file metadata
export async function updateFileMetadata(
  id: string,
  updates: Partial<Omit<FileMetadata, 'id' | 'createdAt'>>
): Promise<FileMetadata | null> {
  const db = await initDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.METADATA], 'readwrite')
    const store = transaction.objectStore(STORES.METADATA)

    const getRequest = store.get(id)

    getRequest.onerror = () => reject(new Error('파일 조회 실패'))
    getRequest.onsuccess = () => {
      const existing = getRequest.result as FileMetadata | undefined
      if (!existing) {
        resolve(null)
        return
      }

      const updated: FileMetadata = {
        ...existing,
        ...updates,
        updatedAt: new Date(),
      }

      const putRequest = store.put(updated)
      putRequest.onerror = () => reject(new Error('메타데이터 업데이트 실패'))
      putRequest.onsuccess = () => resolve(updated)
    }
  })
}
