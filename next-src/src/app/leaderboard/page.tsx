'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BarChart3, Eye, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToolStore } from '@/stores/useToolStore';
import { getToolSlug } from '@/lib/tools-data';
import { ToolIcon } from '@/lib/icon-map';

const tabs = [
  { key: 'clicks' as const, label: '热度排行', icon: Eye },
  { key: 'hot' as const, label: '常用工具', icon: TrendingUp },
  { key: 'newest' as const, label: '最新收录', icon: BarChart3 },
];

export default function LeaderboardPage() {
  const { tools, clickStats, loadData, dataLoaded } = useToolStore();
  const [tab, setTab] = useState<'clicks' | 'hot' | 'newest'>('clicks');

  useEffect(() => {
    if (!dataLoaded) loadData();
  }, [dataLoaded, loadData]);

  const ranked = [...tools].sort((left, right) => {
    if (tab === 'clicks') {
      const clickDifference = (clickStats[String(right.id)] || 0) - (clickStats[String(left.id)] || 0);
      return clickDifference || (right.status === 'hot' ? 1 : 0) - (left.status === 'hot' ? 1 : 0);
    }
    if (tab === 'hot') return (right.status === 'hot' ? 1 : 0) - (left.status === 'hot' ? 1 : 0);
    return right.id - left.id;
  });
  const hasClickData = Object.keys(clickStats).length > 0;

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-4 pb-24 pt-10 text-[var(--ink)] sm:px-6 sm:pb-16 sm:pt-12">
      <header className="mb-7">
        <h1 className="text-3xl font-semibold">排行榜</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">按实际使用热度和收录时间查看工具</p>
      </header>

      <div className="mb-7 flex overflow-x-auto rounded-md border border-[var(--line)] bg-[var(--surface)]" role="tablist" aria-label="排行榜类型">
        {tabs.map((item, index) => {
          const Icon = item.icon;
          const active = tab === item.key;
          return (
            <button
              type="button"
              role="tab"
              aria-selected={active}
              key={item.key}
              onClick={() => setTab(item.key)}
              className={cn(
                'flex min-h-11 flex-1 shrink-0 items-center justify-center gap-1.5 px-3 text-sm font-medium transition-colors',
                index > 0 && 'border-l border-[var(--line)]',
                active ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)]'
              )}
            >
              <Icon className="h-4 w-4" />{item.label}
            </button>
          );
        })}
      </div>

      {tab === 'clicks' && !hasClickData ? (
        <div className="mb-5 rounded-lg border border-dashed border-[var(--line-strong)] bg-[var(--surface)] px-6 py-8 text-center">
          <p className="text-sm font-medium text-[var(--ink)]">暂无真实点击数据</p>
          <p className="mt-1 text-xs text-[var(--muted)]">当前先按常用状态排列，使用数据生成后会自动更新</p>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)]">
        {ranked.map((tool, index) => {
          const clicks = clickStats[String(tool.id)] || 0;
          const showClicks = tab === 'clicks' && hasClickData && clicks > 0;
          return (
            <Link key={tool.id} href={`/tools/${getToolSlug(tool)}`} className="group flex min-h-[72px] items-center gap-3 border-b border-[var(--line)] px-4 py-3 last:border-b-0 hover:bg-[var(--surface-subtle)] sm:px-5">
              <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center text-sm font-semibold', index < 3 ? 'text-[var(--accent)]' : 'text-[var(--muted-subtle)]')}>{index + 1}</span>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[var(--surface-subtle)] text-[var(--accent)]"><ToolIcon name={tool.icon} className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold">{tool.name}</span>
                  {tool.status === 'hot' ? <span className="rounded border border-red-100 bg-red-50 px-1.5 py-0.5 text-[10px] text-[var(--danger)] dark:border-red-950 dark:bg-red-950/40">常用</span> : null}
                </span>
                <span className="block truncate text-xs text-[var(--muted)]">{tool.desc}</span>
              </span>
              {showClicks ? <span className="flex shrink-0 items-center gap-1 text-xs text-[var(--muted)]"><Eye className="h-3.5 w-3.5" />{clicks}</span> : null}
            </Link>
          );
        })}
      </div>
    </main>
  );
}
