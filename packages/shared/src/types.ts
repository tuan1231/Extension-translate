export type UserRole = 'admin' | 'member';

export interface Profile {
  id: string;
  display_name: string | null;
  native_lang: string;
  target_exam: 'toeic' | 'ielts' | 'general';
  role: UserRole;
  storage_used_bytes: number;
  storage_quota_bytes: number; // default 80MB (80 * 1024 * 1024)
  created_at: string;
}

export interface Invite {
  email: string;
  invited_by: string;
  accepted_at: string | null;
  created_at: string;
}

export type MediaKind = 'video' | 'article';
export type StorageMode = 'embed' | 'hls';
export type PlatformType = 'youtube' | 'tiktok' | 'facebook' | 'vimeo' | 'x' | 'article' | 'other';
export type MediaStatus = 'queued' | 'processing' | 'ready' | 'failed';

export interface MediaItem {
  id: string;
  kind: MediaKind;
  source_url: string;
  canonical_hash: string;
  platform: PlatformType;
  title: string;
  lang_original: string;
  duration_sec: number;
  thumbnail_path: string | null;
  storage_mode: StorageMode;
  hls_manifest_path: string | null;
  size_bytes: number;
  status: MediaStatus;
  last_accessed_at: string;
  created_by: string;
  created_at: string;
}

export interface TranscriptSegment {
  i: number;
  start: number; // seconds
  end: number;   // seconds
  text: string;
  textVi?: string;
  words?: {
    word: string;
    start?: number;
    end?: number;
  }[];
}

export type TranscriptSource = 'captions' | 'stt' | 'article' | 'translated';

export interface Transcript {
  id: string;
  media_id: string;
  lang: string;
  source: TranscriptSource;
  segments: TranscriptSegment[];
  created_at: string;
}

export interface Article {
  media_id: string;
  html_clean: string;
  text_original: string;
  text_en: string;
  text_vi?: string;
  word_count: number;
  cefr_level?: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  created_at: string;
}

export type ExerciseType =
  | 'dictation'
  | 'fill_blank'
  | 'toeic_listening'
  | 'toeic_reading'
  | 'ielts_listening'
  | 'ielts_reading';

export interface Exercise {
  id: string;
  media_id: string;
  type: ExerciseType;
  config: Record<string, unknown>;
  version: number;
  created_at: string;
}

export interface ExerciseItemEvidence {
  text?: string;
  start?: number;
  end?: number;
  paragraph_idx?: number;
}

export interface ExerciseItem {
  id: string;
  exercise_id: string;
  order_no: number;
  item_type: string;
  payload: Record<string, unknown>;
  answer: Record<string, unknown>;
  explanation: string;
  evidence?: ExerciseItemEvidence;
}

export type UserMediaStatus = 'new' | 'in_progress' | 'done';

export interface UserMedia {
  user_id: string;
  media_id: string;
  last_position_sec: number;
  last_segment_idx: number;
  percent_complete: number;
  status: UserMediaStatus;
  updated_at: string;
}

export interface Attempt {
  id: string;
  user_id: string;
  exercise_id: string;
  started_at: string;
  finished_at: string | null;
  score: number;
  max_score: number;
  band_estimate?: string;
}

export interface AttemptAnswer {
  attempt_id: string;
  item_id: string;
  user_answer: unknown;
  is_correct: boolean;
  accuracy?: number; // 0..100
}

export interface Vocabulary {
  id: string;
  user_id: string;
  term: string;
  translation: string;
  context?: string;
  media_id?: string;
  segment_idx?: number;
  srs_ease: number;      // default 2.5
  srs_interval: number;  // in days, default 1
  srs_reps: number;      // repetition count
  due_at: string;
  created_at: string;
}

export type JobTier = 't1' | 't2' | 't3';
export type JobStatus =
  | 'queued'
  | 'fetching'
  | 'transcribing'
  | 'compressing'
  | 'translating'
  | 'ready'
  | 'needs_local'
  | 'failed';

export interface Job {
  id: string;
  media_id: string;
  type: 'video_ingest' | 'article_ingest' | 'exam_generation';
  tier: JobTier;
  status: JobStatus;
  step: string | null;
  progress: number; // 0..100
  error: string | null;
  attempts: number;
  gha_run_id: string | null;
  locked_at: string | null;
  created_at: string;
  updated_at: string;
}
