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
  -- 3D 데이터 변환 상태
  conversion_status VARCHAR(20), -- 'pending', 'converting', 'ready', 'failed'
  conversion_progress INTEGER DEFAULT 0,
  converted_path TEXT,           -- 변환된 파일 경로 (COPC, 3D Tiles 등)
  conversion_error TEXT,
  -- 메타데이터 (공간 정보 등)
  metadata JSONB,                -- { spatialInfo: { epsg, bbox, center, ... } }
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 기존 테이블에 변환 컬럼 추가 (이미 테이블이 존재하는 경우)
DO $$ BEGIN
  ALTER TABLE public.files ADD COLUMN IF NOT EXISTS conversion_status VARCHAR(20);
  ALTER TABLE public.files ADD COLUMN IF NOT EXISTS conversion_progress INTEGER DEFAULT 0;
  ALTER TABLE public.files ADD COLUMN IF NOT EXISTS converted_path TEXT;
  ALTER TABLE public.files ADD COLUMN IF NOT EXISTS conversion_error TEXT;
  ALTER TABLE public.files ADD COLUMN IF NOT EXISTS metadata JSONB;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

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

-- Row Level Security (RLS) 활성화
-- 인증된 사용자만 자신의 데이터에 접근 가능
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrity_logs ENABLE ROW LEVEL SECURITY;

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

-- RLS Policies for Integrity Logs (시스템 테이블 - user_id 없음)
-- 인증 사용자는 조회만 가능, 삽입은 service_role만 수행
DROP POLICY IF EXISTS "Authenticated users can view integrity logs" ON public.integrity_logs;
CREATE POLICY "Authenticated users can view integrity logs" ON public.integrity_logs
  FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Service role can manage integrity logs" ON public.integrity_logs;
CREATE POLICY "Service role can manage integrity logs" ON public.integrity_logs
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Grant access to authenticated and anon roles
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- === 3축 아키텍처 (Stories, Scenes, Scene Entries, Releases) ===

-- Stories table
CREATE TABLE IF NOT EXISTS public.stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'ready', 'archived')),
  tags TEXT[] DEFAULT '{}',
  cover_file_id UUID REFERENCES public.files(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scenes table
CREATE TABLE IF NOT EXISTS public.scenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scene Entries table
CREATE TABLE IF NOT EXISTS public.scene_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id UUID NOT NULL REFERENCES public.scenes(id) ON DELETE CASCADE,
  file_id UUID REFERENCES public.files(id) ON DELETE SET NULL,
  entry_type TEXT NOT NULL DEFAULT 'asset'
    CHECK (entry_type IN ('asset', 'memo')),
  title TEXT,
  body TEXT,
  gps_latitude DOUBLE PRECISION,
  gps_longitude DOUBLE PRECISION,
  spatial_anchor JSONB,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Releases table
CREATE TABLE IF NOT EXISTS public.releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  version INTEGER NOT NULL DEFAULT 1,
  label TEXT,
  snapshot JSONB NOT NULL,
  manifest JSONB NOT NULL,
  access_type TEXT NOT NULL DEFAULT 'private'
    CHECK (access_type IN ('private', 'public')),
  share_token TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'revoked')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Story indexes
CREATE INDEX IF NOT EXISTS idx_stories_user_id ON public.stories(user_id);
CREATE INDEX IF NOT EXISTS idx_scenes_story_id ON public.scenes(story_id);
CREATE INDEX IF NOT EXISTS idx_scenes_sort_order ON public.scenes(story_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_scene_entries_scene_id ON public.scene_entries(scene_id);
CREATE INDEX IF NOT EXISTS idx_scene_entries_sort_order ON public.scene_entries(scene_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_scene_entries_file_id ON public.scene_entries(file_id);
CREATE INDEX IF NOT EXISTS idx_releases_story_id ON public.releases(story_id);
CREATE INDEX IF NOT EXISTS idx_releases_share_token ON public.releases(share_token);
CREATE INDEX IF NOT EXISTS idx_releases_status ON public.releases(status);

-- Story triggers
DROP TRIGGER IF EXISTS trigger_stories_updated_at ON public.stories;
CREATE TRIGGER trigger_stories_updated_at
  BEFORE UPDATE ON public.stories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trigger_scenes_updated_at ON public.scenes;
CREATE TRIGGER trigger_scenes_updated_at
  BEFORE UPDATE ON public.scenes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trigger_scene_entries_updated_at ON public.scene_entries;
CREATE TRIGGER trigger_scene_entries_updated_at
  BEFORE UPDATE ON public.scene_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Story RLS
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scene_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.releases ENABLE ROW LEVEL SECURITY;

-- Stories RLS
DROP POLICY IF EXISTS "Users can view own stories" ON public.stories;
DROP POLICY IF EXISTS "Users can insert own stories" ON public.stories;
DROP POLICY IF EXISTS "Users can update own stories" ON public.stories;
DROP POLICY IF EXISTS "Users can delete own stories" ON public.stories;

CREATE POLICY "Users can view own stories" ON public.stories
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own stories" ON public.stories
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own stories" ON public.stories
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own stories" ON public.stories
  FOR DELETE USING (auth.uid() = user_id);

-- Scenes RLS (via story ownership)
DROP POLICY IF EXISTS "Users can view own scenes" ON public.scenes;
DROP POLICY IF EXISTS "Users can insert own scenes" ON public.scenes;
DROP POLICY IF EXISTS "Users can update own scenes" ON public.scenes;
DROP POLICY IF EXISTS "Users can delete own scenes" ON public.scenes;

CREATE POLICY "Users can view own scenes" ON public.scenes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.stories WHERE stories.id = scenes.story_id AND stories.user_id = auth.uid())
  );
CREATE POLICY "Users can insert own scenes" ON public.scenes
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.stories WHERE stories.id = scenes.story_id AND stories.user_id = auth.uid())
  );
CREATE POLICY "Users can update own scenes" ON public.scenes
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.stories WHERE stories.id = scenes.story_id AND stories.user_id = auth.uid())
  );
CREATE POLICY "Users can delete own scenes" ON public.scenes
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.stories WHERE stories.id = scenes.story_id AND stories.user_id = auth.uid())
  );

-- Scene Entries RLS (via scene → story ownership)
DROP POLICY IF EXISTS "Users can view own scene entries" ON public.scene_entries;
DROP POLICY IF EXISTS "Users can insert own scene entries" ON public.scene_entries;
DROP POLICY IF EXISTS "Users can update own scene entries" ON public.scene_entries;
DROP POLICY IF EXISTS "Users can delete own scene entries" ON public.scene_entries;

CREATE POLICY "Users can view own scene entries" ON public.scene_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.scenes
      JOIN public.stories ON stories.id = scenes.story_id
      WHERE scenes.id = scene_entries.scene_id AND stories.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can insert own scene entries" ON public.scene_entries
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.scenes
      JOIN public.stories ON stories.id = scenes.story_id
      WHERE scenes.id = scene_entries.scene_id AND stories.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can update own scene entries" ON public.scene_entries
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.scenes
      JOIN public.stories ON stories.id = scenes.story_id
      WHERE scenes.id = scene_entries.scene_id AND stories.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can delete own scene entries" ON public.scene_entries
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.scenes
      JOIN public.stories ON stories.id = scenes.story_id
      WHERE scenes.id = scene_entries.scene_id AND stories.user_id = auth.uid()
    )
  );

-- Releases RLS (owner + public share token access)
DROP POLICY IF EXISTS "Users can view own releases" ON public.releases;
DROP POLICY IF EXISTS "Public releases viewable by token" ON public.releases;
DROP POLICY IF EXISTS "Users can insert own releases" ON public.releases;
DROP POLICY IF EXISTS "Users can update own releases" ON public.releases;

CREATE POLICY "Users can view own releases" ON public.releases
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Public releases viewable by token" ON public.releases
  FOR SELECT USING (access_type = 'public' AND share_token IS NOT NULL AND status = 'active');
CREATE POLICY "Users can insert own releases" ON public.releases
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own releases" ON public.releases
  FOR UPDATE USING (auth.uid() = user_id);

-- Grant access for new tables
GRANT ALL ON public.stories TO anon, authenticated;
GRANT ALL ON public.scenes TO anon, authenticated;
GRANT ALL ON public.scene_entries TO anon, authenticated;
GRANT ALL ON public.releases TO anon, authenticated;

-- Storage bucket 생성 및 정책 설정
-- 비공개 버킷: 인증된 사용자만 접근 가능
INSERT INTO storage.buckets (id, name, public)
VALUES ('spatial-files', 'spatial-files', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Storage RLS 정책 (기존 정책 삭제 후 재생성)
DROP POLICY IF EXISTS "Allow public read access" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated read access" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon uploads" ON storage.objects;

-- 인증된 사용자 읽기 정책
CREATE POLICY "Allow authenticated read access"
ON storage.objects FOR SELECT
USING (bucket_id = 'spatial-files' AND auth.role() = 'authenticated');

-- 인증된 사용자 업로드 정책
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'spatial-files' AND auth.role() = 'authenticated');

-- 인증된 사용자 삭제 정책
CREATE POLICY "Allow authenticated deletes"
ON storage.objects FOR DELETE
USING (bucket_id = 'spatial-files' AND auth.role() = 'authenticated');
