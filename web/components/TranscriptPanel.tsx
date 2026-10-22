'use client';

import React, { useState, useEffect, useRef } from 'react';
import type { TranscriptSegment } from '@polyglot/shared';
import { Search, Play, Volume2, PenTool, Copy, Check } from 'lucide-react';

interface TranscriptPanelProps {
  segments: TranscriptSegment[];
  currentTime: number;
  onSeek: (timeSec: number) => void;
  onPracticeSentence?: (index: number) => void;
  onSelectWord?: (word: string) => void;
}

export default function TranscriptPanel({
  segments,
  currentTime,
  onSeek,
  onPracticeSentence,
  onSelectWord,
}: TranscriptPanelProps) {
  const [search, setSearch] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const activeItemRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Find active segment index
  const activeIdx = segments.findIndex(
    (s) => currentTime >= s.start && currentTime <= s.end
  );

  // Auto-scroll to active item
  useEffect(() => {
    if (autoScroll && activeItemRef.current && containerRef.current) {
      activeItemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [activeIdx, autoScroll]);

  const filteredSegments = segments.filter(
    (s) =>
      s.text.toLowerCase().includes(search.toLowerCase()) ||
      (s.textVi && s.textVi.toLowerCase().includes(search.toLowerCase()))
  );

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1500);
  };

  const playTTS = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      u.rate = 0.95;
      window.speechSynthesis.speak(u);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'var(--bg-secondary)',
        borderLeft: '1px solid var(--border-subtle)',
      }}
    >
      {/* Top Search & Controls */}
      <div
        style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            padding: '0 10px',
          }}
        >
          <Search size={16} color="var(--text-muted)" style={{ marginRight: '8px' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm trong phụ đề..."
            style={{
              width: '100%',
              padding: '8px 0',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#ffffff',
              fontSize: '0.85rem',
            }}
          />
        </div>

        <button
          onClick={() => setAutoScroll(!autoScroll)}
          className="btn-ghost"
          style={{
            fontSize: '0.75rem',
            padding: '6px 10px',
            color: autoScroll ? 'var(--accent-cyan)' : 'var(--text-muted)',
            backgroundColor: autoScroll ? 'rgba(6, 182, 212, 0.1)' : 'transparent',
            borderRadius: '6px',
          }}
        >
          Auto-scroll {autoScroll ? 'Bật' : 'Tắt'}
        </button>
      </div>

      {/* Segments List */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {filteredSegments.map((seg) => {
          const isActive = seg.i === activeIdx;
          return (
            <div
              key={seg.i}
              ref={isActive ? activeItemRef : null}
              onClick={() => onSeek(seg.start)}
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: isActive ? 'rgba(99, 102, 241, 0.14)' : 'rgba(255, 255, 255, 0.02)',
                border: isActive
                  ? '1px solid var(--border-glow)'
                  : '1px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              className="glass-panel-hover"
            >
              {/* Header row: time badge & actions */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '6px',
                }}
              >
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontFamily: 'var(--font-mono)',
                    color: isActive ? 'var(--accent-cyan)' : 'var(--text-muted)',
                    fontWeight: 600,
                  }}
                >
                  {formatTime(seg.start)} - {formatTime(seg.end)}
                </span>

                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => playTTS(seg.text)}
                    title="Nghe phát âm (TTS)"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '4px',
                    }}
                  >
                    <Volume2 size={14} />
                  </button>

                  <button
                    onClick={() => handleCopy(seg.text, seg.i)}
                    title="Sao chép câu"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '4px',
                    }}
                  >
                    {copiedIdx === seg.i ? <Check size={14} color="var(--accent-emerald)" /> : <Copy size={14} />}
                  </button>

                  {onPracticeSentence && (
                    <button
                      onClick={() => onPracticeSentence(seg.i)}
                      title="Luyện chép câu này (Dictation)"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--accent-cyan)',
                        cursor: 'pointer',
                        padding: '4px',
                      }}
                    >
                      <PenTool size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Original Text */}
              <div
                style={{
                  fontSize: '0.938rem',
                  lineHeight: 1.45,
                  fontWeight: 500,
                  color: isActive ? '#ffffff' : 'var(--text-primary)',
                  marginBottom: seg.textVi ? '4px' : '0',
                }}
              >
                {seg.text.split(' ').map((word, wIdx) => (
                  <span
                    key={wIdx}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectWord?.(word.replace(/[^\p{L}\p{N}']+/gu, ''));
                    }}
                    style={{
                      display: 'inline-block',
                      marginRight: '4px',
                      cursor: 'pointer',
                      borderRadius: '3px',
                      padding: '0 2px',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(6, 182, 212, 0.25)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    {word}
                  </span>
                ))}
              </div>

              {/* Vietnamese Translation */}
              {seg.textVi && (
                <div
                  style={{
                    fontSize: '0.825rem',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.35,
                  }}
                >
                  {seg.textVi}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
