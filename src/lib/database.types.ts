// Supabase Database Types
// 이 파일은 Supabase CLI로 자동 생성할 수 있습니다:
// npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/lib/database.types.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      files: {
        Row: {
          id: string
          name: string
          mime_type: string
          size: number
          format: 'gltf' | 'glb' | 'obj' | 'fbx' | 'ply' | 'las' | 'e57' | '3dtiles' | 'splat' | 'image' | 'other'
          folder_id: string | null
          project_id: string | null
          storage_path: string
          thumbnail_path: string | null
          gps_latitude: number | null
          gps_longitude: number | null
          gps_altitude: number | null
          exif_make: string | null
          exif_model: string | null
          exif_datetime: string | null
          tags: string[] | null
          user_id: string | null
          deleted_at: string | null
          deleted_by: string | null
          last_verified_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          mime_type: string
          size: number
          format: 'gltf' | 'glb' | 'obj' | 'fbx' | 'ply' | 'las' | 'e57' | '3dtiles' | 'splat' | 'image' | 'other'
          folder_id?: string | null
          project_id?: string | null
          storage_path: string
          thumbnail_path?: string | null
          gps_latitude?: number | null
          gps_longitude?: number | null
          gps_altitude?: number | null
          exif_make?: string | null
          exif_model?: string | null
          exif_datetime?: string | null
          tags?: string[] | null
          user_id?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          last_verified_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          mime_type?: string
          size?: number
          format?: 'gltf' | 'glb' | 'obj' | 'fbx' | 'ply' | 'las' | 'e57' | '3dtiles' | 'splat' | 'image' | 'other'
          folder_id?: string | null
          project_id?: string | null
          storage_path?: string
          thumbnail_path?: string | null
          gps_latitude?: number | null
          gps_longitude?: number | null
          gps_altitude?: number | null
          exif_make?: string | null
          exif_model?: string | null
          exif_datetime?: string | null
          tags?: string[] | null
          user_id?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          last_verified_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      folders: {
        Row: {
          id: string
          name: string
          parent_id: string | null
          color: string | null
          user_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          parent_id?: string | null
          color?: string | null
          user_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          parent_id?: string | null
          color?: string | null
          user_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      projects: {
        Row: {
          id: string
          name: string
          description: string | null
          thumbnail_url: string | null
          status: string
          tags: string[]
          user_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          thumbnail_url?: string | null
          status?: string
          tags?: string[]
          user_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          thumbnail_url?: string | null
          status?: string
          tags?: string[]
          user_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      integrity_logs: {
        Row: {
          id: string
          check_type: string
          status: string
          orphaned_records: number
          orphaned_files: number
          valid_files: number
          details: Record<string, unknown> | null
          created_at: string
        }
        Insert: {
          id?: string
          check_type: string
          status: string
          orphaned_records?: number
          orphaned_files?: number
          valid_files?: number
          details?: Record<string, unknown> | null
          created_at?: string
        }
        Update: {
          id?: string
          check_type?: string
          status?: string
          orphaned_records?: number
          orphaned_files?: number
          valid_files?: number
          details?: Record<string, unknown> | null
          created_at?: string
        }
      }
      annotations: {
        Row: {
          id: string
          project_id: string | null
          title: string
          description: string | null
          priority: 'low' | 'medium' | 'high' | 'critical'
          status: 'open' | 'in_progress' | 'resolved' | 'closed'
          position_x: number | null
          position_y: number | null
          position_z: number | null
          gps_latitude: number | null
          gps_longitude: number | null
          file_id: string | null
          user_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id?: string | null
          title: string
          description?: string | null
          priority?: 'low' | 'medium' | 'high' | 'critical'
          status?: 'open' | 'in_progress' | 'resolved' | 'closed'
          position_x?: number | null
          position_y?: number | null
          position_z?: number | null
          gps_latitude?: number | null
          gps_longitude?: number | null
          file_id?: string | null
          user_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string | null
          title?: string
          description?: string | null
          priority?: 'low' | 'medium' | 'high' | 'critical'
          status?: 'open' | 'in_progress' | 'resolved' | 'closed'
          position_x?: number | null
          position_y?: number | null
          position_z?: number | null
          gps_latitude?: number | null
          gps_longitude?: number | null
          file_id?: string | null
          user_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      file_format: 'gltf' | 'glb' | 'obj' | 'fbx' | 'ply' | 'las' | 'e57' | '3dtiles' | 'splat' | 'image' | 'other'
      annotation_priority: 'low' | 'medium' | 'high' | 'critical'
      annotation_status: 'open' | 'in_progress' | 'resolved' | 'closed'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, 'public'>]

export type TablesRow<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema['Tables'] & PublicSchema['Views'])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions['schema']]['Tables'] &
        Database[PublicTableNameOrOptions['schema']]['Views'])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions['schema']]['Tables'] &
      Database[PublicTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema['Tables'] &
        PublicSchema['Views'])
    ? (PublicSchema['Tables'] &
        PublicSchema['Views'])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema['Tables']
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema['Tables']
    ? PublicSchema['Tables'][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema['Tables']
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema['Tables']
    ? PublicSchema['Tables'][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

// Helper types
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']
export type InsertTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']
export type UpdateTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']

export type FileRow = Tables<'files'>
export type FolderRow = Tables<'folders'>
export type ProjectRow = Tables<'projects'>
export type AnnotationRow = Tables<'annotations'>
export type IntegrityLogRow = Tables<'integrity_logs'>
