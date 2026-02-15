import type * as THREE from 'three'

// 연관 파일 정보 타입
export interface RelatedFile {
  name: string
  blob: Blob
  type: 'material' | 'texture' | 'other'
}

// 지원하는 파일 확장자
export type SupportedFormat = 'gltf' | 'glb' | 'obj' | 'fbx' | 'ply' | 'las' | 'e57'

export interface LoadedModel {
  type: 'mesh' | 'group' | 'points'
  object: THREE.Object3D
  format: SupportedFormat
}

export interface LoadProgress {
  loaded: number
  total: number
  percent: number
}
