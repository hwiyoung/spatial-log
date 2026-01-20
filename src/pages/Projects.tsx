import { Plus, Filter } from 'lucide-react'
import ProjectCard from '@/components/dashboard/ProjectCard'
import { MOCK_PROJECTS } from '@/data/mockData'

export default function Projects() {
  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">내 프로젝트</h1>
        <div className="flex space-x-3">
          <button className="flex items-center space-x-2 px-3 py-2 bg-slate-800 text-slate-300 rounded-lg border border-slate-700 hover:text-white">
            <Filter size={18} />
            <span>필터</span>
          </button>
          <button className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-lg shadow-blue-900/30">
            <Plus size={18} />
            <span>새 프로젝트</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-6 overflow-y-auto custom-scrollbar pb-6">
        {MOCK_PROJECTS.map((p) => (
          <ProjectCard key={p.id} project={p} />
        ))}
        <div className="border-2 border-dashed border-slate-800 rounded-xl flex flex-col items-center justify-center text-slate-600 hover:border-slate-700 hover:text-slate-500 cursor-pointer transition-colors min-h-[200px]">
          <Plus size={48} className="mb-2 opacity-50" />
          <span className="font-medium">새 프로젝트 생성</span>
        </div>
      </div>
    </div>
  )
}
