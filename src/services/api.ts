// API Service Layer - Supabase와 로컬 스토리지 추상화

import { getSupabaseClient, isSupabaseConfigured, STORAGE_BUCKET } from '@/lib/supabase'
import type { FileRow, FolderRow, InsertTables, UpdateTables } from '@/lib/database.types'
import * as localStorage from '@/utils/storage'
import { extractExifFromFile } from '@/utils/exifParser'

// Insert/Update 타입
type FileInsert = InsertTables<'files'>
type FileUpdate = UpdateTables<'files'>
type FolderInsert = InsertTables<'folders'>
type FolderUpdate = UpdateTables<'folders'>

// 통합 파일 메타데이터 타입
export interface FileMetadata {
  id: string
  name: string
  type: string
  size: number
  format: 'gltf' | 'glb' | 'obj' | 'fbx' | 'ply' | 'las' | 'e57' | 'image' | 'other'
  folderId: string | null
  storagePath?: string
  thumbnailUrl?: string
  gps?: {
    latitude: number
    longitude: number
    altitude?: number
  }
  exif?: {
    make?: string
    model?: string
    dateTime?: Date
  }
  tags?: string[]
  createdAt: Date
  updatedAt: Date
}

// 통합 폴더 타입
export interface FolderData {
  id: string
  name: string
  parentId: string | null
  color?: string
  createdAt: Date
  updatedAt: Date
}

// Supabase Row를 통합 타입으로 변환
function mapFileRowToMetadata(row: FileRow): FileMetadata {
  return {
    id: row.id,
    name: row.name,
    type: row.mime_type,
    size: row.size,
    format: row.format,
    folderId: row.folder_id,
    storagePath: row.storage_path,
    thumbnailUrl: row.thumbnail_path ?? undefined,
    gps: row.gps_latitude && row.gps_longitude
      ? {
          latitude: row.gps_latitude,
          longitude: row.gps_longitude,
          altitude: row.gps_altitude ?? undefined,
        }
      : undefined,
    exif: row.exif_make || row.exif_model || row.exif_datetime
      ? {
          make: row.exif_make ?? undefined,
          model: row.exif_model ?? undefined,
          dateTime: row.exif_datetime ? new Date(row.exif_datetime) : undefined,
        }
      : undefined,
    tags: row.tags ?? undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

function mapFolderRowToData(row: FolderRow): FolderData {
  return {
    id: row.id,
    name: row.name,
    parentId: row.parent_id,
    color: row.color ?? undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

// === 파일 API ===

export async function uploadFile(
  file: File,
  folderId: string | null = null
): Promise<FileMetadata> {
  // Supabase가 설정되지 않으면 로컬 스토리지 사용
  if (!isSupabaseConfigured()) {
    const localMeta = await localStorage.saveFile(file, folderId)
    return {
      ...localMeta,
      type: localMeta.type,
      storagePath: undefined,
      thumbnailUrl: localMeta.thumbnail,
    }
  }

  const supabase = getSupabaseClient()

  // 현재 사용자 확인
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('로그인이 필요합니다.')
  }

  // 파일 경로 생성 (user_id/folder_id/filename)
  const timestamp = Date.now()
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
  const storagePath = folderId
    ? `${user.id}/${folderId}/${timestamp}_${sanitizedName}`
    : `${user.id}/${timestamp}_${sanitizedName}`

  // Storage에 파일 업로드
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (uploadError) {
    throw new Error(`파일 업로드 실패: ${uploadError.message}`)
  }

  // 파일 포맷 감지
  const format = localStorage.detectFileFormat(file.name)

  // 이미지인 경우 썸네일 업로드 및 EXIF 추출
  let thumbnailPath: string | null = null
  let gpsData: { latitude: number; longitude: number; altitude?: number } | null = null
  let exifData: { make?: string; model?: string; dateTime?: Date } | null = null

  if (format === 'image') {
    // 썸네일 생성 및 업로드
    try {
      const thumbnailBlob = await createThumbnailBlob(file)
      const thumbPath = `${user.id}/thumbnails/${timestamp}_thumb.jpg`

      const { error: thumbError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(thumbPath, thumbnailBlob, {
          cacheControl: '3600',
          upsert: false,
        })

      if (!thumbError) {
        const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(thumbPath)
        thumbnailPath = data.publicUrl
      }
    } catch (err) {
      console.warn('썸네일 생성 실패:', err)
    }

    // EXIF 추출
    try {
      const exif = await extractExifFromFile(file)
      if (exif) {
        if (exif.latitude !== undefined && exif.longitude !== undefined) {
          gpsData = {
            latitude: exif.latitude,
            longitude: exif.longitude,
            altitude: exif.altitude,
          }
        }
        if (exif.make || exif.model || exif.dateTime) {
          exifData = {
            make: exif.make,
            model: exif.model,
            dateTime: exif.dateTime,
          }
        }
      }
    } catch (err) {
      console.warn('EXIF 추출 실패:', err)
    }
  }

  // 메타데이터 DB에 저장
  const insertData: FileInsert = {
    name: file.name,
    mime_type: file.type || 'application/octet-stream',
    size: file.size,
    format,
    folder_id: folderId,
    storage_path: storagePath,
    thumbnail_path: thumbnailPath,
    gps_latitude: gpsData?.latitude,
    gps_longitude: gpsData?.longitude,
    gps_altitude: gpsData?.altitude,
    exif_make: exifData?.make,
    exif_model: exifData?.model,
    exif_datetime: exifData?.dateTime?.toISOString(),
    user_id: user.id,
  }
  const { data, error: insertError } = await supabase
    .from('files')
    .insert(insertData as never)
    .select()
    .single()

  if (insertError || !data) {
    // 업로드한 파일 삭제
    await supabase.storage.from(STORAGE_BUCKET).remove([storagePath])
    throw new Error(`메타데이터 저장 실패: ${insertError?.message}`)
  }

  return mapFileRowToMetadata(data)
}

export async function getFiles(folderId?: string | null): Promise<FileMetadata[]> {
  if (!isSupabaseConfigured()) {
    const localFiles = folderId === undefined
      ? await localStorage.getAllFileMetadata()
      : await localStorage.getFilesByFolder(folderId)
    return localFiles.map(f => ({
      ...f,
      storagePath: undefined,
      thumbnailUrl: f.thumbnail,
    }))
  }

  const supabase = getSupabaseClient()
  let query = supabase.from('files').select('*').order('created_at', { ascending: false })

  if (folderId !== undefined) {
    if (folderId === null) {
      query = query.is('folder_id', null)
    } else {
      query = query.eq('folder_id', folderId)
    }
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`파일 목록 조회 실패: ${error.message}`)
  }

  return ((data || []) as FileRow[]).map(mapFileRowToMetadata)
}

export async function getFile(id: string): Promise<{ metadata: FileMetadata; blob: Blob } | null> {
  if (!isSupabaseConfigured()) {
    const result = await localStorage.getFile(id)
    if (!result) return null
    return {
      metadata: {
        ...result.metadata,
        storagePath: undefined,
        thumbnailUrl: result.metadata.thumbnail,
      },
      blob: result.blob,
    }
  }

  const supabase = getSupabaseClient()

  // 메타데이터 조회
  const { data, error } = await supabase
    .from('files')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) {
    return null
  }

  const fileData = data as FileRow

  // Storage에서 파일 다운로드
  const { data: blobData, error: downloadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .download(fileData.storage_path)

  if (downloadError || !blobData) {
    throw new Error(`파일 다운로드 실패: ${downloadError?.message}`)
  }

  return {
    metadata: mapFileRowToMetadata(fileData),
    blob: blobData,
  }
}

export async function getFileUrl(id: string): Promise<string | null> {
  if (!isSupabaseConfigured()) {
    // 로컬 스토리지의 경우 Blob URL 생성
    const result = await localStorage.getFile(id)
    if (!result) return null
    return URL.createObjectURL(result.blob)
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('files')
    .select('storage_path')
    .eq('id', id)
    .single()

  if (error || !data) return null

  const fileData = data as Pick<FileRow, 'storage_path'>

  // 서명된 URL 생성 (1시간 유효)
  const { data: urlData, error: urlError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(fileData.storage_path, 3600)

  if (urlError || !urlData) return null

  return urlData.signedUrl
}

export async function deleteFile(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    await localStorage.deleteFile(id)
    return
  }

  const supabase = getSupabaseClient()

  // 메타데이터에서 storage_path 조회
  const { data, error: selectError } = await supabase
    .from('files')
    .select('storage_path, thumbnail_path')
    .eq('id', id)
    .single()

  if (selectError || !data) {
    throw new Error('파일을 찾을 수 없습니다.')
  }

  const fileData = data as Pick<FileRow, 'storage_path' | 'thumbnail_path'>

  // Storage에서 파일 삭제
  const pathsToDelete = [fileData.storage_path]
  if (fileData.thumbnail_path) {
    // thumbnail_path가 전체 URL인 경우 경로만 추출
    const thumbPath = fileData.thumbnail_path.split('/').slice(-3).join('/')
    pathsToDelete.push(thumbPath)
  }

  await supabase.storage.from(STORAGE_BUCKET).remove(pathsToDelete)

  // 메타데이터 삭제
  const { error: deleteError } = await supabase.from('files').delete().eq('id', id)

  if (deleteError) {
    throw new Error(`파일 삭제 실패: ${deleteError.message}`)
  }
}

export async function updateFile(
  id: string,
  updates: Partial<Pick<FileMetadata, 'name' | 'folderId' | 'tags'>>
): Promise<FileMetadata | null> {
  if (!isSupabaseConfigured()) {
    const result = await localStorage.updateFileMetadata(id, {
      name: updates.name,
      folderId: updates.folderId,
      tags: updates.tags,
    })
    if (!result) return null
    return {
      ...result,
      storagePath: undefined,
      thumbnailUrl: result.thumbnail,
    }
  }

  const supabase = getSupabaseClient()
  const updateData: FileUpdate = {
    name: updates.name,
    folder_id: updates.folderId,
    tags: updates.tags,
  }
  const { data, error } = await supabase
    .from('files')
    .update(updateData as never)
    .eq('id', id)
    .select()
    .single()

  if (error || !data) {
    return null
  }

  return mapFileRowToMetadata(data as FileRow)
}

// === 폴더 API ===

export async function createFolder(
  name: string,
  parentId: string | null = null
): Promise<FolderData> {
  if (!isSupabaseConfigured()) {
    return await localStorage.createFolder(name, parentId)
  }

  const supabase = getSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('로그인이 필요합니다.')
  }

  const insertData: FolderInsert = {
    name,
    parent_id: parentId,
    user_id: user.id,
  }
  const { data, error } = await supabase
    .from('folders')
    .insert(insertData as never)
    .select()
    .single()

  if (error || !data) {
    throw new Error(`폴더 생성 실패: ${error?.message}`)
  }

  return mapFolderRowToData(data as FolderRow)
}

export async function getFolders(): Promise<FolderData[]> {
  if (!isSupabaseConfigured()) {
    return await localStorage.getAllFolders()
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('folders')
    .select('*')
    .order('name')

  if (error) {
    throw new Error(`폴더 목록 조회 실패: ${error.message}`)
  }

  return ((data || []) as FolderRow[]).map(mapFolderRowToData)
}

export async function updateFolder(
  id: string,
  updates: Partial<Pick<FolderData, 'name' | 'parentId' | 'color'>>
): Promise<FolderData | null> {
  if (!isSupabaseConfigured()) {
    const result = await localStorage.updateFolder(id, {
      name: updates.name,
      parentId: updates.parentId,
      color: updates.color,
    })
    return result
  }

  const supabase = getSupabaseClient()
  const updateData: FolderUpdate = {
    name: updates.name,
    parent_id: updates.parentId,
    color: updates.color,
  }
  const { data, error } = await supabase
    .from('folders')
    .update(updateData as never)
    .eq('id', id)
    .select()
    .single()

  if (error || !data) {
    return null
  }

  return mapFolderRowToData(data as FolderRow)
}

export async function deleteFolder(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    await localStorage.deleteFolder(id)
    return
  }

  const supabase = getSupabaseClient()
  const { error } = await supabase.from('folders').delete().eq('id', id)

  if (error) {
    throw new Error(`폴더 삭제 실패: ${error.message}`)
  }
}

// === 스토리지 정보 ===

export async function getStorageUsage(): Promise<{ used: number; files: number }> {
  if (!isSupabaseConfigured()) {
    return await localStorage.getStorageUsage()
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('files')
    .select('size')

  if (error) {
    throw new Error(`스토리지 사용량 조회 실패: ${error.message}`)
  }

  const used = (data || []).reduce((sum: number, file: { size: number }) => sum + file.size, 0)
  return { used, files: data?.length || 0 }
}

// === 유틸리티 ===

async function createThumbnailBlob(file: File, maxSize = 200): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')!

        let width = img.width
        let height = img.height

        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width
            width = maxSize
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height
            height = maxSize
          }
        }

        canvas.width = width
        canvas.height = height
        ctx.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob)
            } else {
              reject(new Error('썸네일 생성 실패'))
            }
          },
          'image/jpeg',
          0.7
        )
      }
      img.onerror = () => reject(new Error('이미지 로드 실패'))
      img.src = e.target?.result as string
    }
    reader.onerror = () => reject(new Error('파일 읽기 실패'))
    reader.readAsDataURL(file)
  })
}

// 인증 상태 확인
export async function getCurrentUser() {
  if (!isSupabaseConfigured()) {
    return null
  }
  const supabase = getSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// 로그인/로그아웃
export async function signIn(email: string, password: string) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signUp(email: string, password: string) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  const supabase = getSupabaseClient()
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

// 백엔드 연결 상태
export function isBackendConnected(): boolean {
  return isSupabaseConfigured()
}
