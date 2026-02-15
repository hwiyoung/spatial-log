import type { FileGroup, UploadOptions } from '@/components/common/FileUpload'
import {
  updateFileConversionStatus,
} from '@/services/api'
import {
  getConversionTypeForFormat,
  startConversion,
  getConversionStatus,
  checkConverterHealth,
} from '@/services/conversionService'

// 파일 변환을 백그라운드에서 트리거하고 상태를 폴링하는 헬퍼 함수
export async function triggerConversionForFile(
  fileId: string,
  storagePath: string,
  format: string,
  originalName: string,
  onUpdate?: () => Promise<void>,
  conversionOptions?: UploadOptions
): Promise<void> {
  try {
    // 변환 서비스 상태 확인
    const health = await checkConverterHealth()
    if (health.status !== 'healthy') {
      console.warn('변환 서비스가 사용 불가능합니다:', health.status)
      return
    }

    // 변환 타입 결정
    const conversionType = getConversionTypeForFormat(format)
    if (!conversionType) {
      console.warn(`지원하지 않는 변환 포맷: ${format}`)
      return
    }

    // DB에 pending 상태 저장
    await updateFileConversionStatus(fileId, 'pending', 0)

    // 변환 시작 (원본 파일명 + EPSG 코드를 옵션으로 전달)
    const options: Record<string, unknown> = { original_name: originalName }
    if (conversionOptions?.epsg) {
      options.epsg = conversionOptions.epsg
    }
    const response = await startConversion({
      fileId,
      sourcePath: storagePath,
      conversionType,
      options,
    })

    console.log(`변환 시작: ${fileId}, jobId: ${response.jobId}`)

    // 상태 폴링 시작 (백그라운드)
    pollConversionStatus(fileId, response.jobId, onUpdate)
  } catch (err) {
    console.error('변환 트리거 실패:', err)
    // 실패 상태 저장
    await updateFileConversionStatus(
      fileId,
      'failed',
      0,
      undefined,
      err instanceof Error ? err.message : '변환 시작 실패'
    )
  }
}

// 변환 상태 폴링 함수
export async function pollConversionStatus(
  fileId: string,
  jobId: string,
  onUpdate?: () => Promise<void>,
  intervalMs: number = 3000,
  maxAttempts: number = 600 // 30분 (3초 * 600)
): Promise<void> {
  let attempts = 0

  const poll = async () => {
    if (attempts >= maxAttempts) {
      console.warn(`변환 타임아웃: ${fileId}`)
      await updateFileConversionStatus(fileId, 'failed', 0, undefined, '변환 타임아웃')
      return
    }

    attempts++

    try {
      const status = await getConversionStatus(jobId)

      // DB 상태 업데이트
      await updateFileConversionStatus(
        fileId,
        status.status,
        status.progress,
        status.outputPath,
        status.error
      )

      // 파일 목록 새로고침 (UI 업데이트)
      onUpdate?.()

      // 완료 또는 실패가 아니면 계속 폴링
      if (status.status !== 'ready' && status.status !== 'failed') {
        setTimeout(poll, intervalMs)
      } else {
        console.log(`변환 완료: ${fileId}, 상태: ${status.status}`)
      }
    } catch (err) {
      console.error('변환 상태 폴링 오류:', err)
      // 일시적 오류면 계속 시도
      if (attempts < maxAttempts) {
        setTimeout(poll, intervalMs)
      }
    }
  }

  // 첫 폴링 시작
  setTimeout(poll, intervalMs)
}

// 파일 그룹 정보를 이름 기반 맵으로 변환
export function buildFileGroupMap(groups?: FileGroup[]): Map<string, { groupId: string; isMain: boolean; mainFileName?: string }> {
  const map = new Map<string, { groupId: string; isMain: boolean; mainFileName?: string }>()
  if (!groups || groups.length === 0) return map

  for (const group of groups) {
    if (group.mainFile) {
      map.set(group.mainFile.name, { groupId: group.groupId, isMain: true })
      for (const mtl of group.materialFiles) {
        map.set(mtl.name, { groupId: group.groupId, isMain: false, mainFileName: group.mainFile.name })
      }
      for (const tex of group.textureFiles) {
        map.set(tex.name, { groupId: group.groupId, isMain: false, mainFileName: group.mainFile.name })
      }
    }
  }
  return map
}
