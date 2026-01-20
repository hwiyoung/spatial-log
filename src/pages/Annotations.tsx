import {
  Filter,
  List,
  Database,
  AlertCircle,
  Clock,
  CheckCircle2,
  MapPin,
} from 'lucide-react'
import { MOCK_ANNOTATIONS } from '@/data/mockData'

export default function Annotations() {
  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">어노테이션 관리</h1>
        <div className="flex space-x-3">
          <button className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-700">
            <Filter size={18} />
            <span>상태 필터</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex gap-6 min-h-0">
        {/* Left: Annotation List */}
        <div className="w-1/2 bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-800 bg-slate-900 flex justify-between items-center">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <List size={16} /> 이슈 목록 ({MOCK_ANNOTATIONS.length})
            </h3>
          </div>

          <div className="overflow-y-auto custom-scrollbar flex-1">
            {MOCK_ANNOTATIONS.map((note) => (
              <div
                key={note.id}
                className="p-4 border-b border-slate-800 hover:bg-slate-800/50 transition-colors cursor-pointer group"
              >
                <div className="flex justify-between items-start mb-2">
                  <h4 className="text-sm font-medium text-white group-hover:text-blue-400 transition-colors">
                    {note.title}
                  </h4>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                      note.priority === 'High'
                        ? 'bg-red-500/20 text-red-400'
                        : note.priority === 'Medium'
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-green-500/20 text-green-400'
                    }`}
                  >
                    {note.priority}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Database size={12} /> {note.asset}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      {note.status === 'Open' ? (
                        <AlertCircle size={12} className="text-red-400" />
                      ) : note.status === 'In Progress' ? (
                        <Clock size={12} className="text-yellow-400" />
                      ) : (
                        <CheckCircle2 size={12} className="text-green-400" />
                      )}
                      {note.status}
                    </span>
                    <span>{note.date}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Annotation Distribution Map */}
        <div className="flex-1 bg-slate-950 rounded-xl border border-slate-800 relative overflow-hidden flex flex-col">
          <div className="absolute top-4 left-4 z-10 bg-slate-900/90 backdrop-blur border border-slate-700 px-3 py-1.5 rounded-lg text-xs text-white shadow-lg">
            <span className="font-bold text-blue-400">분포 현황</span> : 전체 프로젝트 통합 뷰
          </div>
          <div className="flex-1 relative">
            {/* Simulated Map Background */}
            <div className="absolute inset-0 bg-slate-900">
              <div
                className="absolute inset-0 opacity-40 bg-cover bg-center grayscale contrast-125 brightness-50"
                style={{
                  backgroundImage:
                    "url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop')",
                }}
              ></div>
              <div className="absolute inset-0 bg-blue-900/10 mix-blend-overlay"></div>
              <div
                className="absolute inset-0 opacity-20"
                style={{
                  backgroundImage:
                    'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
                  backgroundSize: '50px 50px',
                }}
              ></div>
            </div>

            {/* Annotation Pins */}
            {MOCK_ANNOTATIONS.map((note) => (
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
                <div className="w-2 h-1 bg-black/50 blur-[2px] rounded-full absolute top-0 left-1/2 -translate-x-1/2"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
