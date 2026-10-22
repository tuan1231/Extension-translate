-- Polyglot Learn Web: Seed Data for local / testing environments

-- Whitelist default admin email (change this to your email)
INSERT INTO public.invites (email, created_at)
VALUES 
  ('admin@polyglot.local', NOW()),
  ('tuan@polyglot.local', NOW())
ON CONFLICT (email) DO NOTHING;

-- Sample YouTube Video item (for instant dev testing)
INSERT INTO public.media_items (
  id,
  kind,
  source_url,
  canonical_hash,
  platform,
  title,
  lang_original,
  duration_sec,
  storage_mode,
  status
)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'video',
  'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  'youtube_dQw4w9WgXcQ',
  'youtube',
  'Rick Astley - Never Gonna Give You Up (Official Music Video)',
  'en',
  213,
  'embed',
  'ready'
)
ON CONFLICT (canonical_hash) DO NOTHING;

-- Sample bilingual transcript for the sample video
INSERT INTO public.transcripts (
  id,
  media_id,
  lang,
  source,
  segments
)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'en',
  'captions',
  '[
    {"i": 0, "start": 18.5, "end": 22.8, "text": "We''re no strangers to love", "textVi": "Chúng ta không còn xa lạ gì với tình yêu"},
    {"i": 1, "start": 22.9, "end": 27.2, "text": "You know the rules and so do I", "textVi": "Em biết luật chơi và anh cũng vậy"},
    {"i": 2, "start": 27.3, "end": 31.5, "text": "A full commitment''s what I''m thinking of", "textVi": "Một sự cam kết trọn vẹn là điều anh đang nghĩ tới"},
    {"i": 3, "start": 31.6, "end": 35.8, "text": "You wouldn''t get this from any other guy", "textVi": "Em sẽ không nhận được điều này từ bất kỳ chàng trai nào khác"},
    {"i": 4, "start": 35.9, "end": 43.1, "text": "I just wanna tell you how I''m feeling. Gotta make you understand", "textVi": "Anh chỉ muốn nói cho em biết cảm xúc của mình. Phải làm cho em hiểu"},
    {"i": 5, "start": 43.2, "end": 47.4, "text": "Never gonna give you up, never gonna let you down", "textVi": "Sẽ không bao giờ từ bỏ em, không bao giờ làm em thất vọng"}
  ]'::jsonb
)
ON CONFLICT (id) DO NOTHING;
