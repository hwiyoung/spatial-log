/**
 * 텍스처 프리로딩 시스템
 * OBJ 파일의 텍스처를 병렬로 미리 로드하여 성능 개선
 */
import * as THREE from 'three'

export interface TextureFile {
  name: string
  blob: Blob
}

export interface PreloadProgress {
  loaded: number
  total: number
  percent: number
}

/**
 * 단일 텍스처를 비동기로 로드
 */
async function loadTextureAsync(
  loader: THREE.TextureLoader,
  url: string
): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (texture) => resolve(texture),
      undefined,
      (error) => reject(error)
    )
  })
}

/**
 * 텍스처 파일들을 병렬로 프리로드
 * @param textureFiles 텍스처 파일 배열 (name, blob)
 * @param onProgress 진행률 콜백
 * @returns 파일명 -> THREE.Texture 맵
 */
export async function preloadTextures(
  textureFiles: TextureFile[],
  onProgress?: (progress: PreloadProgress) => void
): Promise<Map<string, THREE.Texture>> {
  const textureMap = new Map<string, THREE.Texture>()

  if (textureFiles.length === 0) {
    return textureMap
  }

  const textureLoader = new THREE.TextureLoader()
  const total = textureFiles.length
  let loaded = 0

  // 모든 텍스처를 병렬로 로드
  const loadPromises = textureFiles.map(async ({ name, blob }) => {
    const blobUrl = URL.createObjectURL(blob)

    try {
      const texture = await loadTextureAsync(textureLoader, blobUrl)

      // 텍스처 품질 설정
      texture.generateMipmaps = true
      texture.minFilter = THREE.LinearMipmapLinearFilter
      texture.magFilter = THREE.LinearFilter
      texture.anisotropy = 4 // 적당한 이방성 필터링
      texture.colorSpace = THREE.SRGBColorSpace

      // 여러 이름 변형으로 저장 (대소문자 무시, 경로 무시)
      const lowerName = name.toLowerCase()
      const baseName = name.split(/[/\\]/).pop() || name
      const lowerBaseName = baseName.toLowerCase()

      // 다양한 키로 저장하여 매칭 확률 증가
      textureMap.set(lowerName, texture)
      textureMap.set(lowerBaseName, texture)
      textureMap.set(name, texture)
      textureMap.set(baseName, texture)

      // 확장자 제거한 이름도 저장
      const nameWithoutExt = lowerBaseName.replace(/\.[^.]+$/, '')
      textureMap.set(nameWithoutExt, texture)

      loaded++
      onProgress?.({
        loaded,
        total,
        percent: Math.round((loaded / total) * 100)
      })
    } catch (error) {
      console.warn(`텍스처 로드 실패: ${name}`, error)
      loaded++
      onProgress?.({
        loaded,
        total,
        percent: Math.round((loaded / total) * 100)
      })
    } finally {
      URL.revokeObjectURL(blobUrl)
    }
  })

  await Promise.allSettled(loadPromises)

  return textureMap
}

/**
 * 프리로드된 텍스처 맵에서 텍스처 찾기
 * 다양한 이름 변형을 시도하여 매칭
 */
export function findPreloadedTexture(
  textureName: string,
  textureMap: Map<string, THREE.Texture>
): THREE.Texture | null {
  const lowerName = textureName.toLowerCase()
  const baseName = textureName.split(/[/\\]/).pop() || textureName
  const lowerBaseName = baseName.toLowerCase()
  const nameWithoutExt = lowerBaseName.replace(/\.[^.]+$/, '')

  // 정확한 매칭 시도
  if (textureMap.has(lowerName)) return textureMap.get(lowerName)!
  if (textureMap.has(lowerBaseName)) return textureMap.get(lowerBaseName)!
  if (textureMap.has(nameWithoutExt)) return textureMap.get(nameWithoutExt)!
  if (textureMap.has(textureName)) return textureMap.get(textureName)!
  if (textureMap.has(baseName)) return textureMap.get(baseName)!

  // 부분 매칭 시도
  for (const [key, texture] of textureMap) {
    const keyLower = key.toLowerCase()
    if (keyLower.includes(lowerBaseName) || lowerBaseName.includes(keyLower)) {
      return texture
    }
  }

  return null
}

