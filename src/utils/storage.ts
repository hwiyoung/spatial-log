// IndexedDB 기반 파일 스토리지

import { extractExifFromFile } from './exifParser'

const DB_NAME = 'spatial-log-db'
const DB_VERSION = 1

// 스토어 이름
const STORES = {
  FILES: 'files',
  FOLDERS: 'folders',
  METADATA: 'metadata',
} as const

// 파일 메타데이터 타입
export interface FileMetadata {
  id: string
  name: string
  type: string // MIME type
  size: number
  format: 'gltf' | 'glb' | 'obj' | 'fbx' | 'ply' | 'las' | 'e57' | 'image' | 'other'
  folderId: string | null
  createdAt: Date
  updatedAt: Date
  thumbnail?: string // Base64 또는 blob URL
  tags?: string[]
  // GPS 정보 (이미지 EXIF에서 추출)
  gps?: {
    latitude: number
    longitude: number
    altitude?: number
  }
  // EXIF 메타데이터 (이미지)
  exif?: {
    make?: string
    model?: string
    dateTime?: Date
    orientation?: number
  }
}

// 폴더 타입
export interface FolderData {
  id: string
  name: string
  parentId: string | null
  createdAt: Date
  updatedAt: Date
  color?: string
}

// 저장된 파일 (메타데이터 + Blob)
export interface StoredFile {
  metadata: FileMetadata
  blob: Blob
}

// DB 인스턴스 캐시
let dbInstance: IDBDatabase | null = null

// DB 초기화
function initDB(): Promise<IDBDatabase> {
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

      // 파일 스토어 (Blob 저장)
      if (!db.objectStoreNames.contains(STORES.FILES)) {
        db.createObjectStore(STORES.FILES, { keyPath: 'id' })
      }

      // 폴더 스토어
      if (!db.objectStoreNames.contains(STORES.FOLDERS)) {
        const folderStore = db.createObjectStore(STORES.FOLDERS, { keyPath: 'id' })
        folderStore.createIndex('parentId', 'parentId', { unique: false })
      }

      // 메타데이터 스토어
      if (!db.objectStoreNames.contains(STORES.METADATA)) {
        const metaStore = db.createObjectStore(STORES.METADATA, { keyPath: 'id' })
        metaStore.createIndex('folderId', 'folderId', { unique: false })
        metaStore.createIndex('format', 'format', { unique: false })
        metaStore.createIndex('name', 'name', { unique: false })
      }
    }
  })
}

// 파일 포맷 감지
export function detectFileFormat(
  filename: string
): 'gltf' | 'glb' | 'obj' | 'fbx' | 'ply' | 'las' | 'e57' | 'image' | 'other' {
  const ext = filename.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'gltf':
      return 'gltf'
    case 'glb':
      return 'glb'
    case 'obj':
      return 'obj'
    case 'fbx':
      return 'fbx'
    case 'ply':
      return 'ply'
    case 'las':
      return 'las'
    case 'e57':
      return 'e57'
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'webp':
    case 'tiff':
    case 'tif':
    case 'bmp':
      return 'image'
    default:
      return 'other'
  }
}

// UUID 생성
export function generateId(): string {
  return crypto.randomUUID()
}

// === 파일 관련 함수 ===

// 파일 저장
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
    createdAt: now,
    updatedAt: now,
  }

  // 이미지인 경우 썸네일 생성 및 EXIF 추출
  if (metadata.format === 'image') {
    metadata.thumbnail = await createImageThumbnail(file)

    // EXIF 데이터 추출 (GPS 좌표 포함)
    try {
      const exifData = await extractExifFromFile(file)
      if (exifData) {
        // GPS 정보
        if (exifData.latitude !== undefined && exifData.longitude !== undefined) {
          metadata.gps = {
            latitude: exifData.latitude,
            longitude: exifData.longitude,
            altitude: exifData.altitude,
          }
        }
        // EXIF 메타데이터
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

    // Blob 저장
    const fileStore = transaction.objectStore(STORES.FILES)
    fileStore.put({ id, blob: file })

    // 메타데이터 저장
    const metaStore = transaction.objectStore(STORES.METADATA)
    metaStore.put(metadata)

    transaction.oncomplete = () => resolve(metadata)
  })
}

// 파일 가져오기
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

// 파일 삭제
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

// 모든 파일 메타데이터 가져오기
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

// 폴더별 파일 메타데이터 가져오기
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

// 파일 메타데이터 업데이트
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

// === 폴더 관련 함수 ===

// 폴더 생성
export async function createFolder(
  name: string,
  parentId: string | null = null
): Promise<FolderData> {
  const db = await initDB()
  const now = new Date()

  const folder: FolderData = {
    id: generateId(),
    name,
    parentId,
    createdAt: now,
    updatedAt: now,
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.FOLDERS], 'readwrite')
    const store = transaction.objectStore(STORES.FOLDERS)
    const request = store.put(folder)

    request.onerror = () => reject(new Error('폴더 생성 실패'))
    request.onsuccess = () => resolve(folder)
  })
}

// 폴더 가져오기
export async function getFolder(id: string): Promise<FolderData | null> {
  const db = await initDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.FOLDERS], 'readonly')
    const store = transaction.objectStore(STORES.FOLDERS)
    const request = store.get(id)

    request.onerror = () => reject(new Error('폴더 조회 실패'))
    request.onsuccess = () => resolve(request.result || null)
  })
}

// 모든 폴더 가져오기
export async function getAllFolders(): Promise<FolderData[]> {
  const db = await initDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.FOLDERS], 'readonly')
    const store = transaction.objectStore(STORES.FOLDERS)
    const request = store.getAll()

    request.onerror = () => reject(new Error('폴더 목록 조회 실패'))
    request.onsuccess = () => resolve(request.result)
  })
}

// 하위 폴더 가져오기
export async function getChildFolders(parentId: string | null): Promise<FolderData[]> {
  const db = await initDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.FOLDERS], 'readonly')
    const store = transaction.objectStore(STORES.FOLDERS)
    const index = store.index('parentId')
    const request = index.getAll(parentId)

    request.onerror = () => reject(new Error('하위 폴더 조회 실패'))
    request.onsuccess = () => resolve(request.result)
  })
}

// 폴더 업데이트
export async function updateFolder(
  id: string,
  updates: Partial<Omit<FolderData, 'id' | 'createdAt'>>
): Promise<FolderData | null> {
  const db = await initDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.FOLDERS], 'readwrite')
    const store = transaction.objectStore(STORES.FOLDERS)

    const getRequest = store.get(id)

    getRequest.onerror = () => reject(new Error('폴더 조회 실패'))
    getRequest.onsuccess = () => {
      const existing = getRequest.result as FolderData | undefined
      if (!existing) {
        resolve(null)
        return
      }

      const updated: FolderData = {
        ...existing,
        ...updates,
        updatedAt: new Date(),
      }

      const putRequest = store.put(updated)
      putRequest.onerror = () => reject(new Error('폴더 업데이트 실패'))
      putRequest.onsuccess = () => resolve(updated)
    }
  })
}

// 폴더 삭제 (하위 파일은 루트로 이동)
export async function deleteFolder(id: string): Promise<void> {
  const db = await initDB()

  // 해당 폴더의 파일들을 루트로 이동
  const files = await getFilesByFolder(id)
  for (const file of files) {
    await updateFileMetadata(file.id, { folderId: null })
  }

  // 하위 폴더들도 루트로 이동
  const childFolders = await getChildFolders(id)
  for (const folder of childFolders) {
    await updateFolder(folder.id, { parentId: null })
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.FOLDERS], 'readwrite')
    const store = transaction.objectStore(STORES.FOLDERS)
    const request = store.delete(id)

    request.onerror = () => reject(new Error('폴더 삭제 실패'))
    request.onsuccess = () => resolve()
  })
}

// === 유틸리티 함수 ===

// 이미지 썸네일 생성
async function createImageThumbnail(file: File, maxSize = 200): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')!

        let width = img.width
        let height = img.height

        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width
            width = maxSize
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height
            height = maxSize
          }
        }

        canvas.width = width
        canvas.height = height
        ctx.drawImage(img, 0, 0, width, height)

        resolve(canvas.toDataURL('image/jpeg', 0.7))
      }
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  })
}

// 파일 크기 포맷
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

// 스토리지 사용량 계산
export async function getStorageUsage(): Promise<{ used: number; files: number }> {
  const metadata = await getAllFileMetadata()
  const used = metadata.reduce((total, file) => total + file.size, 0)
  return { used, files: metadata.length }
}

// DB 초기화 (모든 데이터 삭제)
export async function clearAllData(): Promise<void> {
  const db = await initDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      [STORES.FILES, STORES.FOLDERS, STORES.METADATA],
      'readwrite'
    )

    transaction.onerror = () => reject(new Error('데이터 초기화 실패'))

    transaction.objectStore(STORES.FILES).clear()
    transaction.objectStore(STORES.FOLDERS).clear()
    transaction.objectStore(STORES.METADATA).clear()

    transaction.oncomplete = () => resolve()
  })
}
