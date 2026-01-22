import { useEffect, useState } from 'react'
import {
  List,
  Plus,
  Search,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Edit2,
  Trash2,
  MoreVertical,
} from 'lucide-react'
import { AnnotationModal, AnnotationMapView } from '@/components/annotation'
import { useAnnotationStore } from '@/stores/annotationStore'
import { useProjectStore } from '@/stores/projectStore'
import type { AnnotationData } from '@/services/api'

// 우선순위 설정
const PRIORITY_CONFIG = {
  low: { label: '낮음', color: 'text-green-400', bg: 'bg-green-500/20', pin: 'text-green-500' },
  medium: { label: '보통', color: 'text-yellow-400', bg: 'bg-yellow-500/20', pin: 'text-yellow-500' },
  high: { label: '높음', color: 'text-orange-400', bg: 'bg-orange-500/20', pin: 'text-orange-500' },
  critical: { label: '긴급', color: 'text-red-400', bg: 'bg-red-500/20', pin: 'text-red-500' },
}

// 상태 설정
const STATUS_CONFIG = {
  open: { label: '열림', icon: AlertCircle, color: 'text-red-400' },
  in_progress: { label: '진행중', icon: Clock, color: 'text-yellow-400' },
  resolved: { label: '해결됨', icon: CheckCircle2, color: 'text-green-400' },
  closed: { label: '종료', icon: XCircle, color: 'text-slate-400' },
}

// Date 변환 함수
function toDate(value: Date | string | undefined | null): Date {
  if (!value) return new Date()
  if (value instanceof Date) return value
  return new Date(value)
}

// 상대적 시간 표시
function getRelativeTime(date: Date | string | undefined | null): string {
  const d = toDate(date)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) return '오늘'
  if (days === 1) return '어제'
  if (days < 7) return `${days}일 전`
  return d.toLocaleDateString('ko-KR')
}

export default function Annotations() {
  const {
    annotations,
    isLoading,
    error,
    statusFilter,
    priorityFilter,
    searchQuery,
    initialize,
    createAnnotation,
    updateAnnotation,
    deleteAnnotation,
    setStatusFilter,
    setPriorityFilter,
    setSearchQuery,
    getFilteredAnnotations,
    clearError,
  } = useAnnotationStore()

  const { projects, initialize: initProjects } = useProjectStore()

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingAnnotation, setEditingAnnotation] = useState<AnnotationData | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<AnnotationData | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [isMapCreateMode, setIsMapCreateMode] = useState(false)
  const [mapClickPosition, setMapClickPosition] = useState<{ lat: number; lng: number } | null>(null)

  // 초기화
  useEffect(() => {
    initialize()
    initProjects()
  }, [initialize, initProjects])

  // 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = () => {
      if (menuOpenId) {
        setMenuOpenId(null)
      }
    }
    // 약간의 딜레이를 주어 메뉴 버튼 클릭과 구분
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [menuOpenId])

  // 어노테이션 생성
  const handleCreate = async (data: Omit<AnnotationData, 'id' | 'createdAt' | 'updatedAt'>) => {
    await createAnnotation(data)
  }

  // 어노테이션 편집
  const handleEdit = async (data: Omit<AnnotationData, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!editingAnnotation) return
    await updateAnnotation(editingAnnotation.id, data)
  }

  // 어노테이션 삭제
  const handleDelete = async () => {
    if (!deleteConfirm) return
    await deleteAnnotation(deleteConfirm.id)
    setDeleteConfirm(null)
    if (selectedId === deleteConfirm.id) {
      setSelectedId(null)
    }
  }

  // 상태 빠른 변경
  const handleStatusChange = async (annotation: AnnotationData, status: AnnotationData['status']) => {
    await updateAnnotation(annotation.id, { status })
    setMenuOpenId(null)
  }

  const filteredAnnotations = getFilteredAnnotations()
  const selectedAnnotation = filteredAnnotations.find((a) => a.id === selectedId)

  // 맵 클릭 핸들러 (어노테이션 추가 모드)
  const handleMapClick = (lat: number, lng: number) => {
    if (isMapCreateMode) {
      setMapClickPosition({ lat, lng })
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* 헤더 */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">어노테이션 관리</h1>
        <div className="flex space-x-3">
          {/* 검색 */}
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="이슈 검색..."
              className="pl-10 pr-4 py-2 bg-slate-800 text-white border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 w-48"
            />
          </div>

          {/* 상태 필터 */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="px-3 py-2 bg-slate-800 text-slate-300 border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="all">모든 상태</option>
            <option value="open">열림</option>
            <option value="in_progress">진행중</option>
            <option value="resolved">해결됨</option>
            <option value="closed">종료</option>
          </select>

          {/* 우선순위 필터 */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as typeof priorityFilter)}
            className="px-3 py-2 bg-slate-800 text-slate-300 border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="all">모든 우선순위</option>
            <option value="critical">긴급</option>
            <option value="high">높음</option>
            <option value="medium">보통</option>
            <option value="low">낮음</option>
          </select>

          {/* 새 이슈 버튼 */}
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-lg shadow-blue-900/30 transition-colors"
          >
            <Plus size={18} />
            <span>새 이슈</span>
          </button>
        </div>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3">
          <AlertCircle className="text-red-400" size={20} />
          <span className="text-red-400 flex-1">{error}</span>
          <button onClick={clearError} className="text-red-400 hover:text-red-300 text-sm underline">
            닫기
          </button>
        </div>
      )}

      <div className="flex-1 flex gap-6 min-h-0">
        {/* 왼쪽: 이슈 목록 */}
        <div className="w-1/2 bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-800 bg-slate-900 flex justify-between items-center">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <List size={16} /> 이슈 목록 ({filteredAnnotations.length})
            </h3>
          </div>

          {isLoading && annotations.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 size={32} className="animate-spin text-slate-400" />
            </div>
          ) : filteredAnnotations.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
              <AlertCircle size={48} className="opacity-30 mb-3" />
              <span>
                {annotations.length === 0 ? '아직 이슈가 없습니다' : '검색 결과가 없습니다'}
              </span>
              {annotations.length === 0 && (
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors text-sm"
                >
                  첫 이슈 등록하기
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-y-auto custom-scrollbar flex-1">
              {filteredAnnotations.map((note) => {
                const StatusIcon = STATUS_CONFIG[note.status].icon
                const priorityConfig = PRIORITY_CONFIG[note.priority]

                return (
                  <div
                    key={note.id}
                    onClick={() => setSelectedId(note.id)}
                    className={`p-4 border-b border-slate-800 hover:bg-slate-800/50 transition-colors cursor-pointer group relative ${
                      selectedId === note.id ? 'bg-slate-800/70 border-l-2 border-l-blue-500' : ''
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="text-sm font-medium text-white group-hover:text-blue-400 transition-colors pr-8">
                        {note.title}
                      </h4>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-medium ${priorityConfig.bg} ${priorityConfig.color}`}
                        >
                          {priorityConfig.label}
                        </span>
                        {/* 메뉴 버튼 */}
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setMenuOpenId(menuOpenId === note.id ? null : note.id)
                            }}
                            className="p-1 text-slate-500 hover:text-white rounded hover:bg-slate-700"
                          >
                            <MoreVertical size={14} />
                          </button>
                          {menuOpenId === note.id && (
                            <div className="absolute right-0 top-6 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-10 py-1 min-w-[120px]">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setEditingAnnotation(note)
                                  setMenuOpenId(null)
                                }}
                                className="w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-800 flex items-center gap-2"
                              >
                                <Edit2 size={14} /> 편집
                              </button>
                              <div className="border-t border-slate-700 my-1" />
                              {note.status !== 'resolved' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleStatusChange(note, 'resolved')
                                  }}
                                  className="w-full px-3 py-2 text-left text-sm text-green-400 hover:bg-slate-800 flex items-center gap-2"
                                >
                                  <CheckCircle2 size={14} /> 해결 완료
                                </button>
                              )}
                              {note.status !== 'closed' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleStatusChange(note, 'closed')
                                  }}
                                  className="w-full px-3 py-2 text-left text-sm text-slate-400 hover:bg-slate-800 flex items-center gap-2"
                                >
                                  <XCircle size={14} /> 종료
                                </button>
                              )}
                              <div className="border-t border-slate-700 my-1" />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setDeleteConfirm(note)
                                  setMenuOpenId(null)
                                }}
                                className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-slate-800 flex items-center gap-2"
                              >
                                <Trash2 size={14} /> 삭제
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    {note.description && (
                      <p className="text-xs text-slate-500 mb-2 line-clamp-2">{note.description}</p>
                    )}
                    <div className="flex justify-between items-center text-xs text-slate-500">
                      <span className={`flex items-center gap-1 ${STATUS_CONFIG[note.status].color}`}>
                        <StatusIcon size={12} />
                        {STATUS_CONFIG[note.status].label}
                      </span>
                      <span>{getRelativeTime(note.updatedAt)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 오른쪽: Leaflet 맵 뷰 */}
        <div className="flex-1 bg-slate-950 rounded-xl border border-slate-800 relative overflow-hidden flex flex-col">
          <AnnotationMapView
            annotations={filteredAnnotations}
            selectedId={selectedId}
            onAnnotationClick={(annotation) => setSelectedId(annotation.id)}
            onMapClick={handleMapClick}
            isCreateMode={isMapCreateMode}
            onCreateModeChange={setIsMapCreateMode}
            pendingPosition={mapClickPosition}
            onConfirmPosition={() => {
              setIsCreateModalOpen(true)
              setIsMapCreateMode(false)
            }}
            onCancelPosition={() => setMapClickPosition(null)}
          />

          {/* 선택된 이슈 상세 정보 */}
          {selectedAnnotation && (
            <div className="absolute bottom-4 left-4 right-4 bg-slate-900/95 backdrop-blur border border-slate-700 rounded-lg p-4 shadow-xl z-[1000]">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-medium text-white">{selectedAnnotation.title}</h4>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-medium ${PRIORITY_CONFIG[selectedAnnotation.priority].bg} ${PRIORITY_CONFIG[selectedAnnotation.priority].color}`}
                  >
                    {PRIORITY_CONFIG[selectedAnnotation.priority].label}
                  </span>
                  <button
                    onClick={() => setEditingAnnotation(selectedAnnotation)}
                    className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-700"
                  >
                    <Edit2 size={14} />
                  </button>
                </div>
              </div>
              {selectedAnnotation.description && (
                <p className="text-sm text-slate-400 mb-2">{selectedAnnotation.description}</p>
              )}
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span className={`flex items-center gap-1 ${STATUS_CONFIG[selectedAnnotation.status].color}`}>
                  {(() => {
                    const Icon = STATUS_CONFIG[selectedAnnotation.status].icon
                    return <Icon size={12} />
                  })()}
                  {STATUS_CONFIG[selectedAnnotation.status].label}
                </span>
                <span>생성: {toDate(selectedAnnotation.createdAt).toLocaleDateString('ko-KR')}</span>
                <span>수정: {getRelativeTime(selectedAnnotation.updatedAt)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 생성 모달 */}
      <AnnotationModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false)
          setMapClickPosition(null)
        }}
        onSubmit={handleCreate}
        title={mapClickPosition ? '새 이슈 (맵에서 선택)' : '새 이슈'}
        projects={projects}
        initialPosition={mapClickPosition ? { x: mapClickPosition.lng, y: mapClickPosition.lat, z: 0 } : undefined}
      />

      {/* 편집 모달 */}
      <AnnotationModal
        isOpen={!!editingAnnotation}
        onClose={() => setEditingAnnotation(null)}
        onSubmit={handleEdit}
        annotation={editingAnnotation}
        title="이슈 편집"
        projects={projects}
      />

      {/* 삭제 확인 모달 */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl border border-slate-700 w-full max-w-sm shadow-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-2">이슈 삭제</h3>
            <p className="text-slate-400 mb-6">
              <span className="text-white font-medium">{deleteConfirm.title}</span>
              <br />
              이슈를 삭제하시겠습니까? 이 작업은 취소할 수 없습니다.
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
