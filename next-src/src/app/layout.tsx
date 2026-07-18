import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { AuthProvider } from '@/components/auth/AuthProvider';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import CompareBar from '@/components/compare/CompareBar';
import BottomNav from '@/components/layout/BottomNav';

export const metadata: Metadata = {
  title: 'AI Tool Hub - 发现最佳 AI 工具',
  description: '探索和发现最佳 AI 工具，提升你的工作效率。涵盖 ChatGPT、Midjourney、Stable Diffusion 等热门 AI 工具的导航与推荐。',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.svg',
  },
  openGraph: {
    title: 'AI Tool Hub - 发现最佳 AI 工具',
    description: '探索和发现最佳 AI 工具，提升你的工作效率。',
    url: 'https://weihub.cloud',
    siteName: 'AI Tool Hub',
    locale: 'zh_CN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Tool Hub - 发现最佳 AI 工具',
    description: '探索和发现最佳 AI 工具，提升你的工作效率。',
  },
  alternates: {
    canonical: 'https://weihub.cloud',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f6f7f4',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="min-h-screen">
        <Navbar />
        <AuthProvider>
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </AuthProvider>
        <Footer />
        <CompareBar />
        <BottomNav />
      </body>
    </html>
  );
}
