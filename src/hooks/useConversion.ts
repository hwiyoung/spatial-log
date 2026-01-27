/**
 * 3D 파일 변환 관련 커스텀 훅
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  startConversion,
  getConversionStatus,
  checkConverterHealth,
  needsConversion,
  getConversionTypeForFormat,
  type ConversionStatus,
  type ConversionStatusResponse,
} from '@/services/conversionService'

interface UseConversionOptions {
  /** 자동 폴링 활성화 */
  autoPolling?: boolean
  /** 폴링 간격 (ms) */
  pollingInterval?: number
  /** 상태 변경 시 콜백 */
  onStatusChange?: (status: ConversionStatusResponse) => void
  /** 완료 시 콜백 */
  onComplete?: (status: ConversionStatusResponse) => void
  /** 실패 시 콜백 */
  onError?: (error: string) => void
}

interface UseConversionReturn {
  /** 변환 시작 */
  convert: (fileId: string, storagePath: string, format: string) => Promise<void>
  /** 변환 상태 */
  status: ConversionStatus | null
  /** 진행률 (0-100) */
  progress: number
  /** 에러 메시지 */
  error: string | null
  /** 출력 파일 경로 */
  outputPath: string | null
  /** 로딩 중 여부 */
  isLoading: boolean
  /** 변환 서비스 사용 가능 여부 */
  isConverterAvailable: boolean
  /** 작업 ID */
  jobId: string | null
  /** 다시 시도 */
  retry: () => Promise<void>
  /** 상태 초기화 */
  reset: () => void
}

/**
 * 단일 파일 변환 관리 훅
 */
export function useConversion(options: UseConversionOptions = {}): UseConversionReturn {
  const {
    autoPolling = true,
    pollingInterval = 2000,
    onStatusChange,
    onComplete,
    onError,
  } = options

  const [status, setStatus] = useState<ConversionStatus | null>(null)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [outputPath, setOutputPath] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isConverterAvailable, setIsConverterAvailable] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)

  // 마지막 요청 정보 저장 (재시도용)
  const lastRequestRef = useRef<{
    fileId: string
    storagePath: string
    format: string
    originalName?: string
  } | null>(null)

  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  // 변환 서비스 상태 확인
  useEffect(() => {
    checkConverterHealth().then((health) => {
      setIsConverterAvailable(health.status === 'healthy')
    })
  }, [])

  // 폴링 정리
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
      }
    }
  }, [])

  // 상태 폴링
  const startPolling = useCallback(
    (currentJobId: string) => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
      }

      pollingRef.current = setInterval(async () => {
        try {
          const statusResponse = await getConversionStatus(currentJobId)

          setStatus(statusResponse.status)
          setProgress(statusResponse.progress)
          setOutputPath(statusResponse.outputPath || null)

          onStatusChange?.(statusResponse)

          // 완료 또는 실패 시 폴링 중지
          if (statusResponse.status === 'ready') {
            clearInterval(pollingRef.current!)
            pollingRef.current = null
            setIsLoading(false)
            onComplete?.(statusResponse)
          } else if (statusResponse.status === 'failed') {
            clearInterval(pollingRef.current!)
            pollingRef.current = null
            setIsLoading(false)
            setError(statusResponse.error || '변환 실패')
            onError?.(statusResponse.error || '변환 실패')
          }
        } catch (err) {
          console.error('변환 상태 폴링 오류:', err)
        }
      }, pollingInterval)
    },
    [pollingInterval, onStatusChange, onComplete, onError]
  )

  // 변환 시작
  const convert = useCallback(
    async (fileId: string, storagePath: string, format: string, originalName?: string) => {
      // 변환이 필요한 포맷인지 확인
      if (!needsConversion(format)) {
        return
      }

      const conversionType = getConversionTypeForFormat(format)
      if (!conversionType) {
        setError('지원하지 않는 변환 포맷입니다.')
        return
      }

      // 요청 정보 저장
      lastRequestRef.current = { fileId, storagePath, format, originalName }

      setIsLoading(true)
      setError(null)
      setStatus('pending')
      setProgress(0)

      try {
        const response = await startConversion({
          fileId,
          sourcePath: storagePath,
          conversionType,
          options: originalName ? { original_name: originalName } : undefined,
        })

        setJobId(response.jobId)
        setStatus(response.status)

        // 자동 폴링 시작
        if (autoPolling) {
          startPolling(response.jobId)
        }
      } catch (err) {
        setIsLoading(false)
        setStatus('failed')
        const errorMessage = err instanceof Error ? err.message : '변환 요청 실패'
        setError(errorMessage)
        onError?.(errorMessage)
      }
    },
    [autoPolling, startPolling, onError]
  )

  // 재시도
  const retry = useCallback(async () => {
    if (lastRequestRef.current) {
      const { fileId, storagePath, format, originalName } = lastRequestRef.current
      await convert(fileId, storagePath, format, originalName)
    }
  }, [convert])

  // 상태 초기화
  const reset = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
    setStatus(null)
    setProgress(0)
    setError(null)
    setOutputPath(null)
    setIsLoading(false)
    setJobId(null)
    lastRequestRef.current = null
  }, [])

  return {
    convert,
    status,
    progress,
    error,
    outputPath,
    isLoading,
    isConverterAvailable,
    jobId,
    retry,
    reset,
  }
}

/**
 * 여러 파일의 변환 상태 관리 훅
 */
export function useConversionBatch() {
  const [conversions, setConversions] = useState<
    Map<string, { status: ConversionStatus; progress: number; error?: string }>
  >(new Map())
  const [isConverterAvailable, setIsConverterAvailable] = useState(false)

  // 변환 서비스 상태 확인
  useEffect(() => {
    checkConverterHealth().then((health) => {
      setIsConverterAvailable(health.status === 'healthy')
    })
  }, [])

  // 파일 변환 상태 업데이트
  const updateConversion = useCallback(
    (fileId: string, status: ConversionStatus, progress: number, error?: string) => {
      setConversions((prev) => {
        const next = new Map(prev)
        next.set(fileId, { status, progress, error })
        return next
      })
    },
    []
  )

  // 파일 변환 상태 조회
  const getConversion = useCallback(
    (fileId: string) => {
      return conversions.get(fileId)
    },
    [conversions]
  )

  // 변환 시작
  const startFileConversion = useCallback(
    async (fileId: string, storagePath: string, format: string, originalName?: string) => {
      if (!needsConversion(format)) return

      const conversionType = getConversionTypeForFormat(format)
      if (!conversionType) return

      updateConversion(fileId, 'pending', 0)

      try {
        const response = await startConversion({
          fileId,
          sourcePath: storagePath,
          conversionType,
          options: originalName ? { original_name: originalName } : undefined,
        })

        updateConversion(fileId, response.status, 0)

        // 폴링 시작
        const poll = async () => {
          try {
            const status = await getConversionStatus(response.jobId)
            updateConversion(fileId, status.status, status.progress, status.error)

            if (status.status !== 'ready' && status.status !== 'failed') {
              setTimeout(poll, 2000)
            }
          } catch {
            // 폴링 오류 무시
          }
        }
        poll()
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '변환 요청 실패'
        updateConversion(fileId, 'failed', 0, errorMessage)
      }
    },
    [updateConversion]
  )

  return {
    conversions,
    getConversion,
    startFileConversion,
    isConverterAvailable,
  }
}

export default useConversion
