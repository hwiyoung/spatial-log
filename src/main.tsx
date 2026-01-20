import { createRoot } from 'react-dom/client'
import { Ion } from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import './index.css'
import App from './App'

// Cesium Ion 기본 액세스 토큰 설정
Ion.defaultAccessToken =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJlYWE1OWUxNy1mMWZiLTQzYjYtYTQ0OS1kMWFjYmFkNjc5YzciLCJpZCI6NTc1MzQsImlhdCI6MTYyMjY0NDQ0M30.XcKpgANiY19MC4bdFUXMVEBToBmqS8kuYpUlxJHYZxk'

// Note: StrictMode 제거됨 - Resium과 React 18 StrictMode 호환성 문제
createRoot(document.getElementById('root')!).render(<App />)
