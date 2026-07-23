'use client';

import { LayoutGrid, Moon, Share2, Sun, User } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useUserStore } from '@/stores/useUserStore';

const navItems = [
  { href: '/tools', label: '工具' },
  { href: '/scenes', label: '场景' },
  { href: '/leaderboard', label: '排行' },
  { href: '/resume/', label: '简历优化' },
];

export default function Navbar() {
  const pathname = usePathname();
  const toggleTheme = useUserStore((state) => state.toggleTheme);

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: 'AI Tool Hub',
        text: '按任务找到合适的 AI 工具',
        url: window.location.href,
      });
      return;
    }

    await navigator.clipboard.writeText(window.location.href);
  };

  return (
    <nav className="sticky top-0 z-[1000] h-16 border-b border-[var(--line)] bg-[var(--surface)]" aria-label="主导航">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex min-h-11 items-center gap-2.5 no-underline">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--ink)] text-[var(--surface)]">
            <LayoutGrid className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
          <span className="text-base font-semibold text-[var(--ink)] sm:text-lg">AI Tool Hub</span>
        </Link>

        <div className="hidden h-full items-center gap-7 md:flex">
          {navItems.map((item) => {
            const activeHref = item.href.replace(/\/$/, '');
            const active = pathname === activeHref || pathname.startsWith(`${activeHref}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'instrument-nav-item flex h-full items-center text-sm font-medium transition-colors',
                  active ? 'text-[var(--accent-ink)]' : 'text-[var(--muted)] hover:text-[var(--ink)]'
                )}
                data-orientation="desktop"
                data-active={active ? 'true' : undefined}
                aria-current={active ? 'page' : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={toggleTheme}
            className="flex h-11 w-11 items-center justify-center rounded-md text-[var(--muted)] transition-colors duration-150 hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)]"
            title="切换主题"
          >
            <Moon className="h-[18px] w-[18px] dark:hidden" aria-hidden="true" />
            <Sun className="hidden h-[18px] w-[18px] dark:block" aria-hidden="true" />
            <span className="sr-only dark:hidden">切换到暗色主题</span>
            <span className="sr-only hidden dark:inline">切换到亮色主题</span>
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="hidden h-11 w-11 items-center justify-center rounded-md text-[var(--muted)] transition-colors duration-150 hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)] sm:flex"
            aria-label="分享当前页面"
            title="分享"
          >
            <Share2 className="h-[18px] w-[18px]" />
          </button>
          <Link
            href="/user"
            className="flex h-11 w-11 items-center justify-center rounded-md text-[var(--muted)] transition-colors duration-150 hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)]"
            aria-label="我的工具箱"
            title="我的工具箱"
          >
            <User className="h-[18px] w-[18px]" />
          </Link>
        </div>
      </div>
    </nav>
  );
}
