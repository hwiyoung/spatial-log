// Gaussian Splatting 로더 유틸리티
// .splat 및 .ply (Gaussian) 파일을 파싱합니다.

export interface GaussianData {
  positions: Float32Array    // x, y, z per gaussian
  scales: Float32Array       // sx, sy, sz per gaussian
  colors: Uint8Array         // r, g, b, a per gaussian
  rotations: Float32Array    // quaternion (qw, qx, qy, qz) per gaussian
  count: number
}

/**
 * .splat 파일 로드
 * 바이너리 포맷: 각 Gaussian당 32 bytes
 * - position: 12 bytes (3 x float32)
 * - scale: 12 bytes (3 x float32, log scale)
 * - color: 4 bytes (4 x uint8, RGBA)
 * - rotation: 4 bytes (4 x int8, normalized quaternion)
 */
export async function loadSplatFile(url: string): Promise<GaussianData> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`파일 로드 실패: ${response.status}`)
  }

  const buffer = await response.arrayBuffer()
  const dataView = new DataView(buffer)

  // 각 Gaussian은 32 bytes
  const bytesPerGaussian = 32
  const count = Math.floor(buffer.byteLength / bytesPerGaussian)

  if (count === 0) {
    throw new Error('유효한 Gaussian 데이터가 없습니다.')
  }

  const positions = new Float32Array(count * 3)
  const scales = new Float32Array(count * 3)
  const colors = new Uint8Array(count * 4)
  const rotations = new Float32Array(count * 4)

  for (let i = 0; i < count; i++) {
    const offset = i * bytesPerGaussian

    // Position (3 x float32)
    positions[i * 3] = dataView.getFloat32(offset, true)
    positions[i * 3 + 1] = dataView.getFloat32(offset + 4, true)
    positions[i * 3 + 2] = dataView.getFloat32(offset + 8, true)

    // Scale (3 x float32, log scale -> actual scale)
    scales[i * 3] = Math.exp(dataView.getFloat32(offset + 12, true))
    scales[i * 3 + 1] = Math.exp(dataView.getFloat32(offset + 16, true))
    scales[i * 3 + 2] = Math.exp(dataView.getFloat32(offset + 20, true))

    // Color (4 x uint8, RGBA)
    colors[i * 4] = dataView.getUint8(offset + 24)
    colors[i * 4 + 1] = dataView.getUint8(offset + 25)
    colors[i * 4 + 2] = dataView.getUint8(offset + 26)
    colors[i * 4 + 3] = dataView.getUint8(offset + 27)

    // Rotation (4 x int8 normalized to quaternion)
    const qx = dataView.getInt8(offset + 28) / 128
    const qy = dataView.getInt8(offset + 29) / 128
    const qz = dataView.getInt8(offset + 30) / 128
    const qw = dataView.getInt8(offset + 31) / 128
    rotations[i * 4] = qw
    rotations[i * 4 + 1] = qx
    rotations[i * 4 + 2] = qy
    rotations[i * 4 + 3] = qz
  }

  return { positions, scales, colors, rotations, count }
}

/**
 * Gaussian PLY 파일인지 확인
 * Spherical Harmonics 계수(f_dc_*, f_rest_*) 존재 여부로 판단
 */
export async function isGaussianPly(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      headers: { Range: 'bytes=0-8192' }, // 헤더만 읽기
    })

    if (!response.ok) return false

    const buffer = await response.arrayBuffer()
    const text = new TextDecoder().decode(new Uint8Array(buffer, 0, Math.min(8192, buffer.byteLength)))

    // Gaussian PLY는 f_dc_0, f_dc_1, f_dc_2 (SH 0차 계수) 또는
    // opacity, scale_0, rot_0 등의 속성을 가짐
    const hasGaussianProps =
      text.includes('f_dc_0') ||
      text.includes('opacity') && text.includes('scale_0') && text.includes('rot_0')

    return hasGaussianProps
  } catch {
    return false
  }
}

/**
 * 파일이 Gaussian Splatting 형식인지 확인
 */
export function isGaussianFormat(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase()
  return ext === 'splat' || ext === 'ksplat'
}

/**
 * 파일 URL에서 포맷 추출
 */
export function getSplatFormatFromUrl(url: string): 'splat' | 'ksplat' | 'ply' | null {
  // URL 또는 hash fragment에서 확장자 추출
  const urlPart = url.split('#')[0] || url
  const hashPart = url.split('#')[1] || ''

  const getExt = (str: string) => str.split('.').pop()?.toLowerCase()

  const urlExt = getExt(urlPart)
  const hashExt = hashPart ? getExt(hashPart) : null

  const ext = hashExt || urlExt

  if (ext === 'splat') return 'splat'
  if (ext === 'ksplat') return 'ksplat'
  if (ext === 'ply') return 'ply'

  return null
}
