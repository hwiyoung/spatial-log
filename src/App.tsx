import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { migrateLocalStorageEntryTypes } from '@/services/api'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'

// localStorage에 저장된 기존 asset/memo 타입을 4종(spatial/visual/document/note)으로 마이그레이션
migrateLocalStorageEntryTypes()
import MainLayout from '@/components/layout/MainLayout'
import Dashboard from '@/pages/Dashboard'
import Assets from '@/pages/Assets'
import StoryList from '@/pages/StoryList'
import StoryWorkspacePage from '@/pages/StoryWorkspacePage'
import PublishList from '@/pages/PublishList'
import PublishDetail from '@/pages/PublishDetail'
import SharedRelease from '@/pages/SharedRelease'
import Login from '@/pages/Login'
import { Loader2 } from 'lucide-react'
import ErrorBoundary from '@/components/common/ErrorBoundary'

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { loading, isAuthenticated } = useAuth()

  if (loading) {
    return (
      <div className="h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-blue-500" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function LoginGuard({ children }: { children: React.ReactNode }) {
  const { loading, isAuthenticated } = useAuth()

  if (loading) {
    return (
      <div className="h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-blue-500" />
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

function App() {
  return (
    <ErrorBoundary>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* 공유 링크 (인증 불필요) */}
          <Route path="/shared/:token" element={<SharedRelease />} />
          <Route
            path="/login"
            element={
              <LoginGuard>
                <Login />
              </LoginGuard>
            }
          />
          {/* Story 워크스페이스 (전체화면, MainLayout 밖) */}
          <Route
            path="/story/:storyId"
            element={
              <AuthGuard>
                <StoryWorkspacePage />
              </AuthGuard>
            }
          />
          <Route
            path="/"
            element={
              <AuthGuard>
                <MainLayout />
              </AuthGuard>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="assets" element={<Assets />} />
            <Route path="story" element={<StoryList />} />
            <Route path="publish" element={<PublishList />} />
            <Route path="publish/:releaseId" element={<PublishDetail />} />
            {/* 기존 경로 호환성 리다이렉트 */}
            <Route path="projects" element={<Navigate to="/publish" replace />} />
            <Route path="projects/:projectId" element={<Navigate to="/publish" replace />} />
            <Route path="annotations" element={<Navigate to="/story" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App
