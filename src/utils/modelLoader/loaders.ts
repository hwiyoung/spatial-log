import * as THREE from 'three'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js'
import type { LoadedModel, LoadProgress } from './types'

// 진행률 콜백 생성
export function createProgressCallback(
  onProgress?: (progress: LoadProgress) => void
): ((event: ProgressEvent) => void) | undefined {
  if (!onProgress) return undefined
  return (event: ProgressEvent) => {
    if (event.lengthComputable) {
      onProgress({
        loaded: event.loaded,
        total: event.total,
        percent: Math.round((event.loaded / event.total) * 100),
      })
    }
  }
}

// GLTF/GLB 로더
export async function loadGLTF(
  url: string,
  onProgress?: (progress: LoadProgress) => void
): Promise<LoadedModel> {
  const loader = new GLTFLoader()

  console.log('=== loadGLTF ===')
  console.log('URL:', url.substring(0, 100) + (url.length > 100 ? '...' : ''))

  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf: GLTF) => {
        console.log('GLTF loaded successfully')
        console.log('Scene children:', gltf.scene.children.length)

        // 모델 중심 맞추기
        const box = new THREE.Box3().setFromObject(gltf.scene)
        const size = box.getSize(new THREE.Vector3())
        const center = box.getCenter(new THREE.Vector3())

        console.log('Model size (before scale):', size.x, size.y, size.z)
        console.log('Model center:', center.x, center.y, center.z)

        // 모델 크기가 0인 경우 경고
        if (size.x === 0 && size.y === 0 && size.z === 0) {
          console.warn('Model has zero size!')
        }

        const targetSize = 5 // 목표 크기 (카메라 기본 위치에서 잘 보이는 크기)

        // 균일 스케일링 - 모든 모델에 동일하게 적용
        const maxDim = Math.max(size.x, size.y, size.z)
        let scale = 1

        if (maxDim > 0) {
          scale = targetSize / maxDim
          console.log(`GLTF 스케일링: maxDim=${maxDim.toFixed(6)} → ${targetSize} (scale: ${scale.toFixed(6)})`)
        }

        // 스케일 적용
        gltf.scene.scale.setScalar(scale)

        // 스케일 적용 후 bounding box 재계산하여 정확한 센터링
        gltf.scene.updateMatrixWorld(true)
        const scaledBox = new THREE.Box3().setFromObject(gltf.scene)
        const scaledCenter = scaledBox.getCenter(new THREE.Vector3())

        gltf.scene.position.sub(scaledCenter)

        console.log(`최종 위치: (${gltf.scene.position.x.toFixed(4)}, ${gltf.scene.position.y.toFixed(4)}, ${gltf.scene.position.z.toFixed(4)})`)

        // URL에서 query string 제거 후 확장자 확인
        const urlWithoutQuery = url.split('?')[0] || url
        resolve({
          type: 'group',
          object: gltf.scene,
          format: urlWithoutQuery.endsWith('.glb') ? 'glb' : 'gltf',
        })
      },
      createProgressCallback(onProgress),
      (error) => {
        console.error('GLTF load failed:', error)
        reject(new Error(`GLTF 로드 실패: ${error}`))
      }
    )
  })
}

// FBX 로더
export async function loadFBX(
  url: string,
  onProgress?: (progress: LoadProgress) => void
): Promise<LoadedModel> {
  const loader = new FBXLoader()

  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (object) => {
        // 모델 중심 맞추기
        const box = new THREE.Box3().setFromObject(object)
        const center = box.getCenter(new THREE.Vector3())
        object.position.sub(center)

        // FBX 스케일 조정 (FBX는 종종 큰 스케일을 가짐)
        const size = box.getSize(new THREE.Vector3())
        const maxDim = Math.max(size.x, size.y, size.z)
        if (maxDim > 10) {
          const scale = 5 / maxDim
          object.scale.setScalar(scale)
        }

        resolve({
          type: 'group',
          object,
          format: 'fbx',
        })
      },
      createProgressCallback(onProgress),
      (error) => reject(new Error(`FBX 로드 실패: ${error}`))
    )
  })
}

// PLY 로더 (포인트 클라우드)
export async function loadPLY(
  url: string,
  onProgress?: (progress: LoadProgress) => void
): Promise<LoadedModel> {
  const loader = new PLYLoader()

  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (geometry) => {
        geometry.computeVertexNormals()

        // 버텍스 컬러가 있는지 확인
        const hasColors = geometry.hasAttribute('color')

        let object: THREE.Object3D

        if (geometry.index !== null) {
          // 메시로 렌더링
          const material = new THREE.MeshStandardMaterial({
            vertexColors: hasColors,
            color: hasColors ? undefined : 0x808080,
            side: THREE.DoubleSide,
          })
          object = new THREE.Mesh(geometry, material)
        } else {
          // 포인트 클라우드로 렌더링
          const material = new THREE.PointsMaterial({
            size: 0.01,
            vertexColors: hasColors,
            color: hasColors ? undefined : 0x3b82f6,
          })
          object = new THREE.Points(geometry, material)
        }

        // 중심 맞추기
        geometry.computeBoundingBox()
        if (geometry.boundingBox) {
          const center = geometry.boundingBox.getCenter(new THREE.Vector3())
          geometry.translate(-center.x, -center.y, -center.z)
        }

        resolve({
          type: geometry.index !== null ? 'mesh' : 'points',
          object,
          format: 'ply',
        })
      },
      createProgressCallback(onProgress),
      (error) => reject(new Error(`PLY 로드 실패: ${error}`))
    )
  })
}

// E57 로더 - 브라우저에서 직접 파싱 불가
// E57은 ASTM E2807 표준 포맷으로 압축된 바이너리 데이터 구조
// 서버사이드 변환 서비스를 통해 PLY/LAS로 변환 후 사용해야 함
export async function loadE57(
  _url: string,
  _onProgress?: (progress: LoadProgress) => void
): Promise<LoadedModel> {
  // E57 파일은 브라우저에서 직접 파싱할 수 없음
  // 변환 서비스를 통해 PLY로 변환 후 미리보기 가능
  throw new Error(
    'E57_CONVERSION_REQUIRED: E57 파일은 변환이 필요합니다.\n\n' +
    '업로드 후 자동으로 PLY 형식으로 변환이 시작됩니다.\n' +
    '변환이 완료되면 미리보기가 가능합니다.\n\n' +
    '변환 상태는 파일 목록에서 확인할 수 있습니다.'
  )
}
