-- Stories, Scenes, Scene Entries, Releases 테이블 생성
-- 기존 projects/annotations 테이블은 유지 (프론트엔드만 새 테이블 사용)

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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_stories_user_id ON public.stories(user_id);
CREATE INDEX IF NOT EXISTS idx_scenes_story_id ON public.scenes(story_id);
CREATE INDEX IF NOT EXISTS idx_scenes_sort_order ON public.scenes(story_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_scene_entries_scene_id ON public.scene_entries(scene_id);
CREATE INDEX IF NOT EXISTS idx_scene_entries_sort_order ON public.scene_entries(scene_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_scene_entries_file_id ON public.scene_entries(file_id);
CREATE INDEX IF NOT EXISTS idx_releases_story_id ON public.releases(story_id);
CREATE INDEX IF NOT EXISTS idx_releases_share_token ON public.releases(share_token);
CREATE INDEX IF NOT EXISTS idx_releases_status ON public.releases(status);

-- updated_at triggers
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

-- RLS
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scene_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.releases ENABLE ROW LEVEL SECURITY;

-- Stories RLS
CREATE POLICY "Users can view own stories" ON public.stories
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own stories" ON public.stories
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own stories" ON public.stories
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own stories" ON public.stories
  FOR DELETE USING (auth.uid() = user_id);

-- Scenes RLS (via story ownership)
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
CREATE POLICY "Users can view own releases" ON public.releases
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Public releases viewable by token" ON public.releases
  FOR SELECT USING (access_type = 'public' AND share_token IS NOT NULL AND status = 'active');
CREATE POLICY "Users can insert own releases" ON public.releases
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own releases" ON public.releases
  FOR UPDATE USING (auth.uid() = user_id);

-- Grant access
GRANT ALL ON public.stories TO anon, authenticated;
GRANT ALL ON public.scenes TO anon, authenticated;
GRANT ALL ON public.scene_entries TO anon, authenticated;
GRANT ALL ON public.releases TO anon, authenticated;
