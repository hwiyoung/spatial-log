/**
 * CesiumWorkspaceCanvas - 워크스페이스 전용 Cesium 캔버스
 * GeoViewer(모델 로딩) + AnnotationMapView3D(마커/클릭) 통합
 */
import { useRef, useEffect, useCallback } from 'react'
import {
  Viewer,
  Cartesian2,
  Cartesian3,
  Color,
  Cesium3DTileset,
  HeadingPitchRange,
  Math as CesiumMath,
  Transforms,
  HeadingPitchRoll,
  Ion,
  VerticalOrigin,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  defined,
  Entity,
  BillboardGraphics,
  LabelGraphics,
  LabelStyle,
  HorizontalOrigin,
  ConstantProperty,
  OpenStreetMapImageryProvider,
} from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import type { SpatialInfo } from '@/services/api'
import type { SceneEntryData, SceneEntryType } from '@/types/story'

interface CesiumWorkspaceCanvasProps {
  dataUrl?: string
  dataType?: '3dtiles' | 'glb'
  spatialInfo?: SpatialInfo
  entries: SceneEntryData[]
  selectedEntryId: string | null
  onEntryClick: (entry: SceneEntryData, screenPosition: { x: number; y: number }) => void
  isCreateMode: boolean
  onMapClick: (gps: { latitude: number; longitude: number }) => void
  measureMode?: boolean
  onMeasureClick?: (gps: { latitude: number; longitude: number }) => void
  onFileDrop?: (data: { fileId: string; format: string; name: string; gps?: { latitude: number; longitude: number } | null }, dropGps: { latitude: number; longitude: number } | null) => void
}

const ENTRY_TYPE_COLORS: Record<SceneEntryType, Color> = {
  spatial: Color.fromCssColorString('#3b82f6'),   // blue
  visual: Color.fromCssColorString('#22c55e'),     // green
  document: Color.fromCssColorString('#a855f7'),   // purple
  note: Color.fromCssColorString('#f59e0b'),       // amber
}

const ENTRY_TYPE_LABELS: Record<SceneEntryType, string> = {
  spatial: '3D 데이터',
  visual: '이미지',
  document: '문서',
  note: '메모',
}

function createMarkerCanvas(color: Color = ENTRY_TYPE_COLORS.spatial, isSelected: boolean = false): HTMLCanvasElement {
  const size = isSelected ? 32 : 24
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size + 10
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(${color.red * 255}, ${color.green * 255}, ${color.blue * 255}, 1)`
  ctx.fill()
  ctx.strokeStyle = 'white'
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(size / 2 - 6, size / 2 + 8)
  ctx.lineTo(size / 2, size + 8)
  ctx.lineTo(size / 2 + 6, size / 2 + 8)
  ctx.fillStyle = `rgba(${color.red * 255}, ${color.green * 255}, ${color.blue * 255}, 1)`
  ctx.fill()

  return canvas
}

export default function CesiumWorkspaceCanvas({
  dataUrl,
  dataType,
  spatialInfo,
  entries,
  selectedEntryId,
  onEntryClick,
  isCreateMode,
  onMapClick,
  measureMode,
  onMeasureClick,
  onFileDrop,
}: CesiumWorkspaceCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<Viewer | null>(null)
  const handlerRef = useRef<ScreenSpaceEventHandler | null>(null)
  const entitiesRef = useRef<Map<string, Entity>>(new Map())
  const tilesetRef = useRef<Cesium3DTileset | null>(null)
  const modelEntityRef = useRef<Entity | null>(null)

  const entriesWithGps = entries.filter((e) => e.gps != null)

  // Cesium Viewer 초기화
  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return

    const ionToken = import.meta.env.VITE_CESIUM_ION_TOKEN
    if (ionToken) Ion.defaultAccessToken = ionToken

    const osmProvider = new OpenStreetMapImageryProvider({
      url: 'https://tile.openstreetmap.org/',
    })

    const viewer = new Viewer(containerRef.current, {
      timeline: false,
      animation: false,
      homeButton: false,
      geocoder: false,
      baseLayerPicker: false,
      navigationHelpButton: false,
      sceneModePicker: false,
      fullscreenButton: false,
      vrButton: false,
      infoBox: false,
      selectionIndicator: false,
      baseLayer: false,
    })

    viewer.imageryLayers.addImageryProvider(osmProvider)

    const creditContainer = viewer.cesiumWidget.creditContainer as HTMLElement
    if (creditContainer) creditContainer.style.display = 'none'

    if (!ionToken) {
      viewer.scene.globe.baseColor = Color.fromCssColorString('#2d4a5e')
    }
    viewer.scene.backgroundColor = Color.fromCssColorString('#0f0f1a')

    // 기본 카메라 (대한민국 중심)
    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(127.5, 36.5, 500000),
      duration: 0,
    })

    viewerRef.current = viewer

    return () => {
      if (handlerRef.current) {
        handlerRef.current.destroy()
        handlerRef.current = null
      }
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy()
      }
      viewerRef.current = null
      entitiesRef.current.clear()
    }
  }, [])

  // 데이터 로딩 (3D Tiles / GLB)
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || !dataUrl || !dataType) return

    // 이전 모델 정리
    if (tilesetRef.current) {
      viewer.scene.primitives.remove(tilesetRef.current)
      tilesetRef.current = null
    }
    if (modelEntityRef.current) {
      viewer.entities.remove(modelEntityRef.current)
      modelEntityRef.current = null
    }

    const loadData = async () => {
      try {
        if (dataType === '3dtiles') {
          const tileset = await Cesium3DTileset.fromUrl(dataUrl)
          viewer.scene.primitives.add(tileset)
          tilesetRef.current = tileset

          const radius = tileset.boundingSphere.radius
          if (radius > 0 && isFinite(radius)) {
            const zoomDistance = Math.max(Math.min(radius * 3, 10000), 200)
            await viewer.zoomTo(tileset, new HeadingPitchRange(
              CesiumMath.toRadians(0),
              CesiumMath.toRadians(-30),
              zoomDistance
            ))
          }
        } else if (dataType === 'glb') {
          const hasGeoCenter = spatialInfo?.center?.longitude != null && spatialInfo?.center?.latitude != null
          const longitude = hasGeoCenter ? spatialInfo!.center!.longitude! : 127.0
          const latitude = hasGeoCenter ? spatialInfo!.center!.latitude! : 36.5
          let altitude = 0
          if (spatialInfo?.bbox) {
            altitude = Math.abs(spatialInfo.bbox.maxZ - spatialInfo.bbox.minZ) / 2
          }

          const position = Cartesian3.fromDegrees(longitude, latitude, altitude)
          const orientation = Transforms.headingPitchRollQuaternion(
            position,
            new HeadingPitchRoll(0, 0, 0)
          )

          const entity = viewer.entities.add({
            name: 'workspace-model',
            position,
            orientation: orientation as any,
            model: {
              uri: dataUrl,
              minimumPixelSize: 128,
              maximumScale: 50000,
              scale: 1.0,
              shadows: 1,
            },
          })
          modelEntityRef.current = entity

          const viewDistance = Math.max(200, 500)
          await viewer.flyTo(entity, {
            duration: 2,
            offset: new HeadingPitchRange(
              CesiumMath.toRadians(0),
              CesiumMath.toRadians(-30),
              viewDistance
            ),
          })
        }
      } catch (err) {
        console.error('CesiumWorkspaceCanvas data load error:', err)
      }
    }

    loadData()
  }, [dataUrl, dataType, spatialInfo])

  // 클릭 이벤트 핸들러
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return

    if (handlerRef.current) handlerRef.current.destroy()

    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas)
    handlerRef.current = handler

    handler.setInputAction((click: { position: { x: number; y: number } }) => {
      const clickPosition = new Cartesian2(click.position.x, click.position.y)

      // 엔티티 클릭 확인
      const pickedObject = viewer.scene.pick(clickPosition)
      if (defined(pickedObject) && pickedObject.id) {
        const entity = pickedObject.id as Entity
        const entryId = entity.properties?.entryId?.getValue()
        if (entryId) {
          const entry = entries.find((e) => e.id === entryId)
          if (entry) {
            // 화면 좌표 전달 (팝업 위치용)
            const screenPos = { x: click.position.x, y: click.position.y }
            onEntryClick(entry, screenPos)
            return
          }
        }
      }

      // 생성 모드 또는 측정 모드일 때 지도 클릭
      if ((isCreateMode || measureMode) && (onMapClick || onMeasureClick)) {
        const ellipsoid = viewer.scene.globe.ellipsoid
        const cartesian = viewer.camera.pickEllipsoid(clickPosition, ellipsoid)
        if (cartesian) {
          const cartographic = ellipsoid.cartesianToCartographic(cartesian)
          const lat = (cartographic.latitude * 180) / Math.PI
          const lng = (cartographic.longitude * 180) / Math.PI
          const gps = { latitude: lat, longitude: lng }

          if (measureMode && onMeasureClick) {
            onMeasureClick(gps)
          } else if (isCreateMode) {
            onMapClick(gps)
          }
        }
      }
    }, ScreenSpaceEventType.LEFT_CLICK)

    return () => {
      if (handlerRef.current) {
        handlerRef.current.destroy()
        handlerRef.current = null
      }
    }
  }, [isCreateMode, measureMode, onMapClick, onMeasureClick, onEntryClick, entries])

  // 마커 업데이트
  const updateMarkers = useCallback(() => {
    const viewer = viewerRef.current
    if (!viewer) return

    const currentIds = new Set(entriesWithGps.map((e) => e.id))
    entitiesRef.current.forEach((entity, id) => {
      if (!currentIds.has(id)) {
        viewer.entities.remove(entity)
        entitiesRef.current.delete(id)
      }
    })

    entriesWithGps.forEach((entry) => {
      const isSelected = entry.id === selectedEntryId
      const existing = entitiesRef.current.get(entry.id)
      const markerColor = ENTRY_TYPE_COLORS[entry.entryType] ?? ENTRY_TYPE_COLORS.note
      const labelText = entry.title || ENTRY_TYPE_LABELS[entry.entryType] || '엔트리'

      if (existing) {
        if (existing.billboard) {
          existing.billboard.image = new ConstantProperty(createMarkerCanvas(markerColor, isSelected))
          existing.billboard.scale = new ConstantProperty(isSelected ? 1.2 : 1.0)
        }
        if (isSelected && !existing.label) {
          existing.label = new LabelGraphics({
            text: labelText,
            font: '14px sans-serif',
            fillColor: Color.WHITE,
            outlineColor: Color.BLACK,
            outlineWidth: 2,
            style: LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: VerticalOrigin.BOTTOM,
            horizontalOrigin: HorizontalOrigin.CENTER,
            pixelOffset: new Cartesian2(0, -40),
          })
        } else if (!isSelected && existing.label) {
          existing.label = undefined
        }
      } else {
        const entity = viewer.entities.add({
          position: Cartesian3.fromDegrees(entry.gps!.longitude, entry.gps!.latitude, 0),
          billboard: new BillboardGraphics({
            image: new ConstantProperty(createMarkerCanvas(markerColor, isSelected)),
            scale: new ConstantProperty(isSelected ? 1.2 : 1.0),
            verticalOrigin: VerticalOrigin.BOTTOM,
          }),
          label: isSelected ? new LabelGraphics({
            text: labelText,
            font: '14px sans-serif',
            fillColor: Color.WHITE,
            outlineColor: Color.BLACK,
            outlineWidth: 2,
            style: LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: VerticalOrigin.BOTTOM,
            horizontalOrigin: HorizontalOrigin.CENTER,
            pixelOffset: new Cartesian2(0, -40),
          }) : undefined,
          properties: { entryId: entry.id },
        })
        entitiesRef.current.set(entry.id, entity)
      }
    })
  }, [entriesWithGps, selectedEntryId])

  useEffect(() => {
    updateMarkers()
  }, [updateMarkers])

  // 선택된 엔트리로 카메라 이동
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || !selectedEntryId) return

    const selected = entriesWithGps.find((e) => e.id === selectedEntryId)
    if (selected?.gps) {
      viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(selected.gps.longitude, selected.gps.latitude, 50000),
        duration: 1.0,
      })
    }
  }, [selectedEntryId, entriesWithGps])

  // Cesium 캔버스에 파일 드롭 시 GPS 좌표 계산
  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/spatial-log-file')) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const raw = e.dataTransfer.getData('application/spatial-log-file')
    if (!raw || !onFileDrop) return
    try {
      const data = JSON.parse(raw) as { fileId: string; format: string; name: string; gps?: { latitude: number; longitude: number } | null }
      // 드롭 위치에서 Cesium GPS 좌표 계산
      let dropGps: { latitude: number; longitude: number } | null = null
      const viewer = viewerRef.current
      if (viewer) {
        const rect = containerRef.current?.getBoundingClientRect()
        if (rect) {
          const x = e.clientX - rect.left
          const y = e.clientY - rect.top
          const ellipsoid = viewer.scene.globe.ellipsoid
          const cartesian = viewer.camera.pickEllipsoid(new Cartesian2(x, y), ellipsoid)
          if (cartesian) {
            const cartographic = ellipsoid.cartesianToCartographic(cartesian)
            dropGps = {
              latitude: (cartographic.latitude * 180) / Math.PI,
              longitude: (cartographic.longitude * 180) / Math.PI,
            }
          }
        }
      }
      onFileDrop(data, dropGps)
    } catch (err) {
      console.error('CesiumWorkspaceCanvas drop error:', err)
    }
  }, [onFileDrop])

  return (
    <div
      className="w-full h-full relative"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div ref={containerRef} className="w-full h-full" />
      {measureMode && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
          <div className="bg-blue-500/20 border border-blue-400/50 rounded-lg px-4 py-2 text-blue-300 text-sm backdrop-blur-sm">
            측정할 지점을 클릭하세요
          </div>
        </div>
      )}
    </div>
  )
}
