'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  X, 
  Link2, 
  FileText, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2, 
  Loader2,
  Video,
  Globe
} from 'lucide-react';
import YoutubeIcon from './YoutubeIcon';
import { LANGUAGES } from '@polyglot/shared';

interface IngestModalProps {
  onClose: () => void;
}

export default function IngestModal({ onClose }: IngestModalProps) {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [targetLang, setTargetLang] = useState('vi');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressStep, setProgressStep] = useState<string | null>(null);

  // Detect platform based on URL
  const getPlatformInfo = (inputUrl: string) => {
    if (!inputUrl) return null;
    const lower = inputUrl.toLowerCase();
    if (lower.includes('youtube.com') || lower.includes('youtu.be')) {
      return { platform: 'YouTube', icon: YoutubeIcon, color: '#ef4444', tier: 'T1 (Siêu tốc - Direct Embed)' };
    }
    if (lower.includes('tiktok.com')) {
      return { platform: 'TikTok', icon: Video, color: '#06b6d4', tier: 'T2 (GitHub Actions HLS)' };
    }
    if (lower.includes('vimeo.com')) {
      return { platform: 'Vimeo', icon: Video, color: '#3b82f6', tier: 'T2 (GitHub Actions HLS)' };
    }
    if (lower.includes('facebook.com') || lower.includes('fb.watch')) {
      return { platform: 'Facebook', icon: Video, color: '#1877f2', tier: 'T2 (GitHub Actions HLS)' };
    }
    return { platform: 'Bài báo / Trang web', icon: FileText, color: '#10b981', tier: 'Article Ingest' };
  };

  const platformInfo = getPlatformInfo(url);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);
    setProgressStep('Đang khởi tạo job và phân tích URL...');

    try {
      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), targetLang }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Có lỗi xảy ra khi xử lý link');
      }

      setProgressStep('Đã chuẩn bị xong dữ liệu học tập! Đang mở bài học...');
      setTimeout(() => {
        onClose();
        if (data.mediaItem.kind === 'article') {
          router.push(`/read/${data.mediaItem.id}`);
        } else {
          router.push(`/watch/${data.mediaItem.id}`);
        }
      }, 800);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Có lỗi không xác định xảy ra');
      setLoading(false);
      setProgressStep(null);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 100,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      padding: '20px',
    }}>
      <div 
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '560px',
          padding: '28px',
          position: 'relative',
          backgroundColor: 'rgba(13, 18, 31, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
          }}
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'var(--gradient-brand)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Sparkles size={22} color="#ffffff" />
          </div>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Thêm nội dung học mới</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Dán link YouTube, TikTok, Facebook, Vimeo hoặc bất kỳ bài báo nào
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)' }}>
              Đường link (URL)
            </label>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'rgba(0, 0, 0, 0.35)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: '0 14px',
              transition: 'border-color 0.2s ease',
            }}>
              <Link2 size={18} color="var(--text-muted)" style={{ marginRight: '10px' }} />
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=... hoặc https://..."
                style={{
                  width: '100%',
                  padding: '12px 0',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#ffffff',
                  fontSize: '0.92rem',
                }}
              />
            </div>
          </div>

          {/* Platform Preview Badge */}
          {platformInfo && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--border-subtle)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <platformInfo.icon size={18} color={platformInfo.color} />
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{platformInfo.platform}</span>
              </div>
              <span className="badge badge-cyan" style={{ fontSize: '0.7rem' }}>
                {platformInfo.tier}
              </span>
            </div>
          )}

          {/* Language Selection */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px' }}>
              Ngôn ngữ dịch phụ đề
            </label>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'rgba(0, 0, 0, 0.35)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: '0 14px',
            }}>
              <Globe size={18} color="var(--text-muted)" style={{ marginRight: '10px' }} />
              <select
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 0',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#ffffff',
                  fontSize: '0.92rem',
                }}
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code} style={{ backgroundColor: '#0d121f', color: '#fff' }}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'rgba(244, 63, 94, 0.1)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              color: 'var(--accent-rose)',
              fontSize: '0.85rem',
            }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Progress step */}
          {progressStep && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'rgba(6, 182, 212, 0.1)',
              border: '1px solid rgba(6, 182, 212, 0.3)',
              color: 'var(--accent-cyan)',
              fontSize: '0.85rem',
            }}>
              <Loader2 size={16} className="animate-spin" />
              <span>{progressStep}</span>
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="btn-secondary"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="btn-primary"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Đang xử lý...</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>Bắt đầu tạo bài học</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
