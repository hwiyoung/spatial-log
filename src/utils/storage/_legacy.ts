// Legacy CRUD functions for Projects, Annotations, and Project-File links.
// These are no longer part of the primary storage architecture but are still
// referenced by api.ts as localStorage fallbacks. Kept for backwards compatibility.

import { initDB, STORES, generateId } from './core'
import type { FileMetadata } from './files'
import { updateFileMetadata } from './files'

// Project type (legacy)
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

// Annotation type (legacy)
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

// === Project CRUD ===

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

export async function getAllProjects(): Promise<ProjectData[]> {
  const db = await initDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.PROJECTS], 'readonly')
    const store = transaction.objectStore(STORES.PROJECTS)
    const request = store.getAll()

    request.onerror = () => reject(new Error('프로젝트 목록 조회 실패'))
    request.onsuccess = () => {
      const projects = request.result as ProjectData[]
      projects.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      resolve(projects)
    }
  })
}

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

// === Annotation CRUD ===

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

// === Project-File Link functions ===

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

export async function linkFilesToProject(fileIds: string[], projectId: string): Promise<void> {
  for (const fileId of fileIds) {
    await updateFileMetadata(fileId, { projectId })
  }
}

export async function unlinkFilesFromProject(fileIds: string[]): Promise<void> {
  for (const fileId of fileIds) {
    await updateFileMetadata(fileId, { projectId: null })
  }
}
