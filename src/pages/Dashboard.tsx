import { useEffect, useState, useRef, useCallback } from 'react'
import { UploadCloud, Plus, ChevronRight, Database, Eye, Box, Loader2, FolderOpen } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import ProjectCard from '@/components/dashboard/ProjectCard'
import Viewer3D from '@/components/viewer/Viewer3D'
import { useProjectStore } from '@/stores/projectStore'
import { useAssetStore } from '@/stores/assetStore'
import { formatFileSize } from '@/utils/storage'
import { is3DFormat } from '@/constants/formats'
import { getConvertedFileInfo, revokeBlobUrl } from '@/utils/previewHelpers'
import type { ProjectData, FileMetadata } from '@/services/api'

export default function Dashboard() {
  const navigate = useNavigate()
  const { projects, isLoading: projectsLoading, initialize: initProjects, deleteProject, updateProject } = useProjectStore()
  const { files, isLoading: filesLoading, initialize: initFiles, getFileBlob } = useAssetStore()
  const [deleteConfirm, setDeleteConfirm] = useState<ProjectData | null>(null)
  const [selectedFile, setSelectedFile] = useState<FileMetadata | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const previewUrlRef = useRef<string | null>(null)

  useEffect(() => {
    initProjects()
    initFiles()
  }, [initProjects, initFiles])

  // 컴포넌트 언마운트 시 Blob URL 정리
  useEffect(() => {
    return () => {
      revokeBlobUrl(previewUrlRef.current)
    }
  }, [])

  const handleDelete = async () => {
    if (!deleteConfirm) return
    await deleteProject(deleteConfirm.id)
    setDeleteConfirm(null)
  }

  const handleStatusChange = async (project: ProjectData, status: ProjectData['status']) => {
    await updateProject(project.id, { status })
  }

  const handleProjectClick = (project: ProjectData) => {
    navigate(`/projects/${project.id}`)
  }

  const handleFileClick = useCallback(async (file: FileMetadata) => {
    if (!is3DFormat(file.format)) {
      setSelectedFile(file)
      setPreviewUrl(null)
      previewUrlRef.current = null
      return
    }

    // 변환이 필요한 포맷(E57, OBJ)만 변환된 파일로 로드 시도
    // GLB/GLTF/PLY/LAS는 원본 Blob으로 직접 로드 (Dashboard의 Viewer3D는 3D Tiles 미지원)
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

    // 변환 중이거나 E57 미변환 → 미리보기 불가
    if (file.conversionStatus === 'converting' || file.conversionStatus === 'pending' ||
        (file.format === 'e57' && file.conversionStatus !== 'ready')) {
      setSelectedFile(file)
      setPreviewUrl(null)
      previewUrlRef.current = null
      return
    }

    // 원본 Blob 로드
    revokeBlobUrl(previewUrlRef.current)
    setSelectedFile(file)
    setPreviewUrl(null)
    previewUrlRef.current = null
    setIsLoadingPreview(true)

    await new Promise(resolve => setTimeout(resolve, 150))

    try {
      const blob = await getFileBlob(file.id)
      if (blob) {
        const blobUrl = URL.createObjectURL(blob) + `#file.${file.format}`
        setPreviewUrl(blobUrl)
        previewUrlRef.current = blobUrl
      } else {
        console.error('Failed to get file blob')
        setPreviewUrl(null)
        previewUrlRef.current = null
      }
    } catch (error) {
      console.error('Failed to get file URL:', error)
      setPreviewUrl(null)
      previewUrlRef.current = null
    } finally {
      setIsLoadingPreview(false)
    }
  }, [getFileBlob])

  const recentProjects = projects.slice(0, 4)
  const recentFiles = files.slice(0, 10)

  return (
    <>
      <div className="flex justify-between items-end mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">대시보드</h1>
          <p className="text-slate-400 text-sm">최근 업로드된 공간 데이터를 확인하고 분석하세요.</p>
        </div>
        <div className="flex space-x-3">
          <Link
            to="/assets"
            className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-700 transition-all"
          >
            <UploadCloud size={18} />
            <span>데이터 업로드</span>
          </Link>
          <Link
            to="/projects"
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium shadow-lg shadow-blue-900/50 transition-all"
          >
            <Plus size={18} />
            <span>프로젝트 생성</span>
          </Link>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-12 gap-6 min-h-0">
        {/* Left Column */}
        <div className="col-span-5 flex flex-col gap-6 min-h-0">
          <div className="flex-shrink-0">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">
                최근 프로젝트
              </h2>
              <Link to="/projects" className="text-xs text-blue-400 hover:text-blue-300 flex items-center">
                전체보기 <ChevronRight size={12} />
              </Link>
            </div>
            {projectsLoading ? (
              <div className="flex items-center justify-center h-32 text-slate-400">
                <Loader2 size={24} className="animate-spin" />
              </div>
            ) : recentProjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-slate-500 bg-slate-900/50 rounded-xl border border-slate-800">
                <FolderOpen size={32} className="mb-2 opacity-50" />
                <span className="text-sm">프로젝트가 없습니다</span>
                <Link to="/projects" className="text-xs text-blue-400 hover:text-blue-300 mt-1">
                  새 프로젝트 만들기
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {recentProjects.slice(0, 2).map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onClick={() => handleProjectClick(project)}
                    onDelete={() => setDeleteConfirm(project)}
                    onStatusChange={(status) => handleStatusChange(project, status)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 flex flex-col min-h-0 bg-slate-900/50 rounded-xl border border-slate-800">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center">
              <h2 className="font-semibold text-white flex items-center gap-2">
                <Database size={16} className="text-blue-500" /> 최근 데이터
              </h2>
              <Link to="/assets" className="text-xs text-blue-400 hover:text-blue-300 flex items-center">
                전체보기 <ChevronRight size={12} />
              </Link>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {filesLoading ? (
                <div className="flex items-center justify-center h-32 text-slate-400">
                  <Loader2 size={24} className="animate-spin" />
                </div>
              ) : recentFiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-slate-500">
                  <Box size={32} className="mb-2 opacity-50" />
                  <span className="text-sm">업로드된 파일이 없습니다</span>
                  <Link to="/assets" className="text-xs text-blue-400 hover:text-blue-300 mt-1">
                    파일 업로드하기
                  </Link>
                </div>
              ) : (
                recentFiles.map((file) => (
                  <div
                    key={file.id}
                    onClick={() => handleFileClick(file)}
                    className={`flex items-center space-x-3 p-2 rounded-lg group transition-colors cursor-pointer ${
                      selectedFile?.id === file.id
                        ? 'bg-blue-500/20 border border-blue-500/50'
                        : 'hover:bg-slate-800'
                    }`}
                  >
                    <div className="relative">
                      {file.thumbnailUrl ? (
                        <img
                          src={file.thumbnailUrl}
                          alt={file.name}
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-slate-700 flex items-center justify-center">
                          <Box size={20} className="text-white/70" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium truncate text-slate-200">{file.name}</h4>
                      <div className="flex items-center text-xs text-slate-500 space-x-2 mt-0.5">
                        <span className="bg-slate-800 px-1.5 rounded text-slate-400 uppercase">{file.format}</span>
                        <span>{formatFileSize(file.size)}</span>
                        <span>{new Date(file.createdAt).toLocaleDateString('ko-KR')}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="col-span-7 flex flex-col min-h-0 gap-4">
          <div className="flex justify-between items-center px-1">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Eye size={16} /> 미리보기
              {selectedFile && (
                <span className="text-xs font-normal text-slate-400 ml-2">
                  - {selectedFile.name}
                </span>
              )}
            </h2>
          </div>
          {isLoadingPreview ? (
            <div className="w-full h-full bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3 text-slate-400">
                <Loader2 size={40} className="animate-spin" />
                <span className="text-sm">모델 로딩 중...</span>
              </div>
            </div>
          ) : (
            <Viewer3D
              modelUrl={previewUrl || undefined}
              modelFormat={selectedFile?.format}
            />
          )}
        </div>
      </div>

      {/* 삭제 확인 모달 */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl border border-slate-700 w-full max-w-sm shadow-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-2">프로젝트 삭제</h3>
            <p className="text-slate-400 mb-6">
              <span className="text-white font-medium">{deleteConfirm.name}</span>
              <br />
              프로젝트를 삭제하시겠습니까? 이 작업은 취소할 수 없습니다.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
