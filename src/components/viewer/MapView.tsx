import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import CesiumView from './CesiumView'

interface Annotation {
  id: number
  title: string
  x: string
  y: string
  priority: 'High' | 'Medium' | 'Low'
  longitude?: number
  latitude?: number
}

interface MapViewProps {
  annotations?: Annotation[]
  onAnnotationClick?: (annotation: Annotation) => void
}

function LoadingFallback() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-slate-900">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
        <span className="text-slate-400 text-sm">지도를 불러오는 중...</span>
      </div>
    </div>
  )
}

export default function MapView({ annotations = [], onAnnotationClick }: MapViewProps) {
  return (
    <div className="w-full h-full relative">
      <Suspense fallback={<LoadingFallback />}>
        <CesiumView annotations={annotations} onAnnotationClick={onAnnotationClick} />
      </Suspense>

      {/* Map overlay info */}
      <div className="absolute top-4 right-4 bg-slate-900/90 backdrop-blur border border-slate-700 px-3 py-1.5 rounded-lg text-xs text-white shadow-lg z-10">
        <span className="font-bold text-green-400">지도 뷰</span> : CesiumJS 3D 지구본
      </div>
    </div>
  )
}
