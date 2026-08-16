'use client';

import { RefreshCw } from 'lucide-react';

// Root layout itself failed to render — the shell is gone, so this page
// must be fully self-contained (no Navbar/Footer, no design-token vars
// from :root globals, inline fallback styles only).
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="zh-CN">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          padding: '24px',
          background: '#06060b',
          color: '#e2e8f0',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          textAlign: 'center',
        }}
      >
        <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>应用出现异常</h1>
        <p style={{ margin: 0, maxWidth: '420px', fontSize: '14px', lineHeight: 1.7, color: '#94a3b8' }}>
          页面框架加载失败。请尝试重新加载；如果问题持续，请清除站点缓存后重试。
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            minHeight: '44px',
            padding: '0 18px',
            borderRadius: '6px',
            border: 'none',
            background: '#0e7490',
            color: '#ffffff',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={14} aria-hidden="true" />
          重新加载
        </button>
      </body>
    </html>
  );
}
