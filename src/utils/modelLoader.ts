import * as THREE from 'three'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js'

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
  const extension = url.split('.').pop()?.toLowerCase()
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

        resolve({
          type: 'group',
          object: gltf.scene,
          format: url.endsWith('.glb') ? 'glb' : 'gltf',
        })
      },
      createProgressCallback(onProgress),
      (error) => reject(new Error(`GLTF 로드 실패: ${error}`))
    )
  })
}

// OBJ 로더
export async function loadOBJ(
  url: string,
  onProgress?: (progress: LoadProgress) => void
): Promise<LoadedModel> {
  const loader = new OBJLoader()

  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (object) => {
        // 모델 중심 맞추기
        const box = new THREE.Box3().setFromObject(object)
        const center = box.getCenter(new THREE.Vector3())
        object.position.sub(center)

        // 기본 머티리얼 적용
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
// E57은 ASTM E2807 표준 포맷으로 XML 헤더와 바이너리 포인트 데이터로 구성
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

  // E57 헤더 파싱
  // 버전 정보는 파일 검증에 사용될 수 있음 (현재 미사용)
  // const majorVersion = dataView.getUint32(8, true)
  // const minorVersion = dataView.getUint32(12, true)

  // 파일 물리적 길이 (8바이트 위치 16부터)
  const filePhysicalLength = Number(dataView.getBigUint64(16, true))

  // XML 오프셋 (8바이트 위치 24부터)
  const xmlPhysicalOffset = Number(dataView.getBigUint64(24, true))

  // XML 논리적 길이 (8바이트 위치 32부터)
  const xmlLogicalLength = Number(dataView.getBigUint64(32, true))

  if (onProgress) {
    onProgress({ loaded: 48, total: filePhysicalLength, percent: 1 })
  }

  // XML 섹션 읽기 (압축되지 않은 경우)
  const decoder = new TextDecoder('utf-8')
  let xmlString = ''

  try {
    const xmlBytes = new Uint8Array(arrayBuffer, xmlPhysicalOffset, Math.min(xmlLogicalLength, arrayBuffer.byteLength - xmlPhysicalOffset))
    xmlString = decoder.decode(xmlBytes)
  } catch {
    // XML 파싱 실패 시 기본값 사용
    console.warn('E57 XML 파싱 실패, 기본 설정 사용')
  }

  // 간단한 포인트 데이터 추출 (XML에서 data3D 섹션 찾기)
  const positions: number[] = []
  const colors: number[] = []

  // E57의 바이너리 섹션에서 포인트 데이터 추출
  // 실제 E57 파싱은 매우 복잡하므로 간단한 구현
  // 여기서는 XML에서 포인트 개수와 데이터 오프셋을 파싱하려 시도

  let pointCount = 0
  let dataOffset = 48 // 기본 헤더 이후

  // XML에서 pointCount 추출 시도
  const pointCountMatch = xmlString.match(/pointCount[^>]*>(\d+)/i)
  if (pointCountMatch) {
    pointCount = parseInt(pointCountMatch[1] ?? '0', 10)
  }

  // 바이너리 블롭 섹션 찾기 (compressedVector 이후 데이터)
  const blobMatch = xmlString.match(/fileOffset[^>]*>(\d+)/i)
  if (blobMatch) {
    dataOffset = parseInt(blobMatch[1] ?? '48', 10)
  }

  // 포인트 개수 추정 (포인트당 약 12-24바이트)
  if (pointCount === 0) {
    const availableBytes = arrayBuffer.byteLength - dataOffset
    pointCount = Math.floor(availableBytes / 12) // XYZ float32 기준
  }

  // 최대 포인트 수 제한
  const maxPoints = Math.min(pointCount, 1000000)
  const skipRate = Math.max(1, Math.ceil(pointCount / maxPoints))

  let minX = Infinity, minY = Infinity, minZ = Infinity
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity

  // 바이너리 데이터 읽기 시도
  try {
    for (let i = 0; i < maxPoints && dataOffset + i * skipRate * 12 + 12 <= arrayBuffer.byteLength; i++) {
      const offset = dataOffset + i * skipRate * 12

      const x = dataView.getFloat32(offset, true)
      const y = dataView.getFloat32(offset + 4, true)
      const z = dataView.getFloat32(offset + 8, true)

      // 유효한 값인지 확인
      if (!isFinite(x) || !isFinite(y) || !isFinite(z)) continue
      if (Math.abs(x) > 1e10 || Math.abs(y) > 1e10 || Math.abs(z) > 1e10) continue

      positions.push(x, y, z)

      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      minZ = Math.min(minZ, z)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
      maxZ = Math.max(maxZ, z)

      // 기본 색상 (높이 기반으로 나중에 재계산)
      colors.push(0.2, 0.5, 0.8)

      if (onProgress && i % 10000 === 0) {
        onProgress({
          loaded: i,
          total: maxPoints,
          percent: Math.round((i / maxPoints) * 100),
        })
      }
    }
  } catch {
    console.warn('E57 바이너리 데이터 파싱 중 오류')
  }

  if (positions.length === 0) {
    throw new Error('E57 파일에서 포인트 데이터를 추출할 수 없습니다.')
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

  // 높이 기반 색상
  const heightRange = maxZ - minZ || 1
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
    format: 'e57',
  }
}

// 통합 로더
export async function loadModel(
  url: string,
  onProgress?: (progress: LoadProgress) => void
): Promise<LoadedModel> {
  const format = getFormatFromUrl(url)

  if (!format) {
    throw new Error(`지원하지 않는 파일 형식입니다: ${url}`)
  }

  switch (format) {
    case 'gltf':
    case 'glb':
      return loadGLTF(url, onProgress)
    case 'obj':
      return loadOBJ(url, onProgress)
    case 'fbx':
      return loadFBX(url, onProgress)
    case 'ply':
      return loadPLY(url, onProgress)
    case 'las':
      return loadLAS(url, onProgress)
    case 'e57':
      return loadE57(url, onProgress)
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
