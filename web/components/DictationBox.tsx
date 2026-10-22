'use client';

import React, { useState, useEffect } from 'react';
import type { TranscriptSegment } from '@polyglot/shared';
import { evaluateDictation, type DictationResult } from '@polyglot/shared';
import { 
  Play, 
  RotateCcw, 
  HelpCircle, 
  Eye, 
  Check, 
  ChevronLeft, 
  ChevronRight,
  Sparkles,
  Volume2
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface DictationBoxProps {
  segments: TranscriptSegment[];
  currentIndex: number;
  onNavigateSentence: (index: number) => void;
  onPlayLoop: (start: number, end: number) => void;
  onSelectWord?: (word: string) => void;
}

export default function DictationBox({
  segments,
  currentIndex,
  onNavigateSentence,
  onPlayLoop,
  onSelectWord,
}: DictationBoxProps) {
  const currentSegment = segments[currentIndex] || null;

  const [inputVal, setInputVal] = useState('');
  const [hintCount, setHintCount] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [result, setResult] = useState<DictationResult | null>(null);

  // Reset when sentence index changes
  useEffect(() => {
    setInputVal('');
    setHintCount(0);
    setRevealed(false);
    setResult(null);
    if (currentSegment) {
      onPlayLoop(currentSegment.start, currentSegment.end);
    }
  }, [currentIndex]);

  if (!currentSegment) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
        Không có dữ liệu câu để luyện nghe chép.
      </div>
    );
  }

  const handleCheck = () => {
    const res = evaluateDictation(currentSegment.text, inputVal, hintCount);
    setResult(res);

    if (res.isPerfect || res.accuracy === 100) {
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.7 },
      });
    }
  };

  const handleHint = () => {
    const words = currentSegment.text.split(' ');
    const inputWords = inputVal.trim() ? inputVal.trim().split(/\s+/) : [];
    let k = 0;
    while (k < words.length && k < inputWords.length && words[k].toLowerCase() === inputWords[k].toLowerCase()) {
      k++;
    }
    if (k < words.length) {
      const nextInput = words.slice(0, k + 1).join(' ') + ' ';
      setInputVal(nextInput);
      setHintCount((prev) => prev + 1);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (result && (revealed || result.isPerfect)) {
        // Go to next sentence
        if (currentIndex < segments.length - 1) {
          onNavigateSentence(currentIndex + 1);
        }
      } else {
        handleCheck();
      }
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: '20px',
        backgroundColor: 'var(--bg-secondary)',
        overflowY: 'auto',
      }}
    >
      {/* Header bar: Sentence counter & Nav */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '18px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="badge badge-indigo">Dictation Mode</span>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Câu {currentIndex + 1} / {segments.length}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={() => onPlayLoop(currentSegment.start, currentSegment.end)}
            className="btn-secondary"
            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
            title="Nghe lại đoạn này"
          >
            <RotateCcw size={14} />
            <span>Nghe lại</span>
          </button>

          <button
            disabled={currentIndex <= 0}
            onClick={() => onNavigateSentence(currentIndex - 1)}
            className="btn-ghost"
            style={{ padding: '6px' }}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            disabled={currentIndex >= segments.length - 1}
            onClick={() => onNavigateSentence(currentIndex + 1)}
            className="btn-ghost"
            style={{ padding: '6px' }}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Input box */}
      <div style={{ marginBottom: '14px' }}>
        <textarea
          rows={3}
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Nghe và gõ lại câu tiếng Anh bạn nghe được... (Nhấn Enter để kiểm tra)"
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            border: '1px solid var(--border-subtle)',
            color: '#ffffff',
            fontSize: '1rem',
            lineHeight: 1.5,
            outline: 'none',
            resize: 'none',
            fontFamily: 'inherit',
          }}
        />
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
        <button
          onClick={handleHint}
          className="btn-secondary"
          style={{ padding: '8px 14px', fontSize: '0.85rem' }}
        >
          <HelpCircle size={15} />
          <span>Gợi ý 1 từ</span>
        </button>

        <button
          onClick={() => {
            setRevealed(true);
            handleCheck();
          }}
          className="btn-secondary"
          style={{ padding: '8px 14px', fontSize: '0.85rem' }}
        >
          <Eye size={15} />
          <span>Xem đáp án</span>
        </button>

        <button
          onClick={handleCheck}
          className="btn-primary"
          style={{ padding: '8px 18px', fontSize: '0.85rem', marginLeft: 'auto' }}
        >
          <Check size={16} />
          <span>Kiểm tra</span>
        </button>
      </div>

      {/* Results and Word Comparison Card */}
      {result && (
        <div
          className="glass-panel"
          style={{
            padding: '18px',
            backgroundColor: 'rgba(18, 25, 41, 0.8)',
            border: '1px solid var(--border-glow)',
          }}
        >
          {/* Accuracy Score Banner */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span
                style={{
                  fontSize: '1.4rem',
                  fontWeight: 800,
                  color:
                    result.accuracy >= 90
                      ? 'var(--accent-emerald)'
                      : result.accuracy >= 60
                      ? 'var(--accent-amber)'
                      : 'var(--accent-rose)',
                }}
              >
                {result.accuracy}%
              </span>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                {result.isPerfect
                  ? 'Tuyệt vời! Chính xác 100%. Nhấn Enter để sang câu tiếp theo.'
                  : revealed
                  ? 'Đáp án chi tiết bên dưới.'
                  : 'Hãy nghe lại và sửa những từ chưa đúng nhé!'}
              </span>
            </div>

            {result.accuracy === 100 && (
              <span className="badge badge-emerald">
                <Sparkles size={13} /> Hoàn hảo
              </span>
            )}
          </div>

          {/* Word Pills Comparison */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '6px',
              padding: '14px',
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '14px',
              lineHeight: 1.8,
            }}
          >
            {result.expectedTokens.map((w, idx) => {
              const isMatched = result.matchedExpected.includes(idx);
              if (isMatched) {
                return (
                  <span
                    key={idx}
                    style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(16, 185, 129, 0.2)',
                      color: 'var(--accent-emerald)',
                      fontWeight: 600,
                    }}
                  >
                    {w.raw}
                  </span>
                );
              }
              if (revealed || result.isPerfect) {
                return (
                  <span
                    key={idx}
                    style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(244, 63, 94, 0.2)',
                      color: 'var(--accent-rose)',
                      fontWeight: 600,
                    }}
                  >
                    {w.raw}
                  </span>
                );
              }
              // Masked bullets
              return (
                <span
                  key={idx}
                  style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    color: 'var(--text-muted)',
                  }}
                >
                  {'•'.repeat(Math.min(w.raw.length, 6))}
                </span>
              );
            })}
          </div>

          {/* Wrong / Extra Words */}
          {result.wrongTokens.length > 0 && (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
              <span>Từ gõ sai hoặc thừa: </span>
              {result.wrongTokens.map((wt, i) => (
                <span
                  key={i}
                  style={{
                    textDecoration: 'line-through',
                    color: 'var(--accent-rose)',
                    marginRight: '6px',
                  }}
                >
                  {wt}
                </span>
              ))}
            </div>
          )}

          {/* Vietnamese Translation (shown upon reveal or completion) */}
          {(revealed || result.isPerfect) && currentSegment.textVi && (
            <div
              style={{
                marginTop: '10px',
                paddingTop: '10px',
                borderTop: '1px solid var(--border-subtle)',
                fontSize: '0.9rem',
                color: 'var(--accent-cyan-light)',
              }}
            >
              <strong>Bản dịch: </strong> {currentSegment.textVi}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
