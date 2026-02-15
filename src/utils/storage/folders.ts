// Folder CRUD operations + FolderData type

import { initDB, STORES, generateId } from './core'
import { getFilesByFolder, updateFileMetadata } from './files'

// Folder type
export interface FolderData {
  id: string
  name: string
  parentId: string | null
  createdAt: Date
  updatedAt: Date
  color?: string
}

// Create folder
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

// Get folder
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

// Get all folders
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

// Get child folders
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

// Update folder
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

// Delete folder (moves child files and folders to root)
export async function deleteFolder(id: string): Promise<void> {
  const db = await initDB()

  // Move files in this folder to root
  const files = await getFilesByFolder(id)
  for (const file of files) {
    await updateFileMetadata(file.id, { folderId: null })
  }

  // Move child folders to root
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
