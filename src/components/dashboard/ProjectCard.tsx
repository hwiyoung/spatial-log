import { Map, MoreVertical } from 'lucide-react'
import type { Project } from '@/data/mockData'

interface ProjectCardProps {
  project: Project
  onClick?: () => void
}

export default function ProjectCard({ project, onClick }: ProjectCardProps) {
  return (
    <div
      onClick={onClick}
      className="bg-slate-800 p-5 rounded-xl border border-slate-700 hover:border-blue-500/50 hover:bg-slate-750 transition-all cursor-pointer group flex flex-col h-full"
    >
      <div className="flex justify-between items-start mb-3">
        <div
          className={`p-2 rounded-lg ${project.status === 'completed' ? 'bg-green-500/10 text-green-400' : 'bg-blue-500/10 text-blue-400'} group-hover:bg-blue-500 group-hover:text-white transition-colors`}
        >
          <Map size={24} />
        </div>
        <button className="text-slate-500 hover:text-white">
          <MoreVertical size={16} />
        </button>
      </div>
      <h3 className="font-bold text-white mb-1">{project.name}</h3>
      <p className="text-xs text-slate-400 mb-4">최종 수정: {project.lastEdited}</p>

      <div className="flex flex-wrap gap-1 mb-4">
        {project.tags.map((tag) => (
          <span
            key={tag}
            className="text-[10px] px-2 py-0.5 bg-slate-700 rounded-full text-slate-300"
          >
            #{tag}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-700/50">
        <div className="flex -space-x-2">
          {[...Array(Math.min(project.members, 3))].map((_, i) => (
            <div
              key={i}
              className="w-6 h-6 rounded-full border-2 border-slate-800 bg-slate-600"
              style={{ backgroundColor: `hsl(${200 + i * 30}, 50%, ${40 - i * 5}%)` }}
            ></div>
          ))}
          {project.members > 3 && (
            <div className="w-6 h-6 rounded-full bg-slate-400 border-2 border-slate-800 flex items-center justify-center text-[8px] text-slate-900 font-bold">
              +{project.members - 3}
            </div>
          )}
        </div>
        <div className="text-xs font-medium text-slate-400 bg-slate-900 px-2 py-1 rounded">
          {project.assets} Assets
        </div>
      </div>
    </div>
  )
}
