-- 003_asset_enhancements.sql
-- 에셋 설명, 상태, 링크/노트 에셋 지원

-- 에셋 설명/상태
ALTER TABLE public.files ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.files ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

-- 링크/노트 에셋 지원
ALTER TABLE public.files ADD COLUMN IF NOT EXISTS asset_type TEXT NOT NULL DEFAULT 'file';
ALTER TABLE public.files ADD COLUMN IF NOT EXISTS url TEXT;
ALTER TABLE public.files ADD COLUMN IF NOT EXISTS body TEXT;
ALTER TABLE public.files ALTER COLUMN storage_path DROP NOT NULL;
ALTER TABLE public.files ALTER COLUMN mime_type SET DEFAULT '';
ALTER TABLE public.files ALTER COLUMN size SET DEFAULT 0;
