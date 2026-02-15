import * as THREE from 'three'
import type { LoadedModel, LoadProgress } from './types'

// LAS 헤더 파싱 결과
interface LASHeader {
  pointDataOffset: number
  pointDataRecordLength: number
  numberOfPoints: number
  xScale: number
  yScale: number
  zScale: number
  xOffset: number
  yOffset: number
  zOffset: number
}

// LAS 바이너리 헤더 파싱
export function parseLASHeader(dataView: DataView): LASHeader {
  // 시그니처 검증
  const signature = String.fromCharCode(
    dataView.getUint8(0),
    dataView.getUint8(1),
    dataView.getUint8(2),
    dataView.getUint8(3)
  )

  if (signature !== 'LASF') {
    throw new Error('유효하지 않은 LAS 파일입니다.')
  }

  return {
    pointDataOffset: dataView.getUint32(96, true),
    pointDataRecordLength: dataView.getUint16(105, true),
    numberOfPoints: dataView.getUint32(107, true),
    xScale: dataView.getFloat64(131, true),
    yScale: dataView.getFloat64(139, true),
    zScale: dataView.getFloat64(147, true),
    xOffset: dataView.getFloat64(155, true),
    yOffset: dataView.getFloat64(163, true),
    zOffset: dataView.getFloat64(171, true),
  }
}

// 높이 기반 색상 그라데이션 계산 (파랑 -> 녹색 -> 빨강)
export function computeHeightGradientColors(
  positions: number[],
  colors: number[],
  minZ: number,
  maxZ: number,
  centerZ: number
): void {
  const heightRange = maxZ - minZ
  for (let i = 0; i < positions.length / 3; i++) {
    const z = (positions[i * 3 + 2] ?? 0) + centerZ - minZ
    const normalizedHeight = z / heightRange

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

  // LAS 헤더 파싱
  const header = parseLASHeader(dataView)

  // 최대 포인트 수 제한 (메모리 관리)
  const maxPoints = Math.min(header.numberOfPoints, 1000000)
  const skipRate = Math.ceil(header.numberOfPoints / maxPoints)

  const positions: number[] = []
  const colors: number[] = []

  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity
  let maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity

  for (let i = 0; i < header.numberOfPoints; i += skipRate) {
    const offset = header.pointDataOffset + i * header.pointDataRecordLength

    const x = dataView.getInt32(offset, true) * header.xScale + header.xOffset
    const y = dataView.getInt32(offset + 4, true) * header.yScale + header.yOffset
    const z = dataView.getInt32(offset + 8, true) * header.zScale + header.zOffset

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
        total: header.numberOfPoints,
        percent: Math.round((i / header.numberOfPoints) * 100),
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
  computeHeightGradientColors(positions, colors, minZ, maxZ, centerZ)

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
