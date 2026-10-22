-- Polyglot Learn Web: Initial Database Schema & Security Policies
-- Compatible with Supabase Postgres

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUMS
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'member');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE media_kind AS ENUM ('video', 'article');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE storage_mode AS ENUM ('embed', 'hls');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE media_status AS ENUM ('queued', 'processing', 'ready', 'failed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE transcript_source AS ENUM ('captions', 'stt', 'article', 'translated');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE exercise_type AS ENUM (
    'dictation',
    'fill_blank',
    'toeic_listening',
    'toeic_reading',
    'ielts_listening',
    'ielts_reading'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE user_media_status AS ENUM ('new', 'in_progress', 'done');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE job_tier AS ENUM ('t1', 't2', 't3');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE job_status AS ENUM (
    'queued',
    'fetching',
    'transcribing',
    'compressing',
    'translating',
    'ready',
    'needs_local',
    'failed'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 3. TABLES

-- Invites: Only whitelisted emails can sign up
CREATE TABLE IF NOT EXISTS public.invites (
  email TEXT PRIMARY KEY,
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Profiles: Extended user information
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  native_lang TEXT NOT NULL DEFAULT 'vi',
  target_exam TEXT NOT NULL DEFAULT 'toeic', -- 'toeic' | 'ielts' | 'general'
  role user_role NOT NULL DEFAULT 'member',
  storage_used_bytes BIGINT NOT NULL DEFAULT 0,
  storage_quota_bytes BIGINT NOT NULL DEFAULT 83886080, -- 80MB default quota
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Media items: Shared library items (deduplicated by canonical_hash)
CREATE TABLE IF NOT EXISTS public.media_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind media_kind NOT NULL DEFAULT 'video',
  source_url TEXT NOT NULL,
  canonical_hash TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL DEFAULT 'youtube',
  title TEXT NOT NULL,
  lang_original TEXT NOT NULL DEFAULT 'en',
  duration_sec NUMERIC NOT NULL DEFAULT 0,
  thumbnail_path TEXT,
  storage_mode storage_mode NOT NULL DEFAULT 'embed',
  hls_manifest_path TEXT,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  status media_status NOT NULL DEFAULT 'queued',
  last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Transcripts: Bilingual timestamps segments
CREATE TABLE IF NOT EXISTS public.transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id UUID NOT NULL REFERENCES public.media_items(id) ON DELETE CASCADE,
  lang TEXT NOT NULL DEFAULT 'en',
  source transcript_source NOT NULL DEFAULT 'captions',
  segments JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{i, start, end, text, textVi}]
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Articles: Clean reader mode texts
CREATE TABLE IF NOT EXISTS public.articles (
  media_id UUID PRIMARY KEY REFERENCES public.media_items(id) ON DELETE CASCADE,
  html_clean TEXT NOT NULL DEFAULT '',
  text_original TEXT NOT NULL DEFAULT '',
  text_en TEXT NOT NULL DEFAULT '',
  text_vi TEXT,
  word_count INT NOT NULL DEFAULT 0,
  cefr_level TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Exercises: Dictation, Fill-blank, TOEIC, IELTS
CREATE TABLE IF NOT EXISTS public.exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id UUID NOT NULL REFERENCES public.media_items(id) ON DELETE CASCADE,
  type exercise_type NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Exercise Items: Specific questions with evidence and explanations
CREATE TABLE IF NOT EXISTS public.exercise_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id UUID NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  order_no INT NOT NULL,
  item_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  answer JSONB NOT NULL DEFAULT '{}'::jsonb,
  explanation TEXT NOT NULL DEFAULT '',
  evidence JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User Media: Progress tracking per user
CREATE TABLE IF NOT EXISTS public.user_media (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_id UUID NOT NULL REFERENCES public.media_items(id) ON DELETE CASCADE,
  last_position_sec NUMERIC NOT NULL DEFAULT 0,
  last_segment_idx INT NOT NULL DEFAULT 0,
  percent_complete NUMERIC NOT NULL DEFAULT 0,
  status user_media_status NOT NULL DEFAULT 'new',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, media_id)
);

-- Exam Attempts: History of test sessions
CREATE TABLE IF NOT EXISTS public.attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  score NUMERIC NOT NULL DEFAULT 0,
  max_score NUMERIC NOT NULL DEFAULT 0,
  band_estimate TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Attempt Answers: Individual question results
CREATE TABLE IF NOT EXISTS public.attempt_answers (
  attempt_id UUID NOT NULL REFERENCES public.attempts(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.exercise_items(id) ON DELETE CASCADE,
  user_answer JSONB,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  accuracy NUMERIC,
  PRIMARY KEY (attempt_id, item_id)
);

-- Vocabulary: Flashcards with SRS (SuperMemo-2 algorithm)
CREATE TABLE IF NOT EXISTS public.vocabulary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  term TEXT NOT NULL,
  translation TEXT NOT NULL,
  context TEXT,
  media_id UUID REFERENCES public.media_items(id) ON DELETE SET NULL,
  segment_idx INT,
  srs_ease NUMERIC NOT NULL DEFAULT 2.5,
  srs_interval INT NOT NULL DEFAULT 1,
  srs_reps INT NOT NULL DEFAULT 0,
  due_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Jobs: Background processing pipeline queue
CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id UUID NOT NULL REFERENCES public.media_items(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'video_ingest',
  tier job_tier NOT NULL DEFAULT 't1',
  status job_status NOT NULL DEFAULT 'queued',
  step TEXT,
  progress INT NOT NULL DEFAULT 0,
  error TEXT,
  attempts INT NOT NULL DEFAULT 0,
  gha_run_id TEXT,
  locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. INDEXES
CREATE INDEX IF NOT EXISTS idx_media_canonical_hash ON public.media_items(canonical_hash);
CREATE INDEX IF NOT EXISTS idx_transcripts_media_id ON public.transcripts(media_id);
CREATE INDEX IF NOT EXISTS idx_exercises_media_id ON public.exercises(media_id);
CREATE INDEX IF NOT EXISTS idx_exercise_items_exercise_id ON public.exercise_items(exercise_id);
CREATE INDEX IF NOT EXISTS idx_user_media_user_id ON public.user_media(user_id);
CREATE INDEX IF NOT EXISTS idx_vocab_user_due ON public.vocabulary(user_id, due_at);
CREATE INDEX IF NOT EXISTS idx_jobs_status_tier ON public.jobs(status, tier);

-- 5. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercise_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempt_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vocabulary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Profiles: users read all members, update own profile
CREATE POLICY "Profiles are viewable by authenticated users"
  ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Invites: members can view whitelist; only admins can insert/update/delete
CREATE POLICY "Invites viewable by authenticated"
  ON public.invites FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage invites"
  ON public.invites FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Shared Library: media_items, transcripts, articles, exercises
CREATE POLICY "Shared media readable by authenticated"
  ON public.media_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert media items"
  ON public.media_items FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Transcripts readable by authenticated"
  ON public.transcripts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Articles readable by authenticated"
  ON public.articles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Exercises readable by authenticated"
  ON public.exercises FOR SELECT TO authenticated USING (true);

CREATE POLICY "Exercise items readable by authenticated"
  ON public.exercise_items FOR SELECT TO authenticated USING (true);

-- User Private Data: user_media, attempts, attempt_answers, vocabulary
CREATE POLICY "User media isolated"
  ON public.user_media FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Attempts isolated"
  ON public.attempts FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Attempt answers isolated"
  ON public.attempt_answers FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.attempts WHERE id = attempt_answers.attempt_id AND user_id = auth.uid())
  );

CREATE POLICY "Vocabulary isolated"
  ON public.vocabulary FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Jobs: Creator can read job progress; service_role has full control
CREATE POLICY "Users can view jobs for their media"
  ON public.jobs FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.media_items WHERE id = jobs.media_id AND created_by = auth.uid())
  );

-- 6. TRIGGERS & FUNCTIONS

-- Function to handle new user registration from Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_is_first_user BOOLEAN;
  v_is_invited BOOLEAN;
  v_role user_role := 'member';
BEGIN
  -- Check if this is the very first user in the system
  SELECT NOT EXISTS(SELECT 1 FROM public.profiles LIMIT 1) INTO v_is_first_user;
  
  -- Check whitelist
  SELECT EXISTS(SELECT 1 FROM public.invites WHERE LOWER(email) = LOWER(NEW.email)) INTO v_is_invited;

  IF v_is_first_user THEN
    v_role := 'admin';
  ELSIF NOT v_is_invited THEN
    RAISE EXCEPTION 'Email % chua duoc moi vao he thong Polyglot Learn.', NEW.email;
  END IF;

  INSERT INTO public.profiles (id, display_name, native_lang, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    'vi',
    v_role
  );

  -- Mark invite as accepted
  UPDATE public.invites SET accepted_at = NOW() WHERE LOWER(email) = LOWER(NEW.email);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at timestamp trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_media_items_updated_at ON public.media_items;
CREATE TRIGGER trg_media_items_updated_at BEFORE UPDATE ON public.media_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_vocabulary_updated_at ON public.vocabulary;
CREATE TRIGGER trg_vocabulary_updated_at BEFORE UPDATE ON public.vocabulary FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_jobs_updated_at ON public.jobs;
CREATE TRIGGER trg_jobs_updated_at BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 7. STORAGE BUCKETS (Executed in Supabase Storage schema)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('media-hls', 'media-hls', false, 52428800, ARRAY['application/x-mpegURL', 'video/MP2T', 'application/vnd.apple.mpegurl']),
  ('audio-tts', 'audio-tts', false, 20971520, ARRAY['audio/ogg', 'audio/opus', 'audio/mpeg']),
  ('thumbnails', 'thumbnails', true, 5242880, ARRAY['image/webp', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO NOTHING;
