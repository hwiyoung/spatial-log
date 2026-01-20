import { MapPin } from 'lucide-react'

interface MapViewProps {
  annotations?: Array<{
    id: number
    title: string
    x: string
    y: string
    priority: 'High' | 'Medium' | 'Low'
  }>
}

export default function MapView({ annotations = [] }: MapViewProps) {
  return (
    <div className="w-full h-full relative">
      {/* Map Background */}
      <div className="absolute inset-0 bg-slate-900">
        <div
          className="absolute inset-0 opacity-40 bg-cover bg-center grayscale contrast-125 brightness-50"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop')",
          }}
        />
        <div className="absolute inset-0 bg-blue-900/10 mix-blend-overlay" />
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '100px 100px',
          }}
        />
      </div>

      {/* Annotation Pins */}
      {annotations.map((note) => (
        <div
          key={note.id}
          className="absolute group cursor-pointer"
          style={{ left: note.x, top: note.y }}
        >
          <div
            className={`relative -translate-x-1/2 -translate-y-full ${
              note.priority === 'High'
                ? 'text-red-500'
                : note.priority === 'Medium'
                  ? 'text-yellow-500'
                  : 'text-green-500'
            }`}
          >
            <MapPin
              size={24}
              className="fill-current drop-shadow-lg animate-bounce"
              style={{ animationDuration: '2s' }}
            />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap border border-slate-700 z-20 pointer-events-none">
              {note.title}
            </div>
          </div>
        </div>
      ))}

      {/* Map Controls Placeholder */}
      <div className="absolute bottom-4 right-4 bg-slate-800/90 backdrop-blur border border-slate-700 rounded-lg p-2 flex flex-col gap-1">
        <button className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 rounded text-lg font-bold">
          +
        </button>
        <div className="w-full h-px bg-slate-700" />
        <button className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 rounded text-lg font-bold">
          −
        </button>
      </div>

      {/* Info overlay */}
      <div className="absolute top-4 right-4 bg-slate-900/90 backdrop-blur border border-slate-700 px-3 py-1.5 rounded-lg text-xs text-white shadow-lg">
        <span className="font-bold text-green-400">지도 뷰</span> : 위성 이미지 모드
      </div>
    </div>
  )
}
