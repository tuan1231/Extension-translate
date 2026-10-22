'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { MediaItem, TranscriptSegment } from '@polyglot/shared';
import SubtitleOverlay from '@/components/SubtitleOverlay';
import TranscriptPanel from '@/components/TranscriptPanel';
import DictationBox from '@/components/DictationBox';
import FillBlankBox from '@/components/FillBlankBox';
import SelectionTranslator from '@/components/SelectionTranslator';
import { 
  FileText, 
  PenTool, 
  CheckSquare, 
  Settings, 
  ArrowLeft, 
  Sparkles, 
  Eye, 
  EyeOff,
  Flame
} from 'lucide-react';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

function WatchContent() {
  const params = useParams();
  const router = useRouter();
  const mediaId = params?.id as string;

  const [media, setMedia] = useState<MediaItem | null>(null);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeTab, setActiveTab] = useState<'transcript' | 'dictation' | 'fill'>('transcript');
  const [practiceIndex, setPracticeIndex] = useState(0);

  // Subtitle settings
  const [showOriginal, setShowOriginal] = useState(true);
  const [showTranslation, setShowTranslation] = useState(true);

  // Selected word for popup translator
  const [selectedWord, setSelectedWord] = useState<string | null>(null);

  const playerRef = useRef<any>(null);
  const isLoopingRef = useRef<{ start: number; end: number } | null>(null);

  // 1. Load media data
  useEffect(() => {
    async function loadData() {
      try {
        // Fetch from API or mock initial data
        const res = await fetch(`/api/media/${mediaId}`);
        if (res.ok) {
          const data = await res.json();
          setMedia(data.media);
          setSegments(data.segments || []);
        } else {
          // Fallback sample data for rickroll or demo video
          const sampleSegments: TranscriptSegment[] = [
            { i: 0, start: 18.5, end: 22.8, text: "We're no strangers to love", textVi: "Chúng ta không còn xa lạ gì với tình yêu" },
            { i: 1, start: 22.9, end: 27.2, text: "You know the rules and so do I", textVi: "Em biết luật chơi và anh cũng vậy" },
            { i: 2, start: 27.3, end: 31.5, text: "A full commitment's what I'm thinking of", textVi: "Một sự cam kết trọn vẹn là điều anh đang nghĩ tới" },
            { i: 3, start: 31.6, end: 35.8, text: "You wouldn't get this from any other guy", textVi: "Em sẽ không nhận được điều này từ bất kỳ chàng trai nào khác" },
            { i: 4, start: 35.9, end: 43.1, text: "I just wanna tell you how I'm feeling. Gotta make you understand", textVi: "Anh chỉ muốn nói cho em biết cảm xúc của mình. Phải làm cho em hiểu" },
            { i: 5, start: 43.2, end: 47.4, text: "Never gonna give you up, never gonna let you down", textVi: "Sẽ không bao giờ từ bỏ em, không bao giờ làm em thất vọng" },
          ];
          setSegments(sampleSegments);
          setMedia({
            id: mediaId,
            kind: 'video',
            source_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            canonical_hash: 'youtube_dQw4w9WgXcQ',
            platform: 'youtube',
            title: 'Rick Astley - Never Gonna Give You Up (Luyện Dictation Demo)',
            lang_original: 'en',
            duration_sec: 213,
            thumbnail_path: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
            storage_mode: 'embed',
            hls_manifest_path: null,
            size_bytes: 0,
            status: 'ready',
            last_accessed_at: new Date().toISOString(),
            created_by: 'system',
            created_at: new Date().toISOString(),
          });
        }
      } catch (err) {
        console.error('Failed to load media:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [mediaId]);

  // 2. Initialize YouTube Iframe Player
  useEffect(() => {
    if (!media || media.platform !== 'youtube') return;

    // Extract youtube video ID
    const match = media.source_url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
    const videoId = match ? match[1] : 'dQw4w9WgXcQ';

    const loadPlayer = () => {
      playerRef.current = new window.YT.Player('yt-player-container', {
        videoId: videoId,
        playerVars: {
          autoplay: 0,
          controls: 1,
          modestbranding: 1,
          rel: 0,
        },
        events: {
          onReady: () => {
            // Player ready
          },
        },
      });
    };

    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
      window.onYouTubeIframeAPIReady = loadPlayer;
    } else {
      loadPlayer();
    }

    // Interval to poll currentTime for subtitle synchronization
    const timer = setInterval(() => {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
        const time = playerRef.current.getCurrentTime();
        setCurrentTime(time);

        // Check if loop practice is active
        if (isLoopingRef.current) {
          const { start, end } = isLoopingRef.current;
          if (time >= end || time < start) {
            playerRef.current.seekTo(start, true);
          }
        }
      }
    }, 200);

    return () => {
      clearInterval(timer);
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        playerRef.current.destroy();
      }
    };
  }, [media]);

  // Current active subtitle segment
  const currentSegment = segments.find(
    (s) => currentTime >= s.start && currentTime <= s.end
  ) || null;

  // Seek video
  const handleSeek = (timeSec: number) => {
    isLoopingRef.current = null;
    if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
      playerRef.current.seekTo(timeSec, true);
      playerRef.current.playVideo();
    }
  };

  // Play loop for dictation / fill-blank
  const handlePlayLoop = (start: number, end: number) => {
    isLoopingRef.current = { start, end };
    if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
      playerRef.current.seekTo(start, true);
      playerRef.current.playVideo();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 70px)' }}>
      {/* Top Bar */}
      <div
        style={{
          height: '52px',
          padding: '0 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: 'rgba(7, 9, 14, 0.85)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => router.push('/library')}
            className="btn-ghost"
            style={{ padding: '6px 10px', fontSize: '0.85rem' }}
          >
            <ArrowLeft size={16} />
            <span>Thư viện</span>
          </button>
          <div style={{ width: '1px', height: '18px', backgroundColor: 'var(--border-subtle)' }} />
          <h2
            style={{
              fontSize: '0.95rem',
              fontWeight: 600,
              maxWidth: '500px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {media?.title || 'Đang tải bài học...'}
          </h2>
        </div>

        {/* Subtitle toggle pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setShowOriginal(!showOriginal)}
            className="btn-ghost"
            style={{
              fontSize: '0.78rem',
              color: showOriginal ? 'var(--accent-cyan)' : 'var(--text-muted)',
              backgroundColor: showOriginal ? 'rgba(6, 182, 212, 0.1)' : 'transparent',
            }}
          >
            {showOriginal ? <Eye size={14} /> : <EyeOff size={14} />}
            <span>Tiếng Anh</span>
          </button>

          <button
            onClick={() => setShowTranslation(!showTranslation)}
            className="btn-ghost"
            style={{
              fontSize: '0.78rem',
              color: showTranslation ? 'var(--accent-cyan)' : 'var(--text-muted)',
              backgroundColor: showTranslation ? 'rgba(6, 182, 212, 0.1)' : 'transparent',
            }}
          >
            {showTranslation ? <Eye size={14} /> : <EyeOff size={14} />}
            <span>Tiếng Việt</span>
          </button>
        </div>
      </div>

      {/* Main Split Layout: Left Video, Right Study Tools */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left: Video Player with Floating Subtitles */}
        <div
          style={{
            flex: 1.4,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: '#000000',
            position: 'relative',
          }}
        >
          {/* YouTube IFrame Container */}
          <div
            id="yt-player-container"
            style={{
              width: '100%',
              height: '100%',
              position: 'absolute',
              inset: 0,
            }}
          />

          {/* Subtitle Overlay */}
          <SubtitleOverlay
            currentSegment={currentSegment}
            showOriginal={showOriginal}
            showTranslation={showTranslation}
            onSelectWord={(word) => setSelectedWord(word)}
          />
        </div>

        {/* Right: Study Panel (Transcript / Dictation / Fill Blank) */}
        <div
          style={{
            flex: 1,
            maxWidth: '560px',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'var(--bg-secondary)',
          }}
        >
          {/* Tab Selector */}
          <div
            style={{
              display: 'flex',
              borderBottom: '1px solid var(--border-subtle)',
              backgroundColor: 'rgba(0, 0, 0, 0.2)',
            }}
          >
            {[
              { id: 'transcript', label: 'Phụ đề song ngữ', icon: FileText },
              { id: 'dictation', label: 'Dictation (Nghe - Chép)', icon: PenTool },
              { id: 'fill', label: 'Điền từ', icon: CheckSquare },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as any);
                    if (tab.id === 'transcript') isLoopingRef.current = null;
                  }}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '14px 10px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    background: 'transparent',
                    border: 'none',
                    borderBottom: isActive ? '2px solid var(--accent-cyan)' : '2px solid transparent',
                    color: isActive ? '#ffffff' : 'var(--text-muted)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Icon size={15} color={isActive ? 'var(--accent-cyan)' : 'currentColor'} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab Body */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {activeTab === 'transcript' && (
              <TranscriptPanel
                segments={segments}
                currentTime={currentTime}
                onSeek={handleSeek}
                onPracticeSentence={(idx) => {
                  setPracticeIndex(idx);
                  setActiveTab('dictation');
                }}
                onSelectWord={(word) => setSelectedWord(word)}
              />
            )}

            {activeTab === 'dictation' && (
              <DictationBox
                segments={segments}
                currentIndex={practiceIndex}
                onNavigateSentence={(idx) => setPracticeIndex(idx)}
                onPlayLoop={handlePlayLoop}
                onSelectWord={(word) => setSelectedWord(word)}
              />
            )}

            {activeTab === 'fill' && (
              <FillBlankBox
                segments={segments}
                currentIndex={practiceIndex}
                onNavigateSentence={(idx) => setPracticeIndex(idx)}
                onPlayLoop={handlePlayLoop}
              />
            )}
          </div>
        </div>
      </div>

      {/* Floating Dictionary & Flashcard Popup */}
      {selectedWord && (
        <SelectionTranslator
          selectedText={selectedWord}
          contextSentence={currentSegment?.text}
          mediaId={mediaId}
          onClose={() => setSelectedWord(null)}
        />
      )}
    </div>
  );
}

export default function WatchPage() {
  return (
    <Suspense
      fallback={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh', color: 'var(--text-muted)' }}>
          Đang tải không gian học tập...
        </div>
      }
    >
      <WatchContent />
    </Suspense>
  );
}
