import { useState, useEffect } from 'react'
import { X, AlertCircle, Clock, CheckCircle2, XCircle, FolderOpen, MapPin } from 'lucide-react'
import type { AnnotationData, ProjectData } from '@/services/api'

interface AnnotationModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (
    data: Omit<AnnotationData, 'id' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>
  annotation?: AnnotationData | null
  title?: string
  projectId?: string | null
  projects?: ProjectData[]
  initialPosition?: { x: number; y: number; z: number } | null
}

const PRIORITY_OPTIONS = [
  { value: 'low', label: '낮음', color: 'text-green-400', bg: 'bg-green-500/10' },
  { value: 'medium', label: '보통', color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  { value: 'high', label: '높음', color: 'text-orange-400', bg: 'bg-orange-500/10' },
  { value: 'critical', label: '긴급', color: 'text-red-400', bg: 'bg-red-500/10' },
] as const

const STATUS_OPTIONS = [
  { value: 'open', label: '열림', icon: AlertCircle, color: 'text-red-400' },
  { value: 'in_progress', label: '진행중', icon: Clock, color: 'text-yellow-400' },
  { value: 'resolved', label: '해결됨', icon: CheckCircle2, color: 'text-green-400' },
  { value: 'closed', label: '종료', icon: XCircle, color: 'text-slate-400' },
] as const

export default function AnnotationModal({
  isOpen,
  onClose,
  onSubmit,
  annotation,
  title,
  projectId,
  projects = [],
  initialPosition,
}: AnnotationModalProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium' as AnnotationData['priority'],
    status: 'open' as AnnotationData['status'],
    selectedProjectId: '' as string,
    positionX: '',
    positionY: '',
    positionZ: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEditMode = !!annotation

  // 어노테이션 데이터가 변경되면 폼 초기화
  useEffect(() => {
    if (annotation) {
      setFormData({
        title: annotation.title,
        description: annotation.description || '',
        priority: annotation.priority,
        status: annotation.status,
        selectedProjectId: annotation.projectId || '',
        positionX: annotation.position?.x?.toString() || '',
        positionY: annotation.position?.y?.toString() || '',
        positionZ: annotation.position?.z?.toString() || '',
      })
    } else {
      setFormData({
        title: '',
        description: '',
        priority: 'medium',
        status: 'open',
        selectedProjectId: projectId || '',
        positionX: initialPosition?.x?.toString() || '',
        positionY: initialPosition?.y?.toString() || '',
        positionZ: initialPosition?.z?.toString() || '',
      })
    }
    setError(null)
  }, [annotation, isOpen, projectId, initialPosition])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.title.trim()) {
      setError('제목을 입력해주세요.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    // 위치 정보 파싱
    const position = formData.positionX || formData.positionY || formData.positionZ
      ? {
          x: parseFloat(formData.positionX) || 0,
          y: parseFloat(formData.positionY) || 0,
          z: parseFloat(formData.positionZ) || 0,
        }
      : null

    try {
      await onSubmit({
        projectId: formData.selectedProjectId || null,
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        priority: formData.priority,
        status: formData.status,
        position,
        gps: annotation?.gps ?? null,
        fileId: annotation?.fileId ?? null,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1100] p-4">
      <div className="bg-slate-900 rounded-xl border border-slate-700 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700 sticky top-0 bg-slate-900">
          <h2 className="text-lg font-semibold text-white">
            {title || (isEditMode ? '이슈 편집' : '새 이슈')}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800"
          >
            <X size={20} />
          </button>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* 프로젝트 선택 */}
          {projects.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <FolderOpen size={14} />
                  프로젝트
                </span>
              </label>
              <select
                value={formData.selectedProjectId}
                onChange={(e) => setFormData({ ...formData, selectedProjectId: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="">프로젝트 선택 (선택사항)</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 제목 */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              제목 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="이슈 제목을 입력하세요"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              autoFocus
            />
          </div>

          {/* 설명 */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">설명</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="이슈에 대한 상세 설명을 입력하세요"
              rows={3}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          {/* 3D 위치 */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              <span className="flex items-center gap-1.5">
                <MapPin size={14} />
                3D 위치 (선택사항)
              </span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs text-slate-500 mb-1">X</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.positionX}
                  onChange={(e) => setFormData({ ...formData, positionX: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Y</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.positionY}
                  onChange={(e) => setFormData({ ...formData, positionY: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Z</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.positionZ}
                  onChange={(e) => setFormData({ ...formData, positionZ: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm"
                />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              3D 뷰어에서 PenTool 버튼을 클릭한 후 위치를 클릭하면 자동으로 입력됩니다.
            </p>
          </div>

          {/* 우선순위 */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">우선순위</label>
            <div className="grid grid-cols-4 gap-2">
              {PRIORITY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, priority: option.value })}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    formData.priority === option.value
                      ? `${option.bg} ${option.color} border border-current`
                      : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* 상태 */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">상태</label>
            <div className="grid grid-cols-2 gap-2">
              {STATUS_OPTIONS.map((option) => {
                const Icon = option.icon
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, status: option.value })}
                    className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      formData.status === option.value
                        ? `bg-slate-700 ${option.color} border border-current`
                        : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <Icon size={16} />
                    {option.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* 버튼 */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white rounded-lg transition-colors"
            >
              {isSubmitting ? '처리중...' : isEditMode ? '저장' : '생성'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
