'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Sparkles, 
  Play, 
  Link2, 
  PenTool, 
  BookOpen, 
  Award, 
  ArrowRight, 
  CheckCircle2, 
  Zap,
  Globe,
  Loader2
} from 'lucide-react';
import YoutubeIcon from '@/components/YoutubeIcon';
import IngestModal from '@/components/IngestModal';

export default function HomePage() {
  const router = useRouter();
  const [quickUrl, setQuickUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const handleQuickIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickUrl.trim()) return;
    setLoading(true);

    try {
      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: quickUrl.trim(), targetLang: 'vi' }),
      });
      const data = await res.json();
      if (res.ok && data.mediaItem) {
        if (data.mediaItem.kind === 'article') {
          router.push(`/read/${data.mediaItem.id}`);
        } else {
          router.push(`/watch/${data.mediaItem.id}`);
        }
      } else {
        setShowModal(true);
      }
    } catch {
      setShowModal(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Hero Section */}
      <section
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '80px 24px 60px',
          textAlign: 'center',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Release Tag */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 14px',
            borderRadius: 'var(--radius-full)',
            background: 'rgba(99, 102, 241, 0.12)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            marginBottom: '28px',
          }}
        >
          <Sparkles size={15} color="var(--accent-indigo)" />
          <span style={{ fontSize: '0.825rem', fontWeight: 600, color: '#a5b4fc' }}>
            Nâng cấp từ Extension sang Web App độc lập
          </span>
        </div>

        {/* Hero Title */}
        <h1
          style={{
            fontSize: 'clamp(2.4rem, 5vw, 4rem)',
            fontWeight: 800,
            lineHeight: 1.15,
            letterSpacing: '-0.03em',
            marginBottom: '20px',
          }}
        >
          Học Tiếng Anh Đỉnh Cao <br />
          Qua Video & Bài Báo với <span className="text-gradient">AI Polyglot</span>
        </h1>

        {/* Hero Subtitle */}
        <p
          style={{
            fontSize: '1.18rem',
            color: 'var(--text-secondary)',
            maxWidth: '680px',
            margin: '0 auto 40px',
            lineHeight: 1.6,
          }}
        >
          Dán link bất kỳ từ YouTube, TikTok, Facebook hoặc bài báo để luyện nghe chép Dictation,
          điền từ, và giải đề thi TOEIC / IELTS do AI tạo tự động.
        </p>

        {/* Quick URL Ingest Box */}
        <div
          className="glass-panel"
          style={{
            maxWidth: '720px',
            margin: '0 auto 50px',
            padding: '8px',
            display: 'flex',
            alignItems: 'center',
            border: '1px solid var(--border-glow)',
            boxShadow: 'var(--shadow-neon)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              flex: 1,
              padding: '0 16px',
            }}
          >
            <Link2 size={20} color="var(--accent-cyan)" style={{ marginRight: '12px' }} />
            <input
              type="url"
              value={quickUrl}
              onChange={(e) => setQuickUrl(e.target.value)}
              placeholder="Dán link video YouTube, TikTok hoặc link bài báo vào đây..."
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#ffffff',
                fontSize: '1rem',
              }}
            />
          </div>

          <button
            onClick={handleQuickIngest}
            disabled={loading || !quickUrl.trim()}
            className="btn-primary"
            style={{ padding: '12px 24px', fontSize: '0.95rem' }}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Đang xử lý...</span>
              </>
            ) : (
              <>
                <Zap size={16} />
                <span>Bắt đầu học ngay</span>
              </>
            )}
          </button>
        </div>

        {/* Quick Demo Links */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Thử nhanh với mẫu:</span>
          <Link
            href="/watch/00000000-0000-0000-0000-000000000001"
            className="btn-secondary"
            style={{ padding: '6px 14px', fontSize: '0.8rem' }}
          >
            <YoutubeIcon size={14} />
            <span>Rick Astley - Never Gonna Give You Up</span>
          </Link>
          <Link
            href="/library"
            className="btn-ghost"
            style={{ padding: '6px 14px', fontSize: '0.8rem' }}
          >
            <span>Vào Thư viện đã lưu</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </section>

      {/* Feature Grid */}
      <section style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 24px 100px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '24px',
          }}
        >
          {/* Card 1 */}
          <div className="glass-panel glass-panel-hover" style={{ padding: '28px' }}>
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                backgroundColor: 'rgba(6, 182, 212, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '18px',
              }}
            >
              <PenTool size={22} color="var(--accent-cyan)" />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '10px' }}>
              Dictation (Nghe - Chép)
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
              Tự động ngắt từng câu video, phát lặp đoạn ngắn, chấm % độ chính xác bằng thuật toán LCS,
              tô màu từ sai/thiếu và gợi ý từng từ.
            </p>
          </div>

          {/* Card 2 */}
          <div className="glass-panel glass-panel-hover" style={{ padding: '28px' }}>
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                backgroundColor: 'rgba(99, 102, 241, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '18px',
              }}
            >
              <Award size={22} color="var(--accent-indigo)" />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '10px' }}>
              Sinh Đề TOEIC / IELTS AI
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
              Chuyển bất kỳ bài báo nào thành đề thi Reading Part 5/7 hoặc IELTS Reading,
              kèm giải thích tiếng Việt và trích dẫn bằng chứng cụ thể.
            </p>
          </div>

          {/* Card 3 */}
          <div className="glass-panel glass-panel-hover" style={{ padding: '28px' }}>
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '18px',
              }}
            >
              <BookOpen size={22} color="var(--accent-emerald)" />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '10px' }}>
              Sổ Từ Vựng SRS (Flashcards)
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
              Bôi đen bất kỳ từ nào để tra nghĩa và lưu vào sổ từ. Thuật toán lặp lại ngắt quãng (SM-2)
              tự động lên lịch ôn tập mỗi ngày để không bao giờ quên.
            </p>
          </div>

          {/* Card 4 */}
          <div className="glass-panel glass-panel-hover" style={{ padding: '28px' }}>
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                backgroundColor: 'rgba(245, 158, 11, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '18px',
              }}
            >
              <Globe size={22} color="var(--accent-amber)" />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '10px' }}>
              Miễn Phí 100% & Tiết Kiệm
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
              YouTube phát trực tiếp không tốn dung lượng máy chủ, các nền tảng khác nén HLS 360p siêu nhẹ
              được lưu trên Supabase Free.
            </p>
          </div>
        </div>
      </section>

      {showModal && <IngestModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
