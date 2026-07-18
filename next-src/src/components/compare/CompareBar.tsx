'use client';

import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCompareStore } from '@/stores/useCompareStore';

export default function CompareBar() {
  const router = useRouter();
  const { selectedTools, removeTool, clearAll } = useCompareStore();

  if (selectedTools.length < 2) return null;

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50',
        'border-t border-[var(--line)] bg-[var(--surface)]',
        'px-6 py-4'
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <div className="flex flex-1 items-center gap-2 overflow-x-auto">
          <span className="shrink-0 text-sm text-[var(--muted)]">已选择 ({selectedTools.length}/4):</span>
          {selectedTools.map((tool) => (
            <span
              key={tool.id}
              className="flex shrink-0 items-center gap-1.5 rounded-md border border-[var(--line)] bg-[var(--accent-soft)] px-3 py-1 text-sm text-[var(--accent)]"
            >
              {tool.name}
              <button
                onClick={() => removeTool(tool.id)}
                className="rounded-sm p-0.5 transition-colors hover:bg-[var(--surface-hover)]"
                aria-label={`移除 ${tool.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <button
            onClick={clearAll}
            className="min-h-11 rounded-md px-4 py-2 text-sm text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)]"
          >
            清除
          </button>
          <button
            onClick={() => router.push('/compare')}
            className={cn(
              'min-h-11 rounded-md bg-[var(--accent)] px-5 py-2 text-sm font-medium text-white',
              'transition-colors hover:bg-[var(--accent-hover)]'
            )}
          >
            开始对比
          </button>
        </div>
      </div>
    </div>
  );
}
