import Link from 'next/link';
import { Bot, Code, Music, Palette, PenTool, Presentation, Search, Video, type LucideIcon } from 'lucide-react';
import type { Scene } from '@/types/tool';

const sceneIcons: Record<string, LucideIcon> = {
  presentation: Presentation,
  code: Code,
  video: Video,
  palette: Palette,
  'pen-tool': PenTool,
  music: Music,
  search: Search,
  bot: Bot,
};

export function TaskEntryList({ scenes }: { scenes: Scene[] }) {
  return (
    <div className="grid grid-cols-1 border-y border-[var(--line)] sm:grid-cols-2 lg:grid-cols-4">
      {scenes.map((scene) => {
        const Icon = sceneIcons[scene.icon] || Bot;
        return (
          <Link
            key={scene.id}
            href={`/tools?scene=${encodeURIComponent(scene.id)}`}
            className="group flex min-h-[104px] items-center gap-3 border-b border-[var(--line)] px-4 py-4 hover:bg-[var(--surface-subtle)] sm:border-r"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[var(--accent-soft)] text-[var(--accent)]"><Icon className="h-5 w-5" /></span>
            <span className="min-w-0"><strong className="block text-sm">{scene.name.replace(/^我要/, '')}</strong><span className="mt-1 block text-xs text-[var(--muted)]">{scene.description}</span></span>
          </Link>
        );
      })}
    </div>
  );
}
