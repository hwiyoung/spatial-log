-- 007_storage_team_shared.sql
-- Storage RLS 정책을 팀 공유 모델로 복원
--
-- 배경:
--   005_security_hardening.sql에서 storage.objects를 사용자별 격리로 변경했으나,
--   files/folders 테이블은 팀 공유(authenticated 전체 접근)로 운영 중.
--   DB에서는 파일이 보이지만 Storage에서 다운로드가 차단되는 불일치 발생.
--
-- 변경:
--   Storage READ/DELETE를 인증된 사용자 전체 접근으로 복원 (schema.sql과 일치)
--   INSERT는 사용자 자신의 폴더에만 허용 (업로드 경로 보호)

-- ============================================================
-- 기존 정책 삭제 (005에서 생성된 것 + 이전 schema.sql 정책)
-- 참고: storage.objects 소유자가 supabase_storage_admin이므로
--       postgres 슈퍼유저로 실행해야 auth 스키마 참조 가능
-- ============================================================

DROP POLICY IF EXISTS "Users can read own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated read access" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete files" ON storage.objects;

-- ============================================================
-- 팀 공유 정책 생성 (schema.sql과 동일)
-- ============================================================

-- READ: 인증된 사용자는 모든 파일 조회 가능 (팀 공유)
CREATE POLICY "Authenticated users can read files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'spatial-files'
  AND auth.role() = 'authenticated'
);

-- INSERT: 사용자 자신의 폴더에만 업로드 (경로 보호 유지)
CREATE POLICY "Authenticated users can upload to own folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'spatial-files'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- DELETE: 인증된 사용자는 모든 파일 삭제 가능 (DB 정책과 일치)
CREATE POLICY "Authenticated users can delete files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'spatial-files'
  AND auth.role() = 'authenticated'
);
