// Folder CRUD + Storage usage

import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase'
import { createFolder as localCreateFolder, getAllFolders, updateFolder as localUpdateFolder, deleteFolder as localDeleteFolder, getStorageUsage as localGetStorageUsage } from '@/utils/storage'
import type { FolderRow } from '@/lib/database.types'
import type { FolderData, FolderInsert, FolderUpdate } from './shared/types'
import { mapFolderRowToData } from './shared/mappers'

export async function createFolder(
  name: string,
  parentId: string | null = null
): Promise<FolderData> {
  if (!isSupabaseConfigured()) {
    return await localCreateFolder(name, parentId)
  }

  const supabase = getSupabaseClient()
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
    return await getAllFolders()
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
    const result = await localUpdateFolder(id, {
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
    await localDeleteFolder(id)
    return
  }

  const supabase = getSupabaseClient()
  const { error } = await supabase.from('folders').delete().eq('id', id)

  if (error) {
    throw new Error(`폴더 삭제 실패: ${error.message}`)
  }
}

export async function getStorageUsage(): Promise<{ used: number; files: number }> {
  if (!isSupabaseConfigured()) {
    return await localGetStorageUsage()
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
