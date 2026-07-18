'use client';

import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { trackClick } from '@/lib/api';

interface SceneCardProps {
  scene: {
    id: string;
    name: string;
    icon: React.ReactNode;
    description: string;
  };
}

export default function SceneCard({ scene }: SceneCardProps) {
  const handleClick = () => {
    trackClick(0, '__scene__', undefined, scene.id).catch(() => {});
  };

  return (
    <Link
      href={`/scenes/${scene.id}`}
      onClick={handleClick}
      className="group flex min-h-[104px] items-center gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 transition-colors duration-150 hover:border-[var(--line-strong)] hover:bg-[var(--surface-subtle)]"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[var(--accent-soft)] text-[var(--accent)]">
        {scene.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-[var(--ink)]">{scene.name}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-[var(--muted)]">{scene.description}</span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-[var(--muted-subtle)] transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-[var(--accent)]" />
    </Link>
  );
}
