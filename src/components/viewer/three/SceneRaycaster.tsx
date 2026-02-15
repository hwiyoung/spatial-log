import { useCallback, useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { ClickPosition } from '../ThreeCanvas'

export interface SceneRaycasterProps {
  onCoordinateClick?: (position: ClickPosition) => void
  onMeasureClick?: (position: ClickPosition) => void
  showCoordinates: boolean
  measureMode: boolean
}

export function SceneRaycaster({ onCoordinateClick, onMeasureClick, showCoordinates, measureMode }: SceneRaycasterProps) {
  const { camera, scene, raycaster, gl } = useThree()
  const fallbackPlaneRef = useRef<THREE.Mesh>(null)

  useEffect(() => {
    // 포인트 클라우드 레이캐스팅 임계값 설정 (클릭 감지 범위)
    raycaster.params.Points.threshold = 0.15
  }, [raycaster])

  const handleClick = useCallback((event: MouseEvent) => {
    if (!showCoordinates && !measureMode) return
    if (showCoordinates && !onCoordinateClick) return
    if (measureMode && !onMeasureClick) return

    // 마우스 좌표를 정규화된 디바이스 좌표로 변환
    const rect = gl.domElement.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1

    const mouse = new THREE.Vector2(x, y)
    raycaster.setFromCamera(mouse, camera)

    // 씬의 모든 객체에 대해 레이캐스팅 (재귀적)
    const intersects = raycaster.intersectObjects(scene.children, true)

    // Grid와 fallback plane, 클릭 마커는 제외하고 실제 모델만 찾기
    const modelIntersect = intersects.find((i) => {
      // Grid helper와 fallback plane, 클릭 마커 제외
      if (i.object === fallbackPlaneRef.current) return false
      if (i.object.type === 'GridHelper') return false
      if (i.object.name === 'fallbackPlane') return false
      if (i.object.name === 'clickPositionMarker') return false
      // visible이 false인 객체 제외
      if (!i.object.visible) return false
      return true
    })

    let clickedPosition: ClickPosition | null = null

    if (modelIntersect) {
      const point = modelIntersect.point
      clickedPosition = {
        x: Math.round(point.x * 1000) / 1000,
        y: Math.round(point.y * 1000) / 1000,
        z: Math.round(point.z * 1000) / 1000,
      }
    } else if (fallbackPlaneRef.current) {
      // 모델이 없으면 바닥면에서 위치 가져오기
      const planeIntersects = raycaster.intersectObject(fallbackPlaneRef.current)
      if (planeIntersects.length > 0) {
        const point = planeIntersects[0]?.point
        if (point) {
          clickedPosition = {
            x: Math.round(point.x * 1000) / 1000,
            y: Math.round(point.y * 1000) / 1000,
            z: Math.round(point.z * 1000) / 1000,
          }
        }
      }
    }

    if (clickedPosition) {
      // 측정 모드일 때
      if (measureMode && onMeasureClick) {
        onMeasureClick(clickedPosition)
      }
      // 좌표 확인 모드일 때
      if (showCoordinates && onCoordinateClick) {
        onCoordinateClick(clickedPosition)
      }
    }
  }, [showCoordinates, measureMode, onCoordinateClick, onMeasureClick, camera, scene, raycaster, gl])

  useEffect(() => {
    const canvas = gl.domElement
    canvas.addEventListener('click', handleClick)
    return () => canvas.removeEventListener('click', handleClick)
  }, [gl, handleClick])

  // 폴백 바닥면 (모델이 없을 때 사용)
  return (
    <mesh
      ref={fallbackPlaneRef}
      name="fallbackPlane"
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
      visible={false}
    >
      <planeGeometry args={[200, 200]} />
      <meshBasicMaterial transparent opacity={0} />
    </mesh>
  )
}
