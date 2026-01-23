// ZIP 파일 업로드 서비스
// OBJ+MTL+텍스처 등 연관 파일을 하나의 그룹으로 처리합니다.

import JSZip from 'jszip'
import { getSupabaseClient, isSupabaseConfigured, STORAGE_BUCKET } from '@/lib/supabase'
import type { FileRow, FileFormat } from '@/lib/database.types'

// 연관 파일 그룹 타입
export interface RelatedFileGroup {
  mainFile: {
    name: string
    data: ArrayBuffer
    format: FileFormat
  }
  relatedFiles: {
    name: string
    data: ArrayBuffer
    type: 'material' | 'texture' | 'other'
  }[]
  groupId: string
}

// ZIP 업로드 결과
export interface ZipUploadResult {
  success: boolean
  groupId: string
  mainFileId: string
  mainFileName: string
  relatedCount: number
  error?: string
}

// 지원하는 3D 모델 포맷
const MODEL_EXTENSIONS = ['.obj', '.fbx', '.gltf', '.glb', '.ply', '.las', '.e57']

// 재질 파일 확장자
const MATERIAL_EXTENSIONS = ['.mtl']

// 텍스처 파일 확장자
const TEXTURE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.tiff', '.tif', '.bmp', '.dds', '.ktx', '.ktx2']

// 파일 확장자로 포맷 결정
function detectFormat(filename: string): FileFormat {
  const ext = filename.toLowerCase().split('.').pop() || ''
  switch (ext) {
    case 'obj': return 'obj'
    case 'fbx': return 'fbx'
    case 'gltf': return 'gltf'
    case 'glb': return 'glb'
    case 'ply': return 'ply'
    case 'las': return 'las'
    case 'e57': return 'e57'
    default: return 'other'
  }
}

// 파일 타입 분류
function classifyFile(filename: string): 'model' | 'material' | 'texture' | 'other' {
  const ext = '.' + filename.toLowerCase().split('.').pop()

  if (MODEL_EXTENSIONS.includes(ext)) return 'model'
  if (MATERIAL_EXTENSIONS.includes(ext)) return 'material'
  if (TEXTURE_EXTENSIONS.includes(ext)) return 'texture'
  return 'other'
}

// UUID 생성 함수
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * ZIP 파일을 파싱하여 연관 파일 그룹으로 변환
 */
export async function parseZipFile(zipFile: File): Promise<RelatedFileGroup> {
  const zip = await JSZip.loadAsync(zipFile)
  const groupId = generateUUID()

  let mainFile: RelatedFileGroup['mainFile'] | null = null
  const relatedFiles: RelatedFileGroup['relatedFiles'] = []

  // 모든 파일 추출
  const filePromises: Promise<void>[] = []

  zip.forEach((relativePath, zipEntry) => {
    if (zipEntry.dir) return // 디렉토리 스킵

    const filename = relativePath.split('/').pop() || relativePath
    if (filename.startsWith('.')) return // 숨김 파일 스킵

    const promise = zipEntry.async('arraybuffer').then((data) => {
      const fileType = classifyFile(filename)

      if (fileType === 'model') {
        // 메인 모델 파일 (첫 번째 발견된 것 사용)
        if (!mainFile) {
          mainFile = {
            name: filename,
            data,
            format: detectFormat(filename),
          }
        } else {
          // 추가 모델 파일은 related로 처리
          relatedFiles.push({
            name: filename,
            data,
            type: 'other',
          })
        }
      } else if (fileType === 'material') {
        relatedFiles.push({
          name: filename,
          data,
          type: 'material',
        })
      } else if (fileType === 'texture') {
        relatedFiles.push({
          name: filename,
          data,
          type: 'texture',
        })
      } else {
        relatedFiles.push({
          name: filename,
          data,
          type: 'other',
        })
      }
    })

    filePromises.push(promise)
  })

  await Promise.all(filePromises)

  if (!mainFile) {
    throw new Error('ZIP 파일에 지원하는 3D 모델 파일이 없습니다. (OBJ, FBX, GLTF, GLB, PLY, LAS, E57)')
  }

  return {
    mainFile,
    relatedFiles,
    groupId,
  }
}

/**
 * 연관 파일 그룹을 Storage에 업로드
 */
export async function uploadFileGroup(
  group: RelatedFileGroup,
  onProgress?: (progress: { current: number; total: number; filename: string }) => void
): Promise<ZipUploadResult> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase가 설정되지 않았습니다.')
  }

  const supabase = getSupabaseClient()
  const userId = 'local-user' // TODO: 실제 사용자 ID
  const totalFiles = 1 + group.relatedFiles.length
  let uploadedCount = 0

  // 그룹 폴더 경로
  const groupPath = `${userId}/groups/${group.groupId}`

  try {
    // 1. 메인 파일 업로드
    onProgress?.({ current: 1, total: totalFiles, filename: group.mainFile.name })

    const mainFilePath = `${groupPath}/${group.mainFile.name}`
    const { error: mainUploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(mainFilePath, group.mainFile.data, {
        contentType: getMimeType(group.mainFile.name),
        upsert: false,
      })

    if (mainUploadError) {
      throw new Error(`메인 파일 업로드 실패: ${mainUploadError.message}`)
    }

    uploadedCount++

    // 2. DB에 메인 파일 레코드 생성
    const mainFileId = generateUUID()
    const { error: dbError } = await supabase
      .from('files')
      .insert({
        id: mainFileId,
        name: group.mainFile.name,
        format: group.mainFile.format,
        size: group.mainFile.data.byteLength,
        storage_path: mainFilePath,
        user_id: userId,
        group_id: group.groupId,
        is_main_file: true,
      } as Partial<FileRow> & Record<string, unknown>)

    if (dbError) {
      // 롤백: Storage 파일 삭제
      await supabase.storage.from(STORAGE_BUCKET).remove([mainFilePath])
      throw new Error(`DB 레코드 생성 실패: ${dbError.message}`)
    }

    // 3. 연관 파일들 업로드
    const uploadedRelatedPaths: string[] = []

    for (const related of group.relatedFiles) {
      onProgress?.({ current: uploadedCount + 1, total: totalFiles, filename: related.name })

      const relatedPath = `${groupPath}/${related.name}`
      const { error: relatedUploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(relatedPath, related.data, {
          contentType: getMimeType(related.name),
          upsert: false,
        })

      if (relatedUploadError) {
        console.warn(`연관 파일 업로드 실패: ${related.name} - ${relatedUploadError.message}`)
        continue // 연관 파일 실패는 무시하고 계속 진행
      }

      uploadedRelatedPaths.push(relatedPath)

      // 연관 파일 DB 레코드 생성 (선택적)
      await supabase
        .from('files')
        .insert({
          id: generateUUID(),
          name: related.name,
          format: 'other' as FileFormat,
          size: related.data.byteLength,
          storage_path: relatedPath,
          user_id: userId,
          group_id: group.groupId,
          is_main_file: false,
          related_type: related.type,
        } as Partial<FileRow> & Record<string, unknown>)

      uploadedCount++
    }

    return {
      success: true,
      groupId: group.groupId,
      mainFileId,
      mainFileName: group.mainFile.name,
      relatedCount: uploadedRelatedPaths.length,
    }
  } catch (error) {
    return {
      success: false,
      groupId: group.groupId,
      mainFileId: '',
      mainFileName: group.mainFile.name,
      relatedCount: 0,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * ZIP 파일 업로드 (파싱 + 업로드 통합)
 */
export async function uploadZipFile(
  zipFile: File,
  onProgress?: (progress: { current: number; total: number; filename: string; phase: 'parsing' | 'uploading' }) => void
): Promise<ZipUploadResult> {
  // 1. ZIP 파싱
  onProgress?.({ current: 0, total: 1, filename: zipFile.name, phase: 'parsing' })
  const group = await parseZipFile(zipFile)

  // 2. 파일 그룹 업로드
  return uploadFileGroup(group, (p) => {
    onProgress?.({ ...p, phase: 'uploading' })
  })
}

/**
 * 파일 그룹 삭제
 */
export async function deleteFileGroup(groupId: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase가 설정되지 않았습니다.')
  }

  const supabase = getSupabaseClient()

  try {
    // 1. 그룹의 모든 파일 레코드 조회
    const { data: files, error: queryError } = await supabase
      .from('files')
      .select('id, storage_path')
      .eq('group_id', groupId)

    if (queryError) {
      throw new Error(`그룹 조회 실패: ${queryError.message}`)
    }

    if (!files || files.length === 0) {
      return { success: true } // 이미 삭제됨
    }

    // 2. Storage 파일들 삭제
    const storagePaths = files.map((f: { storage_path: string }) => f.storage_path).filter(Boolean)
    if (storagePaths.length > 0) {
      await supabase.storage.from(STORAGE_BUCKET).remove(storagePaths)
    }

    // 3. DB 레코드들 삭제
    const fileIds = files.map((f: { id: string }) => f.id)
    const { error: deleteError } = await supabase
      .from('files')
      .delete()
      .in('id', fileIds)

    if (deleteError) {
      throw new Error(`DB 레코드 삭제 실패: ${deleteError.message}`)
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * 파일 그룹 정보 조회
 */
export async function getFileGroupInfo(groupId: string): Promise<{
  mainFile: FileRow | null
  relatedFiles: FileRow[]
}> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase가 설정되지 않았습니다.')
  }

  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('files')
    .select('*')
    .eq('group_id', groupId)
    .order('is_main_file', { ascending: false })

  if (error) {
    throw new Error(`그룹 정보 조회 실패: ${error.message}`)
  }

  const files = (data || []) as FileRow[]
  const mainFile = files.find((f) => (f as FileRow & { is_main_file?: boolean }).is_main_file) || files[0] || null
  const relatedFiles = files.filter((f) => f !== mainFile)

  return { mainFile, relatedFiles }
}

// MIME 타입 추론
function getMimeType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop()
  const mimeTypes: Record<string, string> = {
    obj: 'model/obj',
    mtl: 'model/mtl',
    fbx: 'application/octet-stream',
    gltf: 'model/gltf+json',
    glb: 'model/gltf-binary',
    ply: 'application/x-ply',
    las: 'application/octet-stream',
    e57: 'application/octet-stream',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    tiff: 'image/tiff',
    tif: 'image/tiff',
    bmp: 'image/bmp',
    dds: 'image/vnd.ms-dds',
    ktx: 'image/ktx',
    ktx2: 'image/ktx2',
  }
  return mimeTypes[ext || ''] || 'application/octet-stream'
}
