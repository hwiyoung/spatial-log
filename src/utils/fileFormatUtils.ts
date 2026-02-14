// 파일 포맷별 아이콘/색상 유틸리티
// Assets.tsx, ProjectDetail.tsx, AssetLinkModal.tsx에서 공통 사용

import type { LucideIcon } from 'lucide-react'
import { Box, Layers, Scan, Image, FileText, FileImage, FileBox, FolderOpen } from 'lucide-react'
import { is3DFormat } from '@/constants/formats'

type FileFormat = string

/** 파일 포맷에 따른 아이콘 컴포넌트 반환 (리스트/카드용) */
export function getFileIcon(format: FileFormat): LucideIcon {
  if (format === 'image') return FileImage
  if (is3DFormat(format)) return FileBox
  return FolderOpen
}

/** Assets 그리드용 아이콘 Props (크기/색상 포함) */
export function getFileIconProps(format: FileFormat): { icon: LucideIcon; className: string } {
  switch (format) {
    case 'gltf':
    case 'glb':
    case 'obj':
    case 'fbx':
      return { icon: Box, className: 'text-blue-400' }
    case 'ply':
    case 'las':
      return { icon: Layers, className: 'text-green-400' }
    case 'e57':
      return { icon: Scan, className: 'text-emerald-400' }
    case 'image':
      return { icon: Image, className: 'text-purple-400' }
    default:
      return { icon: FileText, className: 'text-slate-400' }
  }
}

/** 포맷별 배경 그라데이션 색상 */
export function getFormatBgColor(format: FileFormat): string {
  switch (format) {
    case 'gltf':
    case 'glb':
      return 'bg-gradient-to-br from-blue-900/50 to-blue-800/30'
    case 'obj':
    case 'fbx':
      return 'bg-gradient-to-br from-cyan-900/50 to-cyan-800/30'
    case 'ply':
    case 'las':
      return 'bg-gradient-to-br from-green-900/50 to-green-800/30'
    case 'e57':
      return 'bg-gradient-to-br from-emerald-900/50 to-emerald-800/30'
    case 'image':
      return 'bg-gradient-to-br from-purple-900/50 to-purple-800/30'
    default:
      return 'bg-gradient-to-br from-slate-800/50 to-slate-700/30'
  }
}
