// API Service Layer - Supabase와 로컬 스토리지 추상화

import { getSupabaseClient, isSupabaseConfigured, STORAGE_BUCKET } from '@/lib/supabase'
import type { FileRow, FolderRow, ProjectRow, AnnotationRow, StoryRow, SceneRow, SceneEntryRow, ReleaseRow, InsertTables, UpdateTables } from '@/lib/database.types'
import type { StoryData, StoryStatus, SceneData, SceneEntryData, SceneEntryType, ReleaseData, ReleaseSnapshot, ReleaseManifest, AccessType, ReleaseStatus } from '@/types/story'
import * as localStorage from '@/utils/storage'
import { extractExifFromFile } from '@/utils/exifParser'
import { CONVERTER_URL } from '@/constants/config'
import { ALL_3D_FORMATS } from '@/constants/formats'

// Insert/Update 타입
type FileInsert = InsertTables<'files'>
type FileUpdate = UpdateTables<'files'>
type FolderInsert = InsertTables<'folders'>
type FolderUpdate = UpdateTables<'folders'>
type ProjectInsert = InsertTables<'projects'>
type ProjectUpdate = UpdateTables<'projects'>
type AnnotationInsert = InsertTables<'annotations'>
type AnnotationUpdate = UpdateTables<'annotations'>
type StoryInsert = InsertTables<'stories'>
type StoryUpdate = UpdateTables<'stories'>
type SceneInsert = InsertTables<'scenes'>
type SceneUpdate = UpdateTables<'scenes'>
type SceneEntryInsert = InsertTables<'scene_entries'>
type SceneEntryUpdate = UpdateTables<'scene_entries'>
type ReleaseInsert = InsertTables<'releases'>

// 공간 좌표 정보
export interface SpatialInfo {
  // 좌표계 정보
  epsg?: number  // EPSG 코드 (4326, 5186 등)
  isGeographic?: boolean  // 지리 좌표계 여부 (lat/lon)
  isKoreaTM?: boolean     // 한국 TM 좌표계 여부
  // Bounding Box (원본 좌표계 기준)
  bbox?: {
    minX: number
    minY: number
    minZ: number
    maxX: number
    maxY: number
    maxZ: number
  }
  // 중심점
  center?: {
    x?: number       // 원본 좌표계 X
    y?: number       // 원본 좌표계 Y
    z?: number       // 원본 좌표계 Z
    longitude?: number  // WGS84 경도 (지리 좌표 or 변환된 좌표)
    latitude?: number   // WGS84 위도 (지리 좌표 or 변환된 좌표)
    altitude?: number   // 고도
  }
  // 포인트 개수 (포인트 클라우드/정점)
  pointCount?: number
}

// 통합 파일 메타데이터 타입
export interface FileMetadata {
  id: string
  name: string
  type: string
  size: number
  format: 'gltf' | 'glb' | 'obj' | 'fbx' | 'ply' | 'las' | 'e57' | '3dtiles' | 'splat' | 'image' | 'other'
  folderId: string | null
  projectId: string | null
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
  // 3D 데이터 공간 정보
  spatialInfo?: SpatialInfo
  // 3D 데이터 변환 상태
  conversionStatus?: 'pending' | 'converting' | 'ready' | 'failed' | null
  conversionProgress?: number
  convertedPath?: string
  conversionError?: string
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

// 통합 프로젝트 타입
export interface ProjectData {
  id: string
  name: string
  description: string | null
  thumbnailUrl: string | null
  status: 'active' | 'review' | 'completed' | 'archived'
  tags: string[]
  createdAt: Date
  updatedAt: Date
}

// 통합 어노테이션 타입
export interface AnnotationData {
  id: string
  projectId: string | null
  title: string
  description: string | null
  priority: 'low' | 'medium' | 'high' | 'critical'
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  position: {
    x: number
    y: number
    z: number
  } | null
  gps: {
    latitude: number
    longitude: number
  } | null
  fileId: string | null
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
    projectId: row.project_id,
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
    // 공간 정보 (metadata.spatialInfo)
    spatialInfo: row.metadata?.spatialInfo ? {
      epsg: row.metadata.spatialInfo.epsg,
      isGeographic: row.metadata.spatialInfo.isGeographic,
      isKoreaTM: row.metadata.spatialInfo.isKoreaTM,
      bbox: row.metadata.spatialInfo.bbox,
      center: row.metadata.spatialInfo.center,
      pointCount: row.metadata.spatialInfo.vertexCount,
    } : undefined,
    // 변환 상태
    conversionStatus: row.conversion_status as FileMetadata['conversionStatus'] ?? undefined,
    conversionProgress: row.conversion_progress ?? undefined,
    convertedPath: row.converted_path ?? undefined,
    conversionError: row.conversion_error ?? undefined,
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

function mapProjectRowToData(row: ProjectRow): ProjectData {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    thumbnailUrl: row.thumbnail_url,
    status: (row.status as ProjectData['status']) ?? 'active',
    tags: row.tags ?? [],
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

function mapAnnotationRowToData(row: AnnotationRow): AnnotationData {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    description: row.description,
    priority: row.priority,
    status: row.status,
    position:
      row.position_x !== null && row.position_y !== null && row.position_z !== null
        ? { x: row.position_x, y: row.position_y, z: row.position_z }
        : null,
    gps:
      row.gps_latitude !== null && row.gps_longitude !== null
        ? { latitude: row.gps_latitude, longitude: row.gps_longitude }
        : null,
    fileId: row.file_id,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

// === 파일 API ===

/**
 * 이미지 파일의 썸네일 생성/업로드 및 EXIF 메타데이터 추출
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

  // 썸네일 생성 및 업로드
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
  // Supabase가 설정되지 않으면 로컬 스토리지 사용
  if (!isSupabaseConfigured()) {
    const localMeta = await localStorage.saveFile(file, folderId)
    return {
      ...localMeta,
      type: localMeta.type,
      projectId: localMeta.projectId ?? null,
      storagePath: undefined,
      thumbnailUrl: localMeta.thumbnail,
    }
  }

  const supabase = getSupabaseClient()

  // 인증 확인
  const { data: { user } } = await supabase.auth.getUser()

  // 프로덕션에서는 인증 필수, 개발 환경에서는 'dev-user' 사용
  const isDevelopment = import.meta.env.DEV
  if (!user && !isDevelopment) {
    throw new Error('파일 업로드에는 인증이 필요합니다.')
  }
  const userId = user?.id ?? 'dev-user'

  // 파일 경로 생성 (user_id/folder_id/filename)
  const timestamp = Date.now()
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
  const storagePath = folderId
    ? `${userId}/${folderId}/${timestamp}_${sanitizedName}`
    : `${userId}/${timestamp}_${sanitizedName}`

  // Storage에 파일 업로드
  // e57 등 브라우저가 인식하지 못하는 파일 타입은 contentType을 명시적으로 설정
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

  // 파일 포맷 감지
  const format = localStorage.detectFileFormat(file.name)

  // 이미지인 경우 썸네일 업로드 및 EXIF 추출
  const { thumbnailPath, gpsData, exifData } = format === 'image'
    ? await processImageForUpload(file, userId, timestamp, supabase)
    : { thumbnailPath: null, gpsData: null, exifData: null }

  // 태그 생성 (그룹 정보 포함)
  const tags: string[] = options?.tags ? [...options.tags] : []
  if (options?.groupId) {
    tags.push(`group:${options.groupId}`)
  }
  if (options?.parentFileId) {
    tags.push(`parent:${options.parentFileId}`)
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
    user_id: user?.id ?? null,
    tags: tags.length > 0 ? tags : null,
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

export async function getFiles(folderId?: string | null, options?: { includeRelated?: boolean }): Promise<FileMetadata[]> {
  if (!isSupabaseConfigured()) {
    const localFiles = folderId === undefined
      ? await localStorage.getAllFileMetadata()
      : await localStorage.getFilesByFolder(folderId)
    const files = localFiles.map(f => ({
      ...f,
      projectId: f.projectId ?? null,
      storagePath: undefined,
      thumbnailUrl: f.thumbnail,
    }))

    // 연관 파일 필터링 (기본적으로 숨김)
    if (!options?.includeRelated) {
      return files.filter(f => !f.tags?.some(t => t.startsWith('parent:')))
    }
    return files
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

  const files = ((data || []) as FileRow[]).map(mapFileRowToMetadata)

  // 연관 파일 필터링 (기본적으로 숨김)
  if (!options?.includeRelated) {
    return files.filter(f => !f.tags?.some(t => t.startsWith('parent:')))
  }
  return files
}

/**
 * 특정 파일의 연관 파일들 조회 (MTL, 텍스처 등)
 * 1차: parent:{id} 태그로 검색
 * 2차: 태그 없으면 파일명 기반으로 검색 (개별 업로드된 파일 지원)
 */
export async function getRelatedFiles(parentFileId: string): Promise<FileMetadata[]> {
  if (!isSupabaseConfigured()) {
    const allFiles = await localStorage.getAllFileMetadata()
    const taggedFiles = allFiles
      .filter(f => f.tags?.includes(`parent:${parentFileId}`))
      .map(f => ({
        ...f,
        projectId: f.projectId ?? null,
        storagePath: undefined,
        thumbnailUrl: f.thumbnail,
      }))

    if (taggedFiles.length > 0) {
      return taggedFiles
    }

    // 태그 없으면 이름 기반 검색
    const parentFile = allFiles.find(f => f.id === parentFileId)
    if (parentFile) {
      return findRelatedFilesByName(parentFile, allFiles.map(f => ({
        ...f,
        projectId: f.projectId ?? null,
        storagePath: undefined,
        thumbnailUrl: f.thumbnail,
      })))
    }

    return []
  }

  const supabase = getSupabaseClient()

  // 1차: 태그 기반 검색
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

  // 2차: 태그 없으면 이름 기반 검색
  const { data: parentData } = await supabase
    .from('files')
    .select('*')
    .eq('id', parentFileId)
    .single()

  if (!parentData) {
    return []
  }

  const parentFile = mapFileRowToMetadata(parentData as FileRow)

  // MTL, 텍스처 파일 패턴 검색
  const { data: allData } = await supabase
    .from('files')
    .select('*')
    .neq('id', parentFileId)
    .order('created_at', { ascending: false })

  if (!allData) {
    return []
  }

  const allFiles = (allData as FileRow[]).map(mapFileRowToMetadata)
  return findRelatedFilesByName(parentFile, allFiles)
}

/**
 * 파일명 기반으로 연관 파일 검색 (OBJ + MTL + 텍스처)
 */
function findRelatedFilesByName(parentFile: FileMetadata, allFiles: FileMetadata[]): FileMetadata[] {
  // OBJ 파일이 아니면 빈 배열 반환
  if (parentFile.format !== 'obj') {
    return []
  }

  const baseName = parentFile.name.toLowerCase().replace(/\.obj$/i, '')
  const related: FileMetadata[] = []

  // MTL 및 텍스처 확장자
  const mtlExtensions = ['.mtl']
  const textureExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.tiff', '.tif', '.bmp', '.dds', '.ktx', '.ktx2']

  for (const file of allFiles) {
    const fileName = file.name.toLowerCase()
    const ext = '.' + fileName.split('.').pop()

    // MTL 파일: 같은 기본 이름 또는 OBJ에서 참조 가능한 이름
    if (mtlExtensions.includes(ext)) {
      const mtlBaseName = fileName.replace(/\.mtl$/i, '')
      // 이름이 같거나 유사하면 연관 파일로 추가
      if (mtlBaseName === baseName || baseName.includes(mtlBaseName) || mtlBaseName.includes(baseName)) {
        related.push(file)
        continue
      }
    }

    // 텍스처 파일: 같은 업로드 시간대 또는 이름 유사성으로 판단
    if (textureExtensions.includes(ext)) {
      const texBaseName = fileName.replace(/\.[^.]+$/, '')

      // 업로드 시간이 비슷하면 (5분 이내) 연관 파일로 추가
      const timeDiff = Math.abs(new Date(file.createdAt).getTime() - new Date(parentFile.createdAt).getTime())
      const fiveMinutes = 5 * 60 * 1000

      if (timeDiff < fiveMinutes) {
        related.push(file)
        continue
      }

      // 이름 유사성 확인
      if (texBaseName.includes(baseName) || baseName.includes(texBaseName)) {
        related.push(file)
      }
    }
  }

  return related
}

/**
 * 파일 메타데이터만 조회 (blob 없이)
 */
export async function getFileMetadata(id: string): Promise<FileMetadata | null> {
  if (!isSupabaseConfigured()) {
    const result = await localStorage.getFile(id)
    if (!result) return null
    return {
      ...result.metadata,
      projectId: result.metadata.projectId ?? null,
      storagePath: undefined,
      thumbnailUrl: result.metadata.thumbnail,
    }
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
    const result = await localStorage.getFile(id)
    if (!result) return null
    return {
      metadata: {
        ...result.metadata,
        projectId: result.metadata.projectId ?? null,
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

  // 퍼블릭 URL 생성 (버킷이 public으로 설정됨)
  const { data: urlData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(fileData.storage_path)

  return urlData.publicUrl
}

// 삭제 결과 타입
export interface DeleteResult {
  success: boolean
  deletedAt: Date
  softDeleted?: boolean
}

export interface BatchDeleteResult {
  success: string[]
  failed: { id: string; error: string }[]
}

/**
 * spatial-converter를 통한 물리적 파일 삭제
 * Supabase Storage API가 파일 백엔드에서 물리 파일을 안 지우는 문제 해결
 */
async function deletePhysicalFiles(storagePaths: string[]): Promise<void> {
  if (storagePaths.length === 0) return

  try {
    const response = await fetch(`${CONVERTER_URL}/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
 * 트랜잭션 기반 파일 삭제 (안정성 개선)
 * 1. 연관 파일 먼저 삭제 (MTL, 텍스처 등)
 * 2. Storage 파일 삭제 (Supabase API + 물리적 삭제)
 * 3. DB 레코드 삭제
 */
export async function deleteFileWithTransaction(id: string): Promise<DeleteResult> {
  if (!isSupabaseConfigured()) {
    await localStorage.deleteFile(id)
    return { success: true, deletedAt: new Date() }
  }

  const supabase = getSupabaseClient()

  // 1. 메타데이터 조회
  const { data, error: selectError } = await supabase
    .from('files')
    .select('*')
    .eq('id', id)
    .single()

  if (selectError || !data) {
    throw new Error('파일을 찾을 수 없습니다.')
  }

  const fileData = data as FileRow

  // 삭제할 물리 파일 경로 수집
  const physicalPathsToDelete: string[] = []

  // 2. 연관 파일 삭제 (MTL, 텍스처 등 - parent:{id} 태그가 있는 파일들)
  try {
    const { data: relatedFiles } = await supabase
      .from('files')
      .select('id, storage_path')
      .contains('tags', [`parent:${id}`])

    if (relatedFiles && relatedFiles.length > 0) {
      // 연관 파일들의 Storage 삭제
      const relatedPaths = relatedFiles.map((f: { storage_path: string }) => f.storage_path).filter(Boolean)
      if (relatedPaths.length > 0) {
        await supabase.storage.from(STORAGE_BUCKET).remove(relatedPaths)
        physicalPathsToDelete.push(...relatedPaths)
      }

      // 연관 파일들의 DB 레코드 삭제
      const relatedIds = relatedFiles.map((f: { id: string }) => f.id)
      await supabase.from('files').delete().in('id', relatedIds)
      console.log(`연관 파일 ${relatedIds.length}개 삭제됨`)
    }
  } catch (relatedError) {
    console.warn('연관 파일 삭제 실패:', relatedError)
    // 연관 파일 삭제 실패해도 메인 파일은 삭제 진행
  }

  // 3. Storage 삭제 시도 (Supabase API)
  try {
    const pathsToDelete = [fileData.storage_path]
    if (fileData.thumbnail_path) {
      // thumbnail_path가 전체 URL인 경우 경로만 추출
      const thumbPath = extractStoragePathFromUrl(fileData.thumbnail_path)
      if (thumbPath) {
        pathsToDelete.push(thumbPath)
      }
    }
    await supabase.storage.from(STORAGE_BUCKET).remove(pathsToDelete)
    physicalPathsToDelete.push(...pathsToDelete)
  } catch (storageError) {
    console.warn('Supabase Storage 삭제 실패:', storageError)
    // Storage 삭제 실패해도 물리 파일 삭제 시도
    physicalPathsToDelete.push(fileData.storage_path)
  }

  // 4. 물리적 파일 삭제 (spatial-converter를 통해)
  await deletePhysicalFiles(physicalPathsToDelete)

  // 5. DB 레코드 삭제
  const { error: deleteError } = await supabase
    .from('files')
    .delete()
    .eq('id', id)

  if (deleteError) {
    throw new Error(`삭제 실패: ${deleteError.message}`)
  }

  return { success: true, deletedAt: new Date() }
}

/**
 * 배치 파일 삭제
 * 여러 파일을 병렬로 삭제합니다.
 */
export async function deleteFilesInBatch(ids: string[]): Promise<BatchDeleteResult> {
  const results: BatchDeleteResult = {
    success: [],
    failed: [],
  }

  // 병렬 처리 (최대 5개씩)
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
 * 기존 deleteFile 함수 (하위 호환성 유지)
 * 내부적으로 deleteFileWithTransaction을 호출합니다.
 */
export async function deleteFile(id: string): Promise<void> {
  await deleteFileWithTransaction(id)
}

/**
 * Storage URL에서 경로만 추출
 */
function extractStoragePathFromUrl(url: string): string | null {
  if (!url) return null

  // 이미 경로인 경우
  if (!url.startsWith('http')) {
    return url
  }

  // URL에서 경로 추출 (예: http://host/storage/v1/object/public/spatial-files/user/file.jpg)
  try {
    const urlObj = new URL(url)
    const pathParts = urlObj.pathname.split('/')
    const bucketIndex = pathParts.findIndex(p => p === STORAGE_BUCKET)
    if (bucketIndex !== -1 && bucketIndex < pathParts.length - 1) {
      return pathParts.slice(bucketIndex + 1).join('/')
    }
    // 대체: 마지막 3개 세그먼트 사용
    return pathParts.slice(-3).join('/')
  } catch {
    // URL 파싱 실패 시 기존 방식 사용
    return url.split('/').slice(-3).join('/')
  }
}

/**
 * 배열을 청크로 분할
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

export async function updateFile(
  id: string,
  updates: Partial<Pick<FileMetadata, 'name' | 'folderId' | 'projectId' | 'tags'>>
): Promise<FileMetadata | null> {
  if (!isSupabaseConfigured()) {
    const result = await localStorage.updateFileMetadata(id, {
      name: updates.name,
      folderId: updates.folderId,
      projectId: updates.projectId,
      tags: updates.tags,
    })
    if (!result) return null
    return {
      ...result,
      projectId: result.projectId ?? null,
      storagePath: undefined,
      thumbnailUrl: result.thumbnail,
    }
  }

  const supabase = getSupabaseClient()
  const updateData: FileUpdate = {
    name: updates.name,
    folder_id: updates.folderId,
    project_id: updates.projectId,
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

// 파일 변환 상태 업데이트
export async function updateFileConversionStatus(
  id: string,
  status: 'pending' | 'converting' | 'ready' | 'failed',
  progress?: number,
  convertedPath?: string,
  error?: string
): Promise<FileMetadata | null> {
  if (!isSupabaseConfigured()) {
    // 로컬 스토리지에서는 변환 상태 지원하지 않음
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

// GPS 좌표 수정
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

// 비행경로 데이터 조회 (GPS + 촬영시각이 있는 이미지 파일)
export interface FlightPathPoint {
  fileId: string
  fileName: string
  latitude: number
  longitude: number
  altitude?: number
  datetime: string
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
    // 프로젝트에 연결된 파일만 필터
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

// === 폴더 API ===

export async function createFolder(
  name: string,
  parentId: string | null = null
): Promise<FolderData> {
  if (!isSupabaseConfigured()) {
    return await localStorage.createFolder(name, parentId)
  }

  const supabase = getSupabaseClient()
  // 개발 환경에서는 인증 없이 진행 (user_id는 nullable)
  const { data: { user } } = await supabase.auth.getUser()

  const insertData: FolderInsert = {
    name,
    parent_id: parentId,
    user_id: user?.id ?? null,
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

// 파일 확장자에서 MIME 타입 추출
// 3D 파일은 Supabase Storage 호환성을 위해 application/octet-stream 사용
function getMimeTypeFromExtension(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()

  // 3D 모델 포맷은 모두 application/octet-stream 사용 (Supabase Storage 호환성)
  if (ext && (ALL_3D_FORMATS as readonly string[]).includes(ext)) {
    return 'application/octet-stream'
  }

  const mimeTypes: Record<string, string> = {
    // 이미지
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    tiff: 'image/tiff',
    tif: 'image/tiff',
  }
  return mimeTypes[ext || ''] || 'application/octet-stream'
}

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
  if (!isSupabaseConfigured()) return
  const supabase = getSupabaseClient()
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

// === 프로젝트 API ===

export async function createProject(
  name: string,
  description: string | null = null,
  tags: string[] = []
): Promise<ProjectData> {
  if (!isSupabaseConfigured()) {
    return await localStorage.createProject(name, description, tags)
  }

  const supabase = getSupabaseClient()
  // 개발 환경에서는 인증 없이 진행 (user_id는 nullable)
  const { data: { user } } = await supabase.auth.getUser()

  const insertData: ProjectInsert = {
    name,
    description,
    user_id: user?.id ?? null,
    status: 'active',
    tags,
  }

  const { data, error } = await supabase
    .from('projects')
    .insert(insertData as never)
    .select()
    .single()

  if (error || !data) {
    throw new Error(`프로젝트 생성 실패: ${error?.message}`)
  }

  return mapProjectRowToData(data as ProjectRow)
}

export async function getProjects(): Promise<ProjectData[]> {
  if (!isSupabaseConfigured()) {
    return await localStorage.getAllProjects()
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) {
    throw new Error(`프로젝트 목록 조회 실패: ${error.message}`)
  }

  return ((data || []) as ProjectRow[]).map(mapProjectRowToData)
}

export async function getProject(id: string): Promise<ProjectData | null> {
  if (!isSupabaseConfigured()) {
    return await localStorage.getProject(id)
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) {
    return null
  }

  return mapProjectRowToData(data as ProjectRow)
}

export async function updateProject(
  id: string,
  updates: Partial<Pick<ProjectData, 'name' | 'description' | 'thumbnailUrl' | 'status' | 'tags'>>
): Promise<ProjectData | null> {
  if (!isSupabaseConfigured()) {
    return await localStorage.updateProject(id, updates)
  }

  const supabase = getSupabaseClient()
  const updateData: ProjectUpdate = {
    name: updates.name,
    description: updates.description,
    thumbnail_url: updates.thumbnailUrl,
  }

  const { data, error } = await supabase
    .from('projects')
    .update(updateData as never)
    .eq('id', id)
    .select()
    .single()

  if (error || !data) {
    return null
  }

  const project = mapProjectRowToData(data as ProjectRow)
  // Supabase에 저장되지 않는 필드들은 updates에서 가져옴
  return {
    ...project,
    status: updates.status ?? project.status,
    tags: updates.tags ?? project.tags,
  }
}

export async function deleteProject(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    await localStorage.deleteProject(id)
    return
  }

  const supabase = getSupabaseClient()
  const { error } = await supabase.from('projects').delete().eq('id', id)

  if (error) {
    throw new Error(`프로젝트 삭제 실패: ${error.message}`)
  }
}

// === 어노테이션 API ===

export async function createAnnotation(
  data: Omit<AnnotationData, 'id' | 'createdAt' | 'updatedAt'>
): Promise<AnnotationData> {
  if (!isSupabaseConfigured()) {
    return await localStorage.createAnnotation(data)
  }

  const supabase = getSupabaseClient()
  // 개발 환경에서는 인증 없이 진행 (user_id는 nullable)
  const { data: { user } } = await supabase.auth.getUser()

  const insertData: AnnotationInsert = {
    project_id: data.projectId,
    title: data.title,
    description: data.description,
    priority: data.priority,
    status: data.status,
    position_x: data.position?.x,
    position_y: data.position?.y,
    position_z: data.position?.z,
    gps_latitude: data.gps?.latitude,
    gps_longitude: data.gps?.longitude,
    file_id: data.fileId,
    user_id: user?.id ?? null,
  }

  const { data: result, error } = await supabase
    .from('annotations')
    .insert(insertData as never)
    .select()
    .single()

  if (error || !result) {
    throw new Error(`어노테이션 생성 실패: ${error?.message}`)
  }

  return mapAnnotationRowToData(result as AnnotationRow)
}

export async function getAnnotations(projectId?: string | null): Promise<AnnotationData[]> {
  if (!isSupabaseConfigured()) {
    if (projectId !== undefined) {
      return await localStorage.getAnnotationsByProject(projectId)
    }
    return await localStorage.getAllAnnotations()
  }

  const supabase = getSupabaseClient()
  let query = supabase.from('annotations').select('*').order('updated_at', { ascending: false })

  if (projectId !== undefined) {
    if (projectId === null) {
      query = query.is('project_id', null)
    } else {
      query = query.eq('project_id', projectId)
    }
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`어노테이션 목록 조회 실패: ${error.message}`)
  }

  return ((data || []) as AnnotationRow[]).map(mapAnnotationRowToData)
}

export async function getAnnotation(id: string): Promise<AnnotationData | null> {
  if (!isSupabaseConfigured()) {
    return await localStorage.getAnnotation(id)
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('annotations')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) {
    return null
  }

  return mapAnnotationRowToData(data as AnnotationRow)
}

export async function updateAnnotation(
  id: string,
  updates: Partial<Omit<AnnotationData, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<AnnotationData | null> {
  if (!isSupabaseConfigured()) {
    return await localStorage.updateAnnotation(id, updates)
  }

  const supabase = getSupabaseClient()
  const updateData: AnnotationUpdate = {
    title: updates.title,
    description: updates.description,
    priority: updates.priority,
    status: updates.status,
    position_x: updates.position?.x,
    position_y: updates.position?.y,
    position_z: updates.position?.z,
    gps_latitude: updates.gps?.latitude,
    gps_longitude: updates.gps?.longitude,
    file_id: updates.fileId,
    project_id: updates.projectId ?? undefined,
  }

  const { data, error } = await supabase
    .from('annotations')
    .update(updateData as never)
    .eq('id', id)
    .select()
    .single()

  if (error || !data) {
    return null
  }

  return mapAnnotationRowToData(data as AnnotationRow)
}

export async function deleteAnnotation(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    await localStorage.deleteAnnotation(id)
    return
  }

  const supabase = getSupabaseClient()
  const { error } = await supabase.from('annotations').delete().eq('id', id)

  if (error) {
    throw new Error(`어노테이션 삭제 실패: ${error.message}`)
  }
}

// 백엔드 연결 상태
export function isBackendConnected(): boolean {
  return isSupabaseConfigured()
}

// === 프로젝트-파일 연결 API ===

export async function getFilesByProject(projectId: string): Promise<FileMetadata[]> {
  if (!isSupabaseConfigured()) {
    const localFiles = await localStorage.getFilesByProject(projectId)
    return localFiles.map(f => ({
      ...f,
      projectId: f.projectId ?? null,
      storagePath: undefined,
      thumbnailUrl: f.thumbnail,
    }))
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
    await localStorage.linkFilesToProject(fileIds, projectId)
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
    await localStorage.unlinkFilesFromProject(fileIds)
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

// === Share Token API ===

const SHARE_TOKENS_KEY = 'spatial-log-share-tokens'

interface ShareTokenEntry {
  token: string
  publishId: string
  createdAt: string
  isPublic: boolean
}

function getShareTokensFromStorage(): ShareTokenEntry[] {
  try {
    return JSON.parse(window.localStorage.getItem(SHARE_TOKENS_KEY) || '[]')
  } catch {
    return []
  }
}

function saveShareTokensToStorage(tokens: ShareTokenEntry[]): void {
  window.localStorage.setItem(SHARE_TOKENS_KEY, JSON.stringify(tokens))
}

/**
 * 공유 토큰 생성
 */
export async function generateShareToken(publishId: string): Promise<string> {
  const token = localStorage.generateId()
  const tokens = getShareTokensFromStorage()

  // 기존 토큰이 있으면 재사용
  const existing = tokens.find((t) => t.publishId === publishId)
  if (existing) {
    existing.isPublic = true
    saveShareTokensToStorage(tokens)
    return existing.token
  }

  tokens.push({
    token,
    publishId,
    createdAt: new Date().toISOString(),
    isPublic: true,
  })
  saveShareTokensToStorage(tokens)
  return token
}

/**
 * 토큰으로 Publish 조회
 */
export async function getPublishByShareToken(token: string): Promise<{
  project: ProjectData
  files: FileMetadata[]
  annotations: AnnotationData[]
} | null> {
  const tokens = getShareTokensFromStorage()
  const entry = tokens.find((t) => t.token === token && t.isPublic)
  if (!entry) return null

  try {
    const project = await getProject(entry.publishId)
    if (!project) return null

    const files = await getFilesByProject(entry.publishId)
    const annotations = await getAnnotations(entry.publishId)

    return { project, files, annotations }
  } catch {
    return null
  }
}

/**
 * 공유 토큰 비활성화
 */
export async function revokeShareToken(publishId: string): Promise<void> {
  const tokens = getShareTokensFromStorage()
  const entry = tokens.find((t) => t.publishId === publishId)
  if (entry) {
    entry.isPublic = false
    saveShareTokensToStorage(tokens)
  }
}

/**
 * Publish의 공유 상태 조회
 */
export function getShareStatus(publishId: string): { isShared: boolean; token: string | null } {
  const tokens = getShareTokensFromStorage()
  const entry = tokens.find((t) => t.publishId === publishId && t.isPublic)
  return {
    isShared: !!entry,
    token: entry?.token || null,
  }
}

// === Story / Scene / Entry / Release API ===

// --- Row Mappers ---

function mapStoryRowToData(row: StoryRow): StoryData {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: (row.status as StoryStatus) ?? 'draft',
    tags: row.tags ?? [],
    coverFileId: row.cover_file_id,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

function mapSceneRowToData(row: SceneRow): SceneData {
  return {
    id: row.id,
    storyId: row.story_id,
    title: row.title,
    zoneLabel: row.zone_label ?? null,
    summary: row.summary ?? null,
    sortOrder: row.sort_order,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

function mapSceneEntryRowToData(row: SceneEntryRow): SceneEntryData {
  return {
    id: row.id,
    sceneId: row.scene_id,
    fileId: row.file_id,
    entryType: (row.entry_type as SceneEntryType) ?? 'note',
    title: row.title,
    body: row.body,
    url: row.url ?? null,
    gps: row.gps_latitude != null && row.gps_longitude != null
      ? { latitude: row.gps_latitude, longitude: row.gps_longitude }
      : null,
    spatialAnchor: row.spatial_anchor ?? null,
    sortOrder: row.sort_order,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

/** 파일 포맷에서 Entry 타입 자동 감지 */
export function detectEntryTypeFromFormat(format: string): SceneEntryType {
  const spatialFormats = ['gltf', 'glb', 'obj', 'fbx', 'ply', 'las', 'e57', '3dtiles', 'splat']
  if (spatialFormats.includes(format)) return 'spatial'
  if (format === 'image') return 'visual'
  return 'document'
}

function mapReleaseRowToData(row: ReleaseRow): ReleaseData {
  return {
    id: row.id,
    storyId: row.story_id,
    version: row.version,
    label: row.label,
    snapshot: row.snapshot as unknown as ReleaseSnapshot,
    manifest: row.manifest as unknown as ReleaseManifest,
    accessType: (row.access_type as AccessType) ?? 'private',
    shareToken: row.share_token,
    status: (row.status as ReleaseStatus) ?? 'active',
    createdAt: new Date(row.created_at),
  }
}

// --- localStorage fallback keys ---

const STORIES_KEY = 'spatial-log-stories'
const SCENES_KEY = 'spatial-log-scenes'
const SCENE_ENTRIES_KEY = 'spatial-log-scene-entries'
const RELEASES_KEY = 'spatial-log-releases'

const DATE_FIELDS = ['createdAt', 'updatedAt'] as const

function getLocalItems<T>(key: string): T[] {
  try {
    const items = JSON.parse(window.localStorage.getItem(key) || '[]') as T[]
    // JSON.parse는 Date를 string으로 역직렬화하므로 Date 필드 복원
    for (const item of items) {
      if (item && typeof item === 'object') {
        for (const field of DATE_FIELDS) {
          const val = (item as Record<string, unknown>)[field]
          if (typeof val === 'string') {
            (item as Record<string, unknown>)[field] = new Date(val)
          }
        }
      }
    }
    return items
  } catch {
    return []
  }
}

function setLocalItems<T>(key: string, items: T[]): void {
  window.localStorage.setItem(key, JSON.stringify(items))
}

// === Story CRUD ===

export async function createStory(
  title: string,
  description: string | null = null,
  tags: string[] = []
): Promise<StoryData> {
  if (!isSupabaseConfigured()) {
    const now = new Date()
    const story: StoryData = {
      id: localStorage.generateId(),
      title,
      description,
      status: 'draft',
      tags,
      coverFileId: null,
      createdAt: now,
      updatedAt: now,
    }
    const items = getLocalItems<StoryData>(STORIES_KEY)
    items.unshift(story)
    setLocalItems(STORIES_KEY, items)
    return story
  }

  const supabase = getSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const insertData: StoryInsert = {
    title,
    description,
    tags,
    user_id: user?.id ?? null,
  }

  const { data, error } = await supabase
    .from('stories')
    .insert(insertData as never)
    .select()
    .single()

  if (error || !data) {
    throw new Error(`Story 생성 실패: ${error?.message}`)
  }

  return mapStoryRowToData(data as StoryRow)
}

export async function getStories(): Promise<StoryData[]> {
  if (!isSupabaseConfigured()) {
    return getLocalItems<StoryData>(STORIES_KEY)
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('stories')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) {
    throw new Error(`Story 목록 조회 실패: ${error.message}`)
  }

  return ((data || []) as StoryRow[]).map(mapStoryRowToData)
}

export async function getSceneCountsByStories(storyIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  if (storyIds.length === 0) return counts

  if (!isSupabaseConfigured()) {
    const scenes = getLocalItems<SceneData>(SCENES_KEY)
    for (const id of storyIds) {
      counts.set(id, scenes.filter(s => s.storyId === id).length)
    }
    return counts
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('scenes')
    .select('story_id')
    .in('story_id', storyIds)

  if (error) {
    console.error('Scene count 조회 실패:', error.message)
    return counts
  }

  for (const row of ((data || []) as Array<{ story_id: string }>)) {
    counts.set(row.story_id, (counts.get(row.story_id) || 0) + 1)
  }
  return counts
}

export async function getStory(id: string): Promise<StoryData | null> {
  if (!isSupabaseConfigured()) {
    const items = getLocalItems<StoryData>(STORIES_KEY)
    return items.find(s => s.id === id) ?? null
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('stories')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) return null
  return mapStoryRowToData(data as StoryRow)
}

export async function updateStory(
  id: string,
  updates: Partial<Pick<StoryData, 'title' | 'description' | 'status' | 'tags' | 'coverFileId'>>
): Promise<StoryData | null> {
  if (!isSupabaseConfigured()) {
    const items = getLocalItems<StoryData>(STORIES_KEY)
    const idx = items.findIndex(s => s.id === id)
    if (idx === -1) return null
    const current = items[idx]!
    const updated = { ...current, ...updates, updatedAt: new Date() }
    items[idx] = updated
    setLocalItems(STORIES_KEY, items)
    return updated
  }

  const supabase = getSupabaseClient()
  const updateData: StoryUpdate = {
    title: updates.title,
    description: updates.description,
    status: updates.status,
    tags: updates.tags,
    cover_file_id: updates.coverFileId,
  }

  const { data, error } = await supabase
    .from('stories')
    .update(updateData as never)
    .eq('id', id)
    .select()
    .single()

  if (error || !data) return null
  return mapStoryRowToData(data as StoryRow)
}

export async function deleteStory(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    // 로컬: Story + 관련 Scenes + Entries + Releases 모두 삭제
    const stories = getLocalItems<StoryData>(STORIES_KEY)
    setLocalItems(STORIES_KEY, stories.filter(s => s.id !== id))

    const scenes = getLocalItems<SceneData>(SCENES_KEY)
    const sceneIds = scenes.filter(s => s.storyId === id).map(s => s.id)
    setLocalItems(SCENES_KEY, scenes.filter(s => s.storyId !== id))

    const entries = getLocalItems<SceneEntryData>(SCENE_ENTRIES_KEY)
    setLocalItems(SCENE_ENTRIES_KEY, entries.filter(e => !sceneIds.includes(e.sceneId)))

    const releases = getLocalItems<ReleaseData>(RELEASES_KEY)
    setLocalItems(RELEASES_KEY, releases.filter(r => r.storyId !== id))
    return
  }

  const supabase = getSupabaseClient()
  const { error } = await supabase.from('stories').delete().eq('id', id)
  if (error) {
    throw new Error(`Story 삭제 실패: ${error.message}`)
  }
}

// === Scene CRUD ===

export async function getScenesByStory(storyId: string): Promise<SceneData[]> {
  if (!isSupabaseConfigured()) {
    return getLocalItems<SceneData>(SCENES_KEY)
      .filter(s => s.storyId === storyId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('scenes')
    .select('*')
    .eq('story_id', storyId)
    .order('sort_order', { ascending: true })

  if (error) {
    throw new Error(`Scene 목록 조회 실패: ${error.message}`)
  }

  return ((data || []) as SceneRow[]).map(mapSceneRowToData)
}

export async function createScene(
  storyId: string,
  title: string,
  sortOrder?: number,
  options?: { zoneLabel?: string | null; summary?: string | null }
): Promise<SceneData> {
  if (!isSupabaseConfigured()) {
    const items = getLocalItems<SceneData>(SCENES_KEY)
    const existingScenes = items.filter(s => s.storyId === storyId)
    const now = new Date()
    const scene: SceneData = {
      id: localStorage.generateId(),
      storyId,
      title,
      zoneLabel: options?.zoneLabel ?? null,
      summary: options?.summary ?? null,
      sortOrder: sortOrder ?? existingScenes.length,
      createdAt: now,
      updatedAt: now,
    }
    items.push(scene)
    setLocalItems(SCENES_KEY, items)
    return scene
  }

  const supabase = getSupabaseClient()

  // sortOrder 자동 계산
  let order = sortOrder
  if (order === undefined) {
    const { data: existing } = await supabase
      .from('scenes')
      .select('sort_order')
      .eq('story_id', storyId)
      .order('sort_order', { ascending: false })
      .limit(1)
    const first = existing?.[0] as { sort_order: number } | undefined
    order = first ? first.sort_order + 1 : 0
  }

  const insertData: SceneInsert = {
    story_id: storyId,
    title,
    zone_label: options?.zoneLabel ?? null,
    summary: options?.summary ?? null,
    sort_order: order,
  }

  const { data, error } = await supabase
    .from('scenes')
    .insert(insertData as never)
    .select()
    .single()

  if (error || !data) {
    throw new Error(`Scene 생성 실패: ${error?.message}`)
  }

  return mapSceneRowToData(data as SceneRow)
}

export async function updateScene(
  id: string,
  updates: Partial<Pick<SceneData, 'title' | 'sortOrder' | 'zoneLabel' | 'summary'>>
): Promise<SceneData | null> {
  if (!isSupabaseConfigured()) {
    const items = getLocalItems<SceneData>(SCENES_KEY)
    const idx = items.findIndex(s => s.id === id)
    if (idx === -1) return null
    const current = items[idx]!
    if (updates.title !== undefined) current.title = updates.title
    if (updates.sortOrder !== undefined) current.sortOrder = updates.sortOrder
    if (updates.zoneLabel !== undefined) current.zoneLabel = updates.zoneLabel
    if (updates.summary !== undefined) current.summary = updates.summary
    current.updatedAt = new Date()
    setLocalItems(SCENES_KEY, items)
    return current
  }

  const supabase = getSupabaseClient()
  const updateData: SceneUpdate = {
    title: updates.title,
    sort_order: updates.sortOrder,
    zone_label: updates.zoneLabel,
    summary: updates.summary,
  }

  const { data, error } = await supabase
    .from('scenes')
    .update(updateData as never)
    .eq('id', id)
    .select()
    .single()

  if (error || !data) return null
  return mapSceneRowToData(data as SceneRow)
}

export async function deleteScene(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    const scenes = getLocalItems<SceneData>(SCENES_KEY)
    setLocalItems(SCENES_KEY, scenes.filter(s => s.id !== id))
    const entries = getLocalItems<SceneEntryData>(SCENE_ENTRIES_KEY)
    setLocalItems(SCENE_ENTRIES_KEY, entries.filter(e => e.sceneId !== id))
    return
  }

  const supabase = getSupabaseClient()
  const { error } = await supabase.from('scenes').delete().eq('id', id)
  if (error) {
    throw new Error(`Scene 삭제 실패: ${error.message}`)
  }
}

export async function reorderScenes(storyId: string, orderedIds: string[]): Promise<void> {
  if (!isSupabaseConfigured()) {
    const items = getLocalItems<SceneData>(SCENES_KEY)
    orderedIds.forEach((id, index) => {
      const scene = items.find(s => s.id === id)
      if (scene) scene.sortOrder = index
    })
    setLocalItems(SCENES_KEY, items)
    return
  }

  const supabase = getSupabaseClient()
  const updates = orderedIds.map((id, index) =>
    supabase.from('scenes').update({ sort_order: index } as never).eq('id', id).eq('story_id', storyId)
  )
  await Promise.all(updates)
}

// === Scene Entry CRUD ===

export async function getEntriesByScene(sceneId: string): Promise<SceneEntryData[]> {
  if (!isSupabaseConfigured()) {
    return getLocalItems<SceneEntryData>(SCENE_ENTRIES_KEY)
      .filter(e => e.sceneId === sceneId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('scene_entries')
    .select('*')
    .eq('scene_id', sceneId)
    .order('sort_order', { ascending: true })

  if (error) {
    throw new Error(`Entry 목록 조회 실패: ${error.message}`)
  }

  return ((data || []) as SceneEntryRow[]).map(mapSceneEntryRowToData)
}

export async function getEntriesByStory(storyId: string): Promise<Map<string, SceneEntryData[]>> {
  const result = new Map<string, SceneEntryData[]>()

  if (!isSupabaseConfigured()) {
    const scenes = getLocalItems<SceneData>(SCENES_KEY).filter(s => s.storyId === storyId)
    const entries = getLocalItems<SceneEntryData>(SCENE_ENTRIES_KEY)
    for (const scene of scenes) {
      result.set(
        scene.id,
        entries.filter(e => e.sceneId === scene.id).sort((a, b) => a.sortOrder - b.sortOrder)
      )
    }
    return result
  }

  const supabase = getSupabaseClient()

  // Scene IDs 조회
  const { data: sceneData } = await supabase
    .from('scenes')
    .select('id')
    .eq('story_id', storyId)

  if (!sceneData || sceneData.length === 0) return result

  const sceneIds = (sceneData as { id: string }[]).map(s => s.id)

  const { data, error } = await supabase
    .from('scene_entries')
    .select('*')
    .in('scene_id', sceneIds)
    .order('sort_order', { ascending: true })

  if (error) {
    throw new Error(`Entry 일괄 조회 실패: ${error.message}`)
  }

  // Scene별로 그룹핑
  for (const sceneId of sceneIds) {
    result.set(sceneId, [])
  }
  for (const row of (data || []) as SceneEntryRow[]) {
    const entry = mapSceneEntryRowToData(row)
    const list = result.get(entry.sceneId) || []
    list.push(entry)
    result.set(entry.sceneId, list)
  }

  return result
}

export async function createSceneEntry(
  sceneId: string,
  entryData: {
    entryType: SceneEntryType
    fileId?: string | null
    title?: string | null
    body?: string | null
    url?: string | null
    gps?: { latitude: number; longitude: number } | null
    spatialAnchor?: { x: number; y: number; z: number } | null
  }
): Promise<SceneEntryData> {
  if (!isSupabaseConfigured()) {
    const items = getLocalItems<SceneEntryData>(SCENE_ENTRIES_KEY)
    const existingEntries = items.filter(e => e.sceneId === sceneId)
    const now = new Date()
    const entry: SceneEntryData = {
      id: localStorage.generateId(),
      sceneId,
      fileId: entryData.fileId ?? null,
      entryType: entryData.entryType,
      title: entryData.title ?? null,
      body: entryData.body ?? null,
      url: entryData.url ?? null,
      gps: entryData.gps ?? null,
      spatialAnchor: entryData.spatialAnchor ?? null,
      sortOrder: existingEntries.length,
      createdAt: now,
      updatedAt: now,
    }
    items.push(entry)
    setLocalItems(SCENE_ENTRIES_KEY, items)
    return entry
  }

  const supabase = getSupabaseClient()

  // sortOrder 자동 계산
  const { data: existing } = await supabase
    .from('scene_entries')
    .select('sort_order')
    .eq('scene_id', sceneId)
    .order('sort_order', { ascending: false })
    .limit(1)
  const firstEntry = existing?.[0] as { sort_order: number } | undefined
  const nextOrder = firstEntry ? firstEntry.sort_order + 1 : 0

  const insertData: SceneEntryInsert = {
    scene_id: sceneId,
    entry_type: entryData.entryType,
    file_id: entryData.fileId ?? null,
    title: entryData.title ?? null,
    body: entryData.body ?? null,
    url: entryData.url ?? null,
    gps_latitude: entryData.gps?.latitude ?? null,
    gps_longitude: entryData.gps?.longitude ?? null,
    spatial_anchor: entryData.spatialAnchor ? JSON.parse(JSON.stringify(entryData.spatialAnchor)) : null,
    sort_order: nextOrder,
  }

  const { data, error } = await supabase
    .from('scene_entries')
    .insert(insertData as never)
    .select()
    .single()

  if (error || !data) {
    throw new Error(`Entry 생성 실패: ${error?.message}`)
  }

  return mapSceneEntryRowToData(data as SceneEntryRow)
}

export async function updateSceneEntry(
  id: string,
  updates: Partial<Pick<SceneEntryData, 'title' | 'body' | 'url' | 'gps' | 'spatialAnchor' | 'sortOrder' | 'fileId'>>
): Promise<SceneEntryData | null> {
  if (!isSupabaseConfigured()) {
    const items = getLocalItems<SceneEntryData>(SCENE_ENTRIES_KEY)
    const idx = items.findIndex(e => e.id === id)
    if (idx === -1) return null
    const current = items[idx]!
    if (updates.title !== undefined) current.title = updates.title
    if (updates.body !== undefined) current.body = updates.body
    if (updates.url !== undefined) current.url = updates.url
    if (updates.gps !== undefined) current.gps = updates.gps
    if (updates.spatialAnchor !== undefined) current.spatialAnchor = updates.spatialAnchor
    if (updates.sortOrder !== undefined) current.sortOrder = updates.sortOrder
    if (updates.fileId !== undefined) current.fileId = updates.fileId
    current.updatedAt = new Date()
    setLocalItems(SCENE_ENTRIES_KEY, items)
    return current
  }

  const supabase = getSupabaseClient()
  const updateData: SceneEntryUpdate = {
    title: updates.title,
    body: updates.body,
    url: updates.url,
    gps_latitude: updates.gps !== undefined ? (updates.gps?.latitude ?? null) : undefined,
    gps_longitude: updates.gps !== undefined ? (updates.gps?.longitude ?? null) : undefined,
    spatial_anchor: updates.spatialAnchor !== undefined
      ? (updates.spatialAnchor ? JSON.parse(JSON.stringify(updates.spatialAnchor)) : null)
      : undefined,
    sort_order: updates.sortOrder,
    file_id: updates.fileId,
  }

  const { data, error } = await supabase
    .from('scene_entries')
    .update(updateData as never)
    .eq('id', id)
    .select()
    .single()

  if (error || !data) return null
  return mapSceneEntryRowToData(data as SceneEntryRow)
}

export async function deleteSceneEntry(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    const items = getLocalItems<SceneEntryData>(SCENE_ENTRIES_KEY)
    setLocalItems(SCENE_ENTRIES_KEY, items.filter(e => e.id !== id))
    return
  }

  const supabase = getSupabaseClient()
  const { error } = await supabase.from('scene_entries').delete().eq('id', id)
  if (error) {
    throw new Error(`Entry 삭제 실패: ${error.message}`)
  }
}

export async function reorderEntries(sceneId: string, orderedIds: string[]): Promise<void> {
  if (!isSupabaseConfigured()) {
    const items = getLocalItems<SceneEntryData>(SCENE_ENTRIES_KEY)
    orderedIds.forEach((id, index) => {
      const entry = items.find(e => e.id === id)
      if (entry) entry.sortOrder = index
    })
    setLocalItems(SCENE_ENTRIES_KEY, items)
    return
  }

  const supabase = getSupabaseClient()
  const updates = orderedIds.map((id, index) =>
    supabase.from('scene_entries').update({ sort_order: index } as never).eq('id', id).eq('scene_id', sceneId)
  )
  await Promise.all(updates)
}

// === Release CRUD ===

export async function createRelease(
  storyId: string,
  snapshot: ReleaseSnapshot,
  manifest: ReleaseManifest,
  options: { label?: string; accessType?: AccessType }
): Promise<ReleaseData> {
  const accessType = options.accessType ?? 'private'
  const shareToken = accessType === 'public' ? localStorage.generateId() : null

  if (!isSupabaseConfigured()) {
    const items = getLocalItems<ReleaseData>(RELEASES_KEY)
    const existingVersions = items.filter(r => r.storyId === storyId)
    const release: ReleaseData = {
      id: localStorage.generateId(),
      storyId,
      version: existingVersions.length + 1,
      label: options.label ?? null,
      snapshot,
      manifest,
      accessType,
      shareToken,
      status: 'active',
      createdAt: new Date(),
    }
    items.unshift(release)
    setLocalItems(RELEASES_KEY, items)
    return release
  }

  const supabase = getSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  // 버전 자동 계산
  const { data: existing } = await supabase
    .from('releases')
    .select('version')
    .eq('story_id', storyId)
    .order('version', { ascending: false })
    .limit(1)
  const firstRelease = existing?.[0] as { version: number } | undefined
  const nextVersion = firstRelease ? firstRelease.version + 1 : 1

  const insertData: ReleaseInsert = {
    story_id: storyId,
    user_id: user?.id ?? null,
    version: nextVersion,
    label: options.label ?? null,
    snapshot: JSON.parse(JSON.stringify(snapshot)),
    manifest: JSON.parse(JSON.stringify(manifest)),
    access_type: accessType,
    share_token: shareToken,
  }

  const { data, error } = await supabase
    .from('releases')
    .insert(insertData as never)
    .select()
    .single()

  if (error || !data) {
    throw new Error(`Release 생성 실패: ${error?.message}`)
  }

  return mapReleaseRowToData(data as ReleaseRow)
}

export async function getAllReleases(): Promise<ReleaseData[]> {
  if (!isSupabaseConfigured()) {
    return getLocalItems<ReleaseData>(RELEASES_KEY)
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('releases')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Release 목록 조회 실패: ${error.message}`)
  }

  return ((data || []) as ReleaseRow[]).map(mapReleaseRowToData)
}

export async function getReleasesByStory(storyId: string): Promise<ReleaseData[]> {
  if (!isSupabaseConfigured()) {
    return getLocalItems<ReleaseData>(RELEASES_KEY)
      .filter(r => r.storyId === storyId)
      .sort((a, b) => b.version - a.version)
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('releases')
    .select('*')
    .eq('story_id', storyId)
    .order('version', { ascending: false })

  if (error) {
    throw new Error(`Release 목록 조회 실패: ${error.message}`)
  }

  return ((data || []) as ReleaseRow[]).map(mapReleaseRowToData)
}

export async function getRelease(id: string): Promise<ReleaseData | null> {
  if (!isSupabaseConfigured()) {
    const items = getLocalItems<ReleaseData>(RELEASES_KEY)
    return items.find(r => r.id === id) ?? null
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('releases')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) return null
  return mapReleaseRowToData(data as ReleaseRow)
}

export async function getReleaseByShareToken(token: string): Promise<ReleaseData | null> {
  if (!isSupabaseConfigured()) {
    const items = getLocalItems<ReleaseData>(RELEASES_KEY)
    return items.find(r => r.shareToken === token && r.accessType === 'public' && r.status === 'active') ?? null
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('releases')
    .select('*')
    .eq('share_token', token)
    .eq('access_type', 'public')
    .eq('status', 'active')
    .single()

  if (error || !data) return null
  return mapReleaseRowToData(data as ReleaseRow)
}

export async function revokeRelease(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    const items = getLocalItems<ReleaseData>(RELEASES_KEY)
    const release = items.find(r => r.id === id)
    if (release) {
      release.status = 'revoked'
      setLocalItems(RELEASES_KEY, items)
    }
    return
  }

  const supabase = getSupabaseClient()
  const { error } = await supabase
    .from('releases')
    .update({ status: 'revoked' } as never)
    .eq('id', id)

  if (error) {
    throw new Error(`Release 취소 실패: ${error.message}`)
  }
}

// === localStorage 마이그레이션: entry type refactor ===

const MIGRATION_KEY = 'spatial-log-entry-type-migrated'

export function migrateLocalStorageEntryTypes(): void {
  if (window.localStorage.getItem(MIGRATION_KEY)) return

  try {
    // Scene 마이그레이션: zoneLabel, summary 추가
    const scenes = getLocalItems<SceneData & { zoneLabel?: string | null; summary?: string | null }>(SCENES_KEY)
    for (const scene of scenes) {
      if (scene.zoneLabel === undefined) scene.zoneLabel = null
      if (scene.summary === undefined) scene.summary = null
    }
    setLocalItems(SCENES_KEY, scenes)

    // Entry 마이그레이션: asset/memo → 4종 + url 추가
    const entries = getLocalItems<SceneEntryData & { url?: string | null }>(SCENE_ENTRIES_KEY)
    const files = getLocalItems<{ id: string; format: string }>('spatial-log-files')
    for (const entry of entries) {
      if (entry.url === undefined) entry.url = null
      if ((entry.entryType as string) === 'memo') {
        entry.entryType = 'note'
      } else if ((entry.entryType as string) === 'asset') {
        if (entry.fileId) {
          const file = files.find(f => f.id === entry.fileId)
          entry.entryType = file ? detectEntryTypeFromFormat(file.format) : 'spatial'
        } else {
          entry.entryType = 'note'
        }
      }
    }
    setLocalItems(SCENE_ENTRIES_KEY, entries)

    window.localStorage.setItem(MIGRATION_KEY, '1')
  } catch (err) {
    console.error('localStorage 마이그레이션 실패:', err)
  }
}
