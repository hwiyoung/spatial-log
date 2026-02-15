import { useState, useCallback } from 'react'
import { useAssetStore } from '@/stores/assetStore'
import { is3DFormat } from '@/constants/formats'
import { fetchBlobWithProgress, getConvertedFileInfo, isGeographicFile, revokeBlobUrl } from '@/utils/previewHelpers'
import { getFileMetadata } from '@/services/api'
import type { FileMetadata } from '@/services/api'

export interface AssetPreviewState {
  // 3D preview
  previewFile: FileMetadata | null
  previewUrl: string | null
  previewActualFormat: string | null
  isLoadingPreview: boolean
  downloadProgress: { loaded: number; total: number } | null
  previewRelatedFiles: { name: string; blob: Blob; type: 'material' | 'texture' | 'other' }[]
  // Geo viewer (Cesium)
  geoViewerFile: FileMetadata | null
  geoViewerUrl: string | null
  geoViewerDataType: 'ply' | '3dtiles' | 'glb'
}

export interface AssetPreviewActions {
  clearPreviousPreview: () => Promise<void>
  loadConvertedPreview: (file: FileMetadata, convertedUrl: string, format: string) => Promise<boolean>
  handlePreview: (file: FileMetadata) => Promise<void>
  closePreview: () => void
  handleGeoView: (file: FileMetadata) => Promise<void>
  closeGeoViewer: () => void
}

export function useAssetPreview(): AssetPreviewState & AssetPreviewActions {
  const { getFileBlob, getRelatedFileBlobs } = useAssetStore()

  // 3D preview state
  const [previewFile, setPreviewFile] = useState<FileMetadata | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewActualFormat, setPreviewActualFormat] = useState<string | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState<{ loaded: number; total: number } | null>(null)
  const [previewRelatedFiles, setPreviewRelatedFiles] = useState<{ name: string; blob: Blob; type: 'material' | 'texture' | 'other' }[]>([])

  // Geo viewer state (Cesium)
  const [geoViewerFile, setGeoViewerFile] = useState<FileMetadata | null>(null)
  const [geoViewerUrl, setGeoViewerUrl] = useState<string | null>(null)
  const [geoViewerDataType, setGeoViewerDataType] = useState<'ply' | '3dtiles' | 'glb'>('glb')

  // Clear previous preview helper
  const clearPreviousPreview = useCallback(async () => {
    if (previewUrl) {
      revokeBlobUrl(previewUrl)
      setPreviewUrl(null)
      setPreviewFile(null)
      setPreviewRelatedFiles([])
      await new Promise(resolve => setTimeout(resolve, 150))
    }
  }, [previewUrl])

  // Load converted file preview
  const loadConvertedPreview = useCallback(async (
    file: FileMetadata,
    convertedUrl: string,
    format: string
  ): Promise<boolean> => {
    await clearPreviousPreview()

    setPreviewFile(file)
    setIsLoadingPreview(true)
    setDownloadProgress(null)

    try {
      const blob = await fetchBlobWithProgress(convertedUrl, (loaded, total) => {
        setDownloadProgress({ loaded, total })
      })
      const blobUrl = URL.createObjectURL(blob) + `#file.${format}`
      setPreviewUrl(blobUrl)
      setPreviewActualFormat(format)
      return true
    } catch (err) {
      console.error('변환된 파일 로드 실패:', err)
      return false
    } finally {
      setIsLoadingPreview(false)
      setDownloadProgress(null)
    }
  }, [clearPreviousPreview])

  // Geo view (Cesium)
  const handleGeoView = useCallback(async (file: FileMetadata) => {
    if (file.conversionStatus !== 'ready' || !file.convertedPath) {
      alert('지리 좌표 가시화는 변환이 완료된 파일만 지원합니다.')
      return
    }

    const info = getConvertedFileInfo(file)
    if (!info) {
      alert('지리 좌표 가시화를 지원하지 않는 파일 형식입니다.')
      return
    }

    console.log('GeoView:', { file: file.name, dataUrl: info.url, dataType: info.geoDataType, spatialInfo: file.spatialInfo })

    setGeoViewerFile(file)
    setGeoViewerUrl(info.url)
    setGeoViewerDataType(info.geoDataType)
  }, [])

  // 3D file preview
  const handlePreview = useCallback(async (file: FileMetadata) => {
    if (!is3DFormat(file.format)) {
      alert('3D 미리보기는 GLTF, GLB, OBJ, FBX, PLY, LAS 파일만 지원합니다.')
      return
    }

    // Fetch latest file metadata
    let currentFile = file
    try {
      const freshMetadata = await getFileMetadata(file.id)
      if (freshMetadata) {
        currentFile = freshMetadata
      }
    } catch (err) {
      console.warn('파일 메타데이터 조회 실패, 캐시된 데이터 사용:', err)
    }

    // Auto-detect geographic data -> route to Cesium
    if (
      currentFile.conversionStatus === 'ready' &&
      currentFile.convertedPath &&
      ['e57', 'obj', 'ply', 'las'].includes(currentFile.format) &&
      isGeographicFile(currentFile)
    ) {
      console.log('지리좌표 데이터 감지 -> Cesium 뷰어로 라우팅:', currentFile.name)
      handleGeoView(currentFile)
      return
    }

    // E57 requires conversion
    if (currentFile.format === 'e57') {
      if (currentFile.conversionStatus === 'ready' && currentFile.convertedPath) {
        const info = getConvertedFileInfo(currentFile)
        if (info) {
          const success = await loadConvertedPreview(file, info.url, info.format)
          if (!success) {
            alert('변환된 파일을 로드할 수 없습니다.')
            setPreviewFile(null)
            setPreviewActualFormat(null)
          }
        }
      } else if (currentFile.conversionStatus === 'converting' || currentFile.conversionStatus === 'pending') {
        alert(`${currentFile.format.toUpperCase()} 파일이 변환 중입니다. (${currentFile.conversionProgress || 0}%)\n잠시 후 다시 시도해주세요.`)
      } else if (currentFile.conversionStatus === 'failed') {
        alert(`${currentFile.format.toUpperCase()} 변환 실패: ${currentFile.conversionError || '알 수 없는 오류'}`)
      } else {
        alert('E57 파일은 변환 후 미리보기가 가능합니다.\n\n변환 서비스가 실행 중이면 자동으로 변환됩니다.')
      }
      return
    }

    // OBJ: try converted GLB first, fallback to original
    if (currentFile.format === 'obj' && currentFile.conversionStatus === 'ready' && currentFile.convertedPath) {
      const info = getConvertedFileInfo(currentFile)
      if (info) {
        const success = await loadConvertedPreview(file, info.url, info.format)
        if (success) return
        console.warn('변환된 GLB 로드 실패, 원본 OBJ 로드 시도')
      }
    }

    // General 3D files: load original Blob
    await clearPreviousPreview()
    setPreviewFile(file)
    setIsLoadingPreview(true)

    try {
      const blob = await getFileBlob(file.id)
      if (blob) {
        const blobUrl = URL.createObjectURL(blob) + `#file.${file.format}`
        setPreviewUrl(blobUrl)
        setPreviewActualFormat(file.format)

        // OBJ: load related files (MTL, textures)
        if (file.format === 'obj') {
          try {
            const relatedBlobs = await getRelatedFileBlobs(file.id)
            setPreviewRelatedFiles(relatedBlobs.map(f => ({
              name: f.name,
              blob: f.blob,
              type: f.type as 'material' | 'texture' | 'other',
            })))
          } catch (relatedErr) {
            console.warn('연관 파일 로드 실패:', relatedErr)
          }
        }
      } else {
        alert('파일을 로드할 수 없습니다.')
        setPreviewFile(null)
        setPreviewActualFormat(null)
      }
    } catch (err) {
      console.error('미리보기 로드 실패:', err)
      alert('파일을 로드할 수 없습니다.')
      setPreviewFile(null)
      setPreviewActualFormat(null)
    } finally {
      setIsLoadingPreview(false)
    }
  }, [getFileBlob, getRelatedFileBlobs, handleGeoView, loadConvertedPreview, clearPreviousPreview])

  // Close preview
  const closePreview = useCallback(() => {
    revokeBlobUrl(previewUrl)
    setPreviewFile(null)
    setPreviewUrl(null)
    setPreviewActualFormat(null)
    setPreviewRelatedFiles([])
  }, [previewUrl])

  // Close geo viewer
  const closeGeoViewer = useCallback(() => {
    setGeoViewerFile(null)
    setGeoViewerUrl(null)
  }, [])

  return {
    previewFile,
    previewUrl,
    previewActualFormat,
    isLoadingPreview,
    downloadProgress,
    previewRelatedFiles,
    geoViewerFile,
    geoViewerUrl,
    geoViewerDataType,
    clearPreviousPreview,
    loadConvertedPreview,
    handlePreview,
    closePreview,
    handleGeoView,
    closeGeoViewer,
  }
}
