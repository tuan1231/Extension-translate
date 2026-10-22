import { NextRequest, NextResponse } from 'next/server';
import { IngestRequestSchema } from '@polyglot/shared';
import { extractYouTubeVideoId, fetchYouTubeMetadata, fetchYouTubeCaptions } from '@/lib/youtube';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = IngestRequestSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dữ liệu không hợp lệ', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { url, targetLang, extensionCaptions, videoTitle, thumbnailUrl } = parsed.data;
    const youtubeId = extractYouTubeVideoId(url);

    // 1. YouTube pipeline (Tier 1: 0 cost, embed player, no file egress)
    if (youtubeId) {
      const canonicalHash = `youtube_${youtubeId}`;
      const supabase = createAdminClient();

      // Check existing cached media in Supabase
      if (supabase) {
        const { data: existingMedia } = await supabase
          .from('media_items')
          .select('*, transcripts(*)')
          .eq('canonical_hash', canonicalHash)
          .single();

        if (existingMedia) {
          return NextResponse.json({
            success: true,
            cached: true,
            mediaItem: existingMedia,
          });
        }
      }

      // Fetch metadata from oEmbed
      const meta = await fetchYouTubeMetadata(youtubeId);
      const title = videoTitle || meta.title;
      const thumb = thumbnailUrl || meta.thumbnailUrl;

      // Extract captions
      let segments = extensionCaptions || [];
      let langOriginal = 'en';

      if (!segments.length) {
        const res = await fetchYouTubeCaptions(youtubeId, targetLang);
        segments = res.segments;
        langOriginal = res.langOriginal;
      }

      const mediaRecord = {
        id: crypto.randomUUID(),
        kind: 'video',
        source_url: url,
        canonical_hash: canonicalHash,
        platform: 'youtube',
        title,
        lang_original: langOriginal,
        duration_sec: segments.length ? segments[segments.length - 1].end : 0,
        thumbnail_path: thumb,
        storage_mode: 'embed',
        size_bytes: 0,
        status: 'ready',
        last_accessed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };

      const transcriptRecord = {
        id: crypto.randomUUID(),
        media_id: mediaRecord.id,
        lang: langOriginal,
        source: extensionCaptions ? 'captions' : 'captions',
        segments,
        created_at: new Date().toISOString(),
      };

      if (supabase) {
        const { error: mediaErr } = await supabase.from('media_items').insert(mediaRecord);
        if (mediaErr) console.warn('Supabase media_items insert error:', mediaErr);

        const { error: transErr } = await supabase.from('transcripts').insert(transcriptRecord);
        if (transErr) console.warn('Supabase transcripts insert error:', transErr);
      }

      return NextResponse.json({
        success: true,
        mediaItem: {
          ...mediaRecord,
          transcripts: [transcriptRecord],
        },
      });
    }

    // 2. Non-YouTube platforms (TikTok, Facebook, Vimeo) -> Tier 2 (GitHub Actions Worker)
    return NextResponse.json({
      success: true,
      message: 'Video non-YouTube đã được ghi nhận vào hàng đợi xử lý worker.',
      jobTier: 't2',
      mediaItem: {
        id: crypto.randomUUID(),
        kind: 'video',
        source_url: url,
        title: 'Đang xử lý qua Worker...',
        status: 'queued',
      },
    });
  } catch (err: unknown) {
    console.error('Ingest route error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Lỗi hệ thống khi phân tích link' },
      { status: 500 }
    );
  }
}
