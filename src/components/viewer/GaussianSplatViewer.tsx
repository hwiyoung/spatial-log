// Gaussian Splatting 뷰어 컴포넌트
// @mkkellogg/gaussian-splat-3d 라이브러리를 사용합니다.

import { useEffect, useRef, useState, useCallback } from 'react'
import { Loader2, AlertCircle, RotateCcw } from 'lucide-react'
import * as GaussianSplats3D from '@mkkellogg/gaussian-splat-3d'

interface GaussianSplatViewerProps {
  splatUrl: string
  className?: string
  onLoad?: () => void
  onError?: (error: Error) => void
}

export default function GaussianSplatViewer({
  splatUrl,
  className = '',
  onLoad,
  onError,
}: GaussianSplatViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<GaussianSplats3D.Viewer | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)

  // 뷰어 초기화
  useEffect(() => {
    if (!containerRef.current) return

    let viewer: GaussianSplats3D.Viewer | null = null
    let mounted = true

    const initViewer = async () => {
      try {
        setIsLoading(true)
        setError(null)
        setProgress(0)

        // 뷰어 생성
        viewer = new GaussianSplats3D.Viewer({
          cameraUp: [0, 1, 0],
          initialCameraPosition: [0, 5, 10],
          initialCameraLookAt: [0, 0, 0],
          dynamicScene: false,
          rootElement: containerRef.current!,
          selfDrivenMode: true,
          useBuiltInControls: true,
          ignoreDevicePixelRatio: false,
          gpuAcceleratedSort: true,
          sharedMemoryForWorkers: false,
          integerBasedSort: true,
          halfPrecisionCovariancesOnGPU: true,
          antialiased: true,
          focalAdjustment: 1.0,
        })

        viewerRef.current = viewer

        // Splat 씬 추가
        await viewer.addSplatScene(splatUrl, {
          splatAlphaRemovalThreshold: 5,
          showLoadingUI: false,
          position: [0, 0, 0],
          rotation: [0, 0, 0, 1],
          scale: [1, 1, 1],
          progressCallback: (percent: number) => {
            if (mounted) {
              setProgress(Math.round(percent))
            }
          },
        })

        if (mounted) {
          viewer.start()
          setIsLoading(false)
          onLoad?.()
        }
      } catch (err) {
        console.error('Gaussian Splatting 로드 실패:', err)
        if (mounted) {
          const errorMessage = err instanceof Error ? err.message : '로드 실패'
          setError(errorMessage)
          setIsLoading(false)
          onError?.(err instanceof Error ? err : new Error(errorMessage))
        }
      }
    }

    initViewer()

    return () => {
      mounted = false
      if (viewer) {
        viewer.dispose()
        viewerRef.current = null
      }
    }
  }, [splatUrl, onLoad, onError])

  // 뷰어 리셋
  const handleReset = useCallback(() => {
    if (viewerRef.current) {
      // 카메라를 초기 위치로 리셋
      // Note: gaussian-splat-3d 라이브러리의 카메라 리셋 메서드 사용
      const viewer = viewerRef.current as unknown as { camera?: { position?: { set: (x: number, y: number, z: number) => void } } }
      if (viewer.camera?.position) {
        viewer.camera.position.set(0, 5, 10)
      }
    }
  }, [])

  return (
    <div className={`relative w-full h-full ${className}`}>
      {/* Gaussian Splatting 컨테이너 */}
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)' }}
      />

      {/* 로딩 오버레이 */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm pointer-events-none">
          <div className="flex flex-col items-center gap-4">
            <Loader2 size={48} className="animate-spin text-purple-400" />
            <div className="text-center">
              <p className="text-white font-medium">Gaussian Splatting 로딩 중...</p>
              <p className="text-slate-400 text-sm mt-1">{progress}%</p>
            </div>
            {/* 프로그레스 바 */}
            <div className="w-48 h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 에러 오버레이 */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 text-red-400 max-w-md text-center px-4">
            <AlertCircle size={48} />
            <p className="text-white font-medium">로드 실패</p>
            <p className="text-sm">{error}</p>
            <p className="text-xs text-slate-500 mt-2">
              .splat 또는 .ksplat 파일인지 확인하세요
            </p>
          </div>
        </div>
      )}

      {/* 컨트롤 버튼 */}
      {!isLoading && !error && (
        <div className="absolute top-4 left-4 flex gap-2">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/90 backdrop-blur border border-slate-700 rounded-lg text-xs text-white hover:bg-slate-800/90 transition-colors"
            title="카메라 리셋"
          >
            <RotateCcw size={14} />
            <span>리셋</span>
          </button>
        </div>
      )}

      {/* 포맷 배지 */}
      {!isLoading && !error && (
        <div className="absolute top-4 right-4 bg-slate-900/90 backdrop-blur border border-slate-700 px-3 py-1.5 rounded-lg text-xs text-white shadow-lg">
          <span className="font-bold text-purple-400">GAUSSIAN SPLAT</span>
        </div>
      )}

      {/* 사용법 안내 */}
      {!isLoading && !error && (
        <div className="absolute bottom-4 left-4 bg-slate-900/80 backdrop-blur border border-slate-700 px-3 py-2 rounded-lg text-xs text-slate-400">
          <p>마우스 드래그: 회전 | 스크롤: 줌 | 우클릭 드래그: 이동</p>
        </div>
      )}
    </div>
  )
}
