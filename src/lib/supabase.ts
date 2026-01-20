// Supabase 클라이언트 설정

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase 환경 변수가 설정되지 않았습니다. 로컬 스토리지 모드로 동작합니다.'
  )
}

// 내부 클라이언트 인스턴스
const _supabaseClient: SupabaseClient<Database> | null = supabaseUrl && supabaseAnonKey
  ? createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null

// Supabase 연결 상태 확인
export function isSupabaseConfigured(): boolean {
  return _supabaseClient !== null
}

// 타입 안전한 Supabase 클라이언트 반환 (null이면 예외)
export function getSupabaseClient(): SupabaseClient<Database> {
  if (!_supabaseClient) {
    throw new Error('Supabase가 설정되지 않았습니다.')
  }
  return _supabaseClient
}

// 옵셔널 Supabase 클라이언트 (null 허용)
export const supabase = _supabaseClient

// 스토리지 버킷 이름
export const STORAGE_BUCKET = 'spatial-files'

// 파일 URL 생성
export function getPublicFileUrl(path: string): string | null {
  if (!supabase) return null
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

// 파일 다운로드 URL 생성 (서명된 URL)
export async function getSignedFileUrl(
  path: string,
  expiresIn = 3600
): Promise<string | null> {
  if (!supabase) return null
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(path, expiresIn)
  if (error) {
    console.error('서명된 URL 생성 실패:', error)
    return null
  }
  return data.signedUrl
}
