-- Entry Type 리팩터링: asset/memo → spatial/visual/document/note
-- Scene 메타데이터: zone_label, summary 추가
-- Scene Entry: url 필드 추가

-- scenes: zone_label, summary 추가
ALTER TABLE public.scenes ADD COLUMN IF NOT EXISTS zone_label TEXT;
ALTER TABLE public.scenes ADD COLUMN IF NOT EXISTS summary TEXT;

-- scene_entries: url 추가
ALTER TABLE public.scene_entries ADD COLUMN IF NOT EXISTS url TEXT;

-- entry_type 마이그레이션: memo → note
UPDATE public.scene_entries SET entry_type = 'note' WHERE entry_type = 'memo';

-- entry_type 마이그레이션: asset → 파일 포맷 기반 자동 판별
UPDATE public.scene_entries se SET entry_type = CASE
  WHEN f.format IN ('gltf','glb','obj','fbx','ply','las','e57','3dtiles','splat') THEN 'spatial'
  WHEN f.format = 'image' THEN 'visual'
  ELSE 'document'
END FROM public.files f WHERE se.file_id = f.id AND se.entry_type = 'asset';

-- file_id 없는 asset → note
UPDATE public.scene_entries SET entry_type = 'note'
  WHERE entry_type = 'asset' AND file_id IS NULL;

-- CHECK 제약 교체
ALTER TABLE public.scene_entries DROP CONSTRAINT IF EXISTS scene_entries_entry_type_check;
ALTER TABLE public.scene_entries ADD CONSTRAINT scene_entries_entry_type_check
  CHECK (entry_type IN ('spatial', 'visual', 'document', 'note'));
