import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { UploadCloud, BookOpen, ChevronRight, Database, Eye, Globe, Box, Loader2 } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import Viewer3D from '@/components/viewer/Viewer3D'
import { useStoryStore } from '@/stores/storyStore'
import { useReleaseStore } from '@/stores/releaseStore'
import { useAssetStore } from '@/stores/assetStore'
import { formatFileSize } from '@/utils/storage'
import { is3DFormat } from '@/constants/formats'
import { getConvertedFileInfo, revokeBlobUrl } from '@/utils/previewHelpers'
import type { FileMetadata } from '@/services/api'

// 통합 활동 피드 아이템 타입
type ActivityItem =
  | { type: 'asset'; id: string; name: string; detail: string; date: Date; file: FileMetadata }
  | { type: 'story'; id: string; name: string; detail: string; date: Date }
  | { type: 'publish'; id: string; name: string; detail: string; date: Date }

const AXIS_CONFIG = {
  asset: { icon: Database, label: 'Assets', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  story: { icon: BookOpen, label: 'Story', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
  publish: { icon: Globe, label: 'Publish', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
}

function getRelativeTime(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '방금 전'
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}일 전`
  return date.toLocaleDateString('ko-KR')
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { stories, isLoading: storiesLoading, initStories } = useStoryStore()
  const { releases, isLoading: releasesLoading, loadAllReleases } = useReleaseStore()
  const { files, storageUsed, isLoading: filesLoading, initialize: initFiles, getFileBlob } = useAssetStore()
  const [selectedFile, setSelectedFile] = useState<FileMetadata | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const previewUrlRef = useRef<string | null>(null)

  useEffect(() => {
    initStories()
    initFiles()
    loadAllReleases()
  }, [initStories, initFiles, loadAllReleases])

  useEffect(() => {
    return () => {
      revokeBlobUrl(previewUrlRef.current)
    }
  }, [])

  // 에셋 클릭 → 미리보기 로드
  const handleFileClick = useCallback(async (file: FileMetadata) => {
    if (!is3DFormat(file.format)) {
      setSelectedFile(file)
      setPreviewUrl(null)
      previewUrlRef.current = null
      return
    }

    const convertedInfo = ['e57', 'obj'].includes(file.format) ? getConvertedFileInfo(file) : null
    if (convertedInfo && file.conversionStatus === 'ready') {
      revokeBlobUrl(previewUrlRef.current)
      setSelectedFile(file)
      setPreviewUrl(null)
      previewUrlRef.current = null
      setIsLoadingPreview(true)

      try {
        const response = await fetch(convertedInfo.url)
        if (!response.ok) throw new Error(`변환된 파일 로드 실패: ${response.status}`)
        const blob = await response.blob()
        const blobUrl = URL.createObjectURL(blob) + `#file.${convertedInfo.format}`
        setPreviewUrl(blobUrl)
        previewUrlRef.current = blobUrl
      } catch (err) {
        console.error('변환된 파일 로드 실패:', err)
        setPreviewUrl(null)
        previewUrlRef.current = null
      } finally {
        setIsLoadingPreview(false)
      }
      return
    }

    if (file.conversionStatus === 'converting' || file.conversionStatus === 'pending' ||
        (file.format === 'e57' && file.conversionStatus !== 'ready')) {
      setSelectedFile(file)
      setPreviewUrl(null)
      previewUrlRef.current = null
      return
    }

    revokeBlobUrl(previewUrlRef.current)
    setSelectedFile(file)
    setPreviewUrl(null)
    previewUrlRef.current = null
    setIsLoadingPreview(true)

    try {
      const blob = await getFileBlob(file.id)
      if (blob) {
        const blobUrl = URL.createObjectURL(blob) + `#file.${file.format}`
        setPreviewUrl(blobUrl)
        previewUrlRef.current = blobUrl
      } else {
        setPreviewUrl(null)
        previewUrlRef.current = null
      }
    } catch {
      setPreviewUrl(null)
      previewUrlRef.current = null
    } finally {
      setIsLoadingPreview(false)
    }
  }, [getFileBlob])

  // 3축 통계
  const stats = useMemo(() => {
    const draftCount = stories.filter(s => s.status === 'draft').length
    const activeReleaseCount = releases.filter(r => r.status === 'active').length

    return {
      assets: { total: files.length, detail: formatFileSize(storageUsed) },
      story: { total: stories.length, detail: `${draftCount} 초안` },
      publish: { total: releases.length, detail: `${activeReleaseCount} 활성` },
    }
  }, [files, stories, releases, storageUsed])

  // 통합 활동 피드
  const activityFeed = useMemo<ActivityItem[]>(() => {
    const items: ActivityItem[] = []

    files.forEach((file) => {
      items.push({
        type: 'asset',
        id: file.id,
        name: file.name,
        detail: `${file.format.toUpperCase()} · ${formatFileSize(file.size)}`,
        date: new Date(file.createdAt),
        file,
      })
    })

    stories.forEach((story) => {
      items.push({
        type: 'story',
        id: story.id,
        name: story.title,
        detail: story.status === 'draft' ? '초안' : story.status === 'ready' ? '준비됨' : '보관됨',
        date: story.updatedAt,
      })
    })

    releases.forEach((release) => {
      items.push({
        type: 'publish',
        id: release.id,
        name: release.label || `v${release.version}`,
        detail: release.status === 'active' ? '활성' : '취소됨',
        date: release.createdAt,
      })
    })

    items.sort((a, b) => b.date.getTime() - a.date.getTime())
    return items.slice(0, 15)
  }, [files, stories, releases])

  const isLoading = storiesLoading || filesLoading || releasesLoading

  const handleActivityClick = (item: ActivityItem) => {
    if (item.type === 'asset') {
      handleFileClick(item.file)
    } else if (item.type === 'story') {
      navigate(`/story/${item.id}`)
    } else {
      navigate(`/publish/${item.id}`)
    }
  }

  return (
    <>
      {/* 헤더 */}
      <div className="flex justify-between items-end mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">대시보드</h1>
          <p className="text-slate-400 text-sm">공간 데이터의 기록과 공유를 한눈에.</p>
        </div>
        <div className="flex space-x-3">
          <Link
            to="/assets"
            className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-700 transition-all"
          >
            <UploadCloud size={18} />
            <span>에셋 업로드</span>
          </Link>
          <Link
            to="/story"
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium shadow-lg shadow-blue-900/50 transition-all"
          >
            <BookOpen size={18} />
            <span>Story 시작</span>
          </Link>
        </div>
      </div>

      {/* 3축 요약 카드 */}
      <div className="grid grid-cols-3 gap-4 mb-6 flex-shrink-0">
        {([
          { key: 'asset' as const, path: '/assets', stat: stats.assets },
          { key: 'story' as const, path: '/story', stat: stats.story },
          { key: 'publish' as const, path: '/publish', stat: stats.publish },
        ]).map(({ key, path, stat }) => {
          const config = AXIS_CONFIG[key]
          const Icon = config.icon
          return (
            <Link
              key={key}
              to={path}
              className={`${config.bg} border ${config.border} rounded-xl p-4 hover:brightness-125 transition-all group`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`flex items-center gap-2 ${config.color}`}>
                  <Icon size={18} />
                  <span className="text-sm font-semibold">{config.label}</span>
                </div>
                <ChevronRight size={14} className="text-slate-600 group-hover:text-slate-400 transition-colors" />
              </div>
              <div className="text-2xl font-bold text-white mb-1">
                {isLoading ? <Loader2 size={20} className="animate-spin" /> : stat.total}
              </div>
              <div className="text-xs text-slate-400">{isLoading ? '...' : stat.detail}</div>
            </Link>
          )
        })}
      </div>

      {/* 하단: 활동 피드 + 미리보기 */}
      <div className="flex-1 grid grid-cols-12 gap-6 min-h-0">
        {/* 왼쪽: 통합 활동 피드 */}
        <div className="col-span-5 flex flex-col min-h-0 bg-slate-900/50 rounded-xl border border-slate-800">
          <div className="p-4 border-b border-slate-800 flex justify-between items-center flex-shrink-0">
            <h2 className="font-semibold text-white text-sm">최근 활동</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
            {isLoading ? (
              <div className="flex items-center justify-center h-32 text-slate-400">
                <Loader2 size={24} className="animate-spin" />
              </div>
            ) : activityFeed.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-slate-500">
                <Box size={32} className="mb-2 opacity-50" />
                <span className="text-sm">아직 활동이 없습니다</span>
              </div>
            ) : (
              activityFeed.map((item) => {
                const config = AXIS_CONFIG[item.type]
                const Icon = config.icon
                const isSelected = item.type === 'asset' && selectedFile?.id === item.id
                return (
                  <div
                    key={`${item.type}-${item.id}`}
                    onClick={() => handleActivityClick(item)}
                    className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-blue-500/20 border border-blue-500/50'
                        : 'hover:bg-slate-800'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg ${config.bg} flex items-center justify-center flex-shrink-0`}>
                      <Icon size={14} className={config.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium truncate text-slate-200">{item.name}</h4>
                      <div className="flex items-center text-xs text-slate-500 gap-2 mt-0.5">
                        <span className={`${config.color} font-medium`}>{config.label}</span>
                        <span>{item.detail}</span>
                        <span>{getRelativeTime(item.date)}</span>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* 오른쪽: 미리보기 */}
        <div className="col-span-7 flex flex-col min-h-0 gap-4">
          <div className="flex justify-between items-center px-1 flex-shrink-0">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Eye size={16} /> 미리보기
              {selectedFile && (
                <span className="text-xs font-normal text-slate-400 ml-2">
                  - {selectedFile.name}
                </span>
              )}
            </h2>
          </div>
          <div className="relative flex-1 min-h-0">
            <Viewer3D
              modelUrl={previewUrl || undefined}
              modelFormat={selectedFile?.format}
            />
            {isLoadingPreview && (
              <div className="absolute inset-0 bg-slate-950/80 rounded-xl flex items-center justify-center z-10">
                <div className="flex flex-col items-center gap-3 text-slate-400">
                  <Loader2 size={40} className="animate-spin" />
                  <span className="text-sm">모델 로딩 중...</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
