// 어노테이션 관련 상수

// 어노테이션 우선순위 타입
export type AnnotationPriority = 'low' | 'medium' | 'high' | 'critical'

// 어노테이션 상태 타입
export type AnnotationStatus = 'open' | 'in_progress' | 'resolved' | 'closed'

// 우선순위별 CSS 색상 (Hex)
export const PRIORITY_COLORS: Record<AnnotationPriority, string> = {
  low: '#22c55e',      // green-500
  medium: '#eab308',   // yellow-500
  high: '#f97316',     // orange-500
  critical: '#ef4444', // red-500
}

// 우선순위별 배경색 (투명도 포함)
export const PRIORITY_BG_COLORS: Record<AnnotationPriority, string> = {
  low: 'rgba(34, 197, 94, 0.2)',
  medium: 'rgba(234, 179, 8, 0.2)',
  high: 'rgba(249, 115, 22, 0.2)',
  critical: 'rgba(239, 68, 68, 0.2)',
}

// 우선순위별 레이블
export const PRIORITY_LABELS: Record<AnnotationPriority, string> = {
  low: '낮음',
  medium: '중간',
  high: '높음',
  critical: '긴급',
}

// 상태별 CSS 색상
export const STATUS_COLORS: Record<AnnotationStatus, string> = {
  open: '#3b82f6',        // blue-500
  in_progress: '#f59e0b', // amber-500
  resolved: '#22c55e',    // green-500
  closed: '#6b7280',      // gray-500
}

// 상태별 레이블
export const STATUS_LABELS: Record<AnnotationStatus, string> = {
  open: '열림',
  in_progress: '진행 중',
  resolved: '해결됨',
  closed: '닫힘',
}

// 기본 마커 색상
export const DEFAULT_MARKER_COLOR = PRIORITY_COLORS.medium

// 헬퍼 함수: 우선순위 색상 가져오기 (fallback 포함)
export function getPriorityColor(priority: string): string {
  return PRIORITY_COLORS[priority as AnnotationPriority] || DEFAULT_MARKER_COLOR
}

// 헬퍼 함수: 상태 색상 가져오기 (fallback 포함)
export function getStatusColor(status: string): string {
  return STATUS_COLORS[status as AnnotationStatus] || STATUS_COLORS.open
}
