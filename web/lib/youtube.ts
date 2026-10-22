import { parseJson3, parseVttOrSrt, type TranscriptSegment } from '@polyglot/shared';
import { Translator } from './translator';

export interface YouTubeMetadata {
  videoId: string;
  title: string;
  authorName: string;
  thumbnailUrl: string;
}

export function extractYouTubeVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtube.com')) {
      if (parsed.pathname === '/watch') {
        return parsed.searchParams.get('v');
      }
      if (parsed.pathname.startsWith('/embed/')) {
        return parsed.pathname.split('/embed/')[1]?.split('?')[0] || null;
      }
      if (parsed.pathname.startsWith('/shorts/')) {
        return parsed.pathname.split('/shorts/')[1]?.split('?')[0] || null;
      }
    }
    if (parsed.hostname === 'youtu.be') {
      return parsed.pathname.slice(1).split('?')[0] || null;
    }
  } catch {
    // If not a valid URL, try regex
  }
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
  return match ? match[1] : null;
}

export async function fetchYouTubeMetadata(videoId: string): Promise<YouTubeMetadata> {
  const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
  const res = await fetch(oembedUrl);
  if (!res.ok) {
    return {
      videoId,
      title: `YouTube Video (${videoId})`,
      authorName: 'YouTube Creator',
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    };
  }
  const data = await res.json();
  return {
    videoId,
    title: data.title || `YouTube Video (${videoId})`,
    authorName: data.author_name || 'YouTube Creator',
    thumbnailUrl: data.thumbnail_url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
  };
}

export async function fetchYouTubeCaptions(videoId: string, targetLang = 'vi'): Promise<{
  segments: TranscriptSegment[];
  langOriginal: string;
}> {
  // 1. Fetch video page HTML to extract ytInitialPlayerResponse
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const res = await fetch(videoUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9,vi;q=0.8',
    },
  });

  if (!res.ok) {
    throw new Error(`Không thể kết nối đến YouTube (${res.status})`);
  }

  const html = await res.text();
  const match = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});(?:var|\s*<\/script>)/);

  let captionTracks: any[] = [];
  if (match) {
    try {
      const playerResponse = JSON.parse(match[1]);
      captionTracks =
        playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
    } catch {
      // JSON parse error
    }
  }

  // If no caption tracks found on page, try YouTube timedtext directly
  if (!captionTracks.length) {
    // Check if we can fetch en timedtext directly
    const timedtextRes = await fetch(`https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=json3`);
    if (timedtextRes.ok) {
      const json3 = await timedtextRes.json();
      const segments = parseJson3(json3, true);
      if (segments.length) {
        return { segments, langOriginal: 'en' };
      }
    }
    throw new Error('Video này không có phụ đề sẵn có trên YouTube. Vui lòng thử dùng Extension để đẩy phụ đề hoặc chọn video có phụ đề.');
  }

  // Prioritize: English (manual track first, then auto/asr)
  let selectedTrack = captionTracks.find(
    (t: any) => (t.languageCode === 'en' || t.languageCode?.startsWith('en')) && t.kind !== 'asr'
  );
  if (!selectedTrack) {
    selectedTrack = captionTracks.find(
      (t: any) => t.languageCode === 'en' || t.languageCode?.startsWith('en')
    );
  }
  if (!selectedTrack) {
    // Take first available track
    selectedTrack = captionTracks[0];
  }

  const trackBaseUrl = selectedTrack.baseUrl;
  const isAsr = selectedTrack.kind === 'asr';
  const langOriginal = selectedTrack.languageCode || 'en';

  // Request json3 format
  const json3Url = trackBaseUrl.includes('fmt=') ? trackBaseUrl : `${trackBaseUrl}&fmt=json3`;
  const trackRes = await fetch(json3Url);

  let segments: TranscriptSegment[] = [];
  if (trackRes.ok) {
    try {
      const json3Data = await trackRes.json();
      segments = parseJson3(json3Data, isAsr);
    } catch {
      // fallback to text parse
      const textData = await trackRes.text();
      segments = parseVttOrSrt(textData);
    }
  }

  if (!segments.length) {
    throw new Error('Không thể đọc nội dung phụ đề từ YouTube.');
  }

  // If targetLang is different and not already in targetLang, translate segments in batch
  if (targetLang && langOriginal !== targetLang) {
    const textsToTranslate = segments.map((s) => s.text);
    try {
      const translations = await Translator.translateBatch(textsToTranslate, targetLang);
      segments.forEach((seg, i) => {
        seg.textVi = translations[i] || '';
      });
    } catch (e) {
      console.warn('Batch translation warning:', e);
    }
  }

  return { segments, langOriginal };
}
