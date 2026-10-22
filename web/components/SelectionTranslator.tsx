'use client';

import React, { useState, useEffect } from 'react';
import { Volume2, Bookmark, Check, X, Loader2 } from 'lucide-react';
import { Translator } from '@/lib/translator';

interface SelectionTranslatorProps {
  selectedText: string | null;
  contextSentence?: string;
  mediaId?: string;
  onClose: () => void;
}

export default function SelectionTranslator({
  selectedText,
  contextSentence,
  mediaId,
  onClose,
}: SelectionTranslatorProps) {
  const [translation, setTranslation] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!selectedText) return;
    setLoading(true);
    setSaved(false);

    Translator.translate(selectedText, 'vi', 'auto')
      .then((res) => {
        setTranslation(res.translatedText);
        setLoading(false);
      })
      .catch(() => {
        setTranslation('Không thể dịch từ này');
        setLoading(false);
      });
  }, [selectedText]);

  if (!selectedText) return null;

  const playTTS = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(selectedText);
      u.lang = 'en-US';
      window.speechSynthesis.speak(u);
    }
  };

  const handleSaveVocab = async () => {
    try {
      const res = await fetch('/api/vocab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          term: selectedText,
          translation,
          context: contextSentence,
          mediaId,
        }),
      });
      if (res.ok) {
        setSaved(true);
      }
    } catch {
      // ignore
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '80px',
        right: '24px',
        zIndex: 90,
        width: '320px',
        padding: '16px',
        borderRadius: 'var(--radius-md)',
        backgroundColor: 'rgba(13, 18, 31, 0.95)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid var(--border-glow)',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.6)',
      }}
      className="glass-panel"
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: 700, fontSize: '1.05rem', color: '#ffffff' }}>
            {selectedText}
          </span>
          <button
            onClick={playTTS}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--accent-cyan)',
              cursor: 'pointer',
              padding: '2px',
            }}
            title="Nghe phát âm"
          >
            <Volume2 size={16} />
          </button>
        </div>

        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Translation */}
      <div style={{ fontSize: '0.92rem', color: 'var(--accent-cyan-light)', marginBottom: '14px' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Loader2 size={14} className="animate-spin" />
            <span>Đang tra cứu nghĩa...</span>
          </div>
        ) : (
          translation
        )}
      </div>

      {/* Save to Vocabulary button */}
      <button
        onClick={handleSaveVocab}
        disabled={saved || loading}
        className="btn-secondary"
        style={{
          width: '100%',
          padding: '6px 12px',
          fontSize: '0.8rem',
          justifyContent: 'center',
          borderColor: saved ? 'var(--accent-emerald)' : 'var(--border-subtle)',
          color: saved ? 'var(--accent-emerald)' : 'var(--text-primary)',
        }}
      >
        {saved ? (
          <>
            <Check size={14} />
            <span>Đã lưu vào Sổ từ vựng</span>
          </>
        ) : (
          <>
            <Bookmark size={14} />
            <span>+ Lưu vào Sổ từ (SRS Flashcards)</span>
          </>
        )}
      </button>
    </div>
  );
}
