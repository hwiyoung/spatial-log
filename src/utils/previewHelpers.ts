// 3D 파일 미리보기 공유 유틸리티
// Assets.tsx, ProjectDetail.tsx, Dashboard.tsx에서 공통 사용

import type { FileMetadata } from '@/services/api'
import { CONVERTER_URL } from '@/constants/config'

/**
 * Blob URL 정리 (hash fragment 제거 후 revoke)
 * blob:http://...#file.glb 형태의 URL에서 hash를 제거하고 revoke
 */
export function revokeBlobUrl(url: string | null | undefined): void {
  if (!url) return
  const blobUrlOnly = url.split('#')[0] || url
  if (blobUrlOnly.startsWith('blob:')) {
    URL.revokeObjectURL(blobUrlOnly)
  }
}

/**
 * XHR을 통한 Blob 다운로드 (진행률 표시 지원)
 */
export function fetchBlobWithProgress(
  url: string,
  onProgress?: (loaded: number, total: number) => void
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('GET', url, true)
    xhr.responseType = 'blob'

    xhr.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(event.loaded, event.total)
      }
    }

    xhr.onload = () => {
      if (xhr.status === 200) {
        resolve(xhr.response as Blob)
      } else {
        reject(new Error(`파일을 로드할 수 없습니다: ${xhr.status}`))
      }
    }

    xhr.onerror = () => reject(new Error('네트워크 오류'))
    xhr.send()
  })
}

/**
 * 변환된 파일의 URL과 포맷 정보 생성
 */
export function getConvertedFileInfo(
  file: FileMetadata
): { url: string; format: string; geoDataType: 'ply' | '3dtiles' | 'glb' } | null {
  if (!file.convertedPath) return null

  if (file.format === 'e57') {
    const filename = file.convertedPath.split('/').pop() || ''
    return { url: `${CONVERTER_URL}/output/${filename}`, format: 'ply', geoDataType: 'ply' }
  }

  if (['obj', 'gltf', 'glb'].includes(file.format)) {
    const dirName = file.convertedPath.split('/').pop() || ''
    const baseName = dirName.replace('_3dtiles', '')
    return { url: `${CONVERTER_URL}/output/${dirName}/${baseName}.glb`, format: 'glb', geoDataType: 'glb' }
  }

  if (['ply', 'las'].includes(file.format)) {
    const dirName = file.convertedPath.split('/').pop() || ''
    return {
      url: `${CONVERTER_URL}/output/${dirName}/tileset.json`,
      format: '3dtiles',
      geoDataType: '3dtiles',
    }
  }

  return null
}

/**
 * 지리좌표 데이터 여부 감지 (WGS84 / isGeographic 확인)
 */
export function isGeographicFile(file: FileMetadata): boolean {
  if (file.spatialInfo?.isGeographic === true) return true

  const bbox = file.spatialInfo?.bbox
  if (!bbox) return false

  return (
    Math.abs(bbox.minX) <= 180 && Math.abs(bbox.maxX) <= 180 &&
    Math.abs(bbox.minY) <= 90 && Math.abs(bbox.maxY) <= 90 &&
    Math.abs(bbox.maxX - bbox.minX) < 1 && Math.abs(bbox.maxY - bbox.minY) < 1
  )
}
