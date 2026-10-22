'use client';

import React, { useState, useEffect } from 'react';
import type { TranscriptSegment } from '@polyglot/shared';
import { normWord } from '@polyglot/shared';
import { RotateCcw, Eye, Check, ChevronLeft, ChevronRight, HelpCircle } from 'lucide-react';
import confetti from 'canvas-confetti';

interface FillBlankBoxProps {
  segments: TranscriptSegment[];
  currentIndex: number;
  onNavigateSentence: (index: number) => void;
  onPlayLoop: (start: number, end: number) => void;
}

const STOPWORDS = new Set(
  ('a an the and or but if of to in on at by for with from as is are was were be been being am ' +
    'i you he she it we they me him her us them my your his its our their this that these those there here ' +
    'do does did have has had not no so than then too very can could will would shall should may might must ' +
    'just about into over out up down off all any some what which who whom whose when where why how ' +
    "it's i'm you're we're they're don't can't won't isn't aren't that's there's let's").split(/\s+/)
);

interface BlankItem {
  index: number;
  word: string;
  norm: string;
  userVal: string;
  isCorrect?: boolean;
}

export default function FillBlankBox({
  segments,
  currentIndex,
  onNavigateSentence,
  onPlayLoop,
}: FillBlankBoxProps) {
  const currentSegment = segments[currentIndex] || null;

  const [blanks, setBlanks] = useState<BlankItem[]>([]);
  const [tokens, setTokens] = useState<string[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!currentSegment) return;
    setRevealed(false);
    setChecked(false);

    const words = currentSegment.text.split(' ');
    setTokens(words);

    // Pick 2-4 content words as blanks
    const candidateIndices: number[] = [];
    words.forEach((w, idx) => {
      const n = normWord(w);
      if (n.length >= 3 && !STOPWORDS.has(n)) {
        candidateIndices.push(idx);
      }
    });

    // Select up to 3 blanks
    const selected = candidateIndices.slice(0, 3);
    const newBlanks: BlankItem[] = selected.map((idx) => ({
      index: idx,
      word: words[idx],
      norm: normWord(words[idx]),
      userVal: '',
    }));

    setBlanks(newBlanks);
    onPlayLoop(currentSegment.start, currentSegment.end);
  }, [currentIndex]);

  if (!currentSegment) return null;

  const handleInputChange = (blankIdx: number, val: string) => {
    setBlanks((prev) =>
      prev.map((b, i) => (i === blankIdx ? { ...b, userVal: val } : b))
    );
  };

  const handleCheck = () => {
    let allCorrect = true;
    const updated = blanks.map((b) => {
      const isOk = normWord(b.userVal) === b.norm;
      if (!isOk) allCorrect = false;
      return { ...b, isCorrect: isOk };
    });
    setBlanks(updated);
    setChecked(true);

    if (allCorrect && updated.length > 0) {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
      });
    }
  };

  const handleReveal = () => {
    setRevealed(true);
    setBlanks((prev) => prev.map((b) => ({ ...b, userVal: b.word, isCorrect: true })));
    setChecked(true);
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
      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '18px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="badge badge-cyan">Điền từ (Fill Blank)</span>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Câu {currentIndex + 1} / {segments.length}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={() => onPlayLoop(currentSegment.start, currentSegment.end)}
            className="btn-secondary"
            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
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

      {/* Sentence with interactive blanks */}
      <div
        className="glass-panel"
        style={{
          padding: '22px',
          backgroundColor: 'rgba(0, 0, 0, 0.35)',
          borderRadius: 'var(--radius-md)',
          lineHeight: 2.2,
          fontSize: '1.15rem',
          marginBottom: '20px',
        }}
      >
        {tokens.map((token, tIdx) => {
          const blankIdx = blanks.findIndex((b) => b.index === tIdx);
          if (blankIdx === -1) {
            return (
              <span key={tIdx} style={{ marginRight: '6px' }}>
                {token}
              </span>
            );
          }

          const blank = blanks[blankIdx];
          const firstChar = blank.word.charAt(0);
          const borderColor = checked
            ? blank.isCorrect
              ? 'var(--accent-emerald)'
              : 'var(--accent-rose)'
            : 'var(--border-glow)';

          return (
            <span
              key={tIdx}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                marginRight: '6px',
                position: 'relative',
              }}
            >
              <input
                type="text"
                value={blank.userVal}
                onChange={(e) => handleInputChange(blankIdx, e.target.value)}
                placeholder={`${firstChar}${'•'.repeat(Math.max(blank.norm.length - 1, 1))}`}
                style={{
                  width: `${Math.max(blank.norm.length * 14, 70)}px`,
                  padding: '4px 8px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  border: `1.5px solid ${borderColor}`,
                  color: '#ffffff',
                  fontSize: '1rem',
                  fontWeight: 600,
                  outline: 'none',
                  textAlign: 'center',
                }}
              />
            </span>
          );
        })}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
        <button
          onClick={handleReveal}
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

      {/* Vietnamese Subtitle Translation */}
      {(revealed || (checked && blanks.every((b) => b.isCorrect))) && currentSegment.textVi && (
        <div
          className="glass-panel"
          style={{
            padding: '14px 18px',
            backgroundColor: 'rgba(6, 182, 212, 0.08)',
            border: '1px solid rgba(6, 182, 212, 0.25)',
            fontSize: '0.92rem',
            color: 'var(--accent-cyan-light)',
          }}
        >
          <strong>Dịch nghĩa: </strong> {currentSegment.textVi}
        </div>
      )}
    </div>
  );
}
