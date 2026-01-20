import { UploadCloud, Plus, ChevronRight, Database, Eye, Box } from 'lucide-react'
import ProjectCard from '@/components/dashboard/ProjectCard'
import Viewer3D from '@/components/viewer/Viewer3D'
import { MOCK_PROJECTS, MOCK_ASSETS } from '@/data/mockData'

export default function Dashboard() {
  return (
    <>
      <div className="flex justify-between items-end mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">대시보드</h1>
          <p className="text-slate-400 text-sm">최근 업로드된 공간 데이터를 확인하고 분석하세요.</p>
        </div>
        <div className="flex space-x-3">
          <button className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-700 transition-all">
            <UploadCloud size={18} />
            <span>데이터 업로드</span>
          </button>
          <button className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium shadow-lg shadow-blue-900/50 transition-all">
            <Plus size={18} />
            <span>프로젝트 생성</span>
          </button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-12 gap-6 min-h-0">
        {/* Left Column */}
        <div className="col-span-5 flex flex-col gap-6 min-h-0">
          <div className="flex-shrink-0">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">
                최근 프로젝트
              </h2>
              <button className="text-xs text-blue-400 hover:text-blue-300 flex items-center">
                전체보기 <ChevronRight size={12} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {MOCK_PROJECTS.slice(0, 2).map((p) => (
                <ProjectCard key={p.id} project={p} />
              ))}
            </div>
          </div>

          <div className="flex-1 flex flex-col min-h-0 bg-slate-900/50 rounded-xl border border-slate-800">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center">
              <h2 className="font-semibold text-white flex items-center gap-2">
                <Database size={16} className="text-blue-500" /> 최근 데이터
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {MOCK_ASSETS.map((asset) => (
                <div
                  key={asset.id}
                  className="flex items-center space-x-3 p-2 hover:bg-slate-800 rounded-lg group transition-colors cursor-pointer"
                >
                  <div className="relative">
                    <div
                      className={`w-12 h-12 rounded-lg ${asset.thumbnail} flex items-center justify-center`}
                    >
                      <Box size={20} className="text-white/70" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium truncate text-slate-200">{asset.name}</h4>
                    <div className="flex items-center text-xs text-slate-500 space-x-2 mt-0.5">
                      <span className="bg-slate-800 px-1.5 rounded text-slate-400">{asset.type}</span>
                      <span>{asset.size}</span>
                      <span>{asset.date}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="col-span-7 flex flex-col min-h-0 gap-4">
          <div className="flex justify-between items-center px-1">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Eye size={16} /> 미리보기
            </h2>
          </div>
          <Viewer3D />
        </div>
      </div>
    </>
  )
}
