/**
 * cesiumLoaders - Cesium 데이터 로딩 헬퍼 함수
 * GeoViewer에서 사용하는 3D Tiles, GLB 로드 로직을 분리
 */
import {
  Viewer as CesiumViewer,
  Cartesian3,
  Color,
  Cesium3DTileset,
  HeadingPitchRange,
  Math as CesiumMath,
  Transforms,
  HeadingPitchRoll,
} from 'cesium'
import type { Entity } from 'cesium'
import type { SpatialInfo } from '@/services/api'

/**
 * Cesium Entity에 orientation(Quaternion)을 설정하는 헬퍼.
 * Cesium의 Entity.orientation 타입 정의가 Property 기반이라
 * 직접 Quaternion을 대입하면 TS 에러가 발생하므로 cast를 중앙화한다.
 */
export function setEntityOrientation(entity: Entity, position: Cartesian3, headingDeg: number): void {
  const headingRad = CesiumMath.toRadians(headingDeg)
  const orientation = Transforms.headingPitchRollQuaternion(
    position,
    new HeadingPitchRoll(headingRad, 0, 0)
  )
  // Cesium Entity.orientation accepts a Quaternion at runtime,
  // but the TS definition expects Property | undefined.
  ;(entity as any).orientation = orientation
}

/**
 * 3D Tiles 로드
 */
export async function load3DTiles(
  viewer: CesiumViewer,
  url: string,
  spatialInfo?: SpatialInfo
): Promise<Cesium3DTileset> {
  try {
    console.log('=== Loading 3D Tiles ===')
    console.log('URL:', url)
    console.log('Spatial info:', JSON.stringify(spatialInfo, null, 2))

    // tileset.json 내용 확인
    try {
      const tilesetResponse = await fetch(url)
      const tilesetJson = await tilesetResponse.json()
      console.log('tileset.json content:', JSON.stringify(tilesetJson, null, 2))
      console.log('Has root transform:', !!tilesetJson.root?.transform)
      console.log('Bounding volume:', tilesetJson.root?.boundingVolume)
    } catch (e) {
      console.warn('Could not fetch tileset.json for debugging:', e)
    }

    // 3D Tileset 로드 (fromUrl은 이미 ready 상태의 tileset을 반환)
    const tileset = await Cesium3DTileset.fromUrl(url)

    // 타일 로드 에러 캡처
    tileset.tileFailed.addEventListener((event: { url: string; message: string }) => {
      console.error('Tile failed to load:', event.url, event.message)
    })

    tileset.tileLoad.addEventListener((tile: { content?: { url?: string } }) => {
      console.log('Tile loaded:', tile.content?.url)
    })

    viewer.scene.primitives.add(tileset)

    console.log('Tileset loaded and ready')
    console.log('Tileset bounding sphere center:', tileset.boundingSphere.center)
    console.log('Tileset bounding sphere radius:', tileset.boundingSphere.radius)
    console.log('Tileset root transform:', tileset.root?.transform)
    console.log('Tileset root boundingVolume:', (tileset.root as any)?.boundingVolume)

    // 바운딩 스피어 반지름이 유효한지 확인
    const radius = tileset.boundingSphere.radius
    if (radius <= 0 || !isFinite(radius)) {
      console.warn('Invalid bounding sphere radius, using default zoom')
      // 좌표 정보가 있으면 해당 위치로 이동
      if (spatialInfo?.center?.longitude && spatialInfo?.center?.latitude) {
        viewer.camera.flyTo({
          destination: Cartesian3.fromDegrees(
            spatialInfo.center.longitude,
            spatialInfo.center.latitude,
            500 // 500m 고도
          ),
          duration: 2,
        })
      }
      return tileset
    }

    // 줌 거리 계산 - 모델 크기에 비례하되 최소/최대 제한
    // 작은 모델(20m)의 경우 너무 멀리 떨어지지 않도록
    let zoomDistance = radius * 3
    zoomDistance = Math.max(zoomDistance, 200) // 최소 200m (더 여유있게)
    zoomDistance = Math.min(zoomDistance, 10000) // 최대 10km

    console.log('Calculated zoom distance:', zoomDistance)

    // 타일셋의 실제 바운딩 영역으로 자동 줌
    try {
      await viewer.zoomTo(tileset, new HeadingPitchRange(
        CesiumMath.toRadians(0),
        CesiumMath.toRadians(-30), // 더 위에서 내려다봄
        zoomDistance
      ))
      console.log('Camera zoomed to tileset successfully')
    } catch (zoomError) {
      console.error('zoomTo failed:', zoomError)
      // 직접 카메라 이동 시도
      if (spatialInfo?.center?.longitude && spatialInfo?.center?.latitude) {
        console.log('Falling back to direct camera flyTo')
        viewer.camera.flyTo({
          destination: Cartesian3.fromDegrees(
            spatialInfo.center.longitude,
            spatialInfo.center.latitude,
            zoomDistance
          ),
          duration: 2,
        })
      }
    }

    // 카메라 현재 위치 로그
    const cameraPos = viewer.camera.positionCartographic
    console.log('Camera position (cartographic):', {
      longitude: CesiumMath.toDegrees(cameraPos.longitude),
      latitude: CesiumMath.toDegrees(cameraPos.latitude),
      height: cameraPos.height
    })

    return tileset
  } catch (err) {
    console.error('3D Tiles 로드 실패:', err)
    throw new Error(`3D Tiles 데이터를 로드할 수 없습니다: ${err instanceof Error ? err.message : String(err)}`)
  }
}

/**
 * GLB 모델 로드 (Entity API 사용)
 *
 * WGS84 변환된 GLB 모델:
 * - 좌표가 로컬 미터 단위로 변환됨 (중심점 기준)
 * - gltf-transform center로 센터링됨 (원점 중심)
 * - 스케일 1.0으로 사용 (이미 미터 단위)
 */
export async function loadGLB(
  viewer: CesiumViewer,
  url: string,
  spatialInfo?: SpatialInfo,
  headingDeg: number = 0  // 방향 (도 단위)
): Promise<Entity> {
  try {
    console.log('=== Loading GLB ===')
    console.log('URL:', url)
    console.log('Spatial info:', JSON.stringify(spatialInfo, null, 2))
    console.log('Heading:', headingDeg, 'degrees')

    // 위치 결정 (center.longitude/latitude가 있으면 사용, 없으면 기본값)
    const hasGeoCenter = spatialInfo?.center?.longitude !== undefined && spatialInfo?.center?.latitude !== undefined
    const longitude = hasGeoCenter ? spatialInfo!.center!.longitude! : 127.0
    const latitude = hasGeoCenter ? spatialInfo!.center!.latitude! : 36.5

    // 고도 계산
    // WGS84 변환된 GLB는 센터링되어 있으므로, 건물 높이의 절반만큼 올려서 바닥이 지면에 닿도록
    let altitude = 0
    let modelHeightM = 0

    if (spatialInfo?.bbox) {
      // bbox.maxZ - bbox.minZ = 높이 (이미 미터 단위)
      modelHeightM = Math.abs(spatialInfo.bbox.maxZ - spatialInfo.bbox.minZ)
      altitude = modelHeightM / 2  // 센터링된 모델의 바닥이 지면에 닿도록
    }

    console.log('GLB positioning at:', { longitude, latitude, altitude, modelHeightM, hasGeoCenter })

    const position = Cartesian3.fromDegrees(longitude, latitude, altitude)

    const headingRad = CesiumMath.toRadians(headingDeg)
    const pitch = 0
    const roll = 0
    const orientation = Transforms.headingPitchRollQuaternion(
      position,
      new HeadingPitchRoll(headingRad, pitch, roll)
    )

    // 모델 스케일 계산
    let modelScale = 1.0

    if (spatialInfo?.isGeographic && spatialInfo?.bbox) {
      // WGS84 변환된 GLB: 이미 미터 단위로 변환됨, 스케일 1.0 사용
      modelScale = 1.0
      console.log('WGS84 converted GLB: scale=1.0 (already in meters)')
    } else if (spatialInfo?.bbox) {
      const bboxWidth = Math.abs(spatialInfo.bbox.maxX - spatialInfo.bbox.minX)
      const bboxHeight = Math.abs(spatialInfo.bbox.maxY - spatialInfo.bbox.minY)
      const bboxDepth = Math.abs(spatialInfo.bbox.maxZ - spatialInfo.bbox.minZ)
      const maxDim = Math.max(bboxWidth, bboxHeight, bboxDepth)

      console.log('BBox dimensions:', { bboxWidth, bboxHeight, bboxDepth, maxDim })

      // Korea TM 좌표계 (bbox가 큰 미터 단위)인 경우
      if (spatialInfo.isKoreaTM || maxDim > 1000) {
        modelScale = 1.0  // 미터 단위 그대로 사용
        console.log('Korea TM or large model: scale=1.0')
      } else if (maxDim < 1) {
        // 매우 작은 모델 (정규화된 경우)
        modelScale = 50
        console.log('Small model scale applied:', modelScale)
      }
    } else {
      // bbox가 없으면 기본 스케일 사용
      modelScale = 1.0
      console.log('Default scale applied (no bbox):', modelScale)
    }

    const entity = viewer.entities.add({
      name: 'glb-model',
      position: position,
      // Cesium Entity.orientation TS definition expects Property,
      // but accepts Quaternion at runtime.
      orientation: orientation as any,
      model: {
        uri: url,
        minimumPixelSize: 128,
        maximumScale: 50000,
        scale: modelScale,
        shadows: 1, // ENABLED
        silhouetteColor: Color.YELLOW,
        silhouetteSize: 0, // 0 = 비활성화
      },
    })

    console.log('Entity created:', entity.id)

    // 카메라를 모델 위치로 이동 (더 가까이)
    const viewDistance = Math.max(modelScale * 200, 500) // 최소 500m, 스케일에 비례
    console.log('View distance:', viewDistance)

    await viewer.flyTo(entity, {
      duration: 2,
      offset: new HeadingPitchRange(
        CesiumMath.toRadians(0),
        CesiumMath.toRadians(-30),
        viewDistance
      ),
    })

    return entity
  } catch (err) {
    console.error('GLB 로드 실패:', err)
    throw new Error(`GLB 모델을 로드할 수 없습니다: ${err instanceof Error ? err.message : String(err)}`)
  }
}
