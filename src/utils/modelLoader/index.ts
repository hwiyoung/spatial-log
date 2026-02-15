export type { RelatedFile, SupportedFormat, LoadedModel, LoadProgress } from './types'
export { getFormatFromUrl, getFormatFromFile } from './formatDetection'
export { loadGLTF, loadFBX, loadPLY, loadE57 } from './loaders'
export { loadOBJ, prepareMaterialsForOBJ, detectAndApplyWGS84Transform } from './objLoader'
export { loadLAS, parseLASHeader, computeHeightGradientColors } from './lasLoader'

import type { LoadedModel, LoadProgress, RelatedFile } from './types'
import { getFormatFromUrl } from './formatDetection'
import { loadGLTF, loadFBX, loadPLY, loadE57 } from './loaders'
import { loadOBJ } from './objLoader'
import { loadLAS } from './lasLoader'

// 통합 로더
export async function loadModel(
  url: string,
  onProgress?: (progress: LoadProgress) => void,
  relatedFiles?: RelatedFile[]
): Promise<LoadedModel> {
  const format = getFormatFromUrl(url)

  if (!format) {
    throw new Error(`지원하지 않는 파일 형식입니다: ${url}`)
  }

  // 실제 로딩에 사용할 URL에서 hash fragment 제거 (blob:...#filename.obj -> blob:...)
  // hash fragment는 포맷 감지에만 사용됨
  const loadUrl = url.split('#')[0] || url

  switch (format) {
    case 'gltf':
    case 'glb':
      return loadGLTF(loadUrl, onProgress)
    case 'obj':
      return loadOBJ(loadUrl, onProgress, relatedFiles)
    case 'fbx':
      return loadFBX(loadUrl, onProgress)
    case 'ply':
      return loadPLY(loadUrl, onProgress)
    case 'las':
      return loadLAS(loadUrl, onProgress)
    case 'e57':
      return loadE57(loadUrl, onProgress)
    default:
      throw new Error(`지원하지 않는 파일 형식입니다: ${format}`)
  }
}

// File 객체에서 로드
export async function loadModelFromFile(
  file: File,
  onProgress?: (progress: LoadProgress) => void
): Promise<LoadedModel> {
  const url = URL.createObjectURL(file)
  try {
    const model = await loadModel(url, onProgress)
    return model
  } finally {
    URL.revokeObjectURL(url)
  }
}
