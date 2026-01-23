import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Edit2,
  Trash2,
  Loader2,
  AlertCircle,
  FolderOpen,
  Plus,
  MessageSquare,
  Box,
  Link2Off,
  FileImage,
  FileBox,
  Eye,
  X,
  ArrowLeftCircle,
} from 'lucide-react'
import { useProjectStore } from '@/stores/projectStore'
import { useAssetStore } from '@/stores/assetStore'
import { useAnnotationStore } from '@/stores/annotationStore'
import { ProjectModal } from '@/components/project'
import { AssetLinkModal } from '@/components/project'
import ThreeCanvas from '@/components/viewer/ThreeCanvas'
import type { ProjectData, FileMetadata, AnnotationData } from '@/services/api'
import { formatFileSize } from '@/utils/storage'

type Tab = 'assets' | 'annotations' | 'viewer'

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: '진행중', color: 'bg-green-500/20 text-green-400' },
  review: { label: '검토중', color: 'bg-yellow-500/20 text-yellow-400' },
  completed: { label: '완료', color: 'bg-blue-500/20 text-blue-400' },
  archived: { label: '보관됨', color: 'bg-slate-500/20 text-slate-400' },
}

export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()

  const { getProject, updateProject, deleteProject } = useProjectStore()
  const { fetchFilesByProject, unlinkFromProject, getFileBlob } = useAssetStore()
  const { fetchAnnotationsByProject } = useAnnotationStore()

  const [project, setProject] = useState<ProjectData | null>(null)
  const [files, setFiles] = useState<FileMetadata[]>([])
  const [annotations, setAnnotations] = useState<AnnotationData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('assets')
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([])

  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isAssetLinkModalOpen, setIsAssetLinkModalOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  // 3D 미리보기 상태
  const [previewFile, setPreviewFile] = useState<FileMetadata | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)

  // 데이터 로드
  useEffect(() => {
    const loadData = async () => {
      if (!projectId) return

      setIsLoading(true)
      setError(null)

      try {
        const projectData = await getProject(projectId)
        if (!projectData) {
          setError('프로젝트를 찾을 수 없습니다.')
          return
        }
        setProject(projectData)

        const [filesData, annotationsData] = await Promise.all([
          fetchFilesByProject(projectId),
          fetchAnnotationsByProject(projectId),
        ])
        setFiles(filesData)
        setAnnotations(annotationsData)
      } catch (err) {
        setError(err instanceof Error ? err.message : '데이터 로드 실패')
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [projectId, getProject, fetchFilesByProject, fetchAnnotationsByProject])

  // 프로젝트 편집
  const handleEdit = async (data: { name: string; description: string; tags: string[] }) => {
    if (!project) return
    await updateProject(project.id, {
      name: data.name,
      description: data.description,
      tags: data.tags,
    })
    // 프로젝트 정보 다시 로드
    const updated = await getProject(project.id)
    if (updated) {
      setProject(updated)
    }
    setIsEditModalOpen(false)
  }

  // 프로젝트 삭제
  const handleDelete = async () => {
    if (!project) return
    await deleteProject(project.id)
    navigate('/projects')
  }

  // 파일 선택
  const handleFileSelect = (id: string, multi = false) => {
    if (multi) {
      setSelectedFileIds((prev) =>
        prev.includes(id) ? prev.filter((fid) => fid !== id) : [...prev, id]
      )
    } else {
      setSelectedFileIds([id])
    }
  }

  // 파일 연결 해제
  const handleUnlinkFiles = async () => {
    if (selectedFileIds.length === 0) return
    await unlinkFromProject(selectedFileIds)
    setFiles((prev) => prev.filter((f) => !selectedFileIds.includes(f.id)))
    setSelectedFileIds([])
  }

  // 에셋 연결 후 새로고침
  const handleAssetLinked = async () => {
    if (!projectId) return
    const filesData = await fetchFilesByProject(projectId)
    setFiles(filesData)
    setIsAssetLinkModalOpen(false)
  }

  // 파일 아이콘 결정
  const getFileIcon = (format: string) => {
    if (format === 'image') return FileImage
    if (['gltf', 'glb', 'obj', 'fbx', 'ply', 'las', 'e57'].includes(format)) return FileBox
    return FolderOpen
  }

  // 3D 미리보기
  const handlePreview = useCallback(async (file: FileMetadata) => {
    const is3DFormat = ['gltf', 'glb', 'obj', 'fbx', 'ply', 'las', 'e57'].includes(file.format)
    if (!is3DFormat) {
      alert('3D 미리보기는 GLTF, GLB, OBJ, FBX, PLY, LAS 파일만 지원합니다.')
      return
    }

    // 이전 미리보기 정리
    if (previewUrl) {
      const blobUrlOnly = previewUrl.split('#')[0] || previewUrl
      if (blobUrlOnly.startsWith('blob:')) {
        URL.revokeObjectURL(blobUrlOnly)
      }
    }

    setPreviewFile(file)
    setIsLoadingPreview(true)
    setActiveTab('viewer')

    try {
      const blob = await getFileBlob(file.id)
      if (blob) {
        const blobUrl = URL.createObjectURL(blob) + `#file.${file.format}`
        setPreviewUrl(blobUrl)
      } else {
        alert('파일을 로드할 수 없습니다.')
        setPreviewFile(null)
      }
    } catch (err) {
      console.error('미리보기 로드 실패:', err)
      alert('파일을 로드할 수 없습니다.')
      setPreviewFile(null)
    } finally {
      setIsLoadingPreview(false)
    }
  }, [getFileBlob, previewUrl])

  // 미리보기 닫기
  const closePreview = useCallback(() => {
    if (previewUrl) {
      const blobUrlOnly = previewUrl.split('#')[0] || previewUrl
      if (blobUrlOnly.startsWith('blob:')) {
        URL.revokeObjectURL(blobUrlOnly)
      }
    }
    setPreviewFile(null)
    setPreviewUrl(null)
  }, [previewUrl])

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Loader2 size={40} className="animate-spin" />
          <span>프로젝트를 불러오는 중...</span>
        </div>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-slate-400">
          <AlertCircle size={64} className="opacity-30 text-red-400" />
          <span className="text-lg text-red-400">{error || '프로젝트를 찾을 수 없습니다.'}</span>
          <button
            onClick={() => navigate('/projects')}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            프로젝트 목록으로
          </button>
        </div>
      </div>
    )
  }

  const statusInfo = STATUS_LABELS[project.status] ?? { label: '알 수 없음', color: 'bg-slate-500/20 text-slate-400' }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* 헤더 */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => navigate('/projects')}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} className="text-slate-400" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{project.name}</h1>
              <span className={`px-2 py-1 text-xs font-medium rounded ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
            </div>
            {project.description && (
              <p className="text-slate-400 mt-1">{project.description}</p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
              title="편집"
            >
              <Edit2 size={20} className="text-slate-400" />
            </button>
            <button
              onClick={() => setDeleteConfirm(true)}
              className="p-2 hover:bg-red-900/30 rounded-lg transition-colors"
              title="삭제"
            >
              <Trash2 size={20} className="text-red-400" />
            </button>
          </div>
        </div>

        {/* 태그 */}
        {project.tags.length > 0 && (
          <div className="flex gap-2 mb-4">
            {project.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-1 bg-slate-800 text-slate-300 text-xs rounded"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* 탭 */}
        <div className="flex border-b border-slate-700">
          <button
            onClick={() => setActiveTab('assets')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'assets'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2">
              <FolderOpen size={18} />
              에셋 ({files.length})
            </span>
          </button>
          <button
            onClick={() => setActiveTab('annotations')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'annotations'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2">
              <MessageSquare size={18} />
              어노테이션 ({annotations.length})
            </span>
          </button>
          <button
            onClick={() => setActiveTab('viewer')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'viewer'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2">
              <Box size={18} />
              3D 뷰어
            </span>
          </button>
        </div>
      </div>

      {/* 탭 컨텐츠 */}
      <div className="flex-1 overflow-hidden">
        {/* 에셋 탭 */}
        {activeTab === 'assets' && (
          <div className="h-full overflow-auto pr-2">
            {/* 액션 바 */}
            <div className="flex justify-between items-center mb-4">
              <div className="text-sm text-slate-400">
                {selectedFileIds.length > 0 && (
                  <span>{selectedFileIds.length}개 선택됨</span>
                )}
              </div>
              <div className="flex gap-2">
                {selectedFileIds.length > 0 && (
                  <button
                    onClick={handleUnlinkFiles}
                    className="flex items-center gap-2 px-3 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-colors"
                  >
                    <Link2Off size={16} />
                    연결 해제
                  </button>
                )}
                <button
                  onClick={() => setIsAssetLinkModalOpen(true)}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
                >
                  <Plus size={16} />
                  에셋 추가
                </button>
              </div>
            </div>

            {/* 파일 그리드 */}
            {files.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <FolderOpen size={64} className="opacity-30 mb-4" />
                <span className="text-lg mb-4">연결된 에셋이 없습니다</span>
                <button
                  onClick={() => setIsAssetLinkModalOpen(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
                >
                  에셋 추가하기
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {files.map((file) => {
                  const FileIcon = getFileIcon(file.format)
                  const isSelected = selectedFileIds.includes(file.id)
                  const is3DFormat = ['gltf', 'glb', 'obj', 'fbx', 'ply', 'las', 'e57'].includes(file.format)
                  return (
                    <div
                      key={file.id}
                      onClick={(e) => handleFileSelect(file.id, e.ctrlKey || e.metaKey)}
                      onDoubleClick={() => is3DFormat && handlePreview(file)}
                      className={`p-4 bg-slate-800/50 rounded-lg cursor-pointer transition-all group relative ${
                        isSelected
                          ? 'ring-2 ring-blue-500 bg-blue-500/10'
                          : 'hover:bg-slate-800'
                      }`}
                    >
                      {/* 호버 시 미리보기 버튼 */}
                      {is3DFormat && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handlePreview(file)
                          }}
                          className="absolute top-2 right-2 p-1.5 bg-green-600 hover:bg-green-500 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          title="3D 미리보기"
                        >
                          <Eye size={14} className="text-white" />
                        </button>
                      )}
                      <div className="flex flex-col items-center text-center">
                        {file.thumbnailUrl ? (
                          <img
                            src={file.thumbnailUrl}
                            alt={file.name}
                            className="w-16 h-16 object-cover rounded mb-2"
                          />
                        ) : (
                          <FileIcon size={48} className="text-slate-500 mb-2" />
                        )}
                        <span className="text-sm text-white truncate w-full">{file.name}</span>
                        <span className="text-xs text-slate-500">{formatFileSize(file.size)}</span>
                        {is3DFormat && (
                          <span className="text-[10px] text-blue-400 mt-1">더블클릭으로 미리보기</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* 어노테이션 탭 */}
        {activeTab === 'annotations' && (
          <div>
            {annotations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <MessageSquare size={64} className="opacity-30 mb-4" />
                <span className="text-lg">어노테이션이 없습니다</span>
              </div>
            ) : (
              <div className="space-y-2">
                {annotations.map((annotation) => (
                  <div
                    key={annotation.id}
                    className="p-4 bg-slate-800/50 rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium text-white">{annotation.title}</h3>
                        {annotation.description && (
                          <p className="text-sm text-slate-400 mt-1">{annotation.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-1 text-xs rounded ${
                            annotation.priority === 'critical'
                              ? 'bg-red-500/20 text-red-400'
                              : annotation.priority === 'high'
                                ? 'bg-orange-500/20 text-orange-400'
                                : annotation.priority === 'medium'
                                  ? 'bg-yellow-500/20 text-yellow-400'
                                  : 'bg-green-500/20 text-green-400'
                          }`}
                        >
                          {annotation.priority}
                        </span>
                        <span
                          className={`px-2 py-1 text-xs rounded ${
                            annotation.status === 'open'
                              ? 'bg-blue-500/20 text-blue-400'
                              : annotation.status === 'in_progress'
                                ? 'bg-yellow-500/20 text-yellow-400'
                                : annotation.status === 'resolved'
                                  ? 'bg-green-500/20 text-green-400'
                                  : 'bg-slate-500/20 text-slate-400'
                          }`}
                        >
                          {annotation.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 3D 뷰어 탭 */}
        {activeTab === 'viewer' && (
          <div className="h-full">
            {previewFile ? (
              <div className="h-full flex flex-col">
                {/* 미리보기 헤더 */}
                <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-t-lg border-b border-slate-700">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        closePreview()
                        setActiveTab('assets')
                      }}
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                      title="에셋 목록으로 돌아가기"
                    >
                      <ArrowLeftCircle size={20} />
                    </button>
                    <Box size={20} className="text-blue-400" />
                    <div>
                      <h3 className="font-medium text-white">{previewFile.name}</h3>
                      <span className="text-xs text-slate-400">
                        {previewFile.format.toUpperCase()} · {formatFileSize(previewFile.size)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      closePreview()
                      setActiveTab('assets')
                    }}
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                    title="닫기"
                  >
                    <X size={20} />
                  </button>
                </div>
                {/* 3D 뷰어 */}
                <div className="flex-1 min-h-[500px] relative">
                  {isLoadingPreview ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                      <div className="flex flex-col items-center gap-3 text-slate-400">
                        <Loader2 size={40} className="animate-spin" />
                        <span>모델 로딩 중...</span>
                      </div>
                    </div>
                  ) : previewUrl ? (
                    <ThreeCanvas modelUrl={previewUrl} modelFormat={previewFile.format} />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-500">
                      <span>파일을 로드할 수 없습니다</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <Box size={64} className="opacity-30 mb-4" />
                <span className="text-lg mb-2">3D 뷰어</span>
                <span className="text-sm">에셋 탭에서 파일을 더블클릭하거나 미리보기 버튼을 눌러 확인하세요</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 편집 모달 */}
      <ProjectModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSubmit={handleEdit}
        project={project}
        title="프로젝트 편집"
      />

      {/* 에셋 연결 모달 */}
      <AssetLinkModal
        isOpen={isAssetLinkModalOpen}
        onClose={() => setIsAssetLinkModalOpen(false)}
        projectId={project.id}
        onLinked={handleAssetLinked}
      />

      {/* 삭제 확인 모달 */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl border border-slate-700 w-full max-w-sm shadow-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-2">프로젝트 삭제</h3>
            <p className="text-slate-400 mb-6">
              <span className="text-white font-medium">{project.name}</span>
              <br />
              프로젝트를 삭제하시겠습니까? 이 작업은 취소할 수 없습니다.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(false)}
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
    </div>
  )
}
