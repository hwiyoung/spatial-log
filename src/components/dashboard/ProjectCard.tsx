import { useState, useRef, useEffect } from 'react'
import { Map, MoreVertical, Edit2, Trash2, Archive, CheckCircle } from 'lucide-react'
import type { ProjectData } from '@/services/api'

interface ProjectCardProps {
  project: ProjectData
  onClick?: () => void
  onEdit?: () => void
  onDelete?: () => void
  onStatusChange?: (status: 'active' | 'review' | 'completed' | 'archived') => void
}

// Date 변환 함수
function toDate(value: Date | string | undefined | null): Date {
  if (!value) return new Date()
  if (value instanceof Date) return value
  return new Date(value)
}

// 상대적 시간 표시 함수
function getRelativeTime(date: Date | string | undefined | null): string {
  const d = toDate(date)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const weeks = Math.floor(days / 7)

  if (seconds < 60) return '방금 전'
  if (minutes < 60) return `${minutes}분 전`
  if (hours < 24) return `${hours}시간 전`
  if (days < 7) return `${days}일 전`
  if (weeks < 4) return `${weeks}주 전`
  return d.toLocaleDateString('ko-KR')
}

// 상태 배지 컴포넌트
function StatusBadge({ status }: { status: ProjectData['status'] }) {
  const config = {
    active: { bg: 'bg-blue-500/10', text: 'text-blue-400', label: '진행중' },
    review: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', label: '검토중' },
    completed: { bg: 'bg-green-500/10', text: 'text-green-400', label: '완료' },
    archived: { bg: 'bg-slate-500/10', text: 'text-slate-400', label: '보관됨' },
  }
  const { bg, text, label } = config[status]

  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full ${bg} ${text}`}>
      {label}
    </span>
  )
}

export default function ProjectCard({
  project,
  onClick,
  onEdit,
  onDelete,
  onStatusChange,
}: ProjectCardProps) {
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // 외부 클릭 시 메뉴 닫기
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowMenu(!showMenu)
  }

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowMenu(false)
    onEdit?.()
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowMenu(false)
    onDelete?.()
  }

  const handleStatusChange = (e: React.MouseEvent, status: ProjectData['status']) => {
    e.stopPropagation()
    setShowMenu(false)
    onStatusChange?.(status)
  }

  return (
    <div
      onClick={onClick}
      className="bg-slate-800 p-5 rounded-xl border border-slate-700 hover:border-blue-500/50 hover:bg-slate-750 transition-all cursor-pointer group flex flex-col h-full relative"
    >
      <div className="flex justify-between items-start mb-3">
        <div
          className={`p-2 rounded-lg ${
            project.status === 'completed'
              ? 'bg-green-500/10 text-green-400'
              : project.status === 'archived'
                ? 'bg-slate-500/10 text-slate-400'
                : 'bg-blue-500/10 text-blue-400'
          } group-hover:bg-blue-500 group-hover:text-white transition-colors`}
        >
          <Map size={24} />
        </div>
        <div className="relative" ref={menuRef}>
          <button
            onClick={handleMenuClick}
            className="text-slate-500 hover:text-white p-1 rounded hover:bg-slate-700"
          >
            <MoreVertical size={16} />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-8 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50 py-1 min-w-[140px] max-h-[300px] overflow-y-auto">
              <button
                onClick={handleEdit}
                className="w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-800 flex items-center gap-2"
              >
                <Edit2 size={14} />
                편집
              </button>
              <div className="border-t border-slate-700 my-1" />
              <button
                onClick={(e) => handleStatusChange(e, 'active')}
                className="w-full px-3 py-2 text-left text-sm text-blue-400 hover:bg-slate-800 flex items-center gap-2"
              >
                <Map size={14} />
                진행중으로 변경
              </button>
              <button
                onClick={(e) => handleStatusChange(e, 'completed')}
                className="w-full px-3 py-2 text-left text-sm text-green-400 hover:bg-slate-800 flex items-center gap-2"
              >
                <CheckCircle size={14} />
                완료로 변경
              </button>
              <button
                onClick={(e) => handleStatusChange(e, 'archived')}
                className="w-full px-3 py-2 text-left text-sm text-slate-400 hover:bg-slate-800 flex items-center gap-2"
              >
                <Archive size={14} />
                보관하기
              </button>
              <div className="border-t border-slate-700 my-1" />
              <button
                onClick={handleDelete}
                className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-slate-800 flex items-center gap-2"
              >
                <Trash2 size={14} />
                삭제
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 mb-1">
        <h3 className="font-bold text-white truncate">{project.name}</h3>
        <StatusBadge status={project.status} />
      </div>

      {project.description && (
        <p className="text-xs text-slate-400 mb-2 line-clamp-2">{project.description}</p>
      )}

      <p className="text-xs text-slate-500 mb-4">
        최종 수정: {getRelativeTime(project.updatedAt)}
      </p>

      {project.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-4">
          {project.tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="text-[10px] px-2 py-0.5 bg-slate-700 rounded-full text-slate-300"
            >
              #{tag}
            </span>
          ))}
          {project.tags.length > 4 && (
            <span className="text-[10px] px-2 py-0.5 bg-slate-700 rounded-full text-slate-400">
              +{project.tags.length - 4}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-700/50">
        <span className="text-xs text-slate-500">
          {toDate(project.createdAt).toLocaleDateString('ko-KR')} 생성
        </span>
      </div>
    </div>
  )
}
