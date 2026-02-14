import { useNavigate } from 'react-router-dom'
import { Search, MessageSquare, LogOut } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { signOut } from '@/services/api'

export default function Header() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const handleLogout = async () => {
    try {
      await signOut()
      navigate('/login', { replace: true })
    } catch {
      // 로그아웃 실패 시에도 로그인 페이지로 이동
      navigate('/login', { replace: true })
    }
  }

  // 사용자 이니셜 (이메일 첫 두 글자)
  const initials = user?.email
    ? user.email.substring(0, 2).toUpperCase()
    : 'SL'

  const displayName = user?.email || '사용자'

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
            {initials}
          </div>
          <span className="text-sm font-medium text-slate-300 max-w-[160px] truncate">
            {displayName}
          </span>
          {user && (
            <button
              onClick={handleLogout}
              title="로그아웃"
              className="p-1.5 text-slate-400 hover:text-red-400 transition-colors rounded-md hover:bg-slate-800"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
