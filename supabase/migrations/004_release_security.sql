-- 004_release_security.sql
-- Release 비밀번호 보호, 만료일, 조회수

ALTER TABLE public.releases ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE public.releases ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE public.releases ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;
