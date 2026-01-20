import { Search, MessageSquare } from 'lucide-react'

export default function Header() {
  return (
    <header className="h-16 bg-slate-900 border-b border-slate-700 flex items-center justify-between px-6 sticky top-0 z-20 flex-shrink-0">
      <div className="flex items-center bg-slate-800 rounded-md px-3 py-2 w-96">
        <Search size={18} className="text-slate-400 mr-2" />
        <input
          type="text"
          placeholder="프로젝트, 에셋, 어노테이션 검색..."
          className="bg-transparent border-none outline-none text-sm text-white w-full placeholder-slate-500"
        />
      </div>
      <div className="flex items-center space-x-4">
        <button className="p-2 text-slate-400 hover:text-white relative">
          <MessageSquare size={20} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>
        <div className="flex items-center space-x-3 pl-4 border-l border-slate-700">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center font-bold text-white text-xs">
            SL
          </div>
          <span className="text-sm font-medium text-slate-300">사용자</span>
        </div>
      </div>
    </header>
  )
}
