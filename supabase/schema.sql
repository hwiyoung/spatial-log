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
  CREATE TYPE file_format AS ENUM ('gltf', 'glb', 'obj', 'fbx', 'ply', 'las', 'e57', 'image', 'other');
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_files_user_id ON public.files(user_id);
CREATE INDEX IF NOT EXISTS idx_files_folder_id ON public.files(folder_id);
CREATE INDEX IF NOT EXISTS idx_files_format ON public.files(format);
CREATE INDEX IF NOT EXISTS idx_files_location ON public.files USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_folders_user_id ON public.folders(user_id);
CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON public.folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_annotations_project_id ON public.annotations(project_id);
CREATE INDEX IF NOT EXISTS idx_annotations_location ON public.annotations USING GIST(location);

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

-- Storage bucket은 Storage API를 통해 생성됩니다.
-- Supabase Studio (http://192.168.10.203:3101)에서 Storage > Create new bucket으로 생성하거나
-- 앱 시작 시 자동으로 생성됩니다.
