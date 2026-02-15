-- 005_security_hardening.sql
-- 보안 강화: anon 권한 축소, RLS 정책 개선, RPC 함수 추가

-- ============================================================
-- 1. anon 역할 권한 축소 (H5)
-- 기존: GRANT ALL → 최소 권한 원칙 적용
-- ============================================================

-- anon 역할의 기존 테이블 권한 전부 회수
REVOKE ALL ON public.files FROM anon;
REVOKE ALL ON public.folders FROM anon;
REVOKE ALL ON public.projects FROM anon;
REVOKE ALL ON public.annotations FROM anon;
REVOKE ALL ON public.stories FROM anon;
REVOKE ALL ON public.scenes FROM anon;
REVOKE ALL ON public.scene_entries FROM anon;
REVOKE ALL ON public.integrity_logs FROM anon;

-- releases만 anon에게 SELECT 허용 (공개 Release 공유 토큰 조회)
REVOKE ALL ON public.releases FROM anon;
GRANT SELECT ON public.releases TO anon;

-- authenticated는 기존대로 ALL 유지
-- (이미 GRANT ALL이 적용되어 있으므로 추가 작업 불필요)

-- sequences도 anon 회수
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;

-- ============================================================
-- 2. Public Release RLS: 만료일 체크 추가 + 토큰 단건 제한 (M4/M10-expiry)
-- ============================================================

DROP POLICY IF EXISTS "Public releases viewable by token" ON public.releases;
CREATE POLICY "Public releases viewable by token" ON public.releases
  FOR SELECT USING (
    access_type = 'public'
    AND share_token IS NOT NULL
    AND status = 'active'
    AND (expires_at IS NULL OR expires_at > NOW())
  );

-- ============================================================
-- 3. view_count 원자적 증가 RPC (M10)
-- ============================================================

CREATE OR REPLACE FUNCTION public.increment_view_count(release_id UUID)
RETURNS VOID AS $$
  UPDATE public.releases
  SET view_count = view_count + 1
  WHERE id = release_id
    AND access_type = 'public'
    AND status = 'active';
$$ LANGUAGE SQL SECURITY DEFINER;

-- anon이 이 RPC만 호출 가능
GRANT EXECUTE ON FUNCTION public.increment_view_count(UUID) TO anon;

-- ============================================================
-- 4. Release version 유니크 제약조건 (M8)
-- ============================================================

ALTER TABLE public.releases
  ADD CONSTRAINT unique_story_version UNIQUE (story_id, version);

-- ============================================================
-- 5. Storage RLS: 사용자별 격리 강화 (M2-storage)
-- ============================================================

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Allow authenticated read access" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes" ON storage.objects;

-- 사용자 자신의 폴더만 접근 (storage path 첫 세그먼트가 user_id)
CREATE POLICY "Users can read own files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'spatial-files'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can upload own files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'spatial-files'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'spatial-files'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
