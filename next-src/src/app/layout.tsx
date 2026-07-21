import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { AuthProvider } from '@/components/auth/AuthProvider';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import CompareTray from '@/components/compare/CompareTray';
import BottomNav from '@/components/layout/BottomNav';
import { THEME_BOOTSTRAP_SCRIPT } from '@/lib/theme-bootstrap.mjs';

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'AI Tool Hub - 按任务查找和比较 AI 工具',
  description: '按写作、设计、研究和开发任务查找、筛选和比较 AI 工具。',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.svg',
  },
  openGraph: {
    title: 'AI Tool Hub - 按任务查找和比较 AI 工具',
    description: '按写作、设计、研究和开发任务查找、筛选和比较 AI 工具。',
    url: 'https://weihub.cloud',
    siteName: 'AI Tool Hub',
    locale: 'zh_CN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Tool Hub - 按任务查找和比较 AI 工具',
    description: '按写作、设计、研究和开发任务查找、筛选和比较 AI 工具。',
  },
  alternates: {
    canonical: 'https://weihub.cloud',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#080B0E',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={geistSans.variable} suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        <script
          id="theme-bootstrap"
          dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }}
        />
      </head>
      <body className="min-h-screen">
        <Navbar />
        <AuthProvider>
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </AuthProvider>
        <Footer />
        <CompareTray />
        <BottomNav />
      </body>
    </html>
  );
}
