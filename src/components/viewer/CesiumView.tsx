import { useRef, useEffect, useState } from 'react'
import {
  Viewer as CesiumViewer,
  Cartesian3,
  Color,
  VerticalOrigin,
  HorizontalOrigin,
  LabelStyle,
  Cartesian2,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  defined,
  OpenStreetMapImageryProvider,
} from 'cesium'
import { AlertTriangle, Loader2 } from 'lucide-react'

interface Annotation {
  id: number
  title: string
  x: string
  y: string
  priority: 'High' | 'Medium' | 'Low'
  longitude?: number
  latitude?: number
}

interface CesiumViewProps {
  annotations?: Annotation[]
  onAnnotationClick?: (annotation: Annotation) => void
}

// 우선순위에 따른 색상 매핑
const priorityColors: Record<string, Color> = {
  High: Color.RED,
  Medium: Color.ORANGE,
  Low: Color.LIME,
}

export default function CesiumView({ annotations = [], onAnnotationClick }: CesiumViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<CesiumViewer | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    let viewer: CesiumViewer | null = null

    try {
      // OpenStreetMap 이미저리 프로바이더 (무료, 인증 불필요)
      const osmProvider = new OpenStreetMapImageryProvider({
        url: 'https://tile.openstreetmap.org/',
      })

      // Cesium Viewer 생성
      viewer = new CesiumViewer(containerRef.current, {
        timeline: false,
        animation: false,
        homeButton: false,
        sceneModePicker: true,
        baseLayerPicker: false, // Ion 인증 필요한 기본 레이어 선택기 비활성화
        navigationHelpButton: false,
        fullscreenButton: false,
        geocoder: false,
        infoBox: true,
        selectionIndicator: true,
        baseLayer: false, // 기본 레이어 비활성화
      })

      // OSM 레이어 추가
      viewer.imageryLayers.addImageryProvider(osmProvider)

      viewerRef.current = viewer
      setIsLoading(false)

      // 초기 카메라 위치 설정 (대한민국 중심)
      viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(127.5, 36.5, 2000000),
        duration: 2,
      })

      // 어노테이션 추가
      const geoAnnotations = annotations.map((annotation, index) => ({
        ...annotation,
        longitude: annotation.longitude ?? 126.5 + index * 0.5,
        latitude: annotation.latitude ?? 35.5 + index * 0.3,
      }))

      geoAnnotations.forEach((annotation) => {
        viewer!.entities.add({
          id: `annotation-${annotation.id}`,
          name: annotation.title,
          description: `<p><strong>우선순위:</strong> ${annotation.priority}</p><p><strong>ID:</strong> ${annotation.id}</p>`,
          position: Cartesian3.fromDegrees(annotation.longitude, annotation.latitude, 100),
          point: {
            pixelSize: 12,
            color: priorityColors[annotation.priority],
            outlineColor: Color.WHITE,
            outlineWidth: 2,
          },
          label: {
            text: annotation.title,
            font: '14px sans-serif',
            fillColor: Color.WHITE,
            outlineColor: Color.BLACK,
            outlineWidth: 2,
            style: LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: VerticalOrigin.BOTTOM,
            horizontalOrigin: HorizontalOrigin.CENTER,
            pixelOffset: new Cartesian2(0, -15),
            showBackground: true,
            backgroundColor: Color.fromCssColorString('rgba(0, 0, 0, 0.7)'),
            backgroundPadding: new Cartesian2(7, 5),
          },
          properties: {
            annotationData: annotation,
          },
        })
      })

      // 클릭 이벤트 핸들러
      if (onAnnotationClick) {
        const handler = new ScreenSpaceEventHandler(viewer.scene.canvas)
        handler.setInputAction((click: { position: Cartesian2 }) => {
          const pickedObject = viewer!.scene.pick(click.position)
          if (defined(pickedObject) && pickedObject.id?.properties?.annotationData) {
            const annotationData = pickedObject.id.properties.annotationData.getValue()
            onAnnotationClick(annotationData)
          }
        }, ScreenSpaceEventType.LEFT_CLICK)
      }
    } catch (err) {
      console.error('Cesium 초기화 오류:', err)
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.')
      setIsLoading(false)
    }

    // Cleanup
    return () => {
      if (viewer && !viewer.isDestroyed()) {
        viewer.destroy()
      }
      viewerRef.current = null
    }
  }, [annotations, onAnnotationClick])

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-900">
        <div className="flex flex-col items-center gap-3 text-center p-6">
          <AlertTriangle className="w-12 h-12 text-yellow-500" />
          <h3 className="text-white font-semibold">지도를 불러올 수 없습니다</h3>
          <p className="text-slate-400 text-sm max-w-md">
            CesiumJS 초기화 중 오류가 발생했습니다.
            <br />
            WebGL이 지원되는 브라우저인지 확인해주세요.
          </p>
          <p className="text-slate-500 text-xs mt-2">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full relative">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900 z-10">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            <span className="text-slate-400 text-sm">지도를 불러오는 중...</span>
          </div>
        </div>
      )}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  )
}
