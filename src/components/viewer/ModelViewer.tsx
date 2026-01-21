import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { loadModel, loadModelFromFile, type LoadProgress, type LoadedModel, type SupportedFormat } from '../../utils/modelLoader'

interface ModelViewerProps {
  url?: string
  file?: File
  format?: string // 명시적 포맷 지정 (blob URL 사용 시)
  onLoad?: (model: LoadedModel) => void
  onError?: (error: Error) => void
  onProgress?: (progress: LoadProgress) => void
}

export default function ModelViewer({ url, file, format, onLoad, onError, onProgress }: ModelViewerProps) {
  const { scene } = useThree()
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
          loadedModel = await loadModel(loadUrl, onProgress)
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
  }, [url, file, format, scene, onLoad, onError, onProgress])

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
