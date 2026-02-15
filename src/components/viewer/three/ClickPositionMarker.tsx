import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import type { ClickPosition } from '../ThreeCanvas'

interface ClickPositionMarkerProps {
  position: ClickPosition | null
}

export function ClickPositionMarker({ position }: ClickPositionMarkerProps) {
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (!meshRef.current || !position) return
    // 펄스 애니메이션
    const scale = 1 + Math.sin(state.clock.elapsedTime * 4) * 0.15
    meshRef.current.scale.setScalar(scale)
  })

  if (!position) return null

  return (
    <group position={[position.x, position.y, position.z]}>
      {/* 마커 구체 */}
      <mesh ref={meshRef} name="clickPositionMarker">
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial
          color="#3b82f6"
          emissive="#3b82f6"
          emissiveIntensity={0.5}
          transparent
          opacity={0.9}
        />
      </mesh>
      {/* 외곽 링 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} name="clickPositionMarker">
        <ringGeometry args={[0.12, 0.15, 32]} />
        <meshBasicMaterial color="#3b82f6" transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
      {/* 수직선 (바닥까지) */}
      {position.y > 0.1 && (
        <line>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              array={new Float32Array([0, 0, 0, 0, -position.y, 0])}
              count={2}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#3b82f6" opacity={0.4} transparent />
        </line>
      )}
      {/* 좌표 레이블 */}
      <Html
        position={[0, 0.25, 0]}
        center
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <div
          className="px-2 py-1 rounded text-xs whitespace-nowrap font-mono"
          style={{
            backgroundColor: 'rgba(59, 130, 246, 0.9)',
            color: 'white',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}
        >
          ({position.x.toFixed(3)}, {position.y.toFixed(3)}, {position.z.toFixed(3)})
        </div>
      </Html>
    </group>
  )
}
