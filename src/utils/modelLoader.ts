import * as THREE from 'three'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js'
import { preloadTextures, findPreloadedTexture } from './texturePreloader'

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

// 파일 확장자에서 포맷 추출
export function getFormatFromUrl(url: string): SupportedFormat | null {
  // blob URL의 경우 hash fragment에서 파일명 추출 (blob:...#filename.obj 형태)
  if (url.startsWith('blob:') && url.includes('#')) {
    const hashPart = url.split('#')[1] || ''
    const extension = hashPart.split('.').pop()?.toLowerCase()
    if (extension && ['gltf', 'glb', 'obj', 'fbx', 'ply', 'las', 'e57'].includes(extension)) {
      return extension as SupportedFormat
    }
  }

  // URL에서 query string 제거 (signed URL의 ?token=... 등 처리)
  const urlWithoutQuery = url.split('?')[0] || url
  // pathname만 추출 (URL 객체 사용하거나 마지막 / 이후 부분)
  const pathname = urlWithoutQuery.split('/').pop() || urlWithoutQuery
  const extension = pathname.split('.').pop()?.toLowerCase()
  switch (extension) {
    case 'gltf':
    case 'glb':
      return extension as SupportedFormat
    case 'obj':
    case 'fbx':
    case 'ply':
    case 'las':
    case 'e57':
      return extension as SupportedFormat
    default:
      return null
  }
}

// 파일 확장자에서 포맷 추출 (File 객체용)
export function getFormatFromFile(file: File): SupportedFormat | null {
  return getFormatFromUrl(file.name)
}

// 진행률 콜백 생성
function createProgressCallback(
  onProgress?: (progress: LoadProgress) => void
): ((event: ProgressEvent) => void) | undefined {
  if (!onProgress) return undefined
  return (event: ProgressEvent) => {
    if (event.lengthComputable) {
      onProgress({
        loaded: event.loaded,
        total: event.total,
        percent: Math.round((event.loaded / event.total) * 100),
      })
    }
  }
}

// GLTF/GLB 로더
export async function loadGLTF(
  url: string,
  onProgress?: (progress: LoadProgress) => void
): Promise<LoadedModel> {
  const loader = new GLTFLoader()

  console.log('=== loadGLTF ===')
  console.log('URL:', url.substring(0, 100) + (url.length > 100 ? '...' : ''))

  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf: GLTF) => {
        console.log('GLTF loaded successfully')
        console.log('Scene children:', gltf.scene.children.length)

        // 모델 중심 맞추기
        const box = new THREE.Box3().setFromObject(gltf.scene)
        const size = box.getSize(new THREE.Vector3())
        const center = box.getCenter(new THREE.Vector3())

        console.log('Model size (before scale):', size.x, size.y, size.z)
        console.log('Model center:', center.x, center.y, center.z)

        // 모델 크기가 0인 경우 경고
        if (size.x === 0 && size.y === 0 && size.z === 0) {
          console.warn('Model has zero size!')
        }

        gltf.scene.position.sub(center)

        // 자동 스케일링: 모델이 너무 작거나 클 경우 적절한 크기로 조정
        // WGS84 좌표계(경위도) 모델은 매우 작은 값을 가질 수 있음
        const maxDim = Math.max(size.x, size.y, size.z)
        const targetSize = 5 // 목표 크기 (카메라 기본 위치에서 잘 보이는 크기)

        if (maxDim > 0) {
          if (maxDim < 0.1 || maxDim > 100) {
            // 매우 작거나 큰 모델 스케일 조정
            const scale = targetSize / maxDim
            gltf.scene.scale.setScalar(scale)
            console.log(`GLTF 자동 스케일링: ${maxDim.toFixed(6)} → ${targetSize} (scale: ${scale.toFixed(4)})`)
          } else if (maxDim > 10) {
            // 적당히 큰 모델 (10-100 범위)
            const scale = targetSize / maxDim
            gltf.scene.scale.setScalar(scale)
            console.log(`GLTF 적당히 큰 모델 스케일링: scale=${scale.toFixed(4)}`)
          }
        }

        // URL에서 query string 제거 후 확장자 확인
        const urlWithoutQuery = url.split('?')[0] || url
        resolve({
          type: 'group',
          object: gltf.scene,
          format: urlWithoutQuery.endsWith('.glb') ? 'glb' : 'gltf',
        })
      },
      createProgressCallback(onProgress),
      (error) => {
        console.error('GLTF load failed:', error)
        reject(new Error(`GLTF 로드 실패: ${error}`))
      }
    )
  })
}

// OBJ 로더 (MTL/텍스처 지원 - 텍스처 프리로딩으로 성능 개선)
export async function loadOBJ(
  url: string,
  onProgress?: (progress: LoadProgress) => void,
  relatedFiles?: RelatedFile[]
): Promise<LoadedModel> {
  const objLoader = new OBJLoader()

  // 프리로드된 텍스처 맵
  let preloadedTextures = new Map<string, THREE.Texture>()
  let materials: MTLLoader.MaterialCreator | null = null

  if (relatedFiles && relatedFiles.length > 0) {
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
        // OBJ 파일은 종종 Z-up 좌표계를 사용하므로 Y-up으로 변환
        object.rotation.x = -Math.PI / 2

        // 회전 후 bounding box 재계산하여 중심 맞추기
        object.updateMatrixWorld(true)
        const box = new THREE.Box3().setFromObject(object)
        const center = box.getCenter(new THREE.Vector3())
        object.position.sub(center)

        // 자동 스케일링: 모델이 너무 작거나 클 경우 적절한 크기로 조정
        // 4326 좌표계(위경도)처럼 매우 작은 값의 모델도 지원
        const size = box.getSize(new THREE.Vector3())
        const maxDim = Math.max(size.x, size.y, size.z)
        const minDim = Math.min(size.x, size.y, size.z)

        // 목표 크기: 5 단위 (카메라 기본 위치에서 잘 보이는 크기)
        const targetSize = 5

        if (maxDim > 0) {
          // 매우 작은 모델 (예: 4326 위경도 좌표) 또는 매우 큰 모델 스케일 조정
          if (maxDim < 0.1 || maxDim > 100) {
            const scale = targetSize / maxDim
            object.scale.setScalar(scale)
            console.log(`OBJ 자동 스케일링: ${maxDim.toFixed(6)} → ${targetSize} (scale: ${scale.toFixed(4)})`)
          } else if (maxDim > 10) {
            // 적당히 큰 모델 (10-100 범위)
            const scale = targetSize / maxDim
            object.scale.setScalar(scale)
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

// 정규식 특수문자 이스케이프
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// FBX 로더
export async function loadFBX(
  url: string,
  onProgress?: (progress: LoadProgress) => void
): Promise<LoadedModel> {
  const loader = new FBXLoader()

  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (object) => {
        // 모델 중심 맞추기
        const box = new THREE.Box3().setFromObject(object)
        const center = box.getCenter(new THREE.Vector3())
        object.position.sub(center)

        // FBX 스케일 조정 (FBX는 종종 큰 스케일을 가짐)
        const size = box.getSize(new THREE.Vector3())
        const maxDim = Math.max(size.x, size.y, size.z)
        if (maxDim > 10) {
          const scale = 5 / maxDim
          object.scale.setScalar(scale)
        }

        resolve({
          type: 'group',
          object,
          format: 'fbx',
        })
      },
      createProgressCallback(onProgress),
      (error) => reject(new Error(`FBX 로드 실패: ${error}`))
    )
  })
}

// PLY 로더 (포인트 클라우드)
export async function loadPLY(
  url: string,
  onProgress?: (progress: LoadProgress) => void
): Promise<LoadedModel> {
  const loader = new PLYLoader()

  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (geometry) => {
        geometry.computeVertexNormals()

        // 버텍스 컬러가 있는지 확인
        const hasColors = geometry.hasAttribute('color')

        let object: THREE.Object3D

        if (geometry.index !== null) {
          // 메시로 렌더링
          const material = new THREE.MeshStandardMaterial({
            vertexColors: hasColors,
            color: hasColors ? undefined : 0x808080,
            side: THREE.DoubleSide,
          })
          object = new THREE.Mesh(geometry, material)
        } else {
          // 포인트 클라우드로 렌더링
          const material = new THREE.PointsMaterial({
            size: 0.01,
            vertexColors: hasColors,
            color: hasColors ? undefined : 0x3b82f6,
          })
          object = new THREE.Points(geometry, material)
        }

        // 중심 맞추기
        geometry.computeBoundingBox()
        if (geometry.boundingBox) {
          const center = geometry.boundingBox.getCenter(new THREE.Vector3())
          geometry.translate(-center.x, -center.y, -center.z)
        }

        resolve({
          type: geometry.index !== null ? 'mesh' : 'points',
          object,
          format: 'ply',
        })
      },
      createProgressCallback(onProgress),
      (error) => reject(new Error(`PLY 로드 실패: ${error}`))
    )
  })
}

// LAS 로더 (포인트 클라우드) - 기본 구현
// 참고: 실제 LAS 파싱은 복잡하므로 간단한 버전만 구현
export async function loadLAS(
  url: string,
  onProgress?: (progress: LoadProgress) => void
): Promise<LoadedModel> {
  // LAS 파일 로드
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`LAS 파일 로드 실패: ${response.statusText}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const dataView = new DataView(arrayBuffer)

  // LAS 헤더 파싱 (간단한 버전)
  const signature = String.fromCharCode(
    dataView.getUint8(0),
    dataView.getUint8(1),
    dataView.getUint8(2),
    dataView.getUint8(3)
  )

  if (signature !== 'LASF') {
    throw new Error('유효하지 않은 LAS 파일입니다.')
  }

  // 포인트 데이터 오프셋
  const pointDataOffset = dataView.getUint32(96, true)
  // 포인트 레코드 길이
  const pointDataRecordLength = dataView.getUint16(105, true)
  // 포인트 수
  const numberOfPoints = dataView.getUint32(107, true)

  // 스케일 및 오프셋
  const xScale = dataView.getFloat64(131, true)
  const yScale = dataView.getFloat64(139, true)
  const zScale = dataView.getFloat64(147, true)
  const xOffset = dataView.getFloat64(155, true)
  const yOffset = dataView.getFloat64(163, true)
  const zOffset = dataView.getFloat64(171, true)

  // 최대 포인트 수 제한 (메모리 관리)
  const maxPoints = Math.min(numberOfPoints, 1000000)
  const skipRate = Math.ceil(numberOfPoints / maxPoints)

  const positions: number[] = []
  const colors: number[] = []

  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity
  let maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity

  for (let i = 0; i < numberOfPoints; i += skipRate) {
    const offset = pointDataOffset + i * pointDataRecordLength

    const x = dataView.getInt32(offset, true) * xScale + xOffset
    const y = dataView.getInt32(offset + 4, true) * yScale + yOffset
    const z = dataView.getInt32(offset + 8, true) * zScale + zOffset

    positions.push(x, y, z)

    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    minZ = Math.min(minZ, z)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
    maxZ = Math.max(maxZ, z)

    // 높이 기반 색상
    colors.push(0.2, 0.5, 0.8) // 기본 파란색

    if (onProgress) {
      onProgress({
        loaded: i,
        total: numberOfPoints,
        percent: Math.round((i / numberOfPoints) * 100),
      })
    }
  }

  // 중심 맞추기
  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2
  const centerZ = (minZ + maxZ) / 2

  for (let i = 0; i < positions.length; i += 3) {
    positions[i] = (positions[i] ?? 0) - centerX
    positions[i + 1] = (positions[i + 1] ?? 0) - centerY
    positions[i + 2] = (positions[i + 2] ?? 0) - centerZ
  }

  // 높이 기반 색상 재계산
  const heightRange = maxZ - minZ
  for (let i = 0; i < positions.length / 3; i++) {
    const z = (positions[i * 3 + 2] ?? 0) + centerZ - minZ
    const normalizedHeight = z / heightRange

    // 높이에 따른 그라데이션 (파랑 -> 녹색 -> 빨강)
    if (normalizedHeight < 0.5) {
      colors[i * 3] = normalizedHeight * 2
      colors[i * 3 + 1] = 0.5 + normalizedHeight
      colors[i * 3 + 2] = 1 - normalizedHeight * 2
    } else {
      colors[i * 3] = 1
      colors[i * 3 + 1] = 1 - (normalizedHeight - 0.5) * 2
      colors[i * 3 + 2] = 0
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))

  const material = new THREE.PointsMaterial({
    size: 0.05,
    vertexColors: true,
  })

  const points = new THREE.Points(geometry, material)

  // 스케일 조정
  const size = Math.max(maxX - minX, maxY - minY, maxZ - minZ)
  if (size > 10) {
    const scale = 5 / size
    points.scale.setScalar(scale)
  }

  return {
    type: 'points',
    object: points,
    format: 'las',
  }
}

// E57 로더 - 브라우저에서 직접 파싱 불가
// E57은 ASTM E2807 표준 포맷으로 압축된 바이너리 데이터 구조
// 서버사이드 변환 서비스를 통해 PLY/LAS로 변환 후 사용해야 함
export async function loadE57(
  _url: string,
  _onProgress?: (progress: LoadProgress) => void
): Promise<LoadedModel> {
  // E57 파일은 브라우저에서 직접 파싱할 수 없음
  // 변환 서비스를 통해 PLY로 변환 후 미리보기 가능
  throw new Error(
    'E57_CONVERSION_REQUIRED: E57 파일은 변환이 필요합니다.\n\n' +
    '업로드 후 자동으로 PLY 형식으로 변환이 시작됩니다.\n' +
    '변환이 완료되면 미리보기가 가능합니다.\n\n' +
    '변환 상태는 파일 목록에서 확인할 수 있습니다.'
  )
}

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
