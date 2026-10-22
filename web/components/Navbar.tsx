'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Compass, 
  BookOpen, 
  Layers, 
  BarChart2, 
  Sparkles, 
  PlusCircle, 
  Settings, 
  ExternalLink,
  Flame,
  Award
} from 'lucide-react';
import IngestModal from '@/components/IngestModal';

export default function Navbar() {
  const pathname = usePathname();
  const [showIngest, setShowIngest] = useState(false);

  const navLinks = [
    { href: '/', label: 'Khám phá', icon: Compass },
    { href: '/library', label: 'Thư viện', icon: Layers },
    { href: '/review', label: 'Sổ từ vựng', icon: BookOpen },
    { href: '/dashboard', label: 'Tiến độ', icon: BarChart2 },
  ];

  return (
    <>
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        backgroundColor: 'rgba(7, 9, 14, 0.75)',
        borderBottom: '1px solid var(--border-subtle)',
        padding: '0 24px',
      }}>
        <div style={{
          maxWidth: '1280px',
          margin: '0 auto',
          height: '70px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          {/* Logo & Brand */}
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'var(--gradient-brand)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow-neon)',
            }}>
              <Sparkles size={20} color="#ffffff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 800, fontSize: '1.18rem', letterSpacing: '-0.02em' }}>
                  Polyglot<span className="text-gradient">Learn</span>
                </span>
                <span className="badge badge-cyan" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>Web AI</span>
              </div>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Nghe chép Dictation & Luyện thi</p>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {navLinks.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: isActive ? '#ffffff' : 'var(--text-secondary)',
                    backgroundColor: isActive ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                    border: isActive ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid transparent',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Icon size={16} color={isActive ? 'var(--accent-cyan)' : 'currentColor'} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Right Action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Streak & Quota Pill */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              fontSize: '0.8rem',
              fontWeight: 600,
              color: 'var(--accent-amber)',
            }}>
              <Flame size={15} />
              <span>3 ngày liên tiếp</span>
            </div>

            {/* Ingest Action Button */}
            <button
              onClick={() => setShowIngest(true)}
              className="btn-primary"
              style={{ fontSize: '0.875rem', padding: '8px 16px' }}
            >
              <PlusCircle size={16} />
              <span>Thêm video / bài báo</span>
            </button>
          </div>
        </div>
      </header>

      {/* Ingest Modal */}
      {showIngest && (
        <IngestModal onClose={() => setShowIngest(false)} />
      )}
    </>
  );
}
