// 파일 포맷 상수 - 전체 코드베이스에서 공통 사용
// 새 포맷 추가 시 이 파일만 수정하면 됨

/** 3D 모델 포맷 (뷰어에서 직접 렌더링 가능) */
export const MODEL_3D_FORMATS = ['gltf', 'glb', 'obj', 'fbx'] as const

/** 포인트클라우드 포맷 */
export const POINTCLOUD_FORMATS = ['ply', 'las', 'e57'] as const

/** 모든 3D 파일 포맷 (모델 + 포인트클라우드) */
export const ALL_3D_FORMATS = [...MODEL_3D_FORMATS, ...POINTCLOUD_FORMATS] as const

/** 지리좌표 가시화 지원 포맷 (변환 완료 후 Cesium에서 표시 가능) */
export const GEO_VIEWABLE_FORMATS = ['e57', 'obj', 'gltf', 'glb', 'ply', 'las'] as const

/** 3D 포맷 여부 확인 */
export function is3DFormat(format: string): boolean {
  return (ALL_3D_FORMATS as readonly string[]).includes(format)
}

/** 지리좌표 가시화 가능 포맷 여부 확인 */
export function isGeoViewableFormat(format: string): boolean {
  return (GEO_VIEWABLE_FORMATS as readonly string[]).includes(format)
}
