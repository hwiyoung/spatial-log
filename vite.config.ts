import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import cesium from 'vite-plugin-cesium'
import path from 'path'

export default defineConfig({
  plugins: [react(), cesium()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5174,
    watch: {
      usePolling: true,
    },
  },
  build: {
    // 코드 스플리팅 설정
    rollupOptions: {
      output: {
        manualChunks: {
          // React 관련 청크
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // Three.js 관련 청크 (3D 렌더링)
          'three-vendor': ['three', '@react-three/fiber', '@react-three/drei'],
          // Cesium은 vite-plugin-cesium에 의해 외부 모듈로 처리됨 (manualChunks에서 제외)
          // resium만 별도 청크로 분리
          'cesium-vendor': ['resium'],
          // 지도 관련 청크 (2D 맵)
          'map-vendor': ['leaflet', 'react-leaflet'],
          // 상태 관리 및 유틸리티
          'utils-vendor': ['zustand', '@supabase/supabase-js'],
        },
      },
    },
    // 청크 크기 경고 임계값 (KB)
    chunkSizeWarningLimit: 1000,
  },
})
