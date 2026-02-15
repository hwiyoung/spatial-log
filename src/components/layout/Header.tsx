import { useNavigate } from 'react-router-dom'
import { Search, LogOut, FileText, BookOpen, Globe } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { signOut } from '@/services/api'
import { useGlobalSearch } from '@/hooks/useGlobalSearch'

export default function Header() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { query, setQuery, results, isOpen, searchRef, close } = useGlobalSearch()

  const handleLogout = async () => {
    try {
      await signOut()
      navigate('/login', { replace: true })
    } catch {
      navigate('/login', { replace: true })
    }
  }

  const initials = user?.email
    ? user.email.substring(0, 2).toUpperCase()
    : 'SL'

  const displayName = user?.email || '사용자'

  const handleSelect = (path: string) => {
    close()
    navigate(path)
  }

  return (
    <header className="h-16 bg-slate-900 border-b border-slate-700 flex items-center justify-between px-6 sticky top-0 z-20 flex-shrink-0">
      <div ref={searchRef} className="relative">
        <div className="flex items-center bg-slate-800 rounded-md px-3 py-2 w-96">
          <Search size={18} className="text-slate-400 mr-2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') close() }}
            placeholder="Assets, Story, Publish 검색..."
            className="bg-transparent border-none outline-none text-sm text-white w-full placeholder-slate-500"
          />
        </div>

        {isOpen && (
          <div className="absolute top-full left-0 mt-1 w-96 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 max-h-[400px] overflow-y-auto">
            {results.files.length > 0 && (
              <div>
                <div className="px-3 py-2 text-xs font-medium text-blue-400 uppercase border-b border-slate-700">Assets</div>
                {results.files.map(f => (
                  <button
                    key={f.id}
                    onClick={() => handleSelect('/assets')}
                    className="w-full px-3 py-2 flex items-center gap-2 hover:bg-slate-700 text-left"
                  >
                    <FileText size={14} className="text-blue-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm text-white truncate">{f.name}</div>
                      {f.description && <div className="text-xs text-slate-400 truncate">{f.description}</div>}
                    </div>
                    <span className="ml-auto text-[10px] text-slate-500 uppercase flex-shrink-0">{f.format}</span>
                  </button>
                ))}
              </div>
            )}
            {results.stories.length > 0 && (
              <div>
                <div className="px-3 py-2 text-xs font-medium text-purple-400 uppercase border-b border-slate-700">Story</div>
                {results.stories.map(s => (
                  <button
                    key={s.id}
                    onClick={() => handleSelect(`/story/${s.id}`)}
                    className="w-full px-3 py-2 flex items-center gap-2 hover:bg-slate-700 text-left"
                  >
                    <BookOpen size={14} className="text-purple-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm text-white truncate">{s.title}</div>
                      {s.description && <div className="text-xs text-slate-400 truncate">{s.description}</div>}
                    </div>
                    <span className="ml-auto text-[10px] text-slate-500 flex-shrink-0">{s.status}</span>
                  </button>
                ))}
              </div>
            )}
            {results.releases.length > 0 && (
              <div>
                <div className="px-3 py-2 text-xs font-medium text-emerald-400 uppercase border-b border-slate-700">Publish</div>
                {results.releases.map(r => (
                  <button
                    key={r.id}
                    onClick={() => handleSelect(`/publish/${r.id}`)}
                    className="w-full px-3 py-2 flex items-center gap-2 hover:bg-slate-700 text-left"
                  >
                    <Globe size={14} className="text-emerald-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm text-white truncate">{r.label || `v${r.version}`}</div>
                      <div className="text-xs text-slate-400 truncate">{r.snapshot?.story?.title}</div>
                    </div>
                    <span className="ml-auto text-[10px] text-slate-500 flex-shrink-0">v{r.version}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center space-x-4">
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
