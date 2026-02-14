import { createRoot } from 'react-dom/client'
import { Ion } from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import './index.css'
import App from './App'

// Sentry 에러 모니터링 초기화 (패키지 설치 시에만 동작)
const sentryDsn = import.meta.env.VITE_SENTRY_DSN
if (sentryDsn) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sentryModule = '@sentry/react'
  import(/* @vite-ignore */ sentryModule).then((Sentry) => {
    Sentry.init({
      dsn: sentryDsn,
      environment: import.meta.env.MODE,
      tracesSampleRate: import.meta.env.PROD ? 1.0 : 0,
      ignoreErrors: [
        'ResizeObserver loop',
        'Non-Error promise rejection',
      ],
    })
  }).catch(() => {
    console.warn('Sentry SDK가 설치되지 않았습니다. npm install @sentry/react 으로 설치하세요.')
  })
}

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
