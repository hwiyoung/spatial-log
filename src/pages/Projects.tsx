import { useEffect, useState } from 'react'
import { Plus, Filter, Search, Loader2, AlertCircle, FolderOpen } from 'lucide-react'
import ProjectCard from '@/components/dashboard/ProjectCard'
import { ProjectModal } from '@/components/project'
import { useProjectStore } from '@/stores/projectStore'
import type { ProjectData } from '@/services/api'

export default function Projects() {
  const {
    projects,
    isLoading,
    error,
    statusFilter,
    searchQuery,
    initialize,
    createProject,
    updateProject,
    deleteProject,
    setStatusFilter,
    setSearchQuery,
    getFilteredProjects,
    clearError,
  } = useProjectStore()

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<ProjectData | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<ProjectData | null>(null)

  // 초기화
  useEffect(() => {
    initialize()
  }, [initialize])

  // 프로젝트 생성
  const handleCreate = async (data: { name: string; description: string; tags: string[] }) => {
    await createProject(data.name, data.description, data.tags)
  }

  // 프로젝트 편집
  const handleEdit = async (data: { name: string; description: string; tags: string[] }) => {
    if (!editingProject) return
    await updateProject(editingProject.id, {
      name: data.name,
      description: data.description,
      tags: data.tags,
    })
  }

  // 프로젝트 삭제
  const handleDelete = async () => {
    if (!deleteConfirm) return
    await deleteProject(deleteConfirm.id)
    setDeleteConfirm(null)
  }

  // 상태 변경
  const handleStatusChange = async (
    project: ProjectData,
    status: 'active' | 'review' | 'completed' | 'archived'
  ) => {
    await updateProject(project.id, { status })
  }

  const filteredProjects = getFilteredProjects()

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* 헤더 */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">내 프로젝트</h1>
        <div className="flex space-x-3">
          {/* 검색 */}
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="프로젝트 검색..."
              className="pl-10 pr-4 py-2 bg-slate-800 text-white border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 w-64"
            />
          </div>

          {/* 필터 */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as 'all' | 'active' | 'review' | 'completed' | 'archived')
              }
              className="appearance-none pl-10 pr-8 py-2 bg-slate-800 text-slate-300 border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="all">전체</option>
              <option value="active">진행중</option>
              <option value="review">검토중</option>
              <option value="completed">완료</option>
              <option value="archived">보관됨</option>
            </select>
            <Filter
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
            />
          </div>

          {/* 새 프로젝트 버튼 */}
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-lg shadow-blue-900/30 transition-colors"
          >
            <Plus size={18} />
            <span>새 프로젝트</span>
          </button>
        </div>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3">
          <AlertCircle className="text-red-400" size={20} />
          <span className="text-red-400 flex-1">{error}</span>
          <button
            onClick={clearError}
            className="text-red-400 hover:text-red-300 text-sm underline"
          >
            닫기
          </button>
        </div>
      )}

      {/* 로딩 상태 */}
      {isLoading && projects.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <Loader2 size={40} className="animate-spin" />
            <span>프로젝트를 불러오는 중...</span>
          </div>
        </div>
      ) : filteredProjects.length === 0 ? (
        /* 빈 상태 */
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-slate-400">
            <FolderOpen size={64} className="opacity-30" />
            {projects.length === 0 ? (
              <>
                <span className="text-lg">아직 프로젝트가 없습니다</span>
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
                >
                  첫 프로젝트 만들기
                </button>
              </>
            ) : (
              <>
                <span className="text-lg">검색 결과가 없습니다</span>
                <button
                  onClick={() => {
                    setSearchQuery('')
                    setStatusFilter('all')
                  }}
                  className="text-blue-400 hover:text-blue-300 underline"
                >
                  필터 초기화
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        /* 프로젝트 그리드 */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 overflow-visible pb-6">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onClick={() => {
                // TODO: 프로젝트 상세 페이지로 이동
              }}
              onEdit={() => setEditingProject(project)}
              onDelete={() => setDeleteConfirm(project)}
              onStatusChange={(status) => handleStatusChange(project, status)}
            />
          ))}

          {/* 새 프로젝트 카드 */}
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="border-2 border-dashed border-slate-800 rounded-xl flex flex-col items-center justify-center text-slate-600 hover:border-slate-700 hover:text-slate-500 cursor-pointer transition-colors min-h-[200px]"
          >
            <Plus size={48} className="mb-2 opacity-50" />
            <span className="font-medium">새 프로젝트 생성</span>
          </button>
        </div>
      )}

      {/* 생성 모달 */}
      <ProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreate}
        title="새 프로젝트"
      />

      {/* 편집 모달 */}
      <ProjectModal
        isOpen={!!editingProject}
        onClose={() => setEditingProject(null)}
        onSubmit={handleEdit}
        project={editingProject}
        title="프로젝트 편집"
      />

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
    </div>
  )
}
