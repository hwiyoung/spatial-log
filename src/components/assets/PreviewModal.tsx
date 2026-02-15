import { Box, X, Loader2, Download } from 'lucide-react'
import { formatFileSize } from '@/utils/storage'
import ThreeCanvas from '@/components/viewer/ThreeCanvas'
import type { FileMetadata } from '@/services/api'

interface PreviewModalProps {
  previewFile: FileMetadata
  previewUrl: string | null
  previewActualFormat: string | null
  isLoadingPreview: boolean
  downloadProgress: { loaded: number; total: number } | null
  previewRelatedFiles: { name: string; blob: Blob; type: 'material' | 'texture' | 'other' }[]
  onClose: () => void
  onDownload: (file: FileMetadata) => void
}

export default function PreviewModal({
  previewFile,
  previewUrl,
  previewActualFormat,
  isLoadingPreview,
  downloadProgress,
  previewRelatedFiles,
  onClose,
  onDownload,
}: PreviewModalProps) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-slate-900 rounded-xl border border-slate-700 w-full max-w-5xl h-[80vh] shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <Box size={20} className="text-blue-400" />
            <div>
              <h2 className="text-lg font-semibold text-white">{previewFile.name}</h2>
              <p className="text-xs text-slate-400">
                {previewFile.format.toUpperCase()} · {formatFileSize(previewFile.size)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onDownload(previewFile)}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg"
            >
              <Download size={14} />
              다운로드
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* 3D 뷰어 */}
        <div className="flex-1 relative">
          {isLoadingPreview ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3 text-slate-400">
                <Loader2 size={40} className="animate-spin" />
                <span>모델 로딩 중...</span>
                {downloadProgress && downloadProgress.total > 0 && (
                  <div className="w-48">
                    <div className="flex justify-between text-xs mb-1">
                      <span>다운로드</span>
                      <span>{Math.round((downloadProgress.loaded / downloadProgress.total) * 100)}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 transition-all duration-300"
                        style={{ width: `${(downloadProgress.loaded / downloadProgress.total) * 100}%` }}
                      />
                    </div>
                    <div className="text-xs mt-1 text-center">
                      {(downloadProgress.loaded / 1024 / 1024).toFixed(1)} / {(downloadProgress.total / 1024 / 1024).toFixed(1)} MB
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : previewUrl ? (
            <ThreeCanvas
              modelUrl={previewUrl}
              modelFormat={previewActualFormat || previewFile?.format}
              relatedFiles={previewRelatedFiles}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-slate-500">
              <span>파일을 로드할 수 없습니다</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
