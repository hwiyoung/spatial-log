// Asset/File CRUD

import { getSupabaseClient, isSupabaseConfigured, STORAGE_BUCKET } from '@/lib/supabase'
import { saveFile, detectFileFormat, getAllFileMetadata, getFilesByFolder, getFile as localGetFile, updateFileMetadata, deleteFile as localDeleteFile, initDB, getFilesByProject as localGetFilesByProject, linkFilesToProject as localLinkFilesToProject, unlinkFilesFromProject as localUnlinkFilesFromProject } from '@/utils/storage'
import { extractExifFromFile } from '@/utils/exifParser'
import { CONVERTER_URL } from '@/constants/config'
import { TAG_PREFIX } from '@/constants/tags'
import type { FileRow } from '@/lib/database.types'
import type { FileMetadata, FileInsert, FileUpdate, DeleteResult, BatchDeleteResult, FlightPathPoint } from './shared/types'
import { mapFileRowToMetadata, mapLocalFileToMetadata } from './shared/mappers'
import { chunkArray, getMimeTypeFromExtension, createThumbnailBlob } from './shared/utils'

/**
 * Process image for upload: thumbnail generation/upload and EXIF metadata extraction
 */
async function processImageForUpload(
  file: File,
  userId: string,
  timestamp: number,
  supabase: ReturnType<typeof getSupabaseClient>
): Promise<{
  thumbnailPath: string | null
  gpsData: { latitude: number; longitude: number; altitude?: number } | null
  exifData: { make?: string; model?: string; dateTime?: Date } | null
}> {
  let thumbnailPath: string | null = null
  let gpsData: { latitude: number; longitude: number; altitude?: number } | null = null
  let exifData: { make?: string; model?: string; dateTime?: Date } | null = null

  // Thumbnail generation and upload
  try {
    const thumbnailBlob = await createThumbnailBlob(file)
    const thumbPath = `${userId}/thumbnails/${timestamp}_thumb.jpg`

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

  // EXIF extraction
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

  return { thumbnailPath, gpsData, exifData }
}

export async function uploadFile(
  file: File,
  folderId: string | null = null,
  options?: {
    tags?: string[]
    groupId?: string
    parentFileId?: string
  }
): Promise<FileMetadata> {
  if (!isSupabaseConfigured()) {
    const localMeta = await saveFile(file, folderId)
    return mapLocalFileToMetadata(localMeta)
  }

  const supabase = getSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()

  const isDevelopment = import.meta.env.DEV
  if (!user && !isDevelopment) {
    throw new Error('파일 업로드에는 인증이 필요합니다.')
  }
  const userId = user?.id ?? 'dev-user'

  const timestamp = Date.now()
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
  const storagePath = folderId
    ? `${userId}/${folderId}/${timestamp}_${sanitizedName}`
    : `${userId}/${timestamp}_${sanitizedName}`

  const contentType = file.type || getMimeTypeFromExtension(file.name)
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType,
    })

  if (uploadError) {
    throw new Error(`파일 업로드 실패: ${uploadError.message}`)
  }

  const format = detectFileFormat(file.name)

  const { thumbnailPath, gpsData, exifData } = format === 'image'
    ? await processImageForUpload(file, userId, timestamp, supabase)
    : { thumbnailPath: null, gpsData: null, exifData: null }

  const tags: string[] = options?.tags ? [...options.tags] : []
  if (options?.groupId) {
    tags.push(`group:${options.groupId}`)
  }
  if (options?.parentFileId) {
    tags.push(`parent:${options.parentFileId}`)
  }

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
    user_id: user?.id ?? null,
    tags: tags.length > 0 ? tags : null,
  }
  const { data, error: insertError } = await supabase
    .from('files')
    .insert(insertData as never)
    .select()
    .single()

  if (insertError || !data) {
    await supabase.storage.from(STORAGE_BUCKET).remove([storagePath])
    throw new Error(`메타데이터 저장 실패: ${insertError?.message}`)
  }

  return mapFileRowToMetadata(data)
}

export async function createLinkAsset(
  name: string,
  url: string,
  options?: { folderId?: string | null; tags?: string[]; description?: string }
): Promise<FileMetadata> {
  // URL protocol validation (block javascript:, data:, etc.)
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('http:// 또는 https:// URL만 허용됩니다')
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('URL만')) throw e
    throw new Error('유효한 URL이 아닙니다')
  }

  if (!isSupabaseConfigured()) {
    const id = crypto.randomUUID()
    const now = new Date()
    const meta: import('@/utils/storage').FileMetadata = {
      id,
      name,
      type: '',
      size: 0,
      format: 'other',
      folderId: options?.folderId ?? null,
      projectId: null,
      status: 'active',
      assetType: 'link',
      url,
      description: options?.description,
      tags: options?.tags,
      createdAt: now,
      updatedAt: now,
    }
    const db = await initDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['metadata'], 'readwrite')
      tx.objectStore('metadata').put(meta)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    return mapLocalFileToMetadata(meta)
  }

  const supabase = getSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user && !import.meta.env.DEV) {
    throw new Error('인증이 필요합니다.')
  }

  const insertData: FileInsert = {
    name,
    mime_type: '',
    size: 0,
    format: 'other',
    folder_id: options?.folderId ?? null,
    asset_type: 'link',
    url,
    description: options?.description,
    tags: options?.tags,
    user_id: user?.id ?? null,
    status: 'active',
  }

  const { data, error } = await supabase.from('files').insert(insertData as never).select().single()
  if (error || !data) throw new Error(`링크 에셋 생성 실패: ${error?.message}`)
  return mapFileRowToMetadata(data as FileRow)
}

export async function createNoteAsset(
  name: string,
  body: string,
  options?: { folderId?: string | null; tags?: string[]; description?: string }
): Promise<FileMetadata> {
  if (!isSupabaseConfigured()) {
    const id = crypto.randomUUID()
    const now = new Date()
    const meta: import('@/utils/storage').FileMetadata = {
      id,
      name,
      type: '',
      size: 0,
      format: 'other',
      folderId: options?.folderId ?? null,
      projectId: null,
      status: 'active',
      assetType: 'note',
      body,
      description: options?.description,
      tags: options?.tags,
      createdAt: now,
      updatedAt: now,
    }
    const db = await initDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['metadata'], 'readwrite')
      tx.objectStore('metadata').put(meta)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    return mapLocalFileToMetadata(meta)
  }

  const supabase = getSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user && !import.meta.env.DEV) {
    throw new Error('인증이 필요합니다.')
  }

  const insertData: FileInsert = {
    name,
    mime_type: '',
    size: 0,
    format: 'other',
    folder_id: options?.folderId ?? null,
    asset_type: 'note',
    body,
    description: options?.description,
    tags: options?.tags,
    user_id: user?.id ?? null,
    status: 'active',
  }

  const { data, error } = await supabase.from('files').insert(insertData as never).select().single()
  if (error || !data) throw new Error(`노트 에셋 생성 실패: ${error?.message}`)
  return mapFileRowToMetadata(data as FileRow)
}

export async function getFiles(folderId?: string | null, options?: { includeRelated?: boolean; status?: string }): Promise<FileMetadata[]> {
  if (!isSupabaseConfigured()) {
    const localFiles = folderId === undefined
      ? await getAllFileMetadata()
      : await getFilesByFolder(folderId)
    const files: FileMetadata[] = localFiles.map(mapLocalFileToMetadata)

    const statusFilter = options?.status ?? 'active'
    const filtered = statusFilter === 'all'
      ? files
      : files.filter(f => f.status === statusFilter)

    if (!options?.includeRelated) {
      return filtered.filter(f => !f.tags?.some(t => t.startsWith(TAG_PREFIX.PARENT)))
    }
    return filtered
  }

  const supabase = getSupabaseClient()
  let query = supabase.from('files').select('*').order('created_at', { ascending: false })

  const statusFilter = options?.status ?? 'active'
  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter)
  }

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

  const files = ((data || []) as FileRow[]).map(mapFileRowToMetadata)

  if (!options?.includeRelated) {
    return files.filter(f => !f.tags?.some(t => t.startsWith(TAG_PREFIX.PARENT)))
  }
  return files
}

/**
 * Get related files for a given parent file (MTL, textures, etc.)
 * 1st: search by parent:{id} tag
 * 2nd: if no tag, search by filename pattern (for individually uploaded files)
 */
export async function getRelatedFiles(parentFileId: string): Promise<FileMetadata[]> {
  if (!isSupabaseConfigured()) {
    const allFiles = await getAllFileMetadata()
    const taggedFiles = allFiles
      .filter(f => f.tags?.includes(`parent:${parentFileId}`))
      .map(mapLocalFileToMetadata)

    if (taggedFiles.length > 0) {
      return taggedFiles
    }

    const parentFile = allFiles.find(f => f.id === parentFileId)
    if (parentFile) {
      return findRelatedFilesByName(mapLocalFileToMetadata(parentFile), allFiles.map(mapLocalFileToMetadata))
    }

    return []
  }

  const supabase = getSupabaseClient()

  const { data: taggedData, error: taggedError } = await supabase
    .from('files')
    .select('*')
    .contains('tags', [`parent:${parentFileId}`])
    .order('created_at', { ascending: false })

  if (taggedError) {
    throw new Error(`연관 파일 조회 실패: ${taggedError.message}`)
  }

  if (taggedData && taggedData.length > 0) {
    return (taggedData as FileRow[]).map(mapFileRowToMetadata)
  }

  const { data: parentData } = await supabase
    .from('files')
    .select('*')
    .eq('id', parentFileId)
    .single()

  if (!parentData) {
    return []
  }

  const parentFile = mapFileRowToMetadata(parentData as FileRow)

  const { data: allData } = await supabase
    .from('files')
    .select('*')
    .neq('id', parentFileId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (!allData) {
    return []
  }

  const allFilesArr = (allData as FileRow[]).map(mapFileRowToMetadata)
  return findRelatedFilesByName(parentFile, allFilesArr)
}

/**
 * Find related files by filename pattern (OBJ + MTL + textures)
 */
function findRelatedFilesByName(parentFile: FileMetadata, allFiles: FileMetadata[]): FileMetadata[] {
  if (parentFile.format !== 'obj') {
    return []
  }

  const baseName = parentFile.name.toLowerCase().replace(/\.obj$/i, '')
  const related: FileMetadata[] = []

  const mtlExtensions = ['.mtl']
  const textureExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.tiff', '.tif', '.bmp', '.dds', '.ktx', '.ktx2']

  for (const file of allFiles) {
    const fileName = file.name.toLowerCase()
    const ext = '.' + fileName.split('.').pop()

    if (mtlExtensions.includes(ext)) {
      const mtlBaseName = fileName.replace(/\.mtl$/i, '')
      if (mtlBaseName === baseName || baseName.includes(mtlBaseName) || mtlBaseName.includes(baseName)) {
        related.push(file)
        continue
      }
    }

    if (textureExtensions.includes(ext)) {
      const texBaseName = fileName.replace(/\.[^.]+$/, '')

      const timeDiff = Math.abs(new Date(file.createdAt).getTime() - new Date(parentFile.createdAt).getTime())
      const fiveMinutes = 5 * 60 * 1000

      if (timeDiff < fiveMinutes) {
        related.push(file)
        continue
      }

      if (texBaseName.includes(baseName) || baseName.includes(texBaseName)) {
        related.push(file)
      }
    }
  }

  return related
}

/**
 * Get file metadata only (without blob)
 */
export async function getFileMetadata(id: string): Promise<FileMetadata | null> {
  if (!isSupabaseConfigured()) {
    const result = await localGetFile(id)
    if (!result) return null
    return mapLocalFileToMetadata(result.metadata)
  }

  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('files')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) {
    return null
  }

  return mapFileRowToMetadata(data as FileRow)
}

export async function getFile(id: string): Promise<{ metadata: FileMetadata; blob: Blob } | null> {
  if (!isSupabaseConfigured()) {
    const result = await localGetFile(id)
    if (!result) return null
    const metadata = mapLocalFileToMetadata(result.metadata)
    if (metadata.assetType === 'link') {
      return { metadata, blob: new Blob([metadata.url ?? ''], { type: 'text/plain' }) }
    }
    if (metadata.assetType === 'note') {
      return { metadata, blob: new Blob([metadata.body ?? ''], { type: 'text/plain' }) }
    }
    return { metadata, blob: result.blob }
  }

  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('files')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) {
    return null
  }

  const fileData = data as FileRow
  const metadata = mapFileRowToMetadata(fileData)

  if (metadata.assetType === 'link') {
    return { metadata, blob: new Blob([metadata.url ?? ''], { type: 'text/plain' }) }
  }
  if (metadata.assetType === 'note') {
    return { metadata, blob: new Blob([metadata.body ?? ''], { type: 'text/plain' }) }
  }

  if (!fileData.storage_path) {
    return { metadata, blob: new Blob() }
  }

  const { data: blobData, error: downloadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .download(fileData.storage_path)

  if (downloadError || !blobData) {
    throw new Error(`파일 다운로드 실패: ${downloadError?.message}`)
  }

  return { metadata, blob: blobData }
}

export async function getFileUrl(id: string): Promise<string | null> {
  if (!isSupabaseConfigured()) {
    const result = await localGetFile(id)
    if (!result) return null
    const assetType = result.metadata.assetType ?? 'file'
    if (assetType === 'link') return result.metadata.url ?? null
    if (assetType === 'note') return null
    return URL.createObjectURL(result.blob)
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('files')
    .select('storage_path, asset_type, url')
    .eq('id', id)
    .single()

  if (error || !data) return null

  const fileData = data as Pick<FileRow, 'storage_path' | 'asset_type' | 'url'>

  if (fileData.asset_type === 'link') return fileData.url ?? null
  if (fileData.asset_type === 'note') return null

  if (!fileData.storage_path) return null

  const { data: urlData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(fileData.storage_path)

  return urlData.publicUrl
}

/**
 * Delete physical files via spatial-converter
 * Workaround for Supabase Storage API not deleting physical files
 */
async function deletePhysicalFiles(storagePaths: string[]): Promise<void> {
  if (storagePaths.length === 0) return

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }
    }

    const response = await fetch(`${CONVERTER_URL}/delete`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ storage_paths: storagePaths }),
    })

    if (response.ok) {
      const result = await response.json()
      console.log('물리 파일 삭제 결과:', result)
    } else {
      console.warn('물리 파일 삭제 API 실패:', response.status)
    }
  } catch (err) {
    console.warn('물리 파일 삭제 요청 실패 (converter 서비스 확인 필요):', err)
  }
}

/**
 * Extract storage path from URL
 */
function extractStoragePathFromUrl(url: string): string | null {
  if (!url) return null

  if (!url.startsWith('http')) {
    return url
  }

  try {
    const urlObj = new URL(url)
    const pathParts = urlObj.pathname.split('/')
    const bucketIndex = pathParts.findIndex(p => p === STORAGE_BUCKET)
    if (bucketIndex !== -1 && bucketIndex < pathParts.length - 1) {
      return pathParts.slice(bucketIndex + 1).join('/')
    }
    return pathParts.slice(-3).join('/')
  } catch {
    return url.split('/').slice(-3).join('/')
  }
}

/**
 * Transaction-based file deletion (improved stability)
 * 1. Delete related files first (MTL, textures, etc.)
 * 2. Delete Storage files (Supabase API + physical deletion)
 * 3. Delete DB records
 */
export async function deleteFileWithTransaction(id: string): Promise<DeleteResult> {
  if (!isSupabaseConfigured()) {
    await localDeleteFile(id)
    return { success: true, deletedAt: new Date() }
  }

  const supabase = getSupabaseClient()

  const { data, error: selectError } = await supabase
    .from('files')
    .select('*')
    .eq('id', id)
    .single()

  if (selectError || !data) {
    throw new Error('파일을 찾을 수 없습니다.')
  }

  const fileData = data as FileRow

  if (fileData.asset_type === 'link' || fileData.asset_type === 'note') {
    const { error: deleteError } = await supabase
      .from('files')
      .delete()
      .eq('id', id)
    if (deleteError) {
      throw new Error(`삭제 실패: ${deleteError.message}`)
    }
    return { success: true, deletedAt: new Date() }
  }

  const storagePathsToDelete: string[] = []

  try {
    const { data: relatedFiles } = await supabase
      .from('files')
      .select('id, storage_path')
      .contains('tags', [`parent:${id}`])

    if (relatedFiles && relatedFiles.length > 0) {
      const relatedPaths = relatedFiles
        .map((f: { storage_path: string | null }) => f.storage_path)
        .filter((p): p is string => !!p)
      storagePathsToDelete.push(...relatedPaths)

      const relatedIds = relatedFiles.map((f: { id: string }) => f.id)
      await supabase.from('files').delete().in('id', relatedIds)
      console.log(`연관 파일 ${relatedIds.length}개 DB 레코드 삭제됨`)
    }
  } catch (relatedError) {
    console.warn('연관 파일 삭제 실패:', relatedError)
  }

  if (fileData.storage_path) {
    storagePathsToDelete.push(fileData.storage_path)
    if (fileData.thumbnail_path) {
      const thumbPath = extractStoragePathFromUrl(fileData.thumbnail_path)
      if (thumbPath) {
        storagePathsToDelete.push(thumbPath)
      }
    }
  }

  const { error: deleteError } = await supabase
    .from('files')
    .delete()
    .eq('id', id)

  if (deleteError) {
    throw new Error(`삭제 실패: ${deleteError.message}`)
  }

  if (storagePathsToDelete.length > 0) {
    try {
      await supabase.storage.from(STORAGE_BUCKET).remove(storagePathsToDelete)
    } catch (storageError) {
      console.warn('Supabase Storage 삭제 실패 (DB는 이미 삭제됨):', storageError)
    }
    await deletePhysicalFiles(storagePathsToDelete)
  }

  return { success: true, deletedAt: new Date() }
}

/**
 * Batch file deletion
 */
export async function deleteFilesInBatch(ids: string[]): Promise<BatchDeleteResult> {
  const results: BatchDeleteResult = {
    success: [],
    failed: [],
  }

  const chunks = chunkArray(ids, 5)

  for (const chunk of chunks) {
    const deletePromises = chunk.map(async (id) => {
      try {
        await deleteFileWithTransaction(id)
        results.success.push(id)
      } catch (err) {
        results.failed.push({
          id,
          error: err instanceof Error ? err.message : 'Unknown error',
        })
      }
    })
    await Promise.all(deletePromises)
  }

  return results
}

/**
 * Legacy deleteFile function (backward compatibility)
 */
export async function deleteFile(id: string): Promise<void> {
  await deleteFileWithTransaction(id)
}

export async function updateFile(
  id: string,
  updates: Partial<Pick<FileMetadata, 'name' | 'folderId' | 'projectId' | 'tags' | 'description' | 'status' | 'url' | 'body'>>
): Promise<FileMetadata | null> {
  if (!isSupabaseConfigured()) {
    const result = await updateFileMetadata(id, {
      name: updates.name,
      folderId: updates.folderId,
      projectId: updates.projectId,
      tags: updates.tags,
      ...(updates.description !== undefined && { description: updates.description }),
      ...(updates.status !== undefined && { status: updates.status }),
      ...(updates.url !== undefined && { url: updates.url }),
      ...(updates.body !== undefined && { body: updates.body }),
    })
    if (!result) return null
    return mapLocalFileToMetadata(result)
  }

  const supabase = getSupabaseClient()
  const updateData: FileUpdate = {
    name: updates.name,
    folder_id: updates.folderId,
    project_id: updates.projectId,
    tags: updates.tags,
    description: updates.description,
    status: updates.status,
    url: updates.url,
    body: updates.body,
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

export async function updateFileConversionStatus(
  id: string,
  status: 'pending' | 'converting' | 'ready' | 'failed',
  progress?: number,
  convertedPath?: string,
  error?: string
): Promise<FileMetadata | null> {
  if (!isSupabaseConfigured()) {
    console.warn('로컬 스토리지에서는 변환 상태를 지원하지 않습니다.')
    return null
  }

  const supabase = getSupabaseClient()
  const updateData: FileUpdate = {
    conversion_status: status,
    conversion_progress: progress ?? (status === 'ready' ? 100 : status === 'pending' ? 0 : undefined),
    converted_path: convertedPath,
    conversion_error: error,
  }
  const { data, error: dbError } = await supabase
    .from('files')
    .update(updateData as never)
    .eq('id', id)
    .select()
    .single()

  if (dbError || !data) {
    console.error('변환 상태 업데이트 실패:', dbError?.message)
    return null
  }

  return mapFileRowToMetadata(data as FileRow)
}

export async function updateFileGpsCoordinates(
  id: string,
  latitude: number | null,
  longitude: number | null,
  altitude?: number | null
): Promise<FileMetadata | null> {
  if (!isSupabaseConfigured()) {
    console.warn('로컬 스토리지에서는 GPS 수정을 지원하지 않습니다.')
    return null
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('files')
    .update({
      gps_latitude: latitude,
      gps_longitude: longitude,
      gps_altitude: altitude ?? null,
    } as never)
    .eq('id', id)
    .select()
    .single()

  if (error || !data) {
    console.error('GPS 좌표 수정 실패:', error?.message)
    return null
  }

  return mapFileRowToMetadata(data as FileRow)
}

export async function getFlightPathData(projectId?: string): Promise<FlightPathPoint[]> {
  if (!isSupabaseConfigured()) {
    return []
  }

  const supabase = getSupabaseClient()
  let query = supabase
    .from('files')
    .select('id, name, gps_latitude, gps_longitude, gps_altitude, exif_datetime')
    .not('gps_latitude', 'is', null)
    .not('gps_longitude', 'is', null)
    .not('exif_datetime', 'is', null)
    .eq('format', 'image')
    .order('exif_datetime', { ascending: true })

  if (projectId) {
    const { data: links } = await supabase
      .from('project_files')
      .select('file_id')
      .eq('project_id', projectId)

    if (links && links.length > 0) {
      const fileIds = links.map((l: { file_id: string }) => l.file_id)
      query = query.in('id', fileIds)
    } else {
      return []
    }
  }

  const { data, error } = await query

  if (error || !data) {
    console.error('비행경로 데이터 조회 실패:', error?.message)
    return []
  }

  return data.map((row: Record<string, unknown>) => ({
    fileId: row.id as string,
    fileName: row.name as string,
    latitude: row.gps_latitude as number,
    longitude: row.gps_longitude as number,
    altitude: (row.gps_altitude as number) ?? undefined,
    datetime: row.exif_datetime as string,
  }))
}

// === Project-File linking API ===

export async function getFilesByProject(projectId: string): Promise<FileMetadata[]> {
  if (!isSupabaseConfigured()) {
    const localFiles = await localGetFilesByProject(projectId)
    return localFiles.map(mapLocalFileToMetadata)
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('files')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`프로젝트 파일 조회 실패: ${error.message}`)
  }

  return ((data || []) as FileRow[]).map(mapFileRowToMetadata)
}

export async function linkFilesToProject(fileIds: string[], projectId: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    await localLinkFilesToProject(fileIds, projectId)
    return
  }

  const supabase = getSupabaseClient()

  for (const fileId of fileIds) {
    const { error } = await supabase
      .from('files')
      .update({ project_id: projectId } as never)
      .eq('id', fileId)

    if (error) {
      throw new Error(`파일 연결 실패: ${error.message}`)
    }
  }
}

export async function unlinkFilesFromProject(fileIds: string[]): Promise<void> {
  if (!isSupabaseConfigured()) {
    await localUnlinkFilesFromProject(fileIds)
    return
  }

  const supabase = getSupabaseClient()

  for (const fileId of fileIds) {
    const { error } = await supabase
      .from('files')
      .update({ project_id: null } as never)
      .eq('id', fileId)

    if (error) {
      throw new Error(`파일 연결 해제 실패: ${error.message}`)
    }
  }
}
