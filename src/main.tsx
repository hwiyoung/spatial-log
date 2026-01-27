import { createRoot } from 'react-dom/client'
import { Ion } from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import './index.css'
import App from './App'

// Cesium Ion 액세스 토큰 설정 (환경변수에서 로드)
const cesiumToken = import.meta.env.VITE_CESIUM_ION_TOKEN
if (cesiumToken) {
  Ion.defaultAccessToken = cesiumToken
} else {
  console.warn(
    'Cesium Ion 토큰이 설정되지 않았습니다. 3D Tiles 기능이 제한될 수 있습니다.',
    '\n환경변수 VITE_CESIUM_ION_TOKEN을 설정하세요.'
  )
}

// Note: StrictMode 제거됨 - Resium과 React 18 StrictMode 호환성 문제
createRoot(document.getElementById('root')!).render(<App />)
