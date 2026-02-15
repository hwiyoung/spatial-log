import { ALL_3D_FORMATS } from '@/constants/formats'
import type { SupportedFormat } from './types'

// 파일 확장자에서 포맷 추출
export function getFormatFromUrl(url: string): SupportedFormat | null {
  // blob URL의 경우 hash fragment에서 파일명 추출 (blob:...#filename.obj 형태)
  if (url.startsWith('blob:') && url.includes('#')) {
    const hashPart = url.split('#')[1] || ''
    const extension = hashPart.split('.').pop()?.toLowerCase()
    if (extension && (ALL_3D_FORMATS as readonly string[]).includes(extension)) {
      return extension as SupportedFormat
    }
  }

  // URL에서 query string 제거 (signed URL의 ?token=... 등 처리)
  const urlWithoutQuery = url.split('?')[0] || url
  // pathname만 추출 (URL 객체 사용하거나 마지막 / 이후 부분)
  const pathname = urlWithoutQuery.split('/').pop() || urlWithoutQuery
  const extension = pathname.split('.').pop()?.toLowerCase()
  switch (extension) {
    case 'gltf':
    case 'glb':
      return extension as SupportedFormat
    case 'obj':
    case 'fbx':
    case 'ply':
    case 'las':
    case 'e57':
      return extension as SupportedFormat
    default:
      return null
  }
}

// 파일 확장자에서 포맷 추출 (File 객체용)
export function getFormatFromFile(file: File): SupportedFormat | null {
  return getFormatFromUrl(file.name)
}
