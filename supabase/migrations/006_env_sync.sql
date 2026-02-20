-- 006_env_sync.sql
-- 운영-개발 환경 동기화: git 미추적 변경사항 통합
--
-- 적용 대상:
--   개발: RLS 변경 + scene_entries CHECK + storage RLS 수정
--   운영: scene_entries CHECK + status/asset_type 타입 정규화

-- ============================================================
-- 1. files RLS: per-user → team-wide (authenticated)
-- 이유: 단일 팀 사용 앱이므로 인증된 사용자 간 데이터 공유 필요
-- ============================================================

-- 기존 정책 삭제 (개발/운영 양쪽 정책명 모두 처리)
DROP POLICY IF EXISTS "Users can view own files" ON public.files;
DROP POLICY IF EXISTS "Users can insert own files" ON public.files;
DROP POLICY IF EXISTS "Users can update own files" ON public.files;
DROP POLICY IF EXISTS "Users can delete own files" ON public.files;
DROP POLICY IF EXISTS "Authenticated users can view files" ON public.files;
DROP POLICY IF EXISTS "Authenticated users can insert files" ON public.files;
DROP POLICY IF EXISTS "Authenticated users can update files" ON public.files;
DROP POLICY IF EXISTS "Authenticated users can delete files" ON public.files;

CREATE POLICY "Authenticated users can view files" ON public.files
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert files" ON public.files
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update files" ON public.files
  FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete files" ON public.files
  FOR DELETE USING (auth.role() = 'authenticated');

-- ============================================================
-- 2. folders RLS: per-user → team-wide (authenticated)
-- ============================================================

DROP POLICY IF EXISTS "Users can view own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can insert own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can update own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can delete own folders" ON public.folders;
DROP POLICY IF EXISTS "Authenticated users can view folders" ON public.folders;
DROP POLICY IF EXISTS "Authenticated users can insert folders" ON public.folders;
DROP POLICY IF EXISTS "Authenticated users can update folders" ON public.folders;
DROP POLICY IF EXISTS "Authenticated users can delete folders" ON public.folders;

CREATE POLICY "Authenticated users can view folders" ON public.folders
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert folders" ON public.folders
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update folders" ON public.folders
  FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete folders" ON public.folders
  FOR DELETE USING (auth.role() = 'authenticated');

-- ============================================================
-- 3. scene_entries CHECK: asset/memo → spatial/visual/document/note
-- 이유: 코드(SceneEntryType)가 spatial/visual/document/note 사용
-- ============================================================

ALTER TABLE public.scene_entries DROP CONSTRAINT IF EXISTS scene_entries_entry_type_check;
ALTER TABLE public.scene_entries ADD CONSTRAINT scene_entries_entry_type_check
  CHECK (entry_type IN ('spatial', 'visual', 'document', 'note'));

-- ============================================================
-- 4. storage.objects RLS: 일관성 보장
-- schema.sql 기준 auth.role()='authenticated' 통일
-- ============================================================

DROP POLICY IF EXISTS "Allow authenticated read access" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes" ON storage.objects;

CREATE POLICY "Allow authenticated read access"
ON storage.objects FOR SELECT
USING (bucket_id = 'spatial-files' AND auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'spatial-files' AND auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated deletes"
ON storage.objects FOR DELETE
USING (bucket_id = 'spatial-files' AND auth.role() = 'authenticated');

-- ============================================================
-- 5. status/asset_type 타입 정규화 (운영 DB: VARCHAR(20) → TEXT)
-- TEXT와 VARCHAR는 PostgreSQL에서 동일 성능, 일관성을 위해 통일
-- ============================================================

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'files' AND column_name = 'status'
      AND data_type = 'character varying'
  ) THEN
    ALTER TABLE public.files ALTER COLUMN status TYPE TEXT;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'files' AND column_name = 'asset_type'
      AND data_type = 'character varying'
  ) THEN
    ALTER TABLE public.files ALTER COLUMN asset_type TYPE TEXT;
  END IF;
END $$;
