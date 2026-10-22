'use client';

import React from 'react';
import type { TranscriptSegment } from '@polyglot/shared';

interface SubtitleOverlayProps {
  currentSegment: TranscriptSegment | null;
  showOriginal?: boolean;
  showTranslation?: boolean;
  onSelectWord?: (word: string) => void;
}

export default function SubtitleOverlay({
  currentSegment,
  showOriginal = true,
  showTranslation = true,
  onSelectWord,
}: SubtitleOverlayProps) {
  if (!currentSegment) return null;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 20,
        width: '90%',
        maxWidth: '840px',
        textAlign: 'center',
        pointerEvents: 'auto',
      }}
    >
      <div
        style={{
          display: 'inline-block',
          padding: '10px 20px',
          borderRadius: '12px',
          backgroundColor: 'rgba(7, 9, 14, 0.85)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
        }}
      >
        {/* Original Sentence */}
        {showOriginal && (
          <div
            style={{
              fontSize: '1.25rem',
              fontWeight: 600,
              color: '#ffffff',
              lineHeight: 1.4,
              letterSpacing: '-0.01em',
              textShadow: '0 2px 4px rgba(0,0,0,0.8)',
              userSelect: 'text',
            }}
          >
            {currentSegment.text.split(' ').map((w, idx) => (
              <span
                key={idx}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectWord?.(w.replace(/[^\p{L}\p{N}']+/gu, ''));
                }}
                style={{
                  display: 'inline-block',
                  marginRight: '6px',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  padding: '0 2px',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(6, 182, 212, 0.35)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                {w}
              </span>
            ))}
          </div>
        )}

        {/* Translated Subtitle */}
        {showTranslation && currentSegment.textVi && (
          <div
            style={{
              fontSize: '1rem',
              fontWeight: 500,
              color: 'var(--accent-cyan-light)',
              marginTop: '4px',
              textShadow: '0 1px 3px rgba(0,0,0,0.8)',
              userSelect: 'text',
            }}
          >
            {currentSegment.textVi}
          </div>
        )}
      </div>
    </div>
  );
}
