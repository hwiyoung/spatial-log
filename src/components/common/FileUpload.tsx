import { UploadCloud, X, File, CheckCircle, AlertCircle, Loader2, Package, Link2, RefreshCw } from 'lucide-react'
import { formatFileSize } from '@/utils/storage'
import { useFileUpload } from '@/hooks/useFileUpload'
import EPSGSelector from './EPSGSelector'
import type { FileGroup, UploadOptions } from './FileUpload.types'

export type { FileGroup, UploadOptions }

interface FileUploadProps {
  onUpload: (files: File[], groups?: FileGroup[], options?: UploadOptions) => void
  accept?: string
  multiple?: boolean
  maxSize?: number // bytes
  className?: string
}

export default function FileUpload({
  onUpload,
  multiple = true,
  maxSize = 5 * 1024 * 1024 * 1024, // 5GB
  className = '',
}: FileUploadProps) {
  const {
    isDragging,
    isUploading,
    selectedEpsg,
    setSelectedEpsg,
    inputRef,
    accept,
    displayFiles,
    groupRelatedCounts,
    validCount,
    errorCount,
    groupCount,
    conversionCount,
    selectedFiles,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handleFileSelect,
    handleUpload,
    removeFile,
    clearAll,
  } = useFileUpload({ multiple, maxSize, onUpload })

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
                      {item.zipContents.map((name) => (
                        <span
                          key={name}
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

          {/* EPSG 좌표계 선택 (변환 필요 파일이 있을 때) */}
          {conversionCount > 0 && (
            <div className="px-4 py-3 border-t border-slate-800">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-slate-400">좌표계 (EPSG)</span>
                <span className="text-xs text-slate-600">— 포인트클라우드/3D 모델의 원본 좌표계를 지정하세요</span>
              </div>
              <EPSGSelector
                value={selectedEpsg}
                onChange={setSelectedEpsg}
              />
            </div>
          )}

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
