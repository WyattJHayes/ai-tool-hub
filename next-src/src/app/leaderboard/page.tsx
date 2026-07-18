'use client';


import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Trophy, TrendingUp, Eye, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToolStore } from '@/stores/useToolStore';
import { getToolSlug } from '@/lib/tools-data';
import { ToolIcon } from '@/lib/icon-map';

export default function LeaderboardPage() {
  const { tools, clickStats, loadData, dataLoaded } = useToolStore();
  const [tab, setTab] = useState<'clicks' | 'hot' | 'newest'>('clicks');

  useEffect(() => {
    if (!dataLoaded) loadData();
  }, [dataLoaded, loadData]);

  const ranked = [...tools].sort((a, b) => {
    if (tab === 'clicks') {
      const aClicks = clickStats[String(a.id)] || 0;
      const bClicks = clickStats[String(b.id)] || 0;
      if (bClicks !== aClicks) return bClicks - aClicks;
      // Tie-break by hot status
      return (b.status === 'hot' ? 1 : 0) - (a.status === 'hot' ? 1 : 0);
    }
    if (tab === 'hot') {
      return (b.status === 'hot' ? 1 : 0) - (a.status === 'hot' ? 1 : 0);
    }
    // newest: by id descending (higher id = newer)
    return b.id - a.id;
  });

  const hasClickData = Object.keys(clickStats).length > 0;

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="min-h-screen bg-gray-950 text-white"><div className="mx-auto max-w-4xl px-6 pt-24 pb-16">
        <div className="mb-8 flex items-center gap-4">
          <Link
            href="/"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/50 transition-colors hover:bg-white/5 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-3">
            <Trophy className="h-7 w-7 text-amber-400" />
            <h1 className="text-2xl font-bold">排行榜</h1>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-8 flex gap-1 rounded-xl bg-white/5 p-1">
          {[
            { key: 'clicks' as const, label: '热度排行', icon: Eye },
            { key: 'hot' as const, label: '热门工具', icon: TrendingUp },
            { key: 'newest' as const, label: '最新收录', icon: BarChart3 },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm transition-colors',
                tab === t.key
                  ? 'bg-white/10 text-white font-medium'
                  : 'text-white/40 hover:text-white/60'
              )}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Leaderboard list */}
        {tab === 'clicks' && !hasClickData && (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <Eye className="h-10 w-10 text-white/10" />
            <p className="text-white/50">暂无真实点击数据</p>
            <p className="text-sm text-white/30">用户开始使用后，排行数据将自动生成</p>
            <p className="text-xs text-white/20">当前展示按热门状态排序</p>
          </div>
        )}

        <div className="space-y-2">
          {ranked.map((tool, idx) => {
            const clicks = clickStats[String(tool.id)] || 0;
            const showClicks = tab === 'clicks' && hasClickData && clicks > 0;

            return (
                    <Link
                key={tool.id}
                href={`/tools/${getToolSlug(tool)}`}
                className="group flex items-center gap-4 rounded-xl border border-white/5 bg-white/[0.02] px-5 py-4 transition-all hover:border-white/10 hover:bg-white/[0.05]"
              >
                {/* Rank */}
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg font-bold">
                  {idx < 3 ? (
                    <span className="text-2xl">{medals[idx]}</span>
                  ) : (
                    <span className="text-sm text-white/30">{idx + 1}</span>
                  )}
                </div>

                {/* Icon */}
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/5 text-xl">
                  <ToolIcon name={tool.icon} className="h-5 w-5 text-white/60" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-white/90 group-hover:text-white">{tool.name}</h3>
                    {tool.status === 'hot' && (
                      <span className="rounded-full bg-red-500/15 px-1.5 py-0.5 text-[10px] text-red-400">HOT</span>
                    )}
                    {tool.valueTag && (
                      <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-400">{tool.valueTag}</span>
                    )}
                  </div>
                  <p className="truncate text-xs text-white/35">{tool.desc}</p>
                </div>

                {/* Click count */}
                {showClicks && (
                  <div className="flex items-center gap-1 text-xs text-white/30">
                    <Eye className="h-3 w-3" />
                    {clicks}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </div></div>
  );
}
