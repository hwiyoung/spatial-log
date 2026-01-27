import { useState, useCallback } from 'react'
import {
  Terminal,
  Database,
  HardDrive,
  Folder,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  X,
  RefreshCw,
} from 'lucide-react'
import type { FileMetadata } from '@/services/api'

interface StoragePathInfo {
  dbId: string
  fileName: string
  mimeType: string
  size: number
  format: string
  storagePath: string
  bucketPath: string
  dockerVolumePath: string
  thumbnailPath: string | null
  createdAt: string
  tags: string[]
}

interface DevConsoleProps {
  files: FileMetadata[]
  isOpen: boolean
  onClose: () => void
  onRefresh?: () => void
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function FileStorageInfo({ file }: { file: FileMetadata }) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  const storageInfo: StoragePathInfo = {
    dbId: file.id,
    fileName: file.name,
    mimeType: file.type,
    size: file.size,
    format: file.format,
    storagePath: file.storagePath || `${file.id}/${file.name}`,
    bucketPath: `spatial-files/${file.storagePath || `${file.id}/${file.name}`}`,
    dockerVolumePath: `/var/lib/storage/spatial-files/${file.storagePath || `${file.id}/${file.name}`}`,
    thumbnailPath: file.thumbnailUrl ? `spatial-files/${file.thumbnailUrl}` : null,
    createdAt: file.createdAt instanceof Date ? file.createdAt.toISOString() : String(file.createdAt),
    tags: file.tags || [],
  }

  const handleCopy = useCallback((text: string, field: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(field)
      setTimeout(() => setCopied(null), 2000)
    })
  }, [])

  return (
    <div className="border border-slate-700 rounded-lg overflow-hidden">
      {/* 헤더 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-3 py-2 bg-slate-800/50 hover:bg-slate-800 transition-colors text-left"
      >
        {expanded ? (
          <ChevronDown size={14} className="text-slate-400" />
        ) : (
          <ChevronRight size={14} className="text-slate-400" />
        )}
        <span className="flex-1 text-sm text-white truncate">{file.name}</span>
        <span className="text-xs text-slate-400">{formatBytes(file.size)}</span>
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
          file.format === 'image' ? 'bg-green-600/20 text-green-400' :
          file.format === 'gltf' || file.format === 'glb' ? 'bg-blue-600/20 text-blue-400' :
          file.format === 'obj' ? 'bg-purple-600/20 text-purple-400' :
          file.format === 'ply' || file.format === 'las' ? 'bg-yellow-600/20 text-yellow-400' :
          'bg-slate-600/20 text-slate-400'
        }`}>
          {file.format.toUpperCase()}
        </span>
      </button>

      {/* 상세 정보 */}
      {expanded && (
        <div className="p-3 bg-slate-900/50 space-y-2 text-xs">
          {/* DB ID */}
          <div className="flex items-start gap-2">
            <Database size={12} className="text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-slate-400 mb-0.5">DB Record ID</div>
              <div className="flex items-center gap-1">
                <code className="text-white font-mono text-[11px] bg-slate-800 px-1.5 py-0.5 rounded truncate flex-1">
                  {storageInfo.dbId}
                </code>
                <button
                  onClick={() => handleCopy(storageInfo.dbId, 'dbId')}
                  className="p-1 hover:bg-slate-700 rounded flex-shrink-0"
                >
                  {copied === 'dbId' ? (
                    <Check size={12} className="text-green-400" />
                  ) : (
                    <Copy size={12} className="text-slate-400" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Storage Bucket Path */}
          <div className="flex items-start gap-2">
            <Folder size={12} className="text-yellow-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-slate-400 mb-0.5">Storage Bucket Path</div>
              <div className="flex items-center gap-1">
                <code className="text-white font-mono text-[11px] bg-slate-800 px-1.5 py-0.5 rounded truncate flex-1">
                  {storageInfo.bucketPath}
                </code>
                <button
                  onClick={() => handleCopy(storageInfo.bucketPath, 'bucketPath')}
                  className="p-1 hover:bg-slate-700 rounded flex-shrink-0"
                >
                  {copied === 'bucketPath' ? (
                    <Check size={12} className="text-green-400" />
                  ) : (
                    <Copy size={12} className="text-slate-400" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Docker Volume Path */}
          <div className="flex items-start gap-2">
            <HardDrive size={12} className="text-green-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-slate-400 mb-0.5">Docker Volume Path</div>
              <div className="flex items-center gap-1">
                <code className="text-white font-mono text-[11px] bg-slate-800 px-1.5 py-0.5 rounded truncate flex-1">
                  {storageInfo.dockerVolumePath}
                </code>
                <button
                  onClick={() => handleCopy(storageInfo.dockerVolumePath, 'dockerPath')}
                  className="p-1 hover:bg-slate-700 rounded flex-shrink-0"
                >
                  {copied === 'dockerPath' ? (
                    <Check size={12} className="text-green-400" />
                  ) : (
                    <Copy size={12} className="text-slate-400" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* 썸네일 경로 */}
          {storageInfo.thumbnailPath && (
            <div className="flex items-start gap-2">
              <Folder size={12} className="text-purple-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-slate-400 mb-0.5">Thumbnail Path</div>
                <div className="flex items-center gap-1">
                  <code className="text-white font-mono text-[11px] bg-slate-800 px-1.5 py-0.5 rounded truncate flex-1">
                    {storageInfo.thumbnailPath}
                  </code>
                  <button
                    onClick={() => handleCopy(storageInfo.thumbnailPath!, 'thumbnailPath')}
                    className="p-1 hover:bg-slate-700 rounded flex-shrink-0"
                  >
                    {copied === 'thumbnailPath' ? (
                      <Check size={12} className="text-green-400" />
                    ) : (
                      <Copy size={12} className="text-slate-400" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 메타데이터 */}
          <div className="pt-2 border-t border-slate-700 grid grid-cols-2 gap-2">
            <div>
              <div className="text-slate-400 mb-0.5">MIME Type</div>
              <div className="text-white font-mono text-[11px]">{storageInfo.mimeType}</div>
            </div>
            <div>
              <div className="text-slate-400 mb-0.5">Size</div>
              <div className="text-white font-mono text-[11px]">{formatBytes(storageInfo.size)}</div>
            </div>
            <div>
              <div className="text-slate-400 mb-0.5">Created</div>
              <div className="text-white font-mono text-[11px]">{formatDate(storageInfo.createdAt)}</div>
            </div>
            <div>
              <div className="text-slate-400 mb-0.5">Format</div>
              <div className="text-white font-mono text-[11px]">{storageInfo.format.toUpperCase()}</div>
            </div>
          </div>

          {/* 태그 */}
          {storageInfo.tags.length > 0 && (
            <div className="pt-2 border-t border-slate-700">
              <div className="text-slate-400 mb-1">Tags</div>
              <div className="flex flex-wrap gap-1">
                {storageInfo.tags.map((tag, i) => (
                  <span key={i} className="px-1.5 py-0.5 bg-slate-700 rounded text-[10px] text-slate-300">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function DevConsole({ files, isOpen, onClose, onRefresh }: DevConsoleProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [formatFilter, setFormatFilter] = useState<string>('all')

  // 필터링된 파일 목록
  const filteredFiles = files.filter((file) => {
    const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          file.id.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFormat = formatFilter === 'all' || file.format === formatFilter
    return matchesSearch && matchesFormat
  })

  // 포맷별 통계
  const formatStats = files.reduce((acc, file) => {
    acc[file.format] = (acc[file.format] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-3xl max-h-[80vh] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <Terminal size={20} className="text-green-400" />
            <h2 className="text-lg font-semibold text-white">개발자 콘솔</h2>
            <span className="px-2 py-0.5 bg-green-600/20 text-green-400 text-xs rounded-full">
              DEV
            </span>
          </div>
          <div className="flex items-center gap-2">
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                title="새로고침"
              >
                <RefreshCw size={16} className="text-slate-400" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X size={16} className="text-slate-400" />
            </button>
          </div>
        </div>

        {/* 통계 바 */}
        <div className="px-4 py-3 border-b border-slate-700 bg-slate-800/30">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Database size={14} className="text-blue-400" />
              <span className="text-slate-400">총 파일:</span>
              <span className="text-white font-medium">{files.length}개</span>
            </div>
            <div className="flex items-center gap-2">
              <HardDrive size={14} className="text-green-400" />
              <span className="text-slate-400">총 크기:</span>
              <span className="text-white font-medium">
                {formatBytes(files.reduce((sum, f) => sum + f.size, 0))}
              </span>
            </div>
          </div>
          {/* 포맷별 통계 */}
          <div className="flex flex-wrap gap-2 mt-2">
            {Object.entries(formatStats).map(([format, count]) => (
              <span key={format} className="px-2 py-0.5 bg-slate-700 rounded text-xs text-slate-300">
                {format.toUpperCase()}: {count}
              </span>
            ))}
          </div>
        </div>

        {/* 필터 */}
        <div className="px-4 py-3 border-b border-slate-700 flex gap-3">
          <input
            type="text"
            placeholder="파일명 또는 ID로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-3 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
          <select
            value={formatFilter}
            onChange={(e) => setFormatFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
          >
            <option value="all">모든 포맷</option>
            {Object.keys(formatStats).map((format) => (
              <option key={format} value={format}>{format.toUpperCase()}</option>
            ))}
          </select>
        </div>

        {/* 파일 목록 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredFiles.length > 0 ? (
            filteredFiles.map((file) => (
              <FileStorageInfo key={file.id} file={file} />
            ))
          ) : (
            <div className="text-center py-8 text-slate-500">
              {files.length === 0 ? (
                <p>업로드된 파일이 없습니다.</p>
              ) : (
                <p>검색 결과가 없습니다.</p>
              )}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="px-4 py-2 border-t border-slate-700 text-xs text-slate-500">
          <p>
            Docker Volume: <code className="bg-slate-800 px-1 rounded">storage-data:/var/lib/storage</code>
          </p>
        </div>
      </div>
    </div>
  )
}
