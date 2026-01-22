import { BrowserRouter, Routes, Route } from 'react-router-dom'
import MainLayout from '@/components/layout/MainLayout'
import Dashboard from '@/pages/Dashboard'
import Projects from '@/pages/Projects'
import ProjectDetail from '@/pages/ProjectDetail'
import Assets from '@/pages/Assets'
import Annotations from '@/pages/Annotations'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/:projectId" element={<ProjectDetail />} />
          <Route path="assets" element={<Assets />} />
          <Route path="annotations" element={<Annotations />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
