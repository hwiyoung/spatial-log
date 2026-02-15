// Utility functions: file format detection, size formatting, storage usage, image resizing

import { getAllFileMetadata } from './files'

// Detect file format from filename
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
    // 3D Tiles related files
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

// Format file size for display
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

// Calculate storage usage
export async function getStorageUsage(): Promise<{ used: number; files: number }> {
  const metadata = await getAllFileMetadata()
  const used = metadata.reduce((total, file) => total + file.size, 0)
  return { used, files: metadata.length }
}

// Shared image resize helper: returns a canvas with the resized image
export function resizeImageOnCanvas(file: File, maxSize = 200): Promise<HTMLCanvasElement> {
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

        resolve(canvas)
      }
      img.onerror = () => reject(new Error('이미지 로드 실패'))
      img.src = e.target?.result as string
    }
    reader.onerror = () => reject(new Error('파일 읽기 실패'))
    reader.readAsDataURL(file)
  })
}
