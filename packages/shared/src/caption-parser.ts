import type { TranscriptSegment } from './types';

interface Json3Seg {
  utf8?: string;
  tOffsetMs?: number;
}

interface Json3Event {
  tStartMs?: number;
  dDurationMs?: number;
  segs?: Json3Seg[];
}

interface Json3Data {
  events?: Json3Event[];
}

export function parseJson3(json: Json3Data, isAsr = false): TranscriptSegment[] {
  const events = (json.events || []).filter(
    (e) => Array.isArray(e.segs) && e.tStartMs != null
  );
  const segments: TranscriptSegment[] = [];

  if (isAsr) {
    // Auto-generated captions: group word by word into natural sentences
    const words: { t: number; w: string }[] = [];
    for (const ev of events) {
      for (const s of ev.segs || []) {
        const w = (s.utf8 || '').replace(/\n/g, ' ').trim();
        if (!w) continue;
        words.push({ t: (ev.tStartMs! + (s.tOffsetMs || 0)) / 1000, w });
      }
    }
    words.sort((a, b) => a.t - b.t);

    let cur: { t: number; w: string }[] = [];
    const flush = () => {
      if (!cur.length) return;
      segments.push({
        i: segments.length,
        start: cur[0].t,
        end: cur[cur.length - 1].t, // updated below
        text: cur.map((x) => x.w).join(' '),
      });
      cur = [];
    };

    for (let i = 0; i < words.length; i++) {
      const wd = words[i];
      cur.push(wd);
      const next = words[i + 1];
      const endsSentence = /[.?!]$/.test(wd.w);
      const gap = next ? next.t - wd.t : 99;
      if (endsSentence || cur.length >= 14 || gap > 1.4 || (cur.length >= 8 && gap > 0.7)) {
        flush();
      }
    }
    flush();

    segments.forEach((c, idx) => {
      const nxt = segments[idx + 1];
      if (!nxt) {
        c.end = c.end + 1.5;
      } else if (nxt.start - c.end < 2) {
        c.end = nxt.start;
      } else {
        c.end = Math.min(nxt.start, c.end + 1.0);
      }
    });
  } else {
    for (const ev of events) {
      const text = (ev.segs || [])
        .map((s) => s.utf8 || '')
        .join('')
        .replace(/\s+/g, ' ')
        .trim();
      if (!text) continue;
      const start = ev.tStartMs! / 1000;
      const end = (ev.tStartMs! + (ev.dDurationMs || 2000)) / 1000;
      const last = segments[segments.length - 1];
      if (last && last.text === text && start - last.end < 0.5) {
        last.end = Math.max(last.end, end);
        continue;
      }
      segments.push({
        i: segments.length,
        start,
        end,
        text,
      });
    }

    segments.sort((a, b) => a.start - b.start);
    segments.forEach((c, idx) => {
      const nxt = segments[idx + 1];
      if (nxt && c.end > nxt.start) c.end = nxt.start;
      if (c.end - c.start < 0.3) c.end = c.start + 0.3;
    });
  }

  return segments.map((seg, idx) => ({ ...seg, i: idx }));
}

/**
 * Parses WebVTT or SRT formatted string into TranscriptSegments
 */
export function parseVttOrSrt(content: string): TranscriptSegment[] {
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const segments: TranscriptSegment[] = [];

  const timeRegex = /(?:(\d{1,2}):)?(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(?:(\d{1,2}):)?(\d{2}):(\d{2})[.,](\d{3})/;

  let currentStart = 0;
  let currentEnd = 0;
  let currentTextLines: string[] = [];
  let inCue = false;

  const parseSeconds = (hStr: string | undefined, mStr: string, sStr: string, msStr: string): number => {
    const h = hStr ? parseInt(hStr, 10) : 0;
    const m = parseInt(mStr, 10);
    const s = parseInt(sStr, 10);
    const ms = parseInt(msStr, 10);
    return h * 3600 + m * 60 + s + ms / 1000;
  };

  const flushCue = () => {
    if (inCue && currentTextLines.length > 0) {
      const cleanText = currentTextLines
        .join(' ')
        .replace(/<[^>]+>/g, '') // strip HTML/VTT tags
        .replace(/\s+/g, ' ')
        .trim();

      if (cleanText) {
        segments.push({
          i: segments.length,
          start: currentStart,
          end: currentEnd,
          text: cleanText,
        });
      }
    }
    currentTextLines = [];
    inCue = false;
  };

  for (const line of lines) {
    const match = line.match(timeRegex);
    if (match) {
      flushCue();
      currentStart = parseSeconds(match[1], match[2], match[3], match[4]);
      currentEnd = parseSeconds(match[5], match[6], match[7], match[8]);
      inCue = true;
    } else if (inCue) {
      if (line.trim() === '') {
        flushCue();
      } else {
        currentTextLines.push(line.trim());
      }
    }
  }
  flushCue();

  return segments.map((seg, idx) => ({ ...seg, i: idx }));
}
