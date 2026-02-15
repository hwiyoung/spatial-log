import { Box, Image, FileText, StickyNote } from 'lucide-react'
import type { SceneEntryType } from '@/types/story'

/** 엔트리 타입별 통합 설정 */
export const ENTRY_TYPE_CONFIG: Record<SceneEntryType, {
  icon: typeof Box
  color: string
  bgColor: string
  hexColor: string
  label: string
  koLabel: string
  fileRequired: boolean
}> = {
  spatial: { icon: Box, color: 'text-blue-400', bgColor: 'bg-blue-500/20', hexColor: '#3b82f6', label: 'Spatial', koLabel: '3D 데이터', fileRequired: true },
  visual: { icon: Image, color: 'text-green-400', bgColor: 'bg-green-500/20', hexColor: '#22c55e', label: 'Visual', koLabel: '이미지', fileRequired: true },
  document: { icon: FileText, color: 'text-purple-400', bgColor: 'bg-purple-500/20', hexColor: '#a855f7', label: 'Document', koLabel: '문서', fileRequired: true },
  note: { icon: StickyNote, color: 'text-amber-400', bgColor: 'bg-amber-500/20', hexColor: '#f59e0b', label: 'Note', koLabel: '메모', fileRequired: false },
}

/** ENTRY_TYPE_CONFIG의 배열 형태 (순서 보장 필요 시) */
export const ENTRY_TYPES = (Object.entries(ENTRY_TYPE_CONFIG) as [SceneEntryType, typeof ENTRY_TYPE_CONFIG[SceneEntryType]][]).map(
  ([type, config]) => ({ type, ...config })
)

/** 타입별 안전한 설정 접근 (알 수 없는 타입 → note 폴백) */
export function getEntryTypeConfig(type: string) {
  return ENTRY_TYPE_CONFIG[type as SceneEntryType] ?? ENTRY_TYPE_CONFIG.note
}

/** 엔트리 타입별 허용 파일 포맷 필터 */
export const FILE_FORMAT_FILTERS: Record<string, (format: string) => boolean> = {
  spatial: (f) => ['gltf', 'glb', 'obj', 'fbx', 'ply', 'las', 'e57', '3dtiles', 'splat'].includes(f),
  visual: (f) => f === 'image',
  document: (f) => f === 'other',
}

/** 포맷별 배지 색상 (EntryBalloonPopup용) */
export const FORMAT_BADGE_COLORS: Record<string, string> = {
  gltf: 'bg-blue-500/20 text-blue-300',
  glb: 'bg-blue-500/20 text-blue-300',
  obj: 'bg-cyan-500/20 text-cyan-300',
  fbx: 'bg-indigo-500/20 text-indigo-300',
  ply: 'bg-sky-500/20 text-sky-300',
  las: 'bg-teal-500/20 text-teal-300',
  e57: 'bg-teal-500/20 text-teal-300',
  '3dtiles': 'bg-violet-500/20 text-violet-300',
  splat: 'bg-fuchsia-500/20 text-fuchsia-300',
  image: 'bg-green-500/20 text-green-300',
}
