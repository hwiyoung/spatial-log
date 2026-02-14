/**
 * 3D 데이터 변환 서비스
 * spatial-converter 백엔드와 통신하여 파일 변환을 관리합니다.
 */

import { CONVERTER_URL } from '@/constants/config'

// 변환 타입
export type ConversionType =
  | 'e57_to_ply'
  | 'e57_to_las'
  | 'e57_to_3dtiles'
  | 'las_to_copc'
  | 'ply_to_copc'
  | 'laz_to_copc'
  | 'obj_to_3dtiles'
  | 'gltf_to_3dtiles'
  | 'glb_to_3dtiles'
  | 'ply_to_3dtiles'
  | 'las_to_3dtiles'

// 변환 상태
export type ConversionStatus = 'pending' | 'converting' | 'ready' | 'failed'

// 변환 요청
export interface ConversionRequest {
  fileId: string
  sourcePath: string
  conversionType: ConversionType
  options?: Record<string, unknown>
}

// 변환 응답
export interface ConversionResponse {
  jobId: string
  fileId: string
  status: ConversionStatus
  message: string
}

// 변환 상태 응답
export interface ConversionStatusResponse {
  jobId: string
  fileId: string
  status: ConversionStatus
  progress: number
  outputPath?: string
  error?: string
}

/**
 * 파일 포맷에 따른 변환 타입 결정
 */
export function getConversionTypeForFormat(format: string): ConversionType | null {
  const formatLower = format.toLowerCase()

  switch (formatLower) {
    case 'e57':
      return 'e57_to_3dtiles'
    case 'las':
      return 'las_to_3dtiles'
    case 'laz':
      return 'laz_to_copc'
    case 'ply':
      return 'ply_to_3dtiles'
    case 'obj':
      return 'obj_to_3dtiles'
    case 'gltf':
      return 'gltf_to_3dtiles'
    case 'glb':
      return 'glb_to_3dtiles'
    default:
      return null
  }
}

/**
 * 변환이 필요한 포맷인지 확인
 */
export function needsConversion(format: string): boolean {
  return getConversionTypeForFormat(format) !== null
}

/**
 * 변환 작업 시작
 */
export async function startConversion(request: ConversionRequest): Promise<ConversionResponse> {
  try {
    const response = await fetch(`${CONVERTER_URL}/convert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file_id: request.fileId,
        source_path: request.sourcePath,
        conversion_type: request.conversionType,
        options: request.options,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || `변환 요청 실패: ${response.status}`)
    }

    const data = await response.json()
    return {
      jobId: data.job_id,
      fileId: data.file_id,
      status: data.status as ConversionStatus,
      message: data.message,
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error('변환 요청 중 오류가 발생했습니다.')
  }
}

/**
 * 변환 상태 조회
 */
export async function getConversionStatus(jobId: string): Promise<ConversionStatusResponse> {
  try {
    const response = await fetch(`${CONVERTER_URL}/status/${jobId}`)

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`변환 작업을 찾을 수 없습니다: ${jobId}`)
      }
      throw new Error(`상태 조회 실패: ${response.status}`)
    }

    const data = await response.json()
    return {
      jobId: data.job_id,
      fileId: data.file_id,
      status: data.status as ConversionStatus,
      progress: data.progress,
      outputPath: data.output_path,
      error: data.error,
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error('상태 조회 중 오류가 발생했습니다.')
  }
}

/**
 * 변환 서비스 헬스체크
 */
export async function checkConverterHealth(): Promise<{
  status: string
  version: string
  pdalVersion: string
}> {
  try {
    const response = await fetch(`${CONVERTER_URL}/health`)

    if (!response.ok) {
      throw new Error('변환 서비스에 연결할 수 없습니다.')
    }

    const data = await response.json()
    return {
      status: data.status,
      version: data.version,
      pdalVersion: data.pdal_version,
    }
  } catch (error) {
    // 연결 실패 시
    return {
      status: 'unavailable',
      version: 'unknown',
      pdalVersion: 'unknown',
    }
  }
}

/**
 * 변환 상태 텍스트
 */
export const CONVERSION_STATUS_LABELS: Record<ConversionStatus, string> = {
  pending: '대기 중',
  converting: '변환 중',
  ready: '완료',
  failed: '실패',
}

/**
 * 변환 타입 설명
 * 참고: COPC는 PDAL 2.4+ 필요, 현재 LAZ 압축 사용
 */
export const CONVERSION_TYPE_LABELS: Record<ConversionType, string> = {
  e57_to_ply: 'E57 → PLY',
  e57_to_las: 'E57 → LAS',
  e57_to_3dtiles: 'E57 → 3D Tiles',
  las_to_copc: 'LAS → LAZ (압축)',
  ply_to_copc: 'PLY → LAZ (압축)',
  laz_to_copc: 'LAZ → LAZ (최적화)',
  obj_to_3dtiles: 'OBJ → 3D Tiles',
  gltf_to_3dtiles: 'GLTF → 3D Tiles',
  glb_to_3dtiles: 'GLB → 3D Tiles',
  ply_to_3dtiles: 'PLY → 3D Tiles',
  las_to_3dtiles: 'LAS → 3D Tiles',
}
