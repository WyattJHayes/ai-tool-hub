'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorPageProps) {
  // Route-segment errors: keep the shell (Navbar/Footer) and offer retry.
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 px-6 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--signal-soft)]">
        <AlertTriangle className="h-8 w-8 text-[var(--signal-ink)]" aria-hidden="true" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-[var(--ink)]">页面出了点问题</h1>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-[var(--muted)]">
          加载这个页面时发生了错误。你可以重试；如果问题持续出现，请刷新页面或稍后再来。
        </p>
        {error.digest ? (
          <p className="font-mono text-xs text-[var(--muted-subtle)]">错误编号：{error.digest}</p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={reset}
        className="flex min-h-11 items-center gap-1.5 rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-[var(--on-accent)] hover:bg-[var(--accent-hover)]"
      >
        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        重试
      </button>
    </div>
  );
}
