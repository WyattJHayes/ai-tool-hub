'use client';

import type { SortOption } from '@/types/tool';
import { useToolStore } from '@/stores/useToolStore';
import { cn } from '@/lib/utils';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'default', label: '默认' },
  { value: 'hot', label: '热门' },
  { value: 'popular', label: '热度' },
  { value: 'free-first', label: '免费' },
  { value: 'domestic', label: '国产' },
  { value: 'name-asc', label: 'A-Z' },
  { value: 'name-desc', label: 'Z-A' },
];

export function SortBar() {
  const sort = useToolStore((state) => state.sort);
  const setSort = useToolStore((state) => state.setSort);

  return (
    <div className="scrollbar-hide flex max-w-full overflow-x-auto rounded-md border border-[var(--line)] bg-[var(--surface)]" aria-label="工具排序">
      {SORT_OPTIONS.map((option, index) => {
        const active = sort === option.value;
        return (
          <button
            type="button"
            key={option.value}
            onClick={() => setSort(option.value)}
            aria-pressed={active}
            className={cn(
              'min-h-11 shrink-0 px-3 text-sm font-medium transition-colors duration-150',
              index > 0 && 'border-l border-[var(--line)]',
              active
                ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                : 'text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)]'
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
