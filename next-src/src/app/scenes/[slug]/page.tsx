'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Bot, Code, Music, Palette, PenTool, Presentation, Search, Video } from 'lucide-react';
import { useToolStore } from '@/stores/useToolStore';
import { ToolCard } from '@/components/tools/ToolCard';
import type { Tool } from '@/types/tool';

const sceneIcons: Record<string, React.ElementType> = {
  presentation: Presentation,
  code: Code,
  video: Video,
  palette: Palette,
  'pen-tool': PenTool,
  music: Music,
  search: Search,
  bot: Bot,
};

const sceneMeta: Record<string, { name: string; icon: string; desc: string }> = {
  ppt: { name: '制作 PPT', icon: 'presentation', desc: '生成演示结构、内容和视觉稿' },
  coding: { name: '编写代码', icon: 'code', desc: '辅助开发、调试和代码审查' },
  video: { name: '制作视频', icon: 'video', desc: '生成视频、字幕和配音' },
  drawing: { name: '图像设计', icon: 'palette', desc: '生成图像、素材与设计方案' },
  copywriting: { name: '撰写文案', icon: 'pen-tool', desc: '起草、改写和润色内容' },
  music: { name: '制作音乐', icon: 'music', desc: '生成音乐、音效与声音素材' },
  research: { name: '搜索调研', icon: 'search', desc: '查找资料并整理关键结论' },
  agent: { name: '构建 AI 应用', icon: 'bot', desc: '搭建智能体、工作流和应用' },
};

export default function SceneDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { tools, isLoading, loadData, dataLoaded } = useToolStore();
  const [sceneTools, setSceneTools] = useState<Tool[]>([]);
  const meta = sceneMeta[slug] || { name: slug, icon: 'bot', desc: '' };

  useEffect(() => {
    if (!dataLoaded) loadData();
  }, [dataLoaded, loadData]);

  useEffect(() => {
    if (tools.length === 0) return;
    fetch('/data/scenes.json')
      .then((response) => response.json())
      .then((data) => {
        const scene = data.scenes?.find((candidate: { id: string }) => candidate.id === slug);
        if (!scene) return;
        setSceneTools(scene.toolIds.map((id: number) => tools.find((tool) => tool.id === id)).filter(Boolean) as Tool[]);
      })
      .catch(() => {});
  }, [tools, slug]);

  const Icon = sceneIcons[meta.icon] || Bot;

  return (
    <main className="min-h-screen bg-[var(--page)] text-[var(--ink)]">
      <header className="border-b border-[var(--line)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-6 sm:px-6">
          <Link href="/scenes" className="flex h-11 w-11 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)]" aria-label="返回场景列表"><ArrowLeft className="h-4 w-4" /></Link>
          <span className="flex h-11 w-11 items-center justify-center rounded-md bg-[var(--accent-soft)] text-[var(--accent)]"><Icon className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold sm:text-2xl">{meta.name}</h1>
            <p className="text-sm text-[var(--muted)]">{meta.desc}</p>
          </div>
          <span className="shrink-0 text-sm text-[var(--muted)]">{sceneTools.length} 款工具</span>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {sceneTools.length === 0 && !isLoading ? (
          <div className="rounded-lg border border-dashed border-[var(--line-strong)] bg-[var(--surface)] px-6 py-16 text-center">
            <p className="text-base text-[var(--muted)]">该场景暂无工具推荐</p>
            <Link href="/scenes" className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-[var(--accent)]">返回场景列表</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {sceneTools.map((tool) => <ToolCard key={tool.id} tool={tool} />)}
          </div>
        )}
      </section>
    </main>
  );
}
