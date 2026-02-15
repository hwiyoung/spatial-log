import { Trash2, Loader2 } from 'lucide-react'
import { Modal } from '@/components/common'
import { formatFileSize } from '@/utils/storage'
import { getFileIconProps } from '@/utils/fileFormatUtils'
import type { FileMetadata } from '@/services/api'

function FileIcon({ format, size = 24 }: { format: FileMetadata['format']; size?: number }) {
  const { icon: Icon, className } = getFileIconProps(format)
  return <Icon size={size} className={className} />
}

interface DeleteConfirmModalProps {
  isOpen: boolean
  filesToDelete: FileMetadata[]
  isDeleting: boolean
  deleteProgress: number
  onDelete: () => void
  onCancel: () => void
}

export default function DeleteConfirmModal({
  isOpen,
  filesToDelete,
  isDeleting,
  deleteProgress,
  onDelete,
  onCancel,
}: DeleteConfirmModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title="파일 삭제 확인"
    >
      <div className="space-y-4">
        {isDeleting ? (
          // 삭제 진행 중
          <div className="py-6">
            <div className="flex flex-col items-center gap-4">
              <Loader2 size={40} className="text-red-400 animate-spin" />
              <p className="text-white font-medium">파일 삭제 중...</p>
              <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500 transition-all duration-300"
                  style={{ width: `${deleteProgress}%` }}
                />
              </div>
              <p className="text-slate-400 text-sm">{deleteProgress}% 완료</p>
            </div>
          </div>
        ) : (
          // 삭제 확인
          <>
            <div className="flex items-start gap-3 p-4 bg-red-900/20 border border-red-800/50 rounded-lg">
              <Trash2 className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-200 font-medium">
                  {filesToDelete.length}개 파일을 삭제하시겠습니까?
                </p>
                <p className="text-red-300/70 text-sm mt-1">
                  이 작업은 되돌릴 수 없습니다. 파일이 Storage와 DB에서 영구적으로 삭제됩니다.
                </p>
              </div>
            </div>

            {/* 삭제할 파일 목록 */}
            <div className="max-h-60 overflow-y-auto bg-slate-900 rounded-lg border border-slate-700">
              {filesToDelete.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-3 px-4 py-2 border-b border-slate-800 last:border-b-0"
                >
                  <FileIcon format={file.format} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{file.name}</p>
                    <p className="text-xs text-slate-500">{formatFileSize(file.size)}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* 총 용량 */}
            <div className="flex justify-between items-center px-4 py-2 bg-slate-800 rounded-lg">
              <span className="text-slate-400 text-sm">총 용량</span>
              <span className="text-white font-medium">
                {formatFileSize(filesToDelete.reduce((sum, f) => sum + f.size, 0))}
              </span>
            </div>

            {/* 버튼 */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={onCancel}
                className="px-4 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                onClick={onDelete}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
              >
                <Trash2 size={16} />
                <span>{filesToDelete.length}개 파일 삭제</span>
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
