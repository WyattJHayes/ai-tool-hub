'use client';


import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, User, Heart, Star, Settings, LogIn,
  BookOpen, BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUserStore } from '@/stores/useUserStore';
import { useToolStore } from '@/stores/useToolStore';
import { useCompareStore } from '@/stores/useCompareStore';
import { getToolSlug, getRelatedTools } from '@/lib/tools-data';
import { AuthModal } from '@/components/auth/AuthModal';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
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
  const compareHistorySnapshot = useSyncExternalStore(
    subscribeCompareHistory,
    getCompareHistorySnapshot,
    () => '[]'
  );
  const compareHistory = useMemo(
    () => parseCompareHistory(compareHistorySnapshot),
    [compareHistorySnapshot]
  );

  useEffect(() => {
    if (!dataLoaded) loadData();
  }, [dataLoaded, loadData]);

  // Save current compare selection to history
  useEffect(() => {
    if (selectedTools.length < 2) return;

    const ids = selectedTools.map(t => t.id);
    const serializedIds = JSON.stringify(ids);
    const updated = [
      ids,
      ...compareHistory.filter(history => JSON.stringify(history) !== serializedIds),
    ].slice(0, 10);
    const nextSnapshot = JSON.stringify(updated);

    if (nextSnapshot !== compareHistorySnapshot) {
      localStorage.setItem(COMPARE_HISTORY_KEY, nextSnapshot);
      window.dispatchEvent(new Event(COMPARE_HISTORY_EVENT));
    }
  }, [selectedTools, compareHistory, compareHistorySnapshot]);

  const favoriteTools = tools.filter((t) => favorites.includes(t.id));
  const ratedTools = tools.filter((t) => ratings[t.id] && ratings[t.id] > 0);

  // A-05: Personalized recommendations based on favorites
  const recommendedTools = (() => {
    if (favorites.length === 0) return [];
    const favTools = tools.filter(t => favorites.includes(t.id));
    const allRelated = favTools.flatMap(ft => getRelatedTools(tools, ft, 2));
    const seen = new Set(favorites);
    return allRelated.filter(t => !seen.has(t.id)).filter((t, i, arr) => arr.findIndex(x => x.id === t.id) === i).slice(0, 6);
  })();

  const tabs = [
    { key: 'favorites' as const, label: '收藏', icon: Heart },
    { key: 'ratings' as const, label: '评价', icon: Star },
    { key: 'compare-history' as const, label: '对比记录', icon: BarChart3 },
    { key: 'settings' as const, label: '设置', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="sticky top-0 z-50 border-b border-white/10 bg-gray-950/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-4">
          <Link href="/" className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/50 transition-colors hover:bg-white/5 hover:text-white">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20">
              <User className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">我的工具箱</h1>
              <p className="text-xs text-white/40">管理收藏和评价</p>
            </div>
          </div>
          <div className="flex-1" />
          <button onClick={() => setShowAuth(true)} className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/60 transition-colors hover:bg-white/10 hover:text-white">
            <LogIn className="h-3.5 w-3.5" />
            登录
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-8">
        {/* Stats */}
        <div className="mb-8 grid grid-cols-3 gap-4">
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <Heart className="h-6 w-6 text-red-400" />
            <span className="text-2xl font-bold">{favorites.length}</span>
            <span className="text-xs text-white/40">收藏工具</span>
          </div>
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <Star className="h-6 w-6 text-amber-400" />
            <span className="text-2xl font-bold">{ratedTools.length}</span>
            <span className="text-xs text-white/40">已评价</span>
          </div>
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <BookOpen className="h-6 w-6 text-blue-400" />
            <span className="text-2xl font-bold">{tools.length}</span>
            <span className="text-xs text-white/40">浏览工具</span>
          </div>
        </div>

        {/* A-05: Personalized recommendations */}
        {recommendedTools.length > 0 && (
          <div className="mb-8">
            <h2 className="mb-4 text-lg font-semibold">为你推荐</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {recommendedTools.map(tool => (
                <Link
                  key={tool.id}
                  href={'/tools/' + getToolSlug(tool)}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:bg-white/[0.05]"
                >
                  <ToolIcon name={tool.icon} className="h-6 w-6 text-white/60" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white/90">{tool.name}</p>
                    <p className="truncate text-xs text-white/40">{tool.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-xl bg-white/5 p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm transition-colors',
                activeTab === tab.key
                  ? 'bg-white/10 text-white font-medium'
                  : 'text-white/40 hover:text-white/60'
              )}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Favorites tab */}
        {activeTab === 'favorites' && (
          <div>
            {favoriteTools.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-16 text-center">
                <Heart className="h-10 w-10 text-white/10" />
                <p className="text-white/40">还没有收藏任何工具</p>
                <Link href="/" className="text-sm text-blue-400 hover:underline">去首页看看</Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {favoriteTools.map((tool) => (
                  <div key={tool.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:bg-white/[0.05]">
                    <ToolIcon name={tool.icon} className="h-6 w-6 text-white/60" />
                    <div className="flex-1 min-w-0">
                      <Link href={'/tools/' + getToolSlug(tool)} className="font-medium text-white/90 hover:text-white text-sm">{tool.name}</Link>
                      <p className="truncate text-xs text-white/40">{tool.desc}</p>
                    </div>
                    <button onClick={() => toggleFavorite(tool.id)} className="shrink-0 text-red-400 hover:text-red-300">
                      <Heart className="h-4 w-4 fill-red-400" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Ratings tab */}
        {activeTab === 'ratings' && (
          <div>
            {ratedTools.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-16 text-center">
                <Star className="h-10 w-10 text-white/10" />
                <p className="text-white/40">还没有评价任何工具</p>
                <Link href="/" className="text-sm text-blue-400 hover:underline">去评价工具</Link>
              </div>
            ) : (
              <div className="space-y-3">
                {ratedTools.map((tool) => (
                  <div key={tool.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                    <ToolIcon name={tool.icon} className="h-6 w-6 text-white/60" />
                    <div className="flex-1 min-w-0">
                      <Link href={'/tools/' + getToolSlug(tool)} className="font-medium text-white/90 hover:text-white text-sm">{tool.name}</Link>
                    </div>
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star key={n} className={cn('h-3.5 w-3.5', n <= (ratings[tool.id] || 0) ? 'fill-amber-400 text-amber-400' : 'text-white/15')} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* A-04: Compare history tab */}
        {activeTab === 'compare-history' && (
          <div>
            {compareHistory.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-16 text-center">
                <BarChart3 className="h-10 w-10 text-white/10" />
                <p className="text-white/40">还没有对比记录</p>
                <Link href="/" className="text-sm text-blue-400 hover:underline">去首页开始对比</Link>
              </div>
            ) : (
              <div className="space-y-3">
                {compareHistory.map((ids, idx) => (
                  <div key={idx} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex flex-1 flex-wrap gap-2">
                      {ids.map(id => {
                        const t = tools.find(x => x.id === id);
                        if (!t) return null;
                        return (
                                <Link key={id} href={'/tools/' + getToolSlug(t)} className="rounded-full bg-violet-500/15 px-3 py-1 text-sm text-violet-300 border border-violet-500/30 hover:bg-violet-500/20">
                            {t.name}
                          </Link>
                        );
                      })}
                    </div>
                    <Link href="/compare" className="shrink-0 text-xs text-white/30 hover:text-white/60">再对比 →</Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Settings tab */}
        {activeTab === 'settings' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
              <h3 className="font-medium text-white/80">数据存储</h3>
              <p className="mt-2 text-sm text-white/40">当前数据存储在浏览器 localStorage 中。登录后可同步到云端，跨设备访问。</p>
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/50">收藏数量</span>
                  <span className="text-white/70">{favorites.length}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/50">评价数量</span>
                  <span className="text-white/70">{ratedTools.length}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/50">对比记录</span>
                  <span className="text-white/70">{compareHistory.length}</span>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
              <h3 className="font-medium text-white/80">账号</h3>
              {isLoggedIn ? (
                <div>
                  <p className="mt-2 flex items-center gap-1.5 text-sm text-emerald-400">
                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
                    已登录
                  </p>
                  <p className="mt-1 text-xs text-white/30">收藏和评分已同步到云端</p>
                  <button
                    onClick={async () => {
                      if (supabase) await supabase.auth.signOut();
                      logout();
                    }}
                    className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/20"
                  >
                    退出登录
                  </button>
                </div>
              ) : (
                <div>
                  <p className="mt-2 text-sm text-white/40">
                    {isSupabaseConfigured ? '尚未登录，数据仅保存在本地' : 'Supabase 未配置，请设置环境变量'}
                  </p>
                  <button onClick={() => setShowAuth(true)} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500">登录 / 注册</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} />
    </div>
  );
}
