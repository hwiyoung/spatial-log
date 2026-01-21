import { useState, useCallback, useRef } from 'react'
import { UploadCloud, X, File, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { formatFileSize } from '@/utils/storage'

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

// 지원하는 파일 확장자
const SUPPORTED_EXTENSIONS = [
  // 3D 모델
  '.gltf', '.glb', '.obj', '.fbx',
  // 포인트 클라우드
  '.ply', '.las', '.e57',
  // 이미지 (드론/현장 사진)
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.tiff', '.tif', '.bmp',
]

interface FileUploadProps {
  onUpload: (files: File[]) => void
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
}

export default function FileUpload({
  onUpload,
  accept = SUPPORTED_EXTENSIONS.join(','),
  multiple = true,
  maxSize = 500 * 1024 * 1024, // 500MB
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

  // 파일 처리
  const processFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files)
    const processed: SelectedFile[] = fileArray.map((file) => {
      const validation = validateFile(file)
      return {
        file,
        id: generateUUID(),
        status: validation.valid ? 'valid' : 'error',
        error: validation.error,
      }
    })

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

  // 업로드 실행
  const handleUpload = useCallback(async () => {
    const validFiles = selectedFiles.filter((f) => f.status === 'valid').map((f) => f.file)
    if (validFiles.length === 0) return

    setIsUploading(true)
    try {
      await onUpload(validFiles)
      setSelectedFiles([])
    } finally {
      setIsUploading(false)
    }
  }, [selectedFiles, onUpload])

  const validCount = selectedFiles.filter((f) => f.status === 'valid').length
  const errorCount = selectedFiles.filter((f) => f.status === 'error').length

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
            지원 포맷: GLTF, GLB, OBJ, FBX, PLY, LAS, E57, 이미지
          </p>
          <p className="text-slate-600 text-xs mt-1">
            최대 파일 크기: {formatFileSize(maxSize)}
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
            </div>
            <button
              onClick={clearAll}
              className="text-slate-400 hover:text-white text-sm"
            >
              전체 삭제
            </button>
          </div>

          <div className="max-h-60 overflow-y-auto custom-scrollbar">
            {selectedFiles.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between px-4 py-2 hover:bg-slate-800/50 border-b border-slate-800/50 last:border-b-0"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {item.status === 'valid' && (
                    <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
                  )}
                  {item.status === 'error' && (
                    <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
                  )}
                  {item.status === 'pending' && (
                    <File size={16} className="text-slate-400 flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm text-white truncate">{item.file.name}</p>
                    {item.error ? (
                      <p className="text-xs text-red-400">{item.error}</p>
                    ) : (
                      <p className="text-xs text-slate-500">{formatFileSize(item.file.size)}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => removeFile(item.id)}
                  className="p-1 text-slate-500 hover:text-white hover:bg-slate-700 rounded"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>

          {/* 업로드 버튼 */}
          {validCount > 0 && (
            <div className="px-4 py-3 bg-slate-800/50 border-t border-slate-800">
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
