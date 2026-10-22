'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Play, 
  BookOpen, 
  PlusCircle, 
  Layers, 
  Search, 
  HardDrive, 
  CheckCircle2, 
  Clock, 
  Sparkles 
} from 'lucide-react';
import IngestModal from '@/components/IngestModal';
import type { MediaItem } from '@polyglot/shared';

export default function LibraryPage() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'video' | 'article'>('all');
  const [search, setSearch] = useState('');
  const [showIngest, setShowIngest] = useState(false);

  // Initial sample / library items
  useEffect(() => {
    const demoItems: MediaItem[] = [
      {
        id: '00000000-0000-0000-0000-000000000001',
        kind: 'video',
        source_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        canonical_hash: 'youtube_dQw4w9WgXcQ',
        platform: 'youtube',
        title: 'Rick Astley - Never Gonna Give You Up (Official Music Video)',
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
      },
      {
        id: '00000000-0000-0000-0000-000000000002',
        kind: 'video',
        source_url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
        canonical_hash: 'youtube_jNQXAC9IVRw',
        platform: 'youtube',
        title: 'Me at the zoo - First video on YouTube (Luyện nghe A2-B1)',
        lang_original: 'en',
        duration_sec: 19,
        thumbnail_path: 'https://img.youtube.com/vi/jNQXAC9IVRw/hqdefault.jpg',
        storage_mode: 'embed',
        hls_manifest_path: null,
        size_bytes: 0,
        status: 'ready',
        last_accessed_at: new Date().toISOString(),
        created_by: 'system',
        created_at: new Date().toISOString(),
      },
    ];
    setItems(demoItems);
  }, []);

  const filteredItems = items.filter((item) => {
    if (filter !== 'all' && item.kind !== filter) return false;
    if (search && !item.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '36px 24px' }}>
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '32px',
        }}
      >
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '6px' }}>
            Thư viện <span className="text-gradient">Học tập</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Xem lại các video và bài báo đã lưu, tiếp tục bài học dang dở
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* Storage Quota Pill */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 14px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--border-subtle)',
              fontSize: '0.8rem',
            }}
          >
            <HardDrive size={16} color="var(--accent-cyan)" />
            <span>
              Bộ nhớ cá nhân: <strong>0 MB</strong> / 80 MB (YouTube 0 MB)
            </span>
          </div>

          <button onClick={() => setShowIngest(true)} className="btn-primary">
            <PlusCircle size={16} />
            <span>+ Thêm nội dung</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '28px',
          gap: '16px',
        }}
      >
        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {[
            { id: 'all', label: 'Tất cả' },
            { id: 'video', label: 'Video (YouTube / TikTok)' },
            { id: 'article', label: 'Bài báo & Đề thi' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as any)}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.875rem',
                fontWeight: 600,
                background: filter === tab.id ? 'var(--gradient-brand)' : 'rgba(255, 255, 255, 0.05)',
                color: filter === tab.id ? '#ffffff' : 'var(--text-secondary)',
                border: filter === tab.id ? 'none' : '1px solid var(--border-subtle)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            padding: '0 12px',
            width: '280px',
          }}
        >
          <Search size={16} color="var(--text-muted)" style={{ marginRight: '8px' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tiêu đề..."
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
      </div>

      {/* Media Items Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '24px',
        }}
      >
        {filteredItems.map((item) => (
          <div
            key={item.id}
            className="glass-panel glass-panel-hover"
            style={{
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Thumbnail */}
            <div style={{ position: 'relative', width: '100%', height: '180px', backgroundColor: '#000' }}>
              <img
                src={item.thumbnail_path || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600'}
                alt={item.title}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              {/* Platform & Duration Badges */}
              <div
                style={{
                  position: 'absolute',
                  top: '10px',
                  left: '10px',
                }}
              >
                <span className="badge badge-cyan" style={{ textTransform: 'capitalize' }}>
                  {item.platform}
                </span>
              </div>

              {item.duration_sec > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '10px',
                    right: '10px',
                    backgroundColor: 'rgba(0, 0, 0, 0.75)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {formatDuration(item.duration_sec)}
                </div>
              )}
            </div>

            {/* Content info */}
            <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', flex: 1 }}>
              <h3
                style={{
                  fontSize: '1rem',
                  fontWeight: 600,
                  lineHeight: 1.4,
                  marginBottom: '10px',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {item.title}
              </h3>

              {/* Progress bar */}
              <div style={{ marginTop: 'auto', paddingTop: '14px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.78rem',
                    color: 'var(--text-muted)',
                    marginBottom: '6px',
                  }}
                >
                  <span>Tiến độ học</span>
                  <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>45%</span>
                </div>
                <div
                  style={{
                    width: '100%',
                    height: '6px',
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    borderRadius: '3px',
                    overflow: 'hidden',
                    marginBottom: '16px',
                  }}
                >
                  <div
                    style={{
                      width: '45%',
                      height: '100%',
                      background: 'var(--gradient-brand)',
                      borderRadius: '3px',
                    }}
                  />
                </div>

                {/* Continue button */}
                <Link
                  href={item.kind === 'article' ? `/read/${item.id}` : `/watch/${item.id}`}
                  className="btn-primary"
                  style={{ width: '100%', fontSize: '0.85rem', padding: '8px 16px' }}
                >
                  <Play size={15} />
                  <span>Tiếp tục học</span>
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showIngest && <IngestModal onClose={() => setShowIngest(false)} />}
    </div>
  );
}
