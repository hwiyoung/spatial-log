// IndexedDB 기반 파일 스토리지

import { extractExifFromFile } from './exifParser'

const DB_NAME = 'spatial-log-db'
const DB_VERSION = 4

// 스토어 이름
const STORES = {
  FILES: 'files',
  FOLDERS: 'folders',
  METADATA: 'metadata',
  PROJECTS: 'projects',
  ANNOTATIONS: 'annotations',
} as const

// 파일 메타데이터 타입
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

// 프로젝트 타입
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

// 어노테이션 타입
export interface AnnotationData {
  id: string
  projectId: string | null
  title: string
  description: string | null
  priority: 'low' | 'medium' | 'high' | 'critical'
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  position: {
    x: number
    y: number
    z: number
  } | null
  gps: {
    latitude: number
    longitude: number
  } | null
  fileId: string | null
  createdAt: Date
  updatedAt: Date
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
        metaStore.createIndex('projectId', 'projectId', { unique: false })
        metaStore.createIndex('format', 'format', { unique: false })
        metaStore.createIndex('name', 'name', { unique: false })
      } else {
        // 기존 스토어에 projectId 인덱스 추가 (v4 업그레이드)
        const transaction = (event.target as IDBOpenDBRequest).transaction
        if (transaction) {
          const metaStore = transaction.objectStore(STORES.METADATA)
          if (!metaStore.indexNames.contains('projectId')) {
            metaStore.createIndex('projectId', 'projectId', { unique: false })
          }
        }
      }

      // 프로젝트 스토어
      if (!db.objectStoreNames.contains(STORES.PROJECTS)) {
        const projectStore = db.createObjectStore(STORES.PROJECTS, { keyPath: 'id' })
        projectStore.createIndex('status', 'status', { unique: false })
        projectStore.createIndex('name', 'name', { unique: false })
      }

      // 어노테이션 스토어
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

// 파일 포맷 감지
export function detectFileFormat(
  filename: string
): 'gltf' | 'glb' | 'obj' | 'fbx' | 'ply' | 'las' | 'e57' | '3dtiles' | 'splat' | 'image' | 'other' {
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
    // 3D Tiles 관련 파일
    case 'b3dm':
    case 'i3dm':
    case 'pnts':
    case 'cmpt':
      return '3dtiles'
    // Gaussian Splatting
    case 'splat':
    case 'ksplat':
      return 'splat'
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

// UUID 생성 (브라우저 호환성 폴백 포함)
export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // 폴백: RFC4122 v4 UUID 생성
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
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
    projectId: null,
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

// === 프로젝트 관련 함수 ===

// 프로젝트 생성
export async function createProject(
  name: string,
  description: string | null = null,
  tags: string[] = []
): Promise<ProjectData> {
  const db = await initDB()
  const now = new Date()

  const project: ProjectData = {
    id: generateId(),
    name,
    description,
    thumbnailUrl: null,
    status: 'active',
    tags,
    createdAt: now,
    updatedAt: now,
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.PROJECTS], 'readwrite')
    const store = transaction.objectStore(STORES.PROJECTS)
    const request = store.put(project)

    request.onerror = () => reject(new Error('프로젝트 생성 실패'))
    request.onsuccess = () => resolve(project)
  })
}

// 프로젝트 조회
export async function getProject(id: string): Promise<ProjectData | null> {
  const db = await initDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.PROJECTS], 'readonly')
    const store = transaction.objectStore(STORES.PROJECTS)
    const request = store.get(id)

    request.onerror = () => reject(new Error('프로젝트 조회 실패'))
    request.onsuccess = () => resolve(request.result || null)
  })
}

// 모든 프로젝트 조회
export async function getAllProjects(): Promise<ProjectData[]> {
  const db = await initDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.PROJECTS], 'readonly')
    const store = transaction.objectStore(STORES.PROJECTS)
    const request = store.getAll()

    request.onerror = () => reject(new Error('프로젝트 목록 조회 실패'))
    request.onsuccess = () => {
      // 최신순 정렬
      const projects = request.result as ProjectData[]
      projects.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      resolve(projects)
    }
  })
}

// 프로젝트 업데이트
export async function updateProject(
  id: string,
  updates: Partial<Omit<ProjectData, 'id' | 'createdAt'>>
): Promise<ProjectData | null> {
  const db = await initDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.PROJECTS], 'readwrite')
    const store = transaction.objectStore(STORES.PROJECTS)

    const getRequest = store.get(id)

    getRequest.onerror = () => reject(new Error('프로젝트 조회 실패'))
    getRequest.onsuccess = () => {
      const existing = getRequest.result as ProjectData | undefined
      if (!existing) {
        resolve(null)
        return
      }

      const updated: ProjectData = {
        ...existing,
        ...updates,
        updatedAt: new Date(),
      }

      const putRequest = store.put(updated)
      putRequest.onerror = () => reject(new Error('프로젝트 업데이트 실패'))
      putRequest.onsuccess = () => resolve(updated)
    }
  })
}

// 프로젝트 삭제
export async function deleteProject(id: string): Promise<void> {
  const db = await initDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.PROJECTS], 'readwrite')
    const store = transaction.objectStore(STORES.PROJECTS)
    const request = store.delete(id)

    request.onerror = () => reject(new Error('프로젝트 삭제 실패'))
    request.onsuccess = () => resolve()
  })
}

// === 어노테이션 관련 함수 ===

// 어노테이션 생성
export async function createAnnotation(
  data: Omit<AnnotationData, 'id' | 'createdAt' | 'updatedAt'>
): Promise<AnnotationData> {
  const db = await initDB()
  const now = new Date()

  const annotation: AnnotationData = {
    id: generateId(),
    ...data,
    createdAt: now,
    updatedAt: now,
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.ANNOTATIONS], 'readwrite')
    const store = transaction.objectStore(STORES.ANNOTATIONS)
    const request = store.put(annotation)

    request.onerror = () => reject(new Error('어노테이션 생성 실패'))
    request.onsuccess = () => resolve(annotation)
  })
}

// 어노테이션 조회
export async function getAnnotation(id: string): Promise<AnnotationData | null> {
  const db = await initDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.ANNOTATIONS], 'readonly')
    const store = transaction.objectStore(STORES.ANNOTATIONS)
    const request = store.get(id)

    request.onerror = () => reject(new Error('어노테이션 조회 실패'))
    request.onsuccess = () => resolve(request.result || null)
  })
}

// 모든 어노테이션 조회
export async function getAllAnnotations(): Promise<AnnotationData[]> {
  const db = await initDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.ANNOTATIONS], 'readonly')
    const store = transaction.objectStore(STORES.ANNOTATIONS)
    const request = store.getAll()

    request.onerror = () => reject(new Error('어노테이션 목록 조회 실패'))
    request.onsuccess = () => {
      const annotations = request.result as AnnotationData[]
      annotations.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      resolve(annotations)
    }
  })
}

// 프로젝트별 어노테이션 조회
export async function getAnnotationsByProject(projectId: string | null): Promise<AnnotationData[]> {
  const db = await initDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.ANNOTATIONS], 'readonly')
    const store = transaction.objectStore(STORES.ANNOTATIONS)
    const index = store.index('projectId')
    const request = index.getAll(projectId)

    request.onerror = () => reject(new Error('프로젝트별 어노테이션 조회 실패'))
    request.onsuccess = () => {
      const annotations = request.result as AnnotationData[]
      annotations.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      resolve(annotations)
    }
  })
}

// 파일별 어노테이션 조회
export async function getAnnotationsByFile(fileId: string): Promise<AnnotationData[]> {
  const db = await initDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.ANNOTATIONS], 'readonly')
    const store = transaction.objectStore(STORES.ANNOTATIONS)
    const index = store.index('fileId')
    const request = index.getAll(fileId)

    request.onerror = () => reject(new Error('파일별 어노테이션 조회 실패'))
    request.onsuccess = () => resolve(request.result)
  })
}

// 어노테이션 업데이트
export async function updateAnnotation(
  id: string,
  updates: Partial<Omit<AnnotationData, 'id' | 'createdAt'>>
): Promise<AnnotationData | null> {
  const db = await initDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.ANNOTATIONS], 'readwrite')
    const store = transaction.objectStore(STORES.ANNOTATIONS)

    const getRequest = store.get(id)

    getRequest.onerror = () => reject(new Error('어노테이션 조회 실패'))
    getRequest.onsuccess = () => {
      const existing = getRequest.result as AnnotationData | undefined
      if (!existing) {
        resolve(null)
        return
      }

      const updated: AnnotationData = {
        ...existing,
        ...updates,
        updatedAt: new Date(),
      }

      const putRequest = store.put(updated)
      putRequest.onerror = () => reject(new Error('어노테이션 업데이트 실패'))
      putRequest.onsuccess = () => resolve(updated)
    }
  })
}

// 어노테이션 삭제
export async function deleteAnnotation(id: string): Promise<void> {
  const db = await initDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.ANNOTATIONS], 'readwrite')
    const store = transaction.objectStore(STORES.ANNOTATIONS)
    const request = store.delete(id)

    request.onerror = () => reject(new Error('어노테이션 삭제 실패'))
    request.onsuccess = () => resolve()
  })
}

// === 프로젝트-파일 연결 함수 ===

// 프로젝트별 파일 조회
export async function getFilesByProject(projectId: string): Promise<FileMetadata[]> {
  const db = await initDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.METADATA], 'readonly')
    const store = transaction.objectStore(STORES.METADATA)
    const index = store.index('projectId')
    const request = index.getAll(projectId)

    request.onerror = () => reject(new Error('프로젝트별 파일 조회 실패'))
    request.onsuccess = () => resolve(request.result)
  })
}

// 파일을 프로젝트에 연결
export async function linkFilesToProject(fileIds: string[], projectId: string): Promise<void> {
  for (const fileId of fileIds) {
    await updateFileMetadata(fileId, { projectId })
  }
}

// 파일의 프로젝트 연결 해제
export async function unlinkFilesFromProject(fileIds: string[]): Promise<void> {
  for (const fileId of fileIds) {
    await updateFileMetadata(fileId, { projectId: null })
  }
}
