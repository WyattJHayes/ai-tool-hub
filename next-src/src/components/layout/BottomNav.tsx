'use client';

import { FileText, Heart, Home, LayoutGrid, Trophy } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRef } from 'react';
import { useFixedSurfaceGeometry } from '@/hooks/useFixedSurfaceGeometry';
import { cn } from '@/lib/utils';

const navItems = [
  { icon: Home, label: '首页', href: '/' },
  { icon: LayoutGrid, label: '工具', href: '/tools' },
  { icon: FileText, label: '简历', href: '/resume' },
  { icon: Trophy, label: '排行', href: '/leaderboard' },
  { icon: Heart, label: '我的', href: '/user' },
];

export default function BottomNav() {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  useFixedSurfaceGeometry(navRef, '--mobile-nav-block-size', true);

  return (
    <nav
      ref={navRef}
      data-mobile-bottom-nav
      aria-label="移动端导航"
      className="fixed inset-x-0 bottom-0 z-[100] box-border h-[calc(64px+env(safe-area-inset-bottom,0px))] border-t border-[var(--line)] bg-[var(--surface)] pb-[env(safe-area-inset-bottom,0px)] md:hidden"
    >
      <div className="mx-auto grid max-w-[500px] grid-cols-5 px-2 py-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.href === '/'
            ? pathname === '/'
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'instrument-nav-item flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-md text-[11px] transition-colors',
                active ? 'text-[var(--accent-ink)]' : 'text-[var(--muted-subtle)] hover:text-[var(--ink)]'
              )}
              data-orientation="mobile"
              data-active={active ? 'true' : undefined}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
