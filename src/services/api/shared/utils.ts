// Shared utility functions

import { isSupabaseConfigured } from '@/lib/supabase'
import { ALL_3D_FORMATS } from '@/constants/formats'

// localStorage fallback keys
export const STORIES_KEY = 'spatial-log-stories'
export const SCENES_KEY = 'spatial-log-scenes'
export const SCENE_ENTRIES_KEY = 'spatial-log-scene-entries'
export const RELEASES_KEY = 'spatial-log-releases'

export const DATE_FIELDS = ['createdAt', 'updatedAt', 'expiresAt'] as const

export function getLocalItems<T>(key: string): T[] {
  try {
    const items = JSON.parse(window.localStorage.getItem(key) || '[]') as T[]
    // JSON.parse deserializes Date as string, so restore Date fields
    for (const item of items) {
      if (item && typeof item === 'object') {
        for (const field of DATE_FIELDS) {
          const val = (item as Record<string, unknown>)[field]
          if (typeof val === 'string') {
            (item as Record<string, unknown>)[field] = new Date(val)
          }
        }
      }
    }
    return items
  } catch {
    return []
  }
}

export function setLocalItems<T>(key: string, items: T[]): void {
  window.localStorage.setItem(key, JSON.stringify(items))
}

export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

// Private helper: get MIME type from file extension
// 3D files use application/octet-stream for Supabase Storage compatibility
export function getMimeTypeFromExtension(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()

  // All 3D model formats use application/octet-stream (Supabase Storage compatibility)
  if (ext && (ALL_3D_FORMATS as readonly string[]).includes(ext)) {
    return 'application/octet-stream'
  }

  const mimeTypes: Record<string, string> = {
    // Images
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    tiff: 'image/tiff',
    tif: 'image/tiff',
  }
  return mimeTypes[ext || ''] || 'application/octet-stream'
}

export async function createThumbnailBlob(file: File, maxSize = 200): Promise<Blob> {
  return new Promise((resolve, reject) => {
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

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob)
            } else {
              reject(new Error('썸네일 생성 실패'))
            }
          },
          'image/jpeg',
          0.7
        )
      }
      img.onerror = () => reject(new Error('이미지 로드 실패'))
      img.src = e.target?.result as string
    }
    reader.onerror = () => reject(new Error('파일 읽기 실패'))
    reader.readAsDataURL(file)
  })
}

export function isBackendConnected(): boolean {
  return isSupabaseConfigured()
}
