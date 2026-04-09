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

import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import Explorer from './pages/Explorer'
import Detail from './pages/Detail'
import Project from './pages/Project'
import Upload from './pages/Upload'

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* Navigation */}
        <nav style={{
          height: 48, background: '#13161F', borderBottom: '1px solid #2C3044',
          display: 'flex', alignItems: 'center', padding: '0 20px', gap: 6
        }}>
          <NavLink to="/" style={{ fontSize: 14, fontWeight: 700, color: '#E4E7F0', textDecoration: 'none', marginRight: 24 }}>
            SAMS <span style={{ color: '#4A72FF', fontWeight: 400 }}>v0.1</span>
          </NavLink>
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
                padding: '6px 16px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                textDecoration: 'none',
                color: isActive ? '#4A72FF' : '#5C6478',
                background: isActive ? 'rgba(74,114,255,0.1)' : 'transparent',
              })}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        {/* Routes */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <Routes>
            <Route path="/" element={<Explorer />} />
            <Route path="/detail/:collectionId/:itemId" element={<Detail />} />
            <Route path="/project" element={<Project />} />
            <Route path="/upload" element={<Upload />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  )
}
