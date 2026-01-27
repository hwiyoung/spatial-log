/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_CESIUM_ION_TOKEN?: string
  readonly VITE_DEV_MODE?: string
  readonly VITE_CONVERTER_URL?: string  // 3D 데이터 변환 서비스 URL
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
