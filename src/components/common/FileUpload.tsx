import { useState, useCallback, useRef, useMemo } from 'react'
import { UploadCloud, X, File, CheckCircle, AlertCircle, Loader2, Package, Link2, RefreshCw } from 'lucide-react'
import { formatFileSize } from '@/utils/storage'
import { needsConversion, getConversionTypeForFormat, CONVERSION_TYPE_LABELS } from '@/services/conversionService'

// UUID 생성 함수 (브라우저 호환성 폴백 포함)
function generateUUID(): string {
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

// 파일 확장자 분류
const MODEL_EXTENSIONS = ['.obj', '.fbx', '.gltf', '.glb']
const MATERIAL_EXTENSIONS = ['.mtl']
const TEXTURE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.tiff', '.tif', '.bmp', '.dds', '.ktx', '.ktx2']

// 파일 확장자에서 포맷 추출
function getFileFormat(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop() || ''
  return ext
}

// 파일 타입 분류
function classifyFileType(filename: string): 'model' | 'material' | 'texture' | 'other' {
  const ext = '.' + filename.toLowerCase().split('.').pop()
  if (MODEL_EXTENSIONS.includes(ext)) return 'model'
  if (MATERIAL_EXTENSIONS.includes(ext)) return 'material'
  if (TEXTURE_EXTENSIONS.includes(ext)) return 'texture'
  return 'other'
}

// 파일의 기본 이름 추출 (확장자 제외)
function getBaseName(filename: string): string {
  const parts = filename.split('.')
  if (parts.length > 1) {
    parts.pop()
  }
  return parts.join('.').toLowerCase()
}

// 연관 파일 그룹 타입
export interface FileGroup {
  groupId: string
  mainFile: File | null // OBJ, GLTF 등 메인 모델 파일
  materialFiles: File[] // MTL 파일들
  textureFiles: File[] // 텍스처 파일들
  otherFiles: File[] // 기타 파일들
}

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

interface FileUploadProps {
  onUpload: (files: File[], groups?: FileGroup[]) => void
  accept?: string
  multiple?: boolean
  maxSize?: number // bytes
  className?: string
}

interface SelectedFile {
  file: File
  id: string
  status: 'pending' | 'valid' | 'error'
  error?: string
  isZip?: boolean
  zipContents?: string[] // ZIP 파일 내용 미리보기
  // 파일 그룹 정보
  groupId?: string
  fileType?: 'model' | 'material' | 'texture' | 'other'
  isGrouped?: boolean // 그룹에 속한 파일인지
  // 변환 정보
  requiresConversion?: boolean // 서버 변환이 필요한 파일
  conversionType?: string // 변환 타입 (e.g., 'las_to_copc')
  conversionLabel?: string // 변환 타입 라벨 (e.g., 'LAS → COPC')
}

export default function FileUpload({
  onUpload,
  accept = SUPPORTED_EXTENSIONS.join(','),
  multiple = true,
  maxSize = 5 * 1024 * 1024 * 1024, // 5GB
  className = '',
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // 파일 유효성 검사
  const validateFile = (file: File): { valid: boolean; error?: string } => {
    // 파일 크기 검사
    if (file.size > maxSize) {
      return { valid: false, error: `파일 크기가 ${formatFileSize(maxSize)}를 초과합니다.` }
    }

    // 확장자 검사
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

    // 1. 파일 분류
    const modelFiles: File[] = []
    const materialFiles: File[] = []
    const textureFiles: File[] = []
    const otherFiles: File[] = []

    for (const file of fileArray) {
      const fileType = classifyFileType(file.name)
      switch (fileType) {
        case 'model':
          modelFiles.push(file)
          break
        case 'material':
          materialFiles.push(file)
          break
        case 'texture':
          textureFiles.push(file)
          break
        default:
          otherFiles.push(file)
      }
    }

    // 2. 모델 파일별로 그룹 생성
    const groups: Map<string, { groupId: string; modelFile: File; materials: File[]; textures: File[] }> = new Map()

    for (const modelFile of modelFiles) {
      const baseName = getBaseName(modelFile.name)
      const groupId = generateUUID()
      groups.set(baseName, {
        groupId,
        modelFile,
        materials: [],
        textures: [],
      })
    }

    // 3. MTL 파일 연결 (같은 기본 이름 또는 모델이 1개인 경우)
    for (const mtlFile of materialFiles) {
      const baseName = getBaseName(mtlFile.name)
      if (groups.has(baseName)) {
        groups.get(baseName)!.materials.push(mtlFile)
      } else if (groups.size === 1) {
        // 모델이 하나만 있으면 모든 MTL을 그 모델에 연결
        const firstGroup = groups.values().next().value
        if (firstGroup) {
          firstGroup.materials.push(mtlFile)
        }
      } else {
        // 연결할 모델이 없으면 기타로 처리
        otherFiles.push(mtlFile)
      }
    }

    // 4. 텍스처 파일 연결 (모델이 있는 경우에만)
    for (const texFile of textureFiles) {
      if (groups.size === 1) {
        // 모델이 하나만 있으면 모든 텍스처를 그 모델에 연결
        const firstGroup = groups.values().next().value
        if (firstGroup) {
          firstGroup.textures.push(texFile)
        }
      } else if (groups.size > 1) {
        // 모델이 여러 개면 이름 유사도로 연결 시도
        const baseName = getBaseName(texFile.name)
        let matched = false
        for (const [modelBaseName, group] of groups.entries()) {
          if (baseName.includes(modelBaseName) || modelBaseName.includes(baseName)) {
            group.textures.push(texFile)
            matched = true
            break
          }
        }
        if (!matched) {
          // 첫 번째 그룹에 연결
          const firstGroup = groups.values().next().value
          if (firstGroup) {
            firstGroup.textures.push(texFile)
          }
        }
      } else {
        // 모델이 없으면 기타로 처리
        otherFiles.push(texFile)
      }
    }

    // 5. 그룹화된 파일들을 SelectedFile로 변환
    for (const [, group] of groups) {
      const hasRelatedFiles = group.materials.length > 0 || group.textures.length > 0

      // 메인 모델 파일
      const validation = validateFile(group.modelFile)
      const ext = '.' + group.modelFile.name.split('.').pop()?.toLowerCase()
      const isZip = ext === '.zip'
      const format = getFileFormat(group.modelFile.name)
      const requiresConv = needsConversion(format)
      const convType = requiresConv ? getConversionTypeForFormat(format) : null

      processed.push({
        file: group.modelFile,
        id: generateUUID(),
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

      // 연관 MTL 파일들 (그룹에 속함, 개별 표시 안함)
      for (const mtlFile of group.materials) {
        const mtlValidation = validateFile(mtlFile)
        processed.push({
          file: mtlFile,
          id: generateUUID(),
          status: mtlValidation.valid ? 'valid' : 'error',
          error: mtlValidation.error,
          groupId: group.groupId,
          fileType: 'material',
          isGrouped: true,
        })
      }

      // 연관 텍스처 파일들 (그룹에 속함, 개별 표시 안함)
      for (const texFile of group.textures) {
        const texValidation = validateFile(texFile)
        processed.push({
          file: texFile,
          id: generateUUID(),
          status: texValidation.valid ? 'valid' : 'error',
          error: texValidation.error,
          groupId: group.groupId,
          fileType: 'texture',
          isGrouped: true,
        })
      }
    }

    // 6. 기타 파일들 (그룹화되지 않음)
    for (const file of otherFiles) {
      const validation = validateFile(file)
      const ext = '.' + file.name.split('.').pop()?.toLowerCase()
      const isZip = ext === '.zip'
      const format = getFileFormat(file.name)
      const requiresConv = needsConversion(format)
      const convType = requiresConv ? getConversionTypeForFormat(format) : null

      const item: SelectedFile = {
        file,
        id: generateUUID(),
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

  // 파일 선택 핸들러
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { files } = e.target
    if (files && files.length > 0) {
      processFiles(files)
    }
    // 입력 초기화
    e.target.value = ''
  }, [processFiles])

  // 파일 제거
  const removeFile = useCallback((id: string) => {
    setSelectedFiles((prev) => prev.filter((f) => f.id !== id))
  }, [])

  // 전체 제거
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
      // 그룹 정보와 함께 업로드
      await onUpload(validFiles, fileGroups.length > 0 ? fileGroups : undefined)
      setSelectedFiles([])
    } finally {
      setIsUploading(false)
    }
  }, [selectedFiles, onUpload, fileGroups])

  // 표시할 파일들 (그룹에 속한 연관 파일은 숨김, 메인 파일만 표시)
  const displayFiles = useMemo(() => {
    return selectedFiles.filter((f) => {
      // 그룹에 속한 연관 파일(material, texture)은 숨김
      if (f.groupId && f.fileType !== 'model') {
        return false
      }
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

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 드래그 앤 드롭 영역 */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
          ${isDragging
            ? 'border-blue-500 bg-blue-500/10'
            : 'border-slate-700 hover:border-slate-500 hover:bg-slate-800/50'
          }
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileSelect}
          className="hidden"
        />

        <div className="flex flex-col items-center">
          <div className={`p-4 rounded-full mb-4 ${isDragging ? 'bg-blue-500/20' : 'bg-slate-800'}`}>
            <UploadCloud
              size={32}
              className={isDragging ? 'text-blue-400' : 'text-slate-400'}
            />
          </div>
          <h3 className="text-white font-medium mb-1">
            {isDragging ? '여기에 놓으세요' : '파일을 드래그하거나 클릭하여 업로드'}
          </h3>
          <p className="text-slate-500 text-sm">
            지원 포맷: GLTF, GLB, OBJ, FBX, PLY, LAS, E57, 이미지, ZIP
          </p>
          <p className="text-slate-600 text-xs mt-1">
            최대 파일 크기: {formatFileSize(maxSize)}
          </p>
          <p className="text-amber-500/80 text-xs mt-2">
            💡 OBJ 파일 업로드 시 MTL(재질) 파일과 텍스처 이미지도 함께 업로드하세요
          </p>
          <p className="text-cyan-500/80 text-xs mt-1">
            🔄 E57, LAS, PLY, OBJ, GLTF 파일은 업로드 후 자동으로 최적화 변환됩니다
          </p>
        </div>
      </div>

      {/* 선택된 파일 목록 */}
      {selectedFiles.length > 0 && (
        <div className="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <span className="text-white font-medium">
                {selectedFiles.length}개 파일 선택됨
              </span>
              {validCount > 0 && (
                <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded">
                  {validCount}개 준비됨
                </span>
              )}
              {errorCount > 0 && (
                <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded">
                  {errorCount}개 오류
                </span>
              )}
              {groupCount > 0 && (
                <span className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded flex items-center gap-1">
                  <Link2 size={10} />
                  {groupCount}개 그룹
                </span>
              )}
              {conversionCount > 0 && (
                <span className="text-xs px-2 py-0.5 bg-cyan-500/20 text-cyan-400 rounded flex items-center gap-1">
                  <RefreshCw size={10} />
                  {conversionCount}개 변환 필요
                </span>
              )}
            </div>
            <button
              onClick={clearAll}
              className="text-slate-400 hover:text-white text-sm"
            >
              전체 삭제
            </button>
          </div>

          <div className="max-h-60 overflow-y-auto custom-scrollbar">
            {displayFiles.map((item) => {
              const relatedCount = item.groupId ? groupRelatedCounts.get(item.groupId) : null
              const hasRelated = relatedCount && (relatedCount.materials > 0 || relatedCount.textures > 0)

              return (
              <div
                key={item.id}
                className={`px-4 py-2 hover:bg-slate-800/50 border-b border-slate-800/50 last:border-b-0 ${
                  item.isZip ? 'bg-blue-900/10' : ''
                } ${item.isGrouped ? 'bg-purple-900/10' : ''} ${
                  item.requiresConversion && !item.isZip && !item.isGrouped ? 'bg-cyan-900/10' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    {item.status === 'valid' && !item.isZip && !item.isGrouped && !item.requiresConversion && (
                      <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
                    )}
                    {item.status === 'valid' && item.requiresConversion && !item.isZip && !item.isGrouped && (
                      <RefreshCw size={16} className="text-cyan-400 flex-shrink-0" />
                    )}
                    {item.status === 'valid' && item.isGrouped && (
                      <Link2 size={16} className="text-purple-400 flex-shrink-0" />
                    )}
                    {item.status === 'valid' && item.isZip && (
                      <Package size={16} className="text-blue-400 flex-shrink-0" />
                    )}
                    {item.status === 'error' && (
                      <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
                    )}
                    {item.status === 'pending' && (
                      <File size={16} className="text-slate-400 flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-white truncate">{item.file.name}</p>
                        {item.isZip && (
                          <span className="text-xs px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded">
                            ZIP 파일
                          </span>
                        )}
                        {hasRelated && (
                          <span className="text-xs px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded">
                            연관 파일 그룹
                          </span>
                        )}
                        {item.requiresConversion && item.conversionLabel && (
                          <span className="text-xs px-1.5 py-0.5 bg-cyan-500/20 text-cyan-400 rounded flex items-center gap-1">
                            <RefreshCw size={10} />
                            {item.conversionLabel}
                          </span>
                        )}
                      </div>
                      {item.error ? (
                        <p className="text-xs text-red-400">{item.error}</p>
                      ) : (
                        <p className="text-xs text-slate-500">{formatFileSize(item.file.size)}</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => removeFile(item.id)}
                    className="p-1 text-slate-500 hover:text-white hover:bg-slate-700 rounded flex-shrink-0"
                  >
                    <X size={14} />
                  </button>
                </div>
                {/* 연관 파일 미리보기 */}
                {hasRelated && relatedCount && (
                  <div className="mt-2 ml-7 pl-3 border-l border-purple-700/50">
                    <p className="text-xs text-slate-400 mb-1">연관 파일:</p>
                    <div className="flex flex-wrap gap-1">
                      {relatedCount.materials > 0 && (
                        <span className="text-xs px-1.5 py-0.5 bg-amber-800/30 text-amber-400 rounded">
                          MTL {relatedCount.materials}개
                        </span>
                      )}
                      {relatedCount.textures > 0 && (
                        <span className="text-xs px-1.5 py-0.5 bg-green-800/30 text-green-400 rounded">
                          텍스처 {relatedCount.textures}개
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {/* ZIP 파일 내용 미리보기 */}
                {item.isZip && item.zipContents && item.zipContents.length > 0 && (
                  <div className="mt-2 ml-7 pl-3 border-l border-slate-700">
                    <p className="text-xs text-slate-400 mb-1">포함된 파일:</p>
                    <div className="flex flex-wrap gap-1">
                      {item.zipContents.map((name, idx) => (
                        <span
                          key={idx}
                          className="text-xs px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded"
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )})}
          </div>

          {/* 업로드 버튼 */}
          {validCount > 0 && (
            <div className="px-4 py-3 bg-slate-800/50 border-t border-slate-800">
              {conversionCount > 0 && (
                <p className="text-xs text-cyan-400/80 mb-2 text-center">
                  ⚡ {conversionCount}개 파일이 업로드 후 자동으로 최적화 변환됩니다
                </p>
              )}
              <button
                onClick={handleUpload}
                disabled={isUploading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white rounded-lg transition-colors"
              >
                {isUploading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    업로드 중...
                  </>
                ) : (
                  <>
                    <UploadCloud size={18} />
                    {validCount}개 파일 업로드
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
