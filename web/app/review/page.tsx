'use client';

import React, { useState } from 'react';
import { Volume2, RotateCcw, Check, Sparkles, BookOpen, ChevronRight, Award } from 'lucide-react';
import confetti from 'canvas-confetti';

interface Flashcard {
  id: string;
  term: string;
  translation: string;
  context?: string;
  due_at: string;
}

export default function ReviewPage() {
  const [cards, setCards] = useState<Flashcard[]>([
    {
      id: '1',
      term: 'commitment',
      translation: 'sự cam kết, tận tâm',
      context: "A full commitment's what I'm thinking of.",
      due_at: '2026-10-22T00:00:00.000Z',
    },
    {
      id: '2',
      term: 'stranger',
      translation: 'người lạ, kẻ xa lạ',
      context: "We're no strangers to love.",
      due_at: '2026-10-22T00:00:00.000Z',
    },
    {
      id: '3',
      term: 'comprehension',
      translation: 'sự hiểu biết, khả năng lĩnh hội',
      context: 'Reading comprehension is essential for IELTS.',
      due_at: '2026-10-22T00:00:00.000Z',
    },
  ]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const currentCard = cards[currentIndex];

  const playTTS = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      window.speechSynthesis.speak(u);
    }
  };

  const handleGrade = (grade: number) => {
    setIsFlipped(false);
    if (currentIndex < cards.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setIsDone(true);
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '48px 24px' }}>
      <div style={{ textAlign: 'center', marginBottom: '36px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '6px' }}>
          Sổ Từ Vựng <span className="text-gradient">SRS Flashcards</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Học lặp lại ngắt quãng (SuperMemo-2) để ghi nhớ từ vựng vĩnh viễn
        </p>
      </div>

      {!isDone && currentCard ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {/* Card Counter */}
          <div
            style={{
              marginBottom: '16px',
              fontSize: '0.85rem',
              color: 'var(--text-muted)',
              fontWeight: 600,
            }}
          >
            Từ {currentIndex + 1} / {cards.length} cần ôn tập
          </div>

          {/* Flashcard Box */}
          <div
            onClick={() => setIsFlipped(!isFlipped)}
            className="glass-panel"
            style={{
              width: '100%',
              minHeight: '280px',
              padding: '36px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              backgroundColor: 'rgba(18, 25, 41, 0.85)',
              border: '1px solid var(--border-glow)',
              textAlign: 'center',
              transition: 'transform 0.2s ease',
              marginBottom: '28px',
            }}
          >
            {/* Front: Word & Context */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <span style={{ fontSize: '2.2rem', fontWeight: 800, color: '#ffffff' }}>
                {currentCard.term}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  playTTS(currentCard.term);
                }}
                className="btn-ghost"
                style={{ padding: '6px', color: 'var(--accent-cyan)' }}
                title="Phát âm"
              >
                <Volume2 size={20} />
              </button>
            </div>

            {currentCard.context && (
              <p style={{ fontSize: '1.05rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginBottom: '16px' }}>
                &ldquo;{currentCard.context}&rdquo;
              </p>
            )}

            {/* Back: Translation */}
            {isFlipped ? (
              <div
                style={{
                  marginTop: '16px',
                  paddingTop: '16px',
                  borderTop: '1px solid var(--border-subtle)',
                  width: '100%',
                }}
              >
                <span
                  style={{
                    fontSize: '1.5rem',
                    fontWeight: 700,
                    color: 'var(--accent-cyan-light)',
                  }}
                >
                  {currentCard.translation}
                </span>
              </div>
            ) : (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '20px' }}>
                (Bấm vào thẻ để lật xem nghĩa)
              </div>
            )}
          </div>

          {/* SM-2 Buttons (shown when flipped) */}
          {isFlipped ? (
            <div style={{ display: 'flex', gap: '12px', width: '100%', justifyContent: 'center' }}>
              <button
                onClick={() => handleGrade(1)}
                className="btn-secondary"
                style={{ borderColor: 'var(--accent-rose)', color: 'var(--accent-rose)' }}
              >
                Chưa nhớ (Lặp lại)
              </button>
              <button
                onClick={() => handleGrade(2)}
                className="btn-secondary"
                style={{ borderColor: 'var(--accent-amber)', color: 'var(--accent-amber)' }}
              >
                Khó nhớ
              </button>
              <button
                onClick={() => handleGrade(3)}
                className="btn-secondary"
                style={{ borderColor: 'var(--accent-cyan)', color: 'var(--accent-cyan)' }}
              >
                Nhớ tốt
              </button>
              <button onClick={() => handleGrade(4)} className="btn-primary">
                Rất dễ (SRS +4 ngày)
              </button>
            </div>
          ) : (
            <button onClick={() => setIsFlipped(true)} className="btn-secondary" style={{ padding: '10px 24px' }}>
              Xem đáp án & Chấm điểm
            </button>
          )}
        </div>
      ) : (
        /* Completion screen */
        <div
          className="glass-panel"
          style={{
            padding: '48px',
            textAlign: 'center',
            backgroundColor: 'rgba(18, 25, 41, 0.8)',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
            }}
          >
            <Award size={32} color="var(--accent-emerald)" />
          </div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '10px' }}>
            Xuất sắc! Đã hoàn thành ôn tập hôm nay
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
            Bạn đã ôn tập toàn bộ từ vựng đến hạn. Hãy duy trì chuỗi học mỗi ngày nhé!
          </p>
          <button
            onClick={() => {
              setCurrentIndex(0);
              setIsDone(false);
            }}
            className="btn-primary"
          >
            <RotateCcw size={16} />
            <span>Ôn lại lần nữa</span>
          </button>
        </div>
      )}
    </div>
  );
}
