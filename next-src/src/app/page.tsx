'use client';


import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Presentation, Code, Video, Palette, PenTool, Music, Search, Bot,
  TrendingUp, BarChart3, Heart, Layers, Loader2, ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToolStore } from '@/stores/useToolStore';
import { getToolSlug } from '@/lib/tools-data';
import type { Scene } from '@/types/tool';
import SceneCard from '@/components/scenes/SceneCard';
import { ToolIcon } from '@/lib/icon-map';

const scenes: Scene[] = [
  { id: 'ppt', name: 'PPT 制作', icon: '', description: 'AI 辅助生成专业演示文稿', toolIds: [] },
  { id: 'coding', name: '代码助手', icon: '', description: '智能编程与代码审查', toolIds: [] },
  { id: 'video', name: '视频创作', icon: '', description: 'AI 视频生成与剪辑', toolIds: [] },
  { id: 'drawing', name: '设计创意', icon: '', description: 'AI 图像与 UI 设计', toolIds: [] },
  { id: 'copywriting', name: '文案写作', icon: '', description: '智能文案与内容创作', toolIds: [] },
  { id: 'music', name: '音乐生成', icon: '', description: 'AI 作曲与音效生成', toolIds: [] },
  { id: 'search', name: '搜索研究', icon: '', description: 'AI 搜索与信息整合', toolIds: [] },
  { id: 'chatbot', name: '智能对话', icon: '', description: 'AI 聊天与问答助手', toolIds: [] },
];

const sceneIcons = [Presentation, Code, Video, Palette, PenTool, Music, Search, Bot];

export default function Home() {
  const { tools, categories, isLoading, loadData, dataLoaded } = useToolStore();

  useEffect(() => {
    if (!dataLoaded) loadData();
  }, [dataLoaded, loadData]);

  const hotTools = useMemo(
    () => tools.filter((t) => t.status === 'hot').slice(0, 6),
    [tools]
  );

  const stats = useMemo(
    () => ({
      totalTools: tools.length,
      totalCategories: categories.length,
      favorites: tools.filter((t) => t.tags.includes('favorite')).length,
    }),
    [tools, categories]
  );

  return (
    <div className="relative min-h-screen bg-gray-950 text-white"><div className="relative z-10">
        {/* Hero Section */}
        <section className="flex flex-col items-center justify-center px-6 pt-20 pb-16 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
              AI 工具集
            </span>
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-white/60">
            发现、对比、选择最适合你的 AI 工具，提升工作效率
          </p>
        </section>

        {/* 热门推荐 */}
        <section className="mx-auto max-w-7xl px-6 pb-16">
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-6 w-6 text-violet-400" />
              <h2 className="text-2xl font-semibold">热门推荐</h2>
            </div>
            <Link
              href="/leaderboard"
              className="flex items-center gap-1 text-sm text-white/40 transition-colors hover:text-white/70"
            >
              排行榜 <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {hotTools.map((tool) => (
                <Link key={tool.id} href={`/tools/${getToolSlug(tool)}`}>
                  <div
                    className={cn(
                      'group relative flex items-start gap-4 rounded-2xl p-5',
                      'bg-white/5 backdrop-blur-sm border border-white/10',
                      'transition-all duration-300 hover:border-violet-500/30 hover:shadow-[0_0_30px_rgba(139,92,246,0.1)]'
                    )}
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-2xl">
                      <ToolIcon name={tool.icon} className="h-6 w-6 text-violet-300" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-white/90">{tool.name}</h3>
                        <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-400">
                          HOT
                        </span>
                        {tool.valueTag && (
                          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-400">
                            {tool.valueTag}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-white/50 line-clamp-2">{tool.desc}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* 按场景找工具 */}
        <section className="mx-auto max-w-7xl px-6 pb-16">
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Layers className="h-6 w-6 text-cyan-400" />
              <h2 className="text-2xl font-semibold">按场景找工具</h2>
            </div>
            <Link
              href="/scenes"
              className="flex items-center gap-1 text-sm text-white/40 transition-colors hover:text-white/70"
            >
              全部场景 <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {scenes.map((scene, idx) => (
              <SceneCard
                key={scene.id}
                scene={{
                  ...scene,
                  icon: (() => {
                    const Icon = sceneIcons[idx];
                    return <Icon className="h-6 w-6" />;
                  })(),
                }}
              />
            ))}
          </div>
        </section>

        {/* 数据概览 — hide zero-value stats */}
        <section className="mx-auto max-w-7xl px-6 pb-24">
          <div className="mb-8 flex items-center gap-3">
            <BarChart3 className="h-6 w-6 text-emerald-400" />
            <h2 className="text-2xl font-semibold">数据概览</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div
              className={cn(
                'flex flex-col items-center gap-2 rounded-2xl p-8',
                'bg-white/5 backdrop-blur-sm border border-white/10'
              )}
            >
              <Layers className="h-8 w-8 text-violet-400" />
              <span className="text-3xl font-bold text-white">
                {stats.totalTools > 0 ? stats.totalTools : '—'}
              </span>
              <span className="text-sm text-white/50">收录工具</span>
            </div>
            <div
              className={cn(
                'flex flex-col items-center gap-2 rounded-2xl p-8',
                'bg-white/5 backdrop-blur-sm border border-white/10'
              )}
            >
              <BarChart3 className="h-8 w-8 text-cyan-400" />
              <span className="text-3xl font-bold text-white">
                {stats.totalCategories > 0 ? stats.totalCategories : '—'}
              </span>
              <span className="text-sm text-white/50">工具分类</span>
            </div>
            <div
              className={cn(
                'flex flex-col items-center gap-2 rounded-2xl p-8',
                'bg-white/5 backdrop-blur-sm border border-white/10'
              )}
            >
              <Heart className="h-8 w-8 text-emerald-400" />
              <span className="text-3xl font-bold text-white">
                {stats.favorites > 0 ? stats.favorites : '—'}
              </span>
              <span className="text-sm text-white/50">
                {stats.favorites > 0 ? '精选推荐' : '暂无收藏数据'}
              </span>
            </div>
          </div>
        </section>
      </div></div>
  );
}
