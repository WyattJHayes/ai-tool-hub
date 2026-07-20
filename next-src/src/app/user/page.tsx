'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { BarChart3, Heart, LogIn, Settings, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUserStore } from '@/stores/useUserStore';
import { useToolStore } from '@/stores/useToolStore';
import { useCompareStore } from '@/stores/useCompareStore';
import { getRelatedTools, getToolSlug } from '@/lib/tools-data';
import { AuthModal } from '@/components/auth/AuthModal';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { ToolIcon } from '@/lib/icon-map';

const COMPARE_HISTORY_KEY = 'ai-tool-hub-compare-history';
const COMPARE_HISTORY_EVENT = 'ai-tool-hub-compare-history-change';

function subscribeCompareHistory(onStoreChange: () => void) {
  window.addEventListener('storage', onStoreChange);
  window.addEventListener(COMPARE_HISTORY_EVENT, onStoreChange);
  return () => {
    window.removeEventListener('storage', onStoreChange);
    window.removeEventListener(COMPARE_HISTORY_EVENT, onStoreChange);
  };
}

function getCompareHistorySnapshot() {
  return localStorage.getItem(COMPARE_HISTORY_KEY) || '[]';
}

function parseCompareHistory(snapshot: string): number[][] {
  try {
    const parsed = JSON.parse(snapshot);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function UserPage() {
  const { favorites, ratings, toggleFavorite, isLoggedIn, logout } = useUserStore();
  const { tools, loadData, dataLoaded } = useToolStore();
  const { selectedTools } = useCompareStore();
  const [showAuth, setShowAuth] = useState(false);
  const [activeTab, setActiveTab] = useState<'favorites' | 'ratings' | 'compare-history' | 'settings'>('favorites');
  const compareHistorySnapshot = useSyncExternalStore(subscribeCompareHistory, getCompareHistorySnapshot, () => '[]');
  const compareHistory = useMemo(() => parseCompareHistory(compareHistorySnapshot), [compareHistorySnapshot]);

  useEffect(() => {
    if (!dataLoaded) loadData();
  }, [dataLoaded, loadData]);

  useEffect(() => {
    if (selectedTools.length < 2) return;
    const ids = selectedTools.map((tool) => tool.id);
    const serializedIds = JSON.stringify(ids);
    const updated = [ids, ...compareHistory.filter((history) => JSON.stringify(history) !== serializedIds)].slice(0, 10);
    const nextSnapshot = JSON.stringify(updated);
    if (nextSnapshot !== compareHistorySnapshot) {
      localStorage.setItem(COMPARE_HISTORY_KEY, nextSnapshot);
      window.dispatchEvent(new Event(COMPARE_HISTORY_EVENT));
    }
  }, [selectedTools, compareHistory, compareHistorySnapshot]);

  const favoriteTools = tools.filter((tool) => favorites.includes(tool.id));
  const ratedTools = tools.filter((tool) => ratings[tool.id] && ratings[tool.id] > 0);
  const recommendedTools = (() => {
    if (favorites.length === 0) return [];
    const favoriteEntries = tools.filter((tool) => favorites.includes(tool.id));
    const related = favoriteEntries.flatMap((tool) => getRelatedTools(tools, tool, 2));
    const seen = new Set(favorites);
    return related.filter((tool) => !seen.has(tool.id)).filter((tool, index, all) => all.findIndex((candidate) => candidate.id === tool.id) === index).slice(0, 6);
  })();
  const tabs = [
    { key: 'favorites' as const, label: '收藏', icon: Heart },
    { key: 'ratings' as const, label: '评价', icon: Star },
    { key: 'compare-history' as const, label: '对比记录', icon: BarChart3 },
    { key: 'settings' as const, label: '设置', icon: Settings },
  ];

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 pb-24 pt-10 text-[var(--ink)] sm:px-6 sm:pb-16 sm:pt-12">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="text-3xl font-semibold">我的工具箱</h1><p className="mt-2 text-sm text-[var(--muted)]">管理收藏、评价和对比记录</p></div>
        <button type="button" onClick={() => setShowAuth(true)} className="flex min-h-11 items-center gap-1.5 rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-medium text-[var(--ink)] hover:bg-[var(--surface-subtle)]"><LogIn className="h-4 w-4" />登录</button>
      </header>

      <section className="mb-8 grid grid-cols-3 overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)]">
        {[
          { label: '收藏工具', value: favorites.length },
          { label: '已评价', value: ratedTools.length },
          { label: '目录工具', value: tools.length },
        ].map((item, index) => (
          <div key={item.label} className={cn('px-3 py-5 text-center', index > 0 && 'border-l border-[var(--line)]')}><span className="block text-2xl font-semibold">{item.value}</span><span className="mt-1 block text-xs text-[var(--muted)]">{item.label}</span></div>
        ))}
      </section>

      {recommendedTools.length ? (
        <section className="mb-8">
          <h2 className="mb-4 text-lg font-semibold">为你推荐</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recommendedTools.map((tool) => (
              <Link key={tool.id} href={`/tools/${getToolSlug(tool)}`} className="flex min-h-[76px] items-center gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 hover:bg-[var(--surface-subtle)]">
                <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--surface-subtle)] text-[var(--accent)]"><ToolIcon name={tool.icon} className="h-5 w-5" /></span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{tool.name}</span><span className="block truncate text-xs text-[var(--muted)]">{tool.desc}</span></span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <div className="scrollbar-hide mb-6 flex overflow-x-auto rounded-md border border-[var(--line)] bg-[var(--surface)]" role="tablist" aria-label="个人工具箱内容">
        {tabs.map((tab, index) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button type="button" role="tab" aria-selected={active} key={tab.key} onClick={() => setActiveTab(tab.key)} className={cn('flex min-h-11 flex-1 shrink-0 items-center justify-center gap-1.5 px-3 text-sm font-medium', index > 0 && 'border-l border-[var(--line)]', active ? 'bg-[var(--accent-soft)] text-[var(--accent-ink)]' : 'text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)]')}><Icon className="h-4 w-4" />{tab.label}</button>
          );
        })}
      </div>

      {activeTab === 'favorites' ? (
        favoriteTools.length === 0 ? <EmptyState icon={Heart} text="还没有收藏任何工具" linkText="浏览工具目录" /> : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {favoriteTools.map((tool) => (
              <div key={tool.id} className="flex min-h-[76px] items-center gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
                <ToolIcon name={tool.icon} className="h-5 w-5 shrink-0 text-[var(--accent)]" />
                <div className="min-w-0 flex-1"><Link href={`/tools/${getToolSlug(tool)}`} className="text-sm font-semibold text-[var(--accent-ink)] hover:text-[var(--accent-hover)]">{tool.name}</Link><p className="truncate text-xs text-[var(--muted)]">{tool.desc}</p></div>
                <button type="button" onClick={() => toggleFavorite(tool.id)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-[var(--line-strong)] text-[var(--muted)] hover:bg-[var(--surface-hover)]" aria-label={`取消收藏 ${tool.name}`}><Heart className="h-4 w-4 fill-current text-[var(--accent)]" /></button>
              </div>
            ))}
          </div>
        )
      ) : null}

      {activeTab === 'ratings' ? (
        ratedTools.length === 0 ? <EmptyState icon={Star} text="还没有评价任何工具" linkText="浏览工具目录" /> : (
          <div className="space-y-2">
            {ratedTools.map((tool) => (
              <div key={tool.id} className="flex min-h-[64px] items-center gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
                <ToolIcon name={tool.icon} className="h-5 w-5 text-[var(--accent)]" />
                <Link href={`/tools/${getToolSlug(tool)}`} className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--accent-ink)] hover:text-[var(--accent-hover)]">{tool.name}</Link>
                <div className="flex gap-0.5">{[1, 2, 3, 4, 5].map((score) => <Star key={score} className={cn('h-3.5 w-3.5', score <= (ratings[tool.id] || 0) ? 'fill-[var(--accent)] text-[var(--accent)]' : 'text-[var(--line-strong)]')} />)}</div>
              </div>
            ))}
          </div>
        )
      ) : null}

      {activeTab === 'compare-history' ? (
        compareHistory.length === 0 ? <EmptyState icon={BarChart3} text="还没有对比记录" linkText="选择工具进行对比" /> : (
          <div className="space-y-2">
            {compareHistory.map((ids, index) => (
              <div key={index} className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
                <div className="flex flex-1 flex-wrap gap-2">{ids.map((id) => { const tool = tools.find((candidate) => candidate.id === id); return tool ? <Link key={id} href={`/tools/${getToolSlug(tool)}`} className="rounded border border-[var(--line)] bg-[var(--surface-subtle)] px-2.5 py-1 text-sm text-[var(--accent-ink)] hover:text-[var(--accent-hover)]">{tool.name}</Link> : null; })}</div>
                <Link href="/compare" className="flex min-h-11 items-center text-xs font-medium text-[var(--accent-ink)] hover:text-[var(--accent-hover)]">再次对比</Link>
              </div>
            ))}
          </div>
        )
      ) : null}

      {activeTab === 'settings' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5"><h2 className="font-semibold">数据存储</h2><p className="mt-2 text-sm text-[var(--muted)]">本地数据保存在当前浏览器。登录后可同步收藏和评分。</p><dl className="mt-4 space-y-2 text-sm">{[['收藏数量', favorites.length], ['评价数量', ratedTools.length], ['对比记录', compareHistory.length]].map(([label, value]) => <div key={String(label)} className="flex justify-between"><dt className="text-[var(--muted)]">{label}</dt><dd>{value}</dd></div>)}</dl></section>
          <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5"><h2 className="font-semibold">账号</h2>{isLoggedIn ? <><p className="mt-2 text-sm"><span className="text-[var(--ink)]">已登录</span><span className="text-[var(--muted)]">，数据同步已启用</span></p><button type="button" onClick={async () => { if (supabase) await supabase.auth.signOut(); logout(); }} className="mt-4 min-h-11 rounded-md border border-[var(--line-strong)] px-4 text-sm text-[var(--muted)] hover:bg-[var(--surface-hover)]">退出登录</button></> : <><p className={cn('mt-2 text-sm', isSupabaseConfigured ? 'text-[var(--muted)]' : 'text-[var(--signal-ink)]')}>{isSupabaseConfigured ? '尚未登录，数据仅保存在本地' : '云同步当前不可用'}</p><button type="button" onClick={() => setShowAuth(true)} className="mt-4 min-h-11 rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-[var(--on-accent)] hover:bg-[var(--accent-hover)]">登录 / 注册</button></>}</section>
        </div>
      ) : null}

      <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} />
    </main>
  );
}

function EmptyState({ icon: Icon, text, linkText }: { icon: React.ElementType; text: string; linkText: string }) {
  return <div className="rounded-lg border border-dashed border-[var(--line-strong)] bg-[var(--surface)] px-6 py-14 text-center"><Icon className="mx-auto h-7 w-7 text-[var(--muted-subtle)]" /><p className="mt-3 text-sm text-[var(--muted)]">{text}</p><Link href="/tools" className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-[var(--accent-ink)] hover:text-[var(--accent-hover)]">{linkText}</Link></div>;
}
