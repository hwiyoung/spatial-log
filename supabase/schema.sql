-- Spatial Log Database Schema for Supabase (Local Development)
-- This schema runs AFTER Supabase's internal init scripts (migrate.sh)
-- File is mounted as zzz-schema.sql to ensure execution order

-- Set passwords for Supabase service roles (required for service authentication)
DO $$
BEGIN
  -- Set password for authenticator role (used by PostgREST)
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
    ALTER ROLE authenticator WITH PASSWORD 'postgres' LOGIN;
  END IF;

  -- Set password for supabase_auth_admin role (used by GoTrue)
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    ALTER ROLE supabase_auth_admin WITH PASSWORD 'postgres' LOGIN;
  END IF;

  -- Set password for supabase_storage_admin role (used by Storage API)
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN
    ALTER ROLE supabase_storage_admin WITH PASSWORD 'postgres' LOGIN;
  END IF;
END $$;

-- Enable PostGIS extension (uuid-ossp is already enabled by Supabase)
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Enums
DO $$ BEGIN
  CREATE TYPE file_format AS ENUM ('gltf', 'glb', 'obj', 'fbx', 'ply', 'las', 'e57', '3dtiles', 'splat', 'image', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 기존 enum에 새 값 추가 (이미 존재하면 무시)
DO $$ BEGIN
  ALTER TYPE file_format ADD VALUE IF NOT EXISTS '3dtiles';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE file_format ADD VALUE IF NOT EXISTS 'splat';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE annotation_priority AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE annotation_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Projects table
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  status VARCHAR(20) DEFAULT 'active',
  tags TEXT[] DEFAULT '{}',
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Folders table
CREATE TABLE IF NOT EXISTS public.folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  parent_id UUID REFERENCES public.folders(id) ON DELETE CASCADE,
  color VARCHAR(7),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Files table
CREATE TABLE IF NOT EXISTS public.files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(500) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size BIGINT NOT NULL,
  format file_format NOT NULL DEFAULT 'other',
  folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  storage_path TEXT,
  thumbnail_path TEXT,
  gps_latitude DOUBLE PRECISION,
  gps_longitude DOUBLE PRECISION,
  gps_altitude DOUBLE PRECISION,
  location GEOGRAPHY(POINT, 4326),
  exif_make VARCHAR(100),
  exif_model VARCHAR(100),
  exif_datetime TIMESTAMPTZ,
  tags TEXT[] DEFAULT '{}',
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  -- 소프트 삭제 지원
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- 무결성 검증
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Annotations table
CREATE TABLE IF NOT EXISTS public.annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  priority annotation_priority DEFAULT 'medium',
  status annotation_status DEFAULT 'open',
  position_x DOUBLE PRECISION,
  position_y DOUBLE PRECISION,
  position_z DOUBLE PRECISION,
  gps_latitude DOUBLE PRECISION,
  gps_longitude DOUBLE PRECISION,
  location GEOGRAPHY(POINT, 4326),
  file_id UUID REFERENCES public.files(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Integrity logs table (무결성 검사 로그)
CREATE TABLE IF NOT EXISTS public.integrity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_type VARCHAR(50) NOT NULL,  -- 'full', 'incremental', 'single'
  status VARCHAR(20) NOT NULL,       -- 'success', 'warning', 'error'
  orphaned_records INTEGER DEFAULT 0,
  orphaned_files INTEGER DEFAULT 0,
  valid_files INTEGER DEFAULT 0,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_files_user_id ON public.files(user_id);
CREATE INDEX IF NOT EXISTS idx_files_folder_id ON public.files(folder_id);
CREATE INDEX IF NOT EXISTS idx_files_project_id ON public.files(project_id);
CREATE INDEX IF NOT EXISTS idx_files_format ON public.files(format);
CREATE INDEX IF NOT EXISTS idx_files_location ON public.files USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_files_deleted ON public.files(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_folders_user_id ON public.folders(user_id);
CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON public.folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_annotations_project_id ON public.annotations(project_id);
CREATE INDEX IF NOT EXISTS idx_annotations_location ON public.annotations USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_integrity_logs_created ON public.integrity_logs(created_at DESC);

-- Functions
CREATE OR REPLACE FUNCTION public.update_file_location()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.gps_latitude IS NOT NULL AND NEW.gps_longitude IS NOT NULL THEN
    NEW.location = ST_SetSRID(ST_MakePoint(NEW.gps_longitude, NEW.gps_latitude), 4326)::geography;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.update_annotation_location()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.gps_latitude IS NOT NULL AND NEW.gps_longitude IS NOT NULL THEN
    NEW.location = ST_SetSRID(ST_MakePoint(NEW.gps_longitude, NEW.gps_latitude), 4326)::geography;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers (drop and recreate to avoid errors)
DROP TRIGGER IF EXISTS trigger_update_file_location ON public.files;
CREATE TRIGGER trigger_update_file_location
  BEFORE INSERT OR UPDATE ON public.files
  FOR EACH ROW EXECUTE FUNCTION public.update_file_location();

DROP TRIGGER IF EXISTS trigger_update_annotation_location ON public.annotations;
CREATE TRIGGER trigger_update_annotation_location
  BEFORE INSERT OR UPDATE ON public.annotations
  FOR EACH ROW EXECUTE FUNCTION public.update_annotation_location();

DROP TRIGGER IF EXISTS trigger_files_updated_at ON public.files;
CREATE TRIGGER trigger_files_updated_at
  BEFORE UPDATE ON public.files
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trigger_folders_updated_at ON public.folders;
CREATE TRIGGER trigger_folders_updated_at
  BEFORE UPDATE ON public.folders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trigger_projects_updated_at ON public.projects;
CREATE TRIGGER trigger_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trigger_annotations_updated_at ON public.annotations;
CREATE TRIGGER trigger_annotations_updated_at
  BEFORE UPDATE ON public.annotations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Row Level Security (RLS) - 개발 환경에서는 비활성화
-- 프로덕션에서는 ENABLE로 변경 필요
ALTER TABLE public.projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.folders DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.files DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.annotations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrity_logs DISABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can insert own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON public.projects;

DROP POLICY IF EXISTS "Users can view own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can insert own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can update own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can delete own folders" ON public.folders;

DROP POLICY IF EXISTS "Users can view own files" ON public.files;
DROP POLICY IF EXISTS "Users can insert own files" ON public.files;
DROP POLICY IF EXISTS "Users can update own files" ON public.files;
DROP POLICY IF EXISTS "Users can delete own files" ON public.files;

DROP POLICY IF EXISTS "Users can view own annotations" ON public.annotations;
DROP POLICY IF EXISTS "Users can insert own annotations" ON public.annotations;
DROP POLICY IF EXISTS "Users can update own annotations" ON public.annotations;
DROP POLICY IF EXISTS "Users can delete own annotations" ON public.annotations;

-- RLS Policies for Projects
CREATE POLICY "Users can view own projects" ON public.projects
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own projects" ON public.projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects" ON public.projects
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects" ON public.projects
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for Folders
CREATE POLICY "Users can view own folders" ON public.folders
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own folders" ON public.folders
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own folders" ON public.folders
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own folders" ON public.folders
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for Files
CREATE POLICY "Users can view own files" ON public.files
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own files" ON public.files
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own files" ON public.files
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own files" ON public.files
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for Annotations
CREATE POLICY "Users can view own annotations" ON public.annotations
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own annotations" ON public.annotations
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own annotations" ON public.annotations
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own annotations" ON public.annotations
  FOR DELETE USING (auth.uid() = user_id);

-- Grant access to authenticated and anon roles
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- Storage bucket 생성 및 정책 설정
-- 버킷이 없으면 생성
INSERT INTO storage.buckets (id, name, public)
VALUES ('spatial-files', 'spatial-files', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage RLS 정책 (기존 정책 삭제 후 재생성)
DROP POLICY IF EXISTS "Allow public read access" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes" ON storage.objects;

-- 공개 읽기 정책 (모든 사용자가 파일 읽기 가능)
CREATE POLICY "Allow public read access"
ON storage.objects FOR SELECT
USING (bucket_id = 'spatial-files');

-- 인증된 사용자 업로드 정책
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'spatial-files');

-- 인증된 사용자 삭제 정책
CREATE POLICY "Allow authenticated deletes"
ON storage.objects FOR DELETE
USING (bucket_id = 'spatial-files');

-- 익명 사용자도 업로드 가능 (개발 환경용)
DROP POLICY IF EXISTS "Allow anon uploads" ON storage.objects;
CREATE POLICY "Allow anon uploads"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'spatial-files');
