// 파일 무결성 검증 서비스
// Storage와 DB 간 동기화 상태를 확인하고 고아 데이터를 탐지합니다.

import { getSupabaseClient, isSupabaseConfigured, STORAGE_BUCKET } from '@/lib/supabase'
import type { FileRow } from '@/lib/database.types'

// 무결성 검사 결과 타입
export interface IntegrityReport {
  orphanedDbRecords: OrphanedRecord[]   // DB에만 존재 (Storage 파일 없음)
  orphanedStorageFiles: string[]         // Storage에만 존재 (DB 레코드 없음)
  validFiles: ValidFile[]                // 정상 파일
  totalChecked: number
  dbRecordCount: number
  storageFileCount: number
  checkedAt: Date
  duration: number  // ms
}

export interface OrphanedRecord {
  id: string
  name: string
  storagePath: string
  createdAt: Date
}

export interface ValidFile {
  id: string
  name: string
  storagePath: string
  size: number
}

export interface IntegrityCheckOptions {
  includeValidFiles?: boolean  // 정상 파일 목록도 포함할지 여부
  limit?: number               // 검사할 최대 파일 수
}

// 무결성 로그 타입
export interface IntegrityLog {
  id: string
  checkType: 'full' | 'incremental' | 'single'
  status: 'success' | 'warning' | 'error'
  orphanedRecords: number
  orphanedFiles: number
  validFiles: number
  details: Record<string, unknown> | null
  createdAt: Date
}

/**
 * 무결성 검사 실행
 * Storage와 DB 간 동기화 상태를 확인합니다.
 */
export async function runIntegrityCheck(
  options: IntegrityCheckOptions = {}
): Promise<IntegrityReport> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase가 설정되지 않았습니다. 무결성 검사는 Supabase 환경에서만 사용 가능합니다.')
  }

  const startTime = Date.now()
  const supabase = getSupabaseClient()

  // 1. DB에서 모든 파일 레코드 조회
  let query = supabase
    .from('files')
    .select('id, name, storage_path, size, created_at')
    .order('created_at', { ascending: false })

  if (options.limit) {
    query = query.limit(options.limit)
  }

  const { data: dbFiles, error: dbError } = await query

  if (dbError) {
    throw new Error(`DB 조회 실패: ${dbError.message}`)
  }

  const dbRecords = (dbFiles || []) as Pick<FileRow, 'id' | 'name' | 'storage_path' | 'size' | 'created_at'>[]

  // 2. Storage에서 파일 목록 조회
  const storageFiles = await listAllStorageFiles()

  // 3. 비교 분석
  const orphanedDbRecords: OrphanedRecord[] = []
  const validFiles: ValidFile[] = []
  const storagePathSet = new Set(storageFiles)
  const dbPathSet = new Set<string>()

  for (const record of dbRecords) {
    if (!record.storage_path) continue

    dbPathSet.add(record.storage_path)

    if (storagePathSet.has(record.storage_path)) {
      // 정상 파일
      if (options.includeValidFiles) {
        validFiles.push({
          id: record.id,
          name: record.name,
          storagePath: record.storage_path,
          size: record.size,
        })
      }
    } else {
      // DB에만 존재 (고아 레코드)
      orphanedDbRecords.push({
        id: record.id,
        name: record.name,
        storagePath: record.storage_path,
        createdAt: new Date(record.created_at),
      })
    }
  }

  // Storage에만 존재하는 파일 (고아 파일)
  const orphanedStorageFiles = storageFiles.filter(path => !dbPathSet.has(path))

  const duration = Date.now() - startTime

  const report: IntegrityReport = {
    orphanedDbRecords,
    orphanedStorageFiles,
    validFiles,
    totalChecked: dbRecords.length,
    dbRecordCount: dbRecords.length,
    storageFileCount: storageFiles.length,
    checkedAt: new Date(),
    duration,
  }

  // 검사 로그 저장
  await saveIntegrityLog(report)

  return report
}

/**
 * Storage의 모든 파일 목록 조회
 */
async function listAllStorageFiles(): Promise<string[]> {
  const supabase = getSupabaseClient()
  const allFiles: string[] = []

  // 루트 폴더 목록 조회
  const { data: rootFolders, error: rootError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .list('', { limit: 1000 })

  if (rootError) {
    console.error('Storage 루트 조회 실패:', rootError)
    return []
  }

  // 각 폴더 탐색 (사용자 ID 폴더)
  for (const item of rootFolders || []) {
    if (item.id === null) {
      // 폴더인 경우 하위 탐색
      await traverseFolder(item.name, allFiles)
    } else {
      // 파일인 경우 추가
      allFiles.push(item.name)
    }
  }

  return allFiles
}

/**
 * 폴더 재귀 탐색
 */
async function traverseFolder(path: string, fileList: string[]): Promise<void> {
  const supabase = getSupabaseClient()

  const { data: items, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .list(path, { limit: 1000 })

  if (error) {
    console.error(`Storage 폴더 조회 실패 (${path}):`, error)
    return
  }

  for (const item of items || []) {
    const fullPath = `${path}/${item.name}`

    if (item.id === null) {
      // 폴더인 경우 재귀 탐색
      await traverseFolder(fullPath, fileList)
    } else {
      // 파일인 경우 추가
      fileList.push(fullPath)
    }
  }
}

/**
 * 고아 DB 레코드 복구 (삭제)
 * Storage에 파일이 없는 DB 레코드를 삭제합니다.
 */
export async function repairOrphanedDbRecords(recordIds: string[]): Promise<{
  success: string[]
  failed: { id: string; error: string }[]
}> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase가 설정되지 않았습니다.')
  }

  const supabase = getSupabaseClient()
  const success: string[] = []
  const failed: { id: string; error: string }[] = []

  for (const id of recordIds) {
    const { error } = await supabase
      .from('files')
      .delete()
      .eq('id', id)

    if (error) {
      failed.push({ id, error: error.message })
    } else {
      success.push(id)
    }
  }

  return { success, failed }
}

/**
 * 고아 Storage 파일 복구 (삭제)
 * DB에 레코드가 없는 Storage 파일을 삭제합니다.
 */
export async function repairOrphanedStorageFiles(filePaths: string[]): Promise<{
  success: string[]
  failed: { path: string; error: string }[]
}> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase가 설정되지 않았습니다.')
  }

  const supabase = getSupabaseClient()
  const success: string[] = []
  const failed: { path: string; error: string }[] = []

  // 배치 삭제 (최대 100개씩)
  const chunks = chunkArray(filePaths, 100)

  for (const chunk of chunks) {
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove(chunk)

    if (error) {
      // 개별 파일 삭제 시도
      for (const path of chunk) {
        const { error: singleError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .remove([path])

        if (singleError) {
          failed.push({ path, error: singleError.message })
        } else {
          success.push(path)
        }
      }
    } else {
      success.push(...chunk)
    }
  }

  return { success, failed }
}

/**
 * 단일 파일 무결성 확인
 */
export async function checkFileIntegrity(fileId: string): Promise<{
  exists: boolean
  dbRecord: boolean
  storageFile: boolean
  storagePath: string | null
}> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase가 설정되지 않았습니다.')
  }

  const supabase = getSupabaseClient()

  // DB 레코드 확인
  const { data, error } = await supabase
    .from('files')
    .select('id, storage_path')
    .eq('id', fileId)
    .single()

  if (error || !data) {
    return {
      exists: false,
      dbRecord: false,
      storageFile: false,
      storagePath: null,
    }
  }

  const fileData = data as Pick<FileRow, 'id' | 'storage_path'>

  // Storage 파일 확인
  const { data: storageData, error: storageError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .download(fileData.storage_path)

  const storageExists = !storageError && storageData !== null

  return {
    exists: storageExists,
    dbRecord: true,
    storageFile: storageExists,
    storagePath: fileData.storage_path,
  }
}

/**
 * 무결성 검사 로그 저장
 * 테이블이 없으면 조용히 스킵합니다.
 */
async function saveIntegrityLog(report: IntegrityReport): Promise<void> {
  try {
    const supabase = getSupabaseClient()

    const status = report.orphanedDbRecords.length > 0 || report.orphanedStorageFiles.length > 0
      ? 'warning'
      : 'success'

    const { error } = await supabase
      .from('integrity_logs')
      .insert({
        check_type: 'full',
        status,
        orphaned_records: report.orphanedDbRecords.length,
        orphaned_files: report.orphanedStorageFiles.length,
        valid_files: report.validFiles.length || report.totalChecked - report.orphanedDbRecords.length,
        details: {
          duration: report.duration,
          dbRecordCount: report.dbRecordCount,
          storageFileCount: report.storageFileCount,
        },
      } as never)

    if (error) {
      // 테이블이 없는 경우(42P01) 조용히 스킵
      if (error.code === '42P01') {
        console.info('integrity_logs 테이블이 없습니다. 로그 저장을 스킵합니다.')
      } else {
        console.warn('무결성 로그 저장 실패:', error.message)
      }
    }
  } catch (err) {
    // 네트워크 에러 등 예외 무시
    console.warn('무결성 로그 저장 중 오류:', err)
  }
}

/**
 * 무결성 검사 로그 조회
 * 테이블이 없으면 빈 배열을 반환합니다.
 */
export async function getIntegrityLogs(limit = 10): Promise<IntegrityLog[]> {
  if (!isSupabaseConfigured()) {
    return []
  }

  try {
    const supabase = getSupabaseClient()

    const { data, error } = await supabase
      .from('integrity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      // 테이블이 없는 경우(42P01) 조용히 빈 배열 반환
      if (error.code === '42P01') {
        console.info('integrity_logs 테이블이 없습니다.')
        return []
      }
      console.error('무결성 로그 조회 실패:', error.message)
      return []
    }

    return (data || []).map((row: {
      id: string
      check_type: string
      status: string
      orphaned_records: number
      orphaned_files: number
      valid_files: number
      details: Record<string, unknown> | null
      created_at: string
    }) => ({
      id: row.id,
      checkType: row.check_type as IntegrityLog['checkType'],
      status: row.status as IntegrityLog['status'],
      orphanedRecords: row.orphaned_records,
      orphanedFiles: row.orphaned_files,
      validFiles: row.valid_files,
      details: row.details,
      createdAt: new Date(row.created_at),
    }))
  } catch (err) {
    console.warn('무결성 로그 조회 중 오류:', err)
    return []
  }
}

/**
 * 파일 검증 시간 업데이트
 */
export async function updateFileVerifiedAt(fileId: string): Promise<void> {
  if (!isSupabaseConfigured()) return

  const supabase = getSupabaseClient()

  await supabase
    .from('files')
    .update({ last_verified_at: new Date().toISOString() } as never)
    .eq('id', fileId)
}

// 유틸리티 함수
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}
