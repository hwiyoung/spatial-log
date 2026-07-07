import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const apiProxyTarget = process.env.VITE_DEV_API_PROXY_TARGET || 'http://localhost:8000'
const stacProxyTarget = process.env.VITE_DEV_STAC_PROXY_TARGET || 'http://localhost:8080'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/api': apiProxyTarget,
      '/stac': {
        target: stacProxyTarget,
        rewrite: (path) => path.replace(/^\/stac/, ''),
      },
    },
    allowedHosts: ['localhost', '127.0.0.1', '192.168.10.203', 'sam.innopam.kr'],
  },
})
