import {
  Grid,
  List,
  FolderPlus,
  UploadCloud,
  Folder,
  Share2,
  Layers,
  HardDrive,
  MoreVertical,
  ArrowRight,
  Box,
} from 'lucide-react'
import { MOCK_ASSETS } from '@/data/mockData'

const folders = ['서울시', '건물B', '현장사진', '라이브러리', '휴지통']

export default function Assets() {
  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">데이터 보관함</h1>
        <div className="flex space-x-3">
          <div className="bg-slate-800 rounded-lg p-1 flex border border-slate-700">
            <button className="p-1.5 bg-slate-700 rounded text-white">
              <Grid size={16} />
            </button>
            <button className="p-1.5 text-slate-400 hover:text-white">
              <List size={16} />
            </button>
          </div>
          <button className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-700">
            <FolderPlus size={18} />
            <span>새 폴더</span>
          </button>
          <button className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-700">
            <UploadCloud size={18} />
            <span>파일 업로드</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex gap-6 min-h-0 bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
        {/* Folder Tree */}
        <div className="w-60 bg-slate-900 border-r border-slate-800 p-4">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">폴더</h3>
          <ul className="space-y-1">
            <li className="flex items-center space-x-2 px-3 py-2 bg-blue-600/10 text-blue-400 rounded-lg cursor-pointer">
              <Folder size={16} className="fill-blue-400/20" /> <span>전체 파일</span>
            </li>
            {folders.map((folder) => (
              <li
                key={folder}
                className="flex items-center space-x-2 px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
              >
                <Folder size={16} /> <span>{folder}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* File Grid */}
        <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-5 gap-4">
            {MOCK_ASSETS.map((asset) => (
              <div
                key={asset.id}
                className="group bg-slate-800 rounded-lg p-3 border border-slate-700 hover:border-blue-500 cursor-pointer transition-all hover:shadow-lg"
              >
                <div
                  className={`aspect-square rounded-md mb-3 ${asset.thumbnail} flex items-center justify-center relative`}
                >
                  {asset.type === 'Drone' && <Share2 size={24} className="text-white/50" />}
                  {asset.type === 'LIDAR' && <Layers size={24} className="text-white/50" />}
                  {asset.type === 'Mobile' && <HardDrive size={24} className="text-white/50" />}
                  {!['Drone', 'LIDAR', 'Mobile'].includes(asset.type) && (
                    <Box size={24} className="text-white/50" />
                  )}

                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1">
                    <button className="bg-slate-900/80 p-1.5 rounded hover:bg-blue-600 text-white">
                      <ArrowRight size={12} />
                    </button>
                    <button className="bg-slate-900/80 p-1.5 rounded hover:bg-blue-600 text-white">
                      <MoreVertical size={12} />
                    </button>
                  </div>
                </div>
                <div className="px-1">
                  <h4 className="text-sm font-medium text-white truncate mb-1">{asset.name}</h4>
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>{asset.size}</span>
                    <span>{asset.date}</span>
                  </div>
                </div>
              </div>
            ))}
            {/* Upload Zone */}
            <div className="border-2 border-dashed border-slate-700 rounded-lg flex flex-col items-center justify-center text-slate-500 hover:border-blue-500 hover:text-blue-400 hover:bg-blue-500/5 cursor-pointer transition-all aspect-square">
              <UploadCloud size={32} className="mb-2" />
              <span className="text-xs">파일 추가</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
