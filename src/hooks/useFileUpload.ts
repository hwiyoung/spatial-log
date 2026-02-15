import { useState, useCallback, useRef, useMemo } from 'react'
import { formatFileSize, generateId } from '@/utils/storage'
import { needsConversion, getConversionTypeForFormat, CONVERSION_TYPE_LABELS } from '@/services/conversionService'
import { getFileFormat, classifyFilesIntoGroups } from '@/utils/fileClassification'
import type { FileGroup, SelectedFile, UploadOptions } from '@/components/common/FileUpload.types'

// 지원하는 파일 확장자
const SUPPORTED_EXTENSIONS = [
  // 3D 모델
  '.gltf', '.glb', '.obj', '.fbx', '.mtl', // MTL: OBJ 재질 파일
  // 포인트 클라우드
  '.ply', '.las', '.e57',
  // 3D Tiles
  '.b3dm', '.i3dm', '.pnts', '.cmpt', '.json',
  // Gaussian Splatting
  '.splat', '.ksplat',
  // 이미지 (드론/현장 사진)
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.tiff', '.tif', '.bmp',
  // 텍스처
  '.dds', '.ktx', '.ktx2',
  // 압축 파일 (연관 파일 그룹)
  '.zip',
]

interface UseFileUploadOptions {
  multiple?: boolean
  maxSize?: number // bytes
  onUpload: (files: File[], groups?: FileGroup[], options?: UploadOptions) => void
}

export function useFileUpload({ multiple = true, maxSize = 5 * 1024 * 1024 * 1024, onUpload }: UseFileUploadOptions) {
  const [isDragging, setIsDragging] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [selectedEpsg, setSelectedEpsg] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const accept = SUPPORTED_EXTENSIONS.join(',')

  // 파일 유효성 검사
  const validateFile = (file: File): { valid: boolean; error?: string } => {
    if (file.size > maxSize) {
      return { valid: false, error: `파일 크기가 ${formatFileSize(maxSize)}를 초과합니다.` }
    }
    const ext = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!SUPPORTED_EXTENSIONS.includes(ext)) {
      return { valid: false, error: '지원하지 않는 파일 형식입니다.' }
    }
    return { valid: true }
  }

  // 파일 그룹 감지 및 처리
  const processFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files)
    const processed: SelectedFile[] = []

    const { groups, otherFiles } = classifyFilesIntoGroups(fileArray)

    for (const [, group] of groups) {
      const hasRelatedFiles = group.materials.length > 0 || group.textures.length > 0
      const validation = validateFile(group.modelFile)
      const ext = '.' + group.modelFile.name.split('.').pop()?.toLowerCase()
      const isZip = ext === '.zip'
      const format = getFileFormat(group.modelFile.name)
      const requiresConv = needsConversion(format)
      const convType = requiresConv ? getConversionTypeForFormat(format) : null

      processed.push({
        file: group.modelFile,
        id: generateId(),
        status: validation.valid ? 'valid' : 'error',
        error: validation.error,
        isZip,
        groupId: hasRelatedFiles ? group.groupId : undefined,
        fileType: 'model',
        isGrouped: hasRelatedFiles,
        requiresConversion: requiresConv,
        conversionType: convType || undefined,
        conversionLabel: convType ? CONVERSION_TYPE_LABELS[convType] : undefined,
      })

      for (const mtlFile of group.materials) {
        const mtlValidation = validateFile(mtlFile)
        processed.push({
          file: mtlFile,
          id: generateId(),
          status: mtlValidation.valid ? 'valid' : 'error',
          error: mtlValidation.error,
          groupId: group.groupId,
          fileType: 'material',
          isGrouped: true,
        })
      }

      for (const texFile of group.textures) {
        const texValidation = validateFile(texFile)
        processed.push({
          file: texFile,
          id: generateId(),
          status: texValidation.valid ? 'valid' : 'error',
          error: texValidation.error,
          groupId: group.groupId,
          fileType: 'texture',
          isGrouped: true,
        })
      }
    }

    for (const file of otherFiles) {
      const validation = validateFile(file)
      const ext = '.' + file.name.split('.').pop()?.toLowerCase()
      const isZip = ext === '.zip'
      const format = getFileFormat(file.name)
      const requiresConv = needsConversion(format)
      const convType = requiresConv ? getConversionTypeForFormat(format) : null

      const item: SelectedFile = {
        file,
        id: generateId(),
        status: validation.valid ? 'valid' : 'error',
        error: validation.error,
        isZip,
        fileType: 'other',
        requiresConversion: requiresConv,
        conversionType: convType || undefined,
        conversionLabel: convType ? CONVERSION_TYPE_LABELS[convType] : undefined,
      }

      if (isZip && validation.valid) {
        item.zipContents = ['(ZIP 파일 - 업로드 후 자동 처리됨)']
      }

      processed.push(item)
    }

    setSelectedFiles((prev) => (multiple ? [...prev, ...processed] : processed))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [multiple, maxSize])

  // 드래그 이벤트 핸들러
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const { files } = e.dataTransfer
    if (files && files.length > 0) {
      processFiles(files)
    }
  }, [processFiles])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { files } = e.target
    if (files && files.length > 0) {
      processFiles(files)
    }
    e.target.value = ''
  }, [processFiles])

  const removeFile = useCallback((id: string) => {
    setSelectedFiles((prev) => prev.filter((f) => f.id !== id))
  }, [])

  const clearAll = useCallback(() => {
    setSelectedFiles([])
  }, [])

  // 파일 그룹 정보 생성
  const fileGroups = useMemo(() => {
    const groups: FileGroup[] = []
    const groupMap = new Map<string, FileGroup>()

    for (const item of selectedFiles) {
      if (item.groupId && item.status === 'valid') {
        if (!groupMap.has(item.groupId)) {
          groupMap.set(item.groupId, {
            groupId: item.groupId,
            mainFile: null,
            materialFiles: [],
            textureFiles: [],
            otherFiles: [],
          })
        }
        const group = groupMap.get(item.groupId)!
        switch (item.fileType) {
          case 'model':
            group.mainFile = item.file
            break
          case 'material':
            group.materialFiles.push(item.file)
            break
          case 'texture':
            group.textureFiles.push(item.file)
            break
          default:
            group.otherFiles.push(item.file)
        }
      }
    }

    for (const group of groupMap.values()) {
      if (group.mainFile) {
        groups.push(group)
      }
    }

    return groups
  }, [selectedFiles])

  // 업로드 실행
  const handleUpload = useCallback(async () => {
    const validFiles = selectedFiles.filter((f) => f.status === 'valid').map((f) => f.file)
    if (validFiles.length === 0) return

    setIsUploading(true)
    try {
      const uploadOpts: UploadOptions | undefined = selectedEpsg ? { epsg: selectedEpsg } : undefined
      await onUpload(validFiles, fileGroups.length > 0 ? fileGroups : undefined, uploadOpts)
      setSelectedFiles([])
      setSelectedEpsg(null)
    } finally {
      setIsUploading(false)
    }
  }, [selectedFiles, onUpload, fileGroups, selectedEpsg])

  // 표시할 파일들 (그룹에 속한 연관 파일은 숨김)
  const displayFiles = useMemo(() => {
    return selectedFiles.filter((f) => {
      if (f.groupId && f.fileType !== 'model') return false
      return true
    })
  }, [selectedFiles])

  // 각 그룹의 연관 파일 개수
  const groupRelatedCounts = useMemo(() => {
    const counts = new Map<string, { materials: number; textures: number }>()
    for (const item of selectedFiles) {
      if (item.groupId && item.fileType !== 'model') {
        if (!counts.has(item.groupId)) {
          counts.set(item.groupId, { materials: 0, textures: 0 })
        }
        const count = counts.get(item.groupId)!
        if (item.fileType === 'material') count.materials++
        if (item.fileType === 'texture') count.textures++
      }
    }
    return counts
  }, [selectedFiles])

  const validCount = selectedFiles.filter((f) => f.status === 'valid').length
  const errorCount = selectedFiles.filter((f) => f.status === 'error').length
  const groupCount = fileGroups.length
  const conversionCount = selectedFiles.filter((f) => f.requiresConversion && f.status === 'valid').length

  return {
    // State
    isDragging,
    selectedFiles,
    isUploading,
    selectedEpsg,
    setSelectedEpsg,
    inputRef,
    accept,
    maxSize,
    multiple,
    // Computed
    displayFiles,
    groupRelatedCounts,
    fileGroups,
    validCount,
    errorCount,
    groupCount,
    conversionCount,
    // Handlers
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handleFileSelect,
    handleUpload,
    removeFile,
    clearAll,
  }
}
