import { LayoutGrid } from 'lucide-react';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-[var(--line)] bg-[var(--surface)] px-6 pb-24 pt-10 md:pb-10">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-start justify-between gap-8">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
              <LayoutGrid className="h-4 w-4 text-[var(--accent)]" />
              AI Tool Hub
            </div>
            <p className="mt-2 max-w-[340px] text-[13px] leading-relaxed text-[var(--muted)]">
              按任务筛选和比较工具，把时间留给真正的工作。
            </p>
          </div>

          <div className="flex flex-wrap gap-5 text-[13px] text-[var(--muted)]">
            <Link href="/tools" className="transition-colors hover:text-[var(--ink)]">工具目录</Link>
            <Link href="/scenes" className="transition-colors hover:text-[var(--ink)]">任务场景</Link>
            <a href="https://github.com/a895411690/ai-tool-hub" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-[var(--ink)]">GitHub</a>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap justify-between gap-4 border-t border-[var(--line)] pt-5 text-xs text-[var(--muted-subtle)]">
          <span>© {new Date().getFullYear()} AI Tool Hub</span>
          <div className="flex flex-wrap items-center gap-4">
            <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-[var(--muted)]">沪ICP备2026013388号</a>
            <a href="https://beian.mps.gov.cn/#/query/webSearch?code=31011502405714" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 transition-colors hover:text-[var(--muted)]">
              <span className="h-3.5 w-3.5 shrink-0 bg-contain bg-center bg-no-repeat" style={{ backgroundImage: "url('/beian-icon.png')" }} aria-hidden="true" />
              沪公网安备31011502405714号
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
