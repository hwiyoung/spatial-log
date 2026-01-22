import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import type { AnnotationData } from '@/services/api'

const PRIORITY_COLORS: Record<string, string> = {
  low: '#22c55e',
  medium: '#eab308',
  high: '#f97316',
  critical: '#ef4444',
}

interface AnnotationMarker3DProps {
  annotation: AnnotationData
  isSelected: boolean
  onClick: (annotation: AnnotationData) => void
}

export default function AnnotationMarker3D({
  annotation,
  isSelected,
  onClick,
}: AnnotationMarker3DProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)

  // 애니메이션 (선택된 마커만)
  useFrame((state) => {
    if (!meshRef.current) return

    if (isSelected) {
      // 선택된 마커: 펄스 효과
      const scale = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.1
      meshRef.current.scale.setScalar(scale)
    } else if (hovered) {
      meshRef.current.scale.setScalar(1.2)
    } else {
      meshRef.current.scale.setScalar(1)
    }
  })

  if (!annotation.position) return null

  const color = PRIORITY_COLORS[annotation.priority] || PRIORITY_COLORS.medium
  const { x, y, z } = annotation.position

  return (
    <group position={[x, y, z]}>
      {/* 마커 구체 */}
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation()
          onClick(annotation)
        }}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isSelected ? 0.5 : hovered ? 0.3 : 0.1}
        />
      </mesh>

      {/* 수직 연결선 (바닥까지) */}
      {y > 0 && (
        <line>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              array={new Float32Array([0, 0, 0, 0, -y, 0])}
              count={2}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color={color} opacity={0.5} transparent />
        </line>
      )}

      {/* 레이블 (선택 또는 호버 시) */}
      {(isSelected || hovered) && (
        <Html
          position={[0, 0.4, 0]}
          center
          style={{
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          <div
            className="px-2 py-1 rounded text-xs whitespace-nowrap"
            style={{
              backgroundColor: 'rgba(15, 23, 42, 0.9)',
              border: `1px solid ${color}`,
              color: 'white',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            }}
          >
            <div className="font-medium">{annotation.title}</div>
            <div className="text-slate-400 text-[10px]">
              [{x.toFixed(2)}, {y.toFixed(2)}, {z.toFixed(2)}]
            </div>
          </div>
        </Html>
      )}
    </group>
  )
}

interface AnnotationMarkers3DProps {
  annotations: AnnotationData[]
  selectedId: string | null
  onAnnotationClick: (annotation: AnnotationData) => void
}

export function AnnotationMarkers3D({
  annotations,
  selectedId,
  onAnnotationClick,
}: AnnotationMarkers3DProps) {
  // position이 있는 어노테이션만 필터링
  const annotationsWithPosition = annotations.filter((a) => a.position !== null)

  return (
    <group>
      {annotationsWithPosition.map((annotation) => (
        <AnnotationMarker3D
          key={annotation.id}
          annotation={annotation}
          isSelected={annotation.id === selectedId}
          onClick={onAnnotationClick}
        />
      ))}
    </group>
  )
}
