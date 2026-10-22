import { Suspense } from 'react';
import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'Polyglot Learn - Học Tiếng Anh Qua Video & Đề Thi AI',
  description: 'Luyện nghe chép chính tả Dictation, làm đề thi TOEIC / IELTS Reading & Listening từ video YouTube, TikTok và bài báo với AI.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body>
        <Suspense fallback={<div style={{ height: '70px', borderBottom: '1px solid var(--border-subtle)' }} />}>
          <Navbar />
        </Suspense>
        <main style={{ minHeight: 'calc(100vh - 70px)', position: 'relative', zIndex: 1 }}>
          {children}
        </main>
      </body>
    </html>
  );
}
