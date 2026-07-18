'use client';

import { Heart, Home, LayoutGrid, Trophy } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const navItems = [
  { icon: Home, label: '首页', href: '/' },
  { icon: LayoutGrid, label: '工具', href: '/tools' },
  { icon: Trophy, label: '排行', href: '/leaderboard' },
  { icon: Heart, label: '我的', href: '/user' },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-[100] border-t border-[var(--line)] bg-[var(--surface)] pb-[env(safe-area-inset-bottom,0px)] md:hidden" aria-label="移动端导航">
      <div className="mx-auto grid max-w-[500px] grid-cols-4 px-2 py-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-md text-[11px] transition-colors duration-150',
                active ? 'text-[var(--accent)]' : 'text-[var(--muted-subtle)] hover:text-[var(--ink)]'
              )}
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
