import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { Scene } from '@/types/tool';

export function TaskEntryList({ scenes }: { scenes: Scene[] }) {
  return (
    <div data-task-entry-list className="grid grid-cols-1 border-y border-[var(--line-strong)] sm:grid-cols-2 lg:grid-cols-4">
      {scenes.map((scene) => (
        <Link
          data-task-entry
          key={scene.id}
          href={`/tools?scene=${encodeURIComponent(scene.id)}`}
          className="group flex min-h-[104px] items-center justify-between gap-3 border-l-[3px] border-l-transparent border-b border-[var(--line)] px-5 py-4 hover:border-l-[var(--accent)] hover:bg-[var(--surface-hover)] focus-visible:border-l-[var(--accent)] focus-visible:bg-[var(--surface-hover)] sm:border-r lg:min-h-[90px]"
        >
          <span className="min-w-0"><strong className="block text-sm">{scene.name.replace(/^我要/, '')}</strong><span className="mt-1 block text-xs text-[var(--muted)]">{scene.description}</span></span>
          <ChevronRight className="h-4 w-4 shrink-0 text-[var(--muted-subtle)] group-hover:text-[var(--accent)] group-focus-visible:text-[var(--accent)]" aria-hidden="true" />
        </Link>
      ))}
    </div>
  );
}
