/**
 * SAMS Frontend — 4페이지 SPA
 *
 * 페이지 구조 및 UI 설계는 docs/sams_unified_demo.jsx 참조.
 * 화면 구조 상세는 docs/system_structure_design.md 섹션 3 참조.
 *
 * 페이지:
 *   /          → Explorer (검색 + 2D 지도 + 결과 목록 + 미리보기 패널)
 *   /detail/:id → Detail (전체 페이지: 메타데이터/파일/연관관계/시계열/편집)
 *   /project    → Project (Collection 목록 + 4탭 대시보드)
 *   /upload     → Upload (벌크 + 단건 탭)
 */

import { BrowserRouter, Routes, Route, NavLink, useLocation, useNavigate } from 'react-router-dom'
import Explorer from './pages/Explorer'
import Detail from './pages/Detail'
import Project from './pages/Project'
import Upload from './pages/Upload'
import { UploadTasksProvider } from './contexts/UploadTasksContext'
import UploadStatusBar from './components/UploadStatusBar'

function NavBar() {
  const location = useLocation()
  const navigate = useNavigate()

  const handleLogoClick = () => {
    if (location.pathname === '/') window.location.reload()
    else navigate('/')
  }

  return (
    <nav style={{
      height: 64, background: '#13161F', borderBottom: '1px solid #2C3044',
      display: 'flex', alignItems: 'center', padding: '0 28px', gap: 10
    }}>
      <span
        onClick={handleLogoClick}
        style={{ fontSize: 18, fontWeight: 700, color: '#E4E7F0', cursor: 'pointer', marginRight: 32, userSelect: 'none' }}
      >
        SAMS <span style={{ color: '#4A72FF', fontWeight: 400 }}>v0.1</span>
      </span>
          {[
            { to: '/', label: 'Explorer' },
            { to: '/project', label: 'Project' },
            { to: '/upload', label: 'Upload' },
          ].map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              style={({ isActive }) => ({
                padding: '10px 22px', borderRadius: 6, fontSize: 15, fontWeight: 500,
                textDecoration: 'none',
                color: isActive ? '#4A72FF' : '#5C6478',
                background: isActive ? 'rgba(74,114,255,0.1)' : 'transparent',
              })}
            >
              {link.label}
            </NavLink>
          ))}
      <div style={{ marginLeft: 'auto' }}>
        <UploadStatusBar />
      </div>
    </nav>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <UploadTasksProvider>
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
          <NavBar />
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <Routes>
              <Route path="/" element={<Explorer />} />
              <Route path="/detail/:collectionId/:itemId" element={<Detail />} />
              <Route path="/project" element={<Project />} />
              <Route path="/upload" element={<Upload />} />
            </Routes>
          </div>
        </div>
      </UploadTasksProvider>
    </BrowserRouter>
  )
}
