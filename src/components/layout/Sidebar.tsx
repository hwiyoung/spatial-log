import { NavLink, Link } from 'react-router-dom'
import { Box, Database, BookOpen, Globe, Layers, Settings } from 'lucide-react'
import { useAssetStore } from '@/stores/assetStore'
import { formatFileSize } from '@/utils/storage'

const menuItems = [
  { path: '/', icon: Box, label: '대시보드' },
  { path: '/assets', icon: Database, label: 'Assets' },
  { path: '/story', icon: BookOpen, label: 'Story' },
  { path: '/publish', icon: Globe, label: 'Publish' },
]

const STORAGE_LIMIT = 5 * 1024 * 1024 * 1024 // 5GB

export default function Sidebar() {
  const { storageUsed } = useAssetStore()
  const usagePercent = Math.min(Math.round((storageUsed / STORAGE_LIMIT) * 100), 100)

  return (
    <div className="w-64 h-full bg-slate-900 border-r border-slate-700 flex flex-col text-slate-300 flex-shrink-0">
      <Link to="/" className="h-16 px-6 flex items-center space-x-2 border-b border-slate-700 hover:bg-slate-800/50 transition-colors flex-shrink-0">
        <Layers className="text-blue-500" size={28} />
        <span className="text-xl font-bold text-white tracking-tight">Spatial Log</span>
      </Link>

      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
                  : 'hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <item.icon size={20} />
            <span className="font-medium">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-700">
        <div className="bg-slate-800 rounded-lg p-4 mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-semibold text-slate-400">저장 공간</span>
            <span className={`text-xs ${usagePercent >= 90 ? 'text-red-400' : 'text-blue-400'}`}>{usagePercent}%</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all ${usagePercent >= 90 ? 'bg-red-500' : 'bg-blue-500'}`}
              style={{ width: `${usagePercent}%` }}
            ></div>
          </div>
          <div className="mt-2 text-xs text-slate-400">{formatFileSize(storageUsed)} / 5 GB 사용 중</div>
        </div>
        <button className="w-full flex items-center space-x-3 px-4 py-2 text-slate-400 hover:text-white transition-colors">
          <Settings size={20} />
          <span>설정</span>
        </button>
      </div>
    </div>
  )
}
