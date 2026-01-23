import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { loadModel, loadModelFromFile, type LoadProgress, type LoadedModel, type RelatedFile } from '../../utils/modelLoader'

interface ModelViewerProps {
  url?: string
  file?: File
  format?: string // 명시적 포맷 지정 (blob URL 사용 시)
  relatedFiles?: RelatedFile[] // 연관 파일 (MTL, 텍스처 등)
  onLoad?: (model: LoadedModel) => void
  onError?: (error: Error) => void
  onProgress?: (progress: LoadProgress) => void
  fitCamera?: boolean // 모델에 카메라 맞추기 (기본: true)
}

export default function ModelViewer({ url, file, format, relatedFiles, onLoad, onError, onProgress, fitCamera = true }: ModelViewerProps) {
  const { scene, camera, controls } = useThree()
  const modelRef = useRef<THREE.Object3D | null>(null)

  useEffect(() => {
    let isMounted = true

    const load = async () => {
      try {
        let loadedModel: LoadedModel

        if (file) {
          loadedModel = await loadModelFromFile(file, onProgress)
        } else if (url) {
          // format이 명시적으로 지정된 경우 URL에 format 힌트 추가
          const loadUrl = format && !url.includes('#')
            ? `${url}#file.${format}`
            : url
          loadedModel = await loadModel(loadUrl, onProgress, relatedFiles)
        } else {
          return
        }

        if (!isMounted) return

        // 이전 모델 제거
        if (modelRef.current) {
          scene.remove(modelRef.current)
          disposeObject(modelRef.current)
        }

        // 새 모델 설정
        modelRef.current = loadedModel.object
        scene.add(loadedModel.object)

        // 카메라를 모델 범위에 맞추기 (extent zoom)
        if (fitCamera && camera instanceof THREE.PerspectiveCamera) {
          fitCameraToExtent(camera, loadedModel.object, controls as OrbitControlsImpl | null)
        }

        onLoad?.(loadedModel)
      } catch (err) {
        if (!isMounted) return
        const error = err instanceof Error ? err : new Error(String(err))
        onError?.(error)
      }
    }

    if (url || file) {
      load()
    }

    return () => {
      isMounted = false
      // 컴포넌트 언마운트 시 모델 제거
      if (modelRef.current) {
        scene.remove(modelRef.current)
        disposeObject(modelRef.current)
        modelRef.current = null
      }
    }
  }, [url, file, format, relatedFiles, scene, camera, controls, onLoad, onError, onProgress, fitCamera])

  // 모델이 없으면 null 반환 (scene에 직접 추가되므로)
  return null
}

// Three.js 오브젝트 메모리 정리
function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      if (child.geometry) {
        child.geometry.dispose()
      }
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(disposeMaterial)
        } else {
          disposeMaterial(child.material)
        }
      }
    }
    if (child instanceof THREE.Points) {
      if (child.geometry) {
        child.geometry.dispose()
      }
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(disposeMaterial)
        } else {
          disposeMaterial(child.material)
        }
      }
    }
  })
}

function disposeMaterial(material: THREE.Material) {
  material.dispose()

  // 텍스처 정리
  const mat = material as THREE.MeshStandardMaterial
  if (mat.map) mat.map.dispose()
  if (mat.normalMap) mat.normalMap.dispose()
  if (mat.roughnessMap) mat.roughnessMap.dispose()
  if (mat.metalnessMap) mat.metalnessMap.dispose()
  if (mat.aoMap) mat.aoMap.dispose()
  if (mat.emissiveMap) mat.emissiveMap.dispose()
}

/**
 * 카메라를 오브젝트의 범위(extent)에 맞춤
 * OrbitControls 타겟도 함께 업데이트하여 모델 중심으로 회전하도록 함
 */
function fitCameraToExtent(
  camera: THREE.PerspectiveCamera,
  object: THREE.Object3D,
  controls: OrbitControlsImpl | null
) {
  // 월드 좌표계 업데이트
  object.updateMatrixWorld(true)

  // 바운딩 박스 계산
  const box = new THREE.Box3().setFromObject(object)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())

  // 모델 크기가 0인 경우 (빈 모델) 처리
  const maxDim = Math.max(size.x, size.y, size.z)
  if (maxDim === 0) {
    console.warn('모델 크기가 0입니다.')
    return
  }

  // 카메라 FOV 기반 거리 계산 (수평/수직 FOV 모두 고려)
  const fov = camera.fov * (Math.PI / 180)
  const aspect = camera.aspect

  // 수평/수직 방향 모두 화면에 들어오도록 거리 계산
  const fovH = 2 * Math.atan(Math.tan(fov / 2) * aspect)
  const distanceV = (size.y / 2) / Math.tan(fov / 2)
  const distanceH = Math.max(size.x, size.z) / 2 / Math.tan(fovH / 2)
  let cameraDistance = Math.max(distanceV, distanceH)

  // 여유 공간 추가 (1.2배 - 모델이 화면의 약 80% 차지)
  cameraDistance *= 1.2

  // 최소 거리 보장
  cameraDistance = Math.max(cameraDistance, maxDim * 0.5)

  // 카메라 위치 설정 (대각선 방향에서 바라봄)
  const direction = new THREE.Vector3(1, 0.8, 1).normalize()
  camera.position.copy(center).add(direction.multiplyScalar(cameraDistance))
  camera.lookAt(center)

  // near/far 조정 (모델 크기에 따라)
  camera.near = Math.max(cameraDistance / 100, 0.01)
  camera.far = cameraDistance * 100
  camera.updateProjectionMatrix()

  // OrbitControls 타겟을 모델 중심으로 업데이트
  if (controls && 'target' in controls) {
    controls.target.copy(center)
    controls.update()
  }
}
