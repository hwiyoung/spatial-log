/**
 * 3D 측정 오버레이 컴포넌트
 * Three.js 씬 내에서 거리 측정선과 수치 라벨을 렌더링합니다.
 */

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import type { ClickPosition } from './ThreeCanvas'

interface MeasurementPoint {
  position: ClickPosition
  id: number
}

interface MeasurementOverlayProps {
  points: MeasurementPoint[]
  activePointIndex: number | null // 현재 활성 포인트 (애니메이션용)
}

// 두 점 사이의 3D 거리 계산
function calculateDistance(a: ClickPosition, b: ClickPosition): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const dz = b.z - a.z
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

// 두 점의 중간점 계산
function midpoint(a: ClickPosition, b: ClickPosition): [number, number, number] {
  return [(a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2]
}

// 거리 포맷
function formatDistance(distance: number): string {
  if (distance < 0.01) return `${(distance * 1000).toFixed(1)} mm`
  if (distance < 1) return `${(distance * 100).toFixed(1)} cm`
  if (distance < 1000) return `${distance.toFixed(3)} m`
  return `${(distance / 1000).toFixed(3)} km`
}

// 측정 포인트 마커
function MeasurePointMarker({ position, isActive }: { position: ClickPosition; isActive: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (!meshRef.current) return
    if (isActive) {
      const scale = 1 + Math.sin(state.clock.elapsedTime * 5) * 0.2
      meshRef.current.scale.setScalar(scale)
    } else {
      meshRef.current.scale.setScalar(1)
    }
  })

  return (
    <mesh
      ref={meshRef}
      position={[position.x, position.y, position.z]}
      name="measurePointMarker"
    >
      <sphereGeometry args={[0.06, 12, 12]} />
      <meshStandardMaterial
        color="#f59e0b"
        emissive="#f59e0b"
        emissiveIntensity={0.6}
        transparent
        opacity={0.95}
      />
    </mesh>
  )
}

// 측정선 (두 점 사이)
function MeasureLine({ from, to }: { from: ClickPosition; to: ClickPosition }) {
  const distance = calculateDistance(from, to)
  const mid = midpoint(from, to)

  const linePositions = new Float32Array([
    from.x, from.y, from.z,
    to.x, to.y, to.z,
  ])

  return (
    <group>
      {/* 측정선 */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            array={linePositions}
            count={2}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#f59e0b" linewidth={2} />
      </line>

      {/* 점선 (파선 효과를 위한 두 번째 선) */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            array={linePositions}
            count={2}
            itemSize={3}
          />
        </bufferGeometry>
        <lineDashedMaterial color="#fbbf24" dashSize={0.1} gapSize={0.05} />
      </line>

      {/* 거리 라벨 */}
      <Html
        position={mid}
        center
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <div
          className="px-2 py-1 rounded text-xs whitespace-nowrap font-mono"
          style={{
            backgroundColor: 'rgba(245, 158, 11, 0.95)',
            color: 'white',
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            fontWeight: 600,
          }}
        >
          {formatDistance(distance)}
        </div>
      </Html>
    </group>
  )
}

export default function MeasurementOverlay({ points, activePointIndex }: MeasurementOverlayProps) {
  if (points.length === 0) return null

  return (
    <group>
      {/* 포인트 마커 */}
      {points.map((pt, idx) => (
        <MeasurePointMarker
          key={pt.id}
          position={pt.position}
          isActive={idx === activePointIndex}
        />
      ))}

      {/* 연속된 포인트 쌍 사이의 측정선 */}
      {points.length >= 2 &&
        Array.from({ length: Math.floor(points.length / 2) }, (_, i) => {
          const from = points[i * 2]
          const to = points[i * 2 + 1]
          if (!from || !to) return null
          return (
            <MeasureLine
              key={`line-${from.id}-${to.id}`}
              from={from.position}
              to={to.position}
            />
          )
        })
      }
    </group>
  )
}

export { calculateDistance, formatDistance }
export type { MeasurementPoint }
