import { useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { Grid } from '@react-three/drei'
import { Box as BoxIcon } from 'lucide-react'

// FPS 모니터링 상태 타입
export interface PerformanceStats {
  fps: number
  frameTime: number
  triangles: number
  drawCalls: number
  memory?: number
}

export function GridFloor() {
  return (
    <Grid
      args={[100, 100]}
      cellSize={1}
      cellThickness={0.5}
      cellColor="#334155"
      sectionSize={5}
      sectionThickness={1}
      sectionColor="#475569"
      fadeDistance={50}
      fadeStrength={1}
      followCamera={false}
      infiniteGrid={true}
    />
  )
}

export function PlaceholderBox() {
  return (
    <mesh position={[0, 0.5, 0]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#3b82f6" wireframe />
    </mesh>
  )
}

// 성능 모니터링 컴포넌트 (씬 내부)
export function PerformanceMonitor({ onStats }: { onStats: (stats: PerformanceStats) => void }) {
  const { gl } = useThree()
  const frameTimesRef = useRef<number[]>([])
  const lastTimeRef = useRef(performance.now())

  useFrame(() => {
    const now = performance.now()
    const frameTime = now - lastTimeRef.current
    lastTimeRef.current = now

    // 최근 60개 프레임 시간 저장
    frameTimesRef.current.push(frameTime)
    if (frameTimesRef.current.length > 60) {
      frameTimesRef.current.shift()
    }

    // 매 30프레임마다 통계 업데이트
    if (frameTimesRef.current.length % 30 === 0) {
      const avgFrameTime = frameTimesRef.current.reduce((a, b) => a + b, 0) / frameTimesRef.current.length
      const fps = 1000 / avgFrameTime

      const info = gl.info
      onStats({
        fps: Math.round(fps),
        frameTime: Math.round(avgFrameTime * 100) / 100,
        triangles: info.render?.triangles || 0,
        drawCalls: info.render?.calls || 0,
        memory: (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize,
      })
    }
  })

  return null
}

export function CanvasLoadingFallback() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-slate-950">
      <div className="text-slate-600 flex flex-col items-center p-8 rounded-xl bg-slate-900/50 backdrop-blur-sm border border-slate-800">
        <BoxIcon size={64} strokeWidth={1} className="animate-pulse" />
        <p className="mt-4 text-sm font-medium">캔버스 초기화 중...</p>
      </div>
    </div>
  )
}
