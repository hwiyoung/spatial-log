import * as THREE from 'three'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js'

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

  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf: GLTF) => {
        // 모델 중심 맞추기
        const box = new THREE.Box3().setFromObject(gltf.scene)
        const center = box.getCenter(new THREE.Vector3())
        gltf.scene.position.sub(center)

        // URL에서 query string 제거 후 확장자 확인
        const urlWithoutQuery = url.split('?')[0] || url
        resolve({
          type: 'group',
          object: gltf.scene,
          format: urlWithoutQuery.endsWith('.glb') ? 'glb' : 'gltf',
        })
      },
      createProgressCallback(onProgress),
      (error) => reject(new Error(`GLTF 로드 실패: ${error}`))
    )
  })
}

// OBJ 로더 (MTL/텍스처 지원)
export async function loadOBJ(
  url: string,
  onProgress?: (progress: LoadProgress) => void,
  relatedFiles?: RelatedFile[]
): Promise<LoadedModel> {
  const objLoader = new OBJLoader()

  // 텍스처 URL 매핑 (파일명 -> blob URL)
  const textureUrls = new Map<string, string>()
  // MTL 파일에서 파싱한 텍스처 참조 목록
  const mtlTextureRefs: string[] = []
  let materials: MTLLoader.MaterialCreator | null = null

  if (relatedFiles && relatedFiles.length > 0) {
    // 텍스처 파일들의 blob URL 생성
    for (const file of relatedFiles) {
      if (file.type === 'texture') {
        const blobUrl = URL.createObjectURL(file.blob)
        // 파일 이름만 추출 (경로 제거)
        const fileName = file.name.split('/').pop()?.toLowerCase() || file.name.toLowerCase()
        textureUrls.set(fileName, blobUrl)
        // 원본 케이스도 저장
        textureUrls.set(file.name.split('/').pop() || file.name, blobUrl)
      }
    }

    // MTL 파일 로드 및 파싱
    const mtlFile = relatedFiles.find(f => f.type === 'material' && f.name.toLowerCase().endsWith('.mtl'))
    if (mtlFile) {
      try {
        const mtlText = await mtlFile.blob.text()

        // MTL 파일에서 텍스처 참조 추출 (map_Kd, map_Ka, map_Ks 등)
        const textureRefRegex = /^\s*map_(?:Kd|Ka|Ks|Ns|d|bump|Bump|disp|Disp|refl)\s+(.+)$/gmi
        let match
        while ((match = textureRefRegex.exec(mtlText)) !== null) {
          const texPath = match[1].trim()
          const texFileName = texPath.split(/[/\\]/).pop() || texPath
          mtlTextureRefs.push(texFileName)
        }

        // 커스텀 LoadingManager로 텍스처 로딩 가로채기
        const loadingManager = new THREE.LoadingManager()
        loadingManager.setURLModifier((originalUrl: string) => {
          // 텍스처 파일명 추출
          const fileName = originalUrl.split(/[/\\]/).pop()?.toLowerCase() || ''
          const blobUrl = findTextureUrl(fileName, textureUrls)
          if (blobUrl) {
            return blobUrl
          }
          return originalUrl
        })

        const mtlLoader = new MTLLoader(loadingManager)
        materials = mtlLoader.parse(mtlText, '')
        // preload() 제거 - 텍스처는 렌더링 시 lazy 로드됨
      } catch (err) {
        console.warn('MTL 로드 실패:', err)
      }
    }
  }

  // 머티리얼이 로드되었으면 OBJLoader에 설정
  if (materials) {
    objLoader.setMaterials(materials)
  }

  return new Promise((resolve, reject) => {
    objLoader.load(
      url,
      (object) => {
        // OBJ 파일은 종종 Z-up 좌표계를 사용하므로 Y-up으로 변환
        // X축을 기준으로 -90도 회전
        object.rotation.x = -Math.PI / 2

        // 회전 후 bounding box 재계산하여 중심 맞추기
        object.updateMatrixWorld(true)
        const box = new THREE.Box3().setFromObject(object)
        const center = box.getCenter(new THREE.Vector3())
        object.position.sub(center)

        // 기본 머티리얼 적용 (머티리얼이 없는 경우에만)
        object.traverse((child) => {
          if (child instanceof THREE.Mesh && !child.material) {
            child.material = new THREE.MeshStandardMaterial({ color: 0x808080 })
          }
        })

        resolve({
          type: 'group',
          object,
          format: 'obj',
        })
      },
      createProgressCallback(onProgress),
      (error) => reject(new Error(`OBJ 로드 실패: ${error}`))
    )
  })
}

// 텍스처 이름으로 blob URL 찾기
function findTextureUrl(texName: string, textureUrls: Map<string, string>): string | null {
  const lowerName = texName.toLowerCase()

  // 정확한 매칭
  if (textureUrls.has(lowerName)) {
    return textureUrls.get(lowerName) || null
  }

  // 원본 케이스 매칭
  if (textureUrls.has(texName)) {
    return textureUrls.get(texName) || null
  }

  // 확장자 제거 후 비교
  const nameWithoutExt = lowerName.split('.').slice(0, -1).join('.')
  for (const [key, value] of textureUrls) {
    const keyWithoutExt = key.toLowerCase().split('.').slice(0, -1).join('.')
    if (keyWithoutExt === nameWithoutExt) {
      return value
    }
  }

  // 부분 매칭 (텍스처 이름이 파일명에 포함된 경우)
  for (const [key, value] of textureUrls) {
    if (key.toLowerCase().includes(lowerName) || lowerName.includes(key.toLowerCase())) {
      return value
    }
  }

  return null
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

// E57 로더 (포인트 클라우드)
// E57은 ASTM E2807 표준 포맷으로 XML 메타데이터 + 압축 바이너리 데이터 구조
// 완전한 파싱은 어렵지만, 샘플링을 통해 대략적인 가시화 시도
export async function loadE57(
  url: string,
  onProgress?: (progress: LoadProgress) => void
): Promise<LoadedModel> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`E57 파일 로드 실패: ${response.statusText}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const dataView = new DataView(arrayBuffer)
  const fileSize = arrayBuffer.byteLength

  // E57 파일 시그니처 확인 (ASTM-E57)
  const signature = String.fromCharCode(
    dataView.getUint8(0),
    dataView.getUint8(1),
    dataView.getUint8(2),
    dataView.getUint8(3),
    dataView.getUint8(4),
    dataView.getUint8(5),
    dataView.getUint8(6),
    dataView.getUint8(7)
  )

  if (!signature.startsWith('ASTM-E57')) {
    throw new Error('유효하지 않은 E57 파일입니다.')
  }

  if (onProgress) {
    onProgress({ loaded: 10, total: 100, percent: 10 })
  }

  // XML 섹션 파싱하여 스케일/오프셋 정보 추출 시도
  const xmlOffset = Number(dataView.getBigUint64(24, true))
  const xmlLength = Number(dataView.getBigUint64(32, true))

  const scaleX = 0.001, scaleY = 0.001, scaleZ = 0.001

  try {
    const xmlBytes = new Uint8Array(arrayBuffer, xmlOffset, Math.min(xmlLength, fileSize - xmlOffset))
    const xmlString = new TextDecoder('utf-8').decode(xmlBytes)

    // 스케일 추출 시도
    const scaleMatch = xmlString.match(/cartesianBounds.*?xMinimum.*?>([-\d.e+]+)/is)
    if (scaleMatch) {
      // 좌표 범위 추출 (향후 좌표 보정에 사용 가능)
      void scaleMatch[1]
    }
  } catch {
    // XML 파싱 실패 시 기본값 사용
  }

  if (onProgress) {
    onProgress({ loaded: 20, total: 100, percent: 20 })
  }

  // 바이너리 데이터에서 유효한 포인트 패턴 탐색
  // E57 데이터는 다양한 형식(float32, float64, scaled int32)으로 저장될 수 있음
  const positions: number[] = []
  const colors: number[] = []

  let minX = Infinity, minY = Infinity, minZ = Infinity
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity

  // 여러 오프셋과 형식으로 포인트 데이터 탐색 시도
  const searchStart = 48 // 헤더 이후
  const searchEnd = Math.min(xmlOffset, fileSize)
  const maxPoints = 500000 // 최대 포인트 수

  // 방법 1: Float64 (double) 형식 탐색 (24바이트 = XYZ double)
  let foundPoints = tryParseFloat64Points(dataView, searchStart, searchEnd, maxPoints, onProgress)

  // 방법 2: Float32 형식이 더 많으면 사용
  if (foundPoints.positions.length < 1000) {
    foundPoints = tryParseFloat32Points(dataView, searchStart, searchEnd, maxPoints, onProgress)
  }

  // 방법 3: Scaled Int32 형식 시도
  if (foundPoints.positions.length < 1000) {
    foundPoints = tryParseScaledInt32Points(dataView, searchStart, searchEnd, maxPoints, scaleX, scaleY, scaleZ, onProgress)
  }

  if (foundPoints.positions.length < 100) {
    throw new Error(
      'E57 파일에서 포인트 데이터를 추출할 수 없습니다.\n\n' +
      '이 파일은 압축되었거나 지원하지 않는 형식입니다.\n' +
      '해결 방법: CloudCompare로 PLY/LAS로 변환하세요\n' +
      'https://www.cloudcompare.org/'
    )
  }

  // 결과 사용
  positions.push(...foundPoints.positions)
  minX = foundPoints.minX; minY = foundPoints.minY; minZ = foundPoints.minZ
  maxX = foundPoints.maxX; maxY = foundPoints.maxY; maxZ = foundPoints.maxZ

  // 중심 맞추기
  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2
  const centerZ = (minZ + maxZ) / 2

  for (let i = 0; i < positions.length; i += 3) {
    positions[i] = (positions[i] ?? 0) - centerX
    positions[i + 1] = (positions[i + 1] ?? 0) - centerY
    positions[i + 2] = (positions[i + 2] ?? 0) - centerZ
  }

  // 높이 기반 색상
  const heightRange = maxZ - minZ || 1
  for (let i = 0; i < positions.length / 3; i++) {
    const z = (positions[i * 3 + 2] ?? 0) + centerZ - minZ
    const normalizedHeight = Math.max(0, Math.min(1, z / heightRange))

    // 높이에 따른 그라데이션 (파랑 → 청록 → 녹색 → 노랑 → 빨강)
    if (normalizedHeight < 0.25) {
      colors.push(0, normalizedHeight * 4, 1)
    } else if (normalizedHeight < 0.5) {
      colors.push(0, 1, 1 - (normalizedHeight - 0.25) * 4)
    } else if (normalizedHeight < 0.75) {
      colors.push((normalizedHeight - 0.5) * 4, 1, 0)
    } else {
      colors.push(1, 1 - (normalizedHeight - 0.75) * 4, 0)
    }
  }

  if (onProgress) {
    onProgress({ loaded: 100, total: 100, percent: 100 })
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))

  const material = new THREE.PointsMaterial({
    size: 0.02,
    vertexColors: true,
    sizeAttenuation: true,
  })

  const points = new THREE.Points(geometry, material)

  // 스케일 조정
  const size = Math.max(maxX - minX, maxY - minY, maxZ - minZ)
  if (size > 10) {
    const scale = 5 / size
    points.scale.setScalar(scale)
  }

  console.log(`E57: ${positions.length / 3}개 포인트 로드됨`)

  return {
    type: 'points',
    object: points,
    format: 'e57',
  }
}

// Float64 (double) 포인트 탐색
function tryParseFloat64Points(
  dataView: DataView,
  start: number,
  end: number,
  maxPoints: number,
  onProgress?: (progress: LoadProgress) => void
): { positions: number[], minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number } {
  const positions: number[] = []
  let minX = Infinity, minY = Infinity, minZ = Infinity
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity

  const stride = 24 // 3 * float64
  const sampleRate = Math.max(1, Math.floor((end - start) / stride / maxPoints))

  for (let offset = start; offset + 24 <= end && positions.length / 3 < maxPoints; offset += stride * sampleRate) {
    try {
      const x = dataView.getFloat64(offset, true)
      const y = dataView.getFloat64(offset + 8, true)
      const z = dataView.getFloat64(offset + 16, true)

      // 유효한 좌표 범위 확인 (일반적인 측량 데이터 범위)
      if (!isFinite(x) || !isFinite(y) || !isFinite(z)) continue
      if (Math.abs(x) > 1e9 || Math.abs(y) > 1e9 || Math.abs(z) > 1e9) continue
      if (x === 0 && y === 0 && z === 0) continue

      positions.push(x, y, z)
      minX = Math.min(minX, x); minY = Math.min(minY, y); minZ = Math.min(minZ, z)
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); maxZ = Math.max(maxZ, z)

      if (onProgress && positions.length % 50000 === 0) {
        onProgress({ loaded: 20 + (positions.length / maxPoints) * 60, total: 100, percent: 20 + Math.round((positions.length / maxPoints) * 60) })
      }
    } catch {
      continue
    }
  }

  return { positions, minX, minY, minZ, maxX, maxY, maxZ }
}

// Float32 포인트 탐색
function tryParseFloat32Points(
  dataView: DataView,
  start: number,
  end: number,
  maxPoints: number,
  onProgress?: (progress: LoadProgress) => void
): { positions: number[], minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number } {
  const positions: number[] = []
  let minX = Infinity, minY = Infinity, minZ = Infinity
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity

  const stride = 12 // 3 * float32
  const sampleRate = Math.max(1, Math.floor((end - start) / stride / maxPoints))

  for (let offset = start; offset + 12 <= end && positions.length / 3 < maxPoints; offset += stride * sampleRate) {
    try {
      const x = dataView.getFloat32(offset, true)
      const y = dataView.getFloat32(offset + 4, true)
      const z = dataView.getFloat32(offset + 8, true)

      if (!isFinite(x) || !isFinite(y) || !isFinite(z)) continue
      if (Math.abs(x) > 1e9 || Math.abs(y) > 1e9 || Math.abs(z) > 1e9) continue
      if (x === 0 && y === 0 && z === 0) continue

      positions.push(x, y, z)
      minX = Math.min(minX, x); minY = Math.min(minY, y); minZ = Math.min(minZ, z)
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); maxZ = Math.max(maxZ, z)

      if (onProgress && positions.length % 50000 === 0) {
        onProgress({ loaded: 20 + (positions.length / maxPoints) * 60, total: 100, percent: 20 + Math.round((positions.length / maxPoints) * 60) })
      }
    } catch {
      continue
    }
  }

  return { positions, minX, minY, minZ, maxX, maxY, maxZ }
}

// Scaled Int32 포인트 탐색
function tryParseScaledInt32Points(
  dataView: DataView,
  start: number,
  end: number,
  maxPoints: number,
  scaleX: number,
  scaleY: number,
  scaleZ: number,
  onProgress?: (progress: LoadProgress) => void
): { positions: number[], minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number } {
  const positions: number[] = []
  let minX = Infinity, minY = Infinity, minZ = Infinity
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity

  const stride = 12 // 3 * int32
  const sampleRate = Math.max(1, Math.floor((end - start) / stride / maxPoints))

  for (let offset = start; offset + 12 <= end && positions.length / 3 < maxPoints; offset += stride * sampleRate) {
    try {
      const ix = dataView.getInt32(offset, true)
      const iy = dataView.getInt32(offset + 4, true)
      const iz = dataView.getInt32(offset + 8, true)

      const x = ix * scaleX
      const y = iy * scaleY
      const z = iz * scaleZ

      if (!isFinite(x) || !isFinite(y) || !isFinite(z)) continue
      if (Math.abs(x) > 1e9 || Math.abs(y) > 1e9 || Math.abs(z) > 1e9) continue

      positions.push(x, y, z)
      minX = Math.min(minX, x); minY = Math.min(minY, y); minZ = Math.min(minZ, z)
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); maxZ = Math.max(maxZ, z)

      if (onProgress && positions.length % 50000 === 0) {
        onProgress({ loaded: 20 + (positions.length / maxPoints) * 60, total: 100, percent: 20 + Math.round((positions.length / maxPoints) * 60) })
      }
    } catch {
      continue
    }
  }

  return { positions, minX, minY, minZ, maxX, maxY, maxZ }
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
