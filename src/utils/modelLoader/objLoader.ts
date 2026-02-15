import * as THREE from 'three'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js'
import { preloadTextures, findPreloadedTexture } from '../texturePreloader'
import type { LoadedModel, LoadProgress, RelatedFile } from './types'

// 정규식 특수문자 이스케이프
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// MTL 파싱 및 프리로드된 텍스처 연결
export async function prepareMaterialsForOBJ(
  relatedFiles: RelatedFile[],
  onProgress?: (progress: LoadProgress) => void
): Promise<{ materials: MTLLoader.MaterialCreator | null; preloadedTextures: Map<string, THREE.Texture> }> {
  let preloadedTextures = new Map<string, THREE.Texture>()
  let materials: MTLLoader.MaterialCreator | null = null

  // Step 1: 텍스처 파일들을 병렬로 프리로드 (진행률 0-50%)
  const textureFiles = relatedFiles.filter(f => f.type === 'texture')

  if (textureFiles.length > 0) {
    onProgress?.({ loaded: 0, total: 100, percent: 0 })

    preloadedTextures = await preloadTextures(
      textureFiles.map(f => ({ name: f.name, blob: f.blob })),
      (progress) => {
        // 텍스처 로딩은 전체 진행률의 0-50%
        const percent = Math.round(progress.percent * 0.5)
        onProgress?.({ loaded: percent, total: 100, percent })
      }
    )

    onProgress?.({ loaded: 50, total: 100, percent: 50 })
  }

  // Step 2: MTL 파일 파싱 및 프리로드된 텍스처 연결
  const mtlFile = relatedFiles.find(f => f.type === 'material' && f.name.toLowerCase().endsWith('.mtl'))
  if (mtlFile) {
    try {
      const mtlText = await mtlFile.blob.text()

      // 커스텀 LoadingManager - 프리로드된 텍스처가 있으면 빈 URL 반환 (로드 스킵)
      const loadingManager = new THREE.LoadingManager()
      loadingManager.setURLModifier((originalUrl: string) => {
        const fileName = originalUrl.split(/[/\\]/).pop() || ''
        // 프리로드된 텍스처가 있으면 placeholder 반환 (실제 로드 방지)
        if (findPreloadedTexture(fileName, preloadedTextures)) {
          return 'data:,' // 빈 데이터 URL (로드 스킵용)
        }
        return originalUrl
      })

      const mtlLoader = new MTLLoader(loadingManager)
      materials = mtlLoader.parse(mtlText, '')

      // 프리로드된 텍스처를 머티리얼에 직접 주입
      for (const [matName, mat] of Object.entries(materials.materials)) {
        if (mat instanceof THREE.MeshPhongMaterial || mat instanceof THREE.MeshStandardMaterial) {
          // MTL에서 해당 머티리얼의 텍스처 이름 찾기
          const matRegex = new RegExp(`newmtl\\s+${escapeRegExp(matName)}[\\s\\S]*?(?=newmtl|$)`, 'i')
          const matMatch = mtlText.match(matRegex)

          if (matMatch) {
            const matBlock = matMatch[0]

            // map_Kd (diffuse)
            const diffuseMatch = matBlock.match(/map_Kd\s+(.+)/i)
            if (diffuseMatch) {
              const texName = diffuseMatch[1]?.trim() || ''
              const texture = findPreloadedTexture(texName, preloadedTextures)
              if (texture) {
                mat.map = texture
                mat.needsUpdate = true
              }
            }

            // map_Bump / bump (normal/bump map)
            const bumpMatch = matBlock.match(/(?:map_bump|bump)\s+(.+)/i)
            if (bumpMatch) {
              const texName = bumpMatch[1]?.trim() || ''
              const texture = findPreloadedTexture(texName, preloadedTextures)
              if (texture) {
                mat.bumpMap = texture
                mat.needsUpdate = true
              }
            }

            // map_Ks (specular)
            const specMatch = matBlock.match(/map_Ks\s+(.+)/i)
            if (specMatch && mat instanceof THREE.MeshPhongMaterial) {
              const texName = specMatch[1]?.trim() || ''
              const texture = findPreloadedTexture(texName, preloadedTextures)
              if (texture) {
                mat.specularMap = texture
                mat.needsUpdate = true
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('MTL 로드 실패:', err)
    }
  }

  return { materials, preloadedTextures }
}

// WGS84 좌표계 감지 및 축별 독립 스케일링 적용
export function detectAndApplyWGS84Transform(
  object: THREE.Object3D,
  originalCenter: THREE.Vector3,
  originalSize: THREE.Vector3,
  targetSize: number
): boolean {
  // OBJ는 보통 Z-up이므로 WGS84일 경우: X=경도, Y=위도, Z=높이
  // 감지 조건을 OBJ 좌표계에 맞게 조정
  const isOBJWGS84 =
    Math.abs(originalCenter.x) > 1 && Math.abs(originalCenter.x) < 180 && // 경도 범위
    Math.abs(originalCenter.y) < 90 && // 위도 범위
    (originalSize.x < 0.01 || originalSize.y < 0.01) && // X/Y(경위도)가 작음
    originalSize.z > 1 && originalSize.z > originalSize.x * 100 && originalSize.z > originalSize.y * 100 // Z(높이)가 큼

  if (!isOBJWGS84) {
    return false
  }

  console.log('OBJ WGS84 좌표계 감지됨! 축별 독립 스케일링 적용')

  // WGS84 OBJ: X=경도, Y=위도, Z=높이
  const degreeToMeter = 111000

  const realSizeX = originalSize.x * degreeToMeter
  const realSizeY = originalSize.y * degreeToMeter
  const realSizeZ = originalSize.z // 이미 미터

  console.log(`실제 크기 (미터): X=${realSizeX.toFixed(2)}, Y=${realSizeY.toFixed(2)}, Z=${realSizeZ.toFixed(2)}`)

  const maxRealDim = Math.max(realSizeX, realSizeY, realSizeZ)
  const baseScale = targetSize / maxRealDim

  // 축별 스케일 (회전 전 적용)
  const scaleX = baseScale * degreeToMeter
  const scaleY = baseScale * degreeToMeter
  const scaleZ = baseScale

  object.scale.set(scaleX, scaleY, scaleZ)

  // 중심 이동 (스케일 적용 후)
  object.position.set(
    -originalCenter.x * scaleX,
    -originalCenter.y * scaleY,
    -originalCenter.z * scaleZ
  )

  // Z-up to Y-up 회전
  object.rotation.x = -Math.PI / 2

  console.log(`OBJ WGS84 스케일링: X=${scaleX.toFixed(2)}, Y=${scaleY.toFixed(2)}, Z=${scaleZ.toFixed(2)}`)

  return true
}

// OBJ 로더 (MTL/텍스처 지원 - 텍스처 프리로딩으로 성능 개선)
export async function loadOBJ(
  url: string,
  onProgress?: (progress: LoadProgress) => void,
  relatedFiles?: RelatedFile[]
): Promise<LoadedModel> {
  const objLoader = new OBJLoader()

  let materials: MTLLoader.MaterialCreator | null = null

  if (relatedFiles && relatedFiles.length > 0) {
    const result = await prepareMaterialsForOBJ(relatedFiles, onProgress)
    materials = result.materials
  }

  // 머티리얼이 로드되었으면 OBJLoader에 설정
  if (materials) {
    objLoader.setMaterials(materials)
  }

  // Step 3: OBJ 로드 (진행률 50-100%)
  return new Promise((resolve, reject) => {
    objLoader.load(
      url,
      (object) => {
        // 먼저 원본 좌표 상태에서 WGS84 감지 (회전 전)
        const originalBox = new THREE.Box3().setFromObject(object)
        const originalSize = originalBox.getSize(new THREE.Vector3())
        const originalCenter = originalBox.getCenter(new THREE.Vector3())

        console.log('OBJ 원본 크기:', originalSize.x, originalSize.y, originalSize.z)
        console.log('OBJ 원본 중심:', originalCenter.x, originalCenter.y, originalCenter.z)

        const targetSize = 5

        // WGS84 감지 및 적용
        const wasWGS84 = detectAndApplyWGS84Transform(object, originalCenter, originalSize, targetSize)

        if (!wasWGS84) {
          // 일반 모델: Z-up 여부를 휴리스틱으로 판단
          // Z축 범위가 Y축보다 확연히 크면 Z-up으로 간주하여 회전
          const isLikelyZUp = originalSize.z > originalSize.y * 1.5 && originalSize.z > 0.1
          if (isLikelyZUp) {
            object.rotation.x = -Math.PI / 2
            console.log('OBJ Z-up 감지: Y-up으로 회전 적용')
          }

          // bounding box 재계산하여 중심 맞추기
          object.updateMatrixWorld(true)
          const box = new THREE.Box3().setFromObject(object)
          const center = box.getCenter(new THREE.Vector3())
          object.position.sub(center)

          const size = box.getSize(new THREE.Vector3())
          const maxDim = Math.max(size.x, size.y, size.z)

          if (maxDim > 0) {
            if (maxDim < 0.1 || maxDim > 100) {
              const scale = targetSize / maxDim
              object.scale.setScalar(scale)
              console.log(`OBJ 자동 스케일링: ${maxDim.toFixed(6)} → ${targetSize} (scale: ${scale.toFixed(4)})`)
            } else if (maxDim > 10) {
              const scale = targetSize / maxDim
              object.scale.setScalar(scale)
            }
          }
        }

        // 기본 머티리얼 적용 (머티리얼이 없는 경우에만)
        object.traverse((child) => {
          if (child instanceof THREE.Mesh && !child.material) {
            child.material = new THREE.MeshStandardMaterial({ color: 0x808080 })
          }
        })

        onProgress?.({ loaded: 100, total: 100, percent: 100 })

        resolve({
          type: 'group',
          object,
          format: 'obj',
        })
      },
      (event) => {
        if (event.lengthComputable) {
          // OBJ 로딩은 전체 진행률의 50-100%
          const objPercent = Math.round((event.loaded / event.total) * 50)
          onProgress?.({ loaded: 50 + objPercent, total: 100, percent: 50 + objPercent })
        }
      },
      (error) => reject(new Error(`OBJ 로드 실패: ${error}`))
    )
  })
}
