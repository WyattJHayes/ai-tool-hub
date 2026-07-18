'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Bot,
  Code,
  Music,
  Palette,
  PenTool,
  Presentation,
  Search,
  Video,
} from 'lucide-react';
import { useToolStore } from '@/stores/useToolStore';
import type { Scene } from '@/types/tool';
import { SearchBar } from '@/components/hero/SearchBar';
import SceneCard from '@/components/scenes/SceneCard';
import { ToolCard } from '@/components/tools/ToolCard';

const scenes: Scene[] = [
  { id: 'ppt', name: 'PPT 制作', icon: '', description: '生成结构和视觉完整的演示文稿', toolIds: [] },
  { id: 'coding', name: '代码助手', icon: '', description: '编写、理解和审查代码', toolIds: [] },
  { id: 'video', name: '视频创作', icon: '', description: '生成视频、字幕和配音', toolIds: [] },
  { id: 'drawing', name: '设计创意', icon: '', description: '图像生成与界面设计', toolIds: [] },
  { id: 'copywriting', name: '文案写作', icon: '', description: '起草、改写和润色内容', toolIds: [] },
  { id: 'music', name: '音乐生成', icon: '', description: '作曲、音效与声音处理', toolIds: [] },
  { id: 'search', name: '搜索研究', icon: '', description: '查找资料并整理关键信息', toolIds: [] },
  { id: 'chatbot', name: '智能对话', icon: '', description: '通用问答和任务协作', toolIds: [] },
];

const sceneIcons = [Presentation, Code, Video, Palette, PenTool, Music, Search, Bot];

export default function Home() {
  const { tools, isLoading, loadData, dataLoaded } = useToolStore();

  useEffect(() => {
    if (!dataLoaded) loadData();
  }, [dataLoaded, loadData]);

  const curatedTools = useMemo(() => {
    const hotTools = tools.filter((tool) => tool.status === 'hot');
    return (hotTools.length >= 6 ? hotTools : tools).slice(0, 6);
  }, [tools]);

  return (
    <main className="min-h-screen bg-[var(--page)] text-[var(--ink)]">
      <section className="border-b border-[var(--line)] bg-[var(--surface)]">
        <div className="mx-auto max-w-7xl px-4 py-9 sm:px-6 sm:py-12">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-semibold leading-tight text-[var(--ink)] sm:text-4xl">
              按任务找到合适的 AI 工具
            </h1>
            <p className="mt-3 max-w-2xl text-base text-[var(--muted)] sm:text-lg">
              收录实用工具，帮你更快完成写作、设计、研究和开发
            </p>
            <div className="mt-6">
              <SearchBar />
            </div>
            <p className="mt-3 text-xs text-[var(--muted-subtle)]">
              {tools.length > 0 ? `${tools.length}+ 款工具` : '工具目录'} · 每周更新
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-9 sm:px-6 sm:py-12">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-[var(--ink)] sm:text-2xl">本周值得试</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">从高频任务中挑选的实用工具</p>
          </div>
          <Link href="/leaderboard" className="flex min-h-11 shrink-0 items-center gap-1 text-sm font-medium text-[var(--accent)] hover:text-[var(--accent-hover)]">
            查看排行榜 <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="正在加载工具">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-52 rounded-lg border border-[var(--line)] bg-[var(--surface)]" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {curatedTools.map((tool) => (
              <ToolCard key={tool.id} tool={tool} />
            ))}
          </div>
        )}
      </section>

      <section className="border-y border-[var(--line)] bg-[var(--surface)]">
        <div className="mx-auto max-w-7xl px-4 py-9 sm:px-6 sm:py-12">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-[var(--ink)] sm:text-2xl">按任务浏览</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">从你要完成的工作开始选择</p>
            </div>
            <Link href="/scenes" className="flex min-h-11 shrink-0 items-center gap-1 text-sm font-medium text-[var(--accent)] hover:text-[var(--accent-hover)]">
              全部场景 <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {scenes.map((scene, index) => {
              const Icon = sceneIcons[index];
              return (
                <SceneCard
                  key={scene.id}
                  scene={{ ...scene, icon: <Icon className="h-5 w-5" /> }}
                />
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
