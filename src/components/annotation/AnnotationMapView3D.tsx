import { useRef, useEffect, useCallback } from 'react'
import {
  Viewer,
  Cartesian2,
  Cartesian3,
  Color,
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
import type { AnnotationData } from '@/services/api'
import 'cesium/Build/Cesium/Widgets/widgets.css'

interface AnnotationMapView3DProps {
  annotations: AnnotationData[]
  selectedId: string | null
  onAnnotationClick: (annotation: AnnotationData) => void
  onMapClick?: (lat: number, lng: number) => void
  isCreateMode: boolean
  pendingPosition?: { lat: number; lng: number } | null
}

const DEFAULT_COLOR = Color.fromCssColorString('#eab308')

const PRIORITY_COLORS: Record<string, Color> = {
  low: Color.fromCssColorString('#22c55e'),
  medium: Color.fromCssColorString('#eab308'),
  high: Color.fromCssColorString('#f97316'),
  critical: Color.fromCssColorString('#ef4444'),
}

// 마커 캔버스 생성 함수
function createMarkerCanvas(color: Color, isSelected: boolean): HTMLCanvasElement {
  const size = isSelected ? 32 : 24
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size + 10

  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  // 핀 형태 그리기
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(${color.red * 255}, ${color.green * 255}, ${color.blue * 255}, 1)`
  ctx.fill()
  ctx.strokeStyle = 'white'
  ctx.lineWidth = 2
  ctx.stroke()

  // 핀 아래쪽 삼각형
  ctx.beginPath()
  ctx.moveTo(size / 2 - 6, size / 2 + 8)
  ctx.lineTo(size / 2, size + 8)
  ctx.lineTo(size / 2 + 6, size / 2 + 8)
  ctx.fillStyle = `rgba(${color.red * 255}, ${color.green * 255}, ${color.blue * 255}, 1)`
  ctx.fill()

  return canvas
}

export default function AnnotationMapView3D({
  annotations,
  selectedId,
  onAnnotationClick,
  onMapClick,
  isCreateMode,
  pendingPosition,
}: AnnotationMapView3DProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<Viewer | null>(null)
  const handlerRef = useRef<ScreenSpaceEventHandler | null>(null)
  const entitiesRef = useRef<Map<string, Entity>>(new Map())
  const pendingEntityRef = useRef<Entity | null>(null)

  // GPS가 있는 어노테이션만 필터링
  const annotationsWithGps = annotations.filter((a) => a.gps !== null)

  // Cesium Viewer 초기화
  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return

    // OpenStreetMap 이미저리 프로바이더 (무료, 인증 불필요)
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
      baseLayer: false, // 기본 이미지리 비활성화
    })

    // OSM 레이어 추가
    viewer.imageryLayers.addImageryProvider(osmProvider)

    // 크레딧 숨기기
    const creditContainer = viewer.cesiumWidget.creditContainer as HTMLElement
    if (creditContainer) {
      creditContainer.style.display = 'none'
    }

    viewerRef.current = viewer

    return () => {
      if (handlerRef.current) {
        handlerRef.current.destroy()
        handlerRef.current = null
      }
      if (viewerRef.current) {
        viewerRef.current.destroy()
        viewerRef.current = null
      }
      entitiesRef.current.clear()
    }
  }, [])

  // 클릭 이벤트 핸들러 설정
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return

    // 기존 핸들러 정리
    if (handlerRef.current) {
      handlerRef.current.destroy()
    }

    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas)
    handlerRef.current = handler

    handler.setInputAction((click: { position: { x: number; y: number } }) => {
      const clickPosition = new Cartesian2(click.position.x, click.position.y)

      // 엔티티 클릭 확인
      const pickedObject = viewer.scene.pick(clickPosition)

      if (defined(pickedObject) && pickedObject.id) {
        const entity = pickedObject.id as Entity
        const annotationId = entity.properties?.annotationId?.getValue()
        if (annotationId) {
          const annotation = annotations.find((a) => a.id === annotationId)
          if (annotation) {
            onAnnotationClick(annotation)
            return
          }
        }
      }

      // 생성 모드일 때 지도 클릭
      if (isCreateMode && onMapClick) {
        const ellipsoid = viewer.scene.globe.ellipsoid
        const cartesian = viewer.camera.pickEllipsoid(clickPosition, ellipsoid)

        if (cartesian) {
          const cartographic = ellipsoid.cartesianToCartographic(cartesian)
          const lat = (cartographic.latitude * 180) / Math.PI
          const lng = (cartographic.longitude * 180) / Math.PI
          onMapClick(lat, lng)
        }
      }
    }, ScreenSpaceEventType.LEFT_CLICK)

    return () => {
      if (handlerRef.current) {
        handlerRef.current.destroy()
        handlerRef.current = null
      }
    }
  }, [isCreateMode, onMapClick, onAnnotationClick, annotations])

  // 어노테이션 마커 업데이트
  const updateMarkers = useCallback(() => {
    const viewer = viewerRef.current
    if (!viewer) return

    // 기존 마커 중 삭제된 것 제거
    const currentIds = new Set(annotationsWithGps.map((a) => a.id))
    entitiesRef.current.forEach((entity, id) => {
      if (!currentIds.has(id)) {
        viewer.entities.remove(entity)
        entitiesRef.current.delete(id)
      }
    })

    // 마커 생성 또는 업데이트
    annotationsWithGps.forEach((annotation) => {
      const isSelected = annotation.id === selectedId
      const color = PRIORITY_COLORS[annotation.priority] ?? DEFAULT_COLOR
      const existingEntity = entitiesRef.current.get(annotation.id)

      if (existingEntity) {
        // 기존 마커 업데이트
        if (existingEntity.billboard) {
          existingEntity.billboard.image = new ConstantProperty(createMarkerCanvas(color, isSelected))
          existingEntity.billboard.scale = new ConstantProperty(isSelected ? 1.2 : 1.0)
        }
        // 선택 시 라벨 표시
        if (isSelected && !existingEntity.label) {
          existingEntity.label = new LabelGraphics({
            text: annotation.title,
            font: '14px sans-serif',
            fillColor: Color.WHITE,
            outlineColor: Color.BLACK,
            outlineWidth: 2,
            style: LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: VerticalOrigin.BOTTOM,
            horizontalOrigin: HorizontalOrigin.CENTER,
            pixelOffset: new Cartesian2(0, -40),
          })
        } else if (!isSelected && existingEntity.label) {
          existingEntity.label = undefined
        }
      } else {
        // 새 마커 생성
        const entity = viewer.entities.add({
          position: Cartesian3.fromDegrees(
            annotation.gps!.longitude,
            annotation.gps!.latitude,
            0
          ),
          billboard: new BillboardGraphics({
            image: new ConstantProperty(createMarkerCanvas(color, isSelected)),
            scale: new ConstantProperty(isSelected ? 1.2 : 1.0),
            verticalOrigin: VerticalOrigin.BOTTOM,
          }),
          label: isSelected ? new LabelGraphics({
            text: annotation.title,
            font: '14px sans-serif',
            fillColor: Color.WHITE,
            outlineColor: Color.BLACK,
            outlineWidth: 2,
            style: LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: VerticalOrigin.BOTTOM,
            horizontalOrigin: HorizontalOrigin.CENTER,
            pixelOffset: new Cartesian2(0, -40),
          }) : undefined,
          properties: {
            annotationId: annotation.id,
          },
        })
        entitiesRef.current.set(annotation.id, entity)
      }
    })
  }, [annotationsWithGps, selectedId])

  // 어노테이션 변경 시 마커 업데이트
  useEffect(() => {
    updateMarkers()
  }, [updateMarkers])

  // 선택된 어노테이션으로 카메라 이동
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || !selectedId) return

    const selected = annotationsWithGps.find((a) => a.id === selectedId)
    if (selected?.gps) {
      viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(
          selected.gps.longitude,
          selected.gps.latitude,
          50000 // 고도 50km
        ),
        duration: 1.0,
      })
    }
  }, [selectedId, annotationsWithGps])

  // 임시 마커 업데이트
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return

    // 기존 임시 마커 제거
    if (pendingEntityRef.current) {
      viewer.entities.remove(pendingEntityRef.current)
      pendingEntityRef.current = null
    }

    // 새 임시 마커 추가
    if (pendingPosition) {
      const entity = viewer.entities.add({
        position: Cartesian3.fromDegrees(pendingPosition.lng, pendingPosition.lat, 0),
        billboard: new BillboardGraphics({
          image: createMarkerCanvas(Color.fromCssColorString('#f97316'), true) as unknown as string,
          scale: 1.2,
          verticalOrigin: VerticalOrigin.BOTTOM,
        }),
      })
      pendingEntityRef.current = entity
    }
  }, [pendingPosition])

  return (
    <div className="w-full h-full relative">
      <div ref={containerRef} className="w-full h-full" />

      {/* 생성 모드 안내 */}
      {isCreateMode && !pendingPosition && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="bg-orange-500/20 border-2 border-dashed border-orange-400 rounded-xl px-6 py-4 text-orange-300 text-sm backdrop-blur-sm">
            지구본을 클릭하여 위치를 선택하세요
          </div>
        </div>
      )}
    </div>
  )
}
