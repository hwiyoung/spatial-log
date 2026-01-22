import { useRef, useEffect } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface CameraControllerProps {
  targetPosition: { x: number; y: number; z: number } | null
  offset?: { x: number; y: number; z: number }
  duration?: number
}

export default function CameraController({
  targetPosition,
  offset = { x: 3, y: 3, z: 3 },
  duration = 1.0,
}: CameraControllerProps) {
  const { camera } = useThree()
  const isAnimating = useRef(false)
  const startPosition = useRef(new THREE.Vector3())
  const endPosition = useRef(new THREE.Vector3())
  const startLookAt = useRef(new THREE.Vector3())
  const endLookAt = useRef(new THREE.Vector3())
  const progress = useRef(0)
  const prevTarget = useRef<{ x: number; y: number; z: number } | null>(null)

  useEffect(() => {
    if (!targetPosition) {
      isAnimating.current = false
      return
    }

    // 같은 타겟이면 스킵
    if (
      prevTarget.current &&
      prevTarget.current.x === targetPosition.x &&
      prevTarget.current.y === targetPosition.y &&
      prevTarget.current.z === targetPosition.z
    ) {
      return
    }

    prevTarget.current = targetPosition

    // 애니메이션 시작
    startPosition.current.copy(camera.position)
    endPosition.current.set(
      targetPosition.x + offset.x,
      targetPosition.y + offset.y,
      targetPosition.z + offset.z
    )

    // 현재 카메라가 바라보는 방향 계산
    const direction = new THREE.Vector3()
    camera.getWorldDirection(direction)
    startLookAt.current.copy(camera.position).add(direction.multiplyScalar(10))

    endLookAt.current.set(targetPosition.x, targetPosition.y, targetPosition.z)

    progress.current = 0
    isAnimating.current = true
  }, [targetPosition, camera, offset])

  useFrame((_, delta) => {
    if (!isAnimating.current) return

    progress.current += delta / duration

    if (progress.current >= 1) {
      progress.current = 1
      isAnimating.current = false
    }

    // Ease-out 보간
    const t = 1 - Math.pow(1 - progress.current, 3)

    // 위치 보간
    camera.position.lerpVectors(startPosition.current, endPosition.current, t)

    // 시선 방향 보간
    const currentLookAt = new THREE.Vector3()
    currentLookAt.lerpVectors(startLookAt.current, endLookAt.current, t)
    camera.lookAt(currentLookAt)
  })

  return null
}
