import Link from 'next/link';
import { Compass, Home, Search } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-5 px-6 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--accent-soft)]">
        <Compass className="h-8 w-8 text-[var(--accent-ink)]" aria-hidden="true" />
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium text-[var(--muted)]">404</p>
        <h1 className="text-2xl font-semibold text-[var(--ink)]">页面不存在</h1>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-[var(--muted)]">
          你访问的链接可能已失效或被移动。回到首页继续浏览，或直接搜索你需要的 AI 工具。
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="flex min-h-11 items-center gap-1.5 rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-[var(--on-accent)] hover:bg-[var(--accent-hover)]"
        >
          <Home className="h-3.5 w-3.5" aria-hidden="true" />
          返回首页
        </Link>
        <Link
          href="/tools"
          className="flex min-h-11 items-center gap-1.5 rounded-md border border-[var(--line-strong)] px-4 text-sm font-medium text-[var(--ink)] hover:border-[var(--accent)] hover:text-[var(--accent-ink)]"
        >
          <Search className="h-3.5 w-3.5" aria-hidden="true" />
          浏览全部工具
        </Link>
      </div>
    </div>
  );
}
