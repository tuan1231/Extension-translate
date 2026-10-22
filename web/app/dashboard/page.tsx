'use client';

import React from 'react';
import Link from 'next/link';
import { 
  Flame, 
  BarChart2, 
  BookOpen, 
  Clock, 
  Award, 
  Play, 
  CheckCircle2, 
  TrendingUp,
  Target
} from 'lucide-react';

export default function DashboardPage() {
  const stats = [
    { label: 'Chuỗi học liên tiếp', value: '3 ngày', icon: Flame, color: 'var(--accent-amber)' },
    { label: 'Từ vựng đã lưu', value: '24 từ', icon: BookOpen, color: 'var(--accent-cyan)' },
    { label: 'Độ chính xác Dictation', value: '94%', icon: TrendingUp, color: 'var(--accent-emerald)' },
    { label: 'Thời lượng đã học', value: '45 phút', icon: Clock, color: 'var(--accent-indigo)' },
  ];

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 24px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '6px' }}>
          Tiến Độ <span className="text-gradient">Học Tập & Thống Kê</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Theo dõi chuỗi học, chỉ số luyện nghe Dictation và trình độ TOEIC / IELTS ước tính
        </p>
      </div>

      {/* Metric Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '20px',
          marginBottom: '36px',
        }}
      >
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className="glass-panel" style={{ padding: '22px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '12px',
                }}
              >
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                  {stat.label}
                </span>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon size={18} color={stat.color} />
                </div>
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ffffff' }}>
                {stat.value}
              </div>
            </div>
          );
        })}
      </div>

      {/* Target Exam Goal Card */}
      <div
        className="glass-panel"
        style={{
          padding: '28px',
          marginBottom: '36px',
          backgroundColor: 'rgba(99, 102, 241, 0.08)',
          border: '1px solid var(--border-glow)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: 'var(--gradient-brand)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow-neon)',
            }}
          >
            <Target size={28} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Mục tiêu: TOEIC 850+ / IELTS 7.0</h3>
              <span className="badge badge-cyan">Đang tiến triển</span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Điểm ước tính hiện tại: <strong>Listening 390/495</strong> • Dự kiến đạt mục tiêu trong 6 tuần
            </p>
          </div>
        </div>

        <Link href="/library" className="btn-primary">
          <Play size={16} />
          <span>Tiếp tục bài học tiếp theo</span>
        </Link>
      </div>
    </div>
  );
}
