'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Bot, Code, Music, Palette, PenTool, Presentation, Search, Video } from 'lucide-react';
import { useToolStore } from '@/stores/useToolStore';

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

interface SceneWithCount {
  id: string;
  name: string;
  icon: string;
  description: string;
  toolCount: number;
}

const initialScenes: SceneWithCount[] = [
  { id: 'ppt', name: '制作 PPT', icon: 'presentation', description: '生成演示结构、内容和视觉稿', toolCount: 0 },
  { id: 'coding', name: '编写代码', icon: 'code', description: '辅助开发、调试和代码审查', toolCount: 0 },
  { id: 'video', name: '制作视频', icon: 'video', description: '生成视频、字幕和配音', toolCount: 0 },
  { id: 'drawing', name: '图像设计', icon: 'palette', description: '生成图像、素材与设计方案', toolCount: 0 },
  { id: 'copywriting', name: '撰写文案', icon: 'pen-tool', description: '起草、改写和润色内容', toolCount: 0 },
  { id: 'music', name: '制作音乐', icon: 'music', description: '生成音乐、音效与声音素材', toolCount: 0 },
  { id: 'research', name: '搜索调研', icon: 'search', description: '查找资料并整理关键结论', toolCount: 0 },
  { id: 'agent', name: '构建 AI 应用', icon: 'bot', description: '搭建智能体、工作流和应用', toolCount: 0 },
];

export default function ScenesPage() {
  const { loadData, dataLoaded } = useToolStore();
  const [scenes, setScenes] = useState(initialScenes);

  useEffect(() => {
    if (!dataLoaded) loadData();
  }, [dataLoaded, loadData]);

  useEffect(() => {
    fetch('/data/scenes.json')
      .then((response) => response.json())
      .then((data) => {
        setScenes((current) => current.map((scene) => {
          const matched = data.scenes?.find((candidate: { id: string; toolIds: number[] }) => candidate.id === scene.id);
          return matched ? { ...scene, toolCount: matched.toolIds.length } : scene;
        }));
      })
      .catch(() => {});
  }, []);

  return (
    <main className="min-h-screen bg-[var(--page)] text-[var(--ink)]">
      <header className="border-b border-[var(--line)] bg-[var(--surface)]">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
          <h1 className="text-3xl font-semibold sm:text-4xl">按任务浏览</h1>
          <p className="mt-3 max-w-xl text-base text-[var(--muted)]">先选择要完成的工作，再比较适合的工具</p>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 py-9 sm:px-6 sm:py-12">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {scenes.map((scene) => {
            const Icon = sceneIcons[scene.icon] || Bot;
            return (
              <Link key={scene.id} href={`/scenes/${scene.id}`} className="group flex min-h-[132px] items-start gap-4 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5 transition-colors duration-150 hover:border-[var(--line-strong)] hover:bg-[var(--surface-subtle)]">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[var(--accent-soft)] text-[var(--accent)]"><Icon className="h-5 w-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-semibold">{scene.name}</span>
                  <span className="mt-1 block text-sm text-[var(--muted)]">{scene.description}</span>
                  <span className="mt-3 flex items-center gap-1 text-xs font-medium text-[var(--accent)]">{scene.toolCount} 款工具 <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
