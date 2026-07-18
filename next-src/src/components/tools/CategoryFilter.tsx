'use client';

import { useToolStore } from '@/stores/useToolStore';
import { cn } from '@/lib/utils';

export function CategoryFilter() {
  const categories = useToolStore((state) => state.categories);
  const selectedCategory = useToolStore((state) => state.selectedCategory);
  const setSelectedCategory = useToolStore((state) => state.setSelectedCategory);
  const allCategories = [{ id: 'all', name: '全部' }, ...categories];

  return (
    <div className="scrollbar-hide flex items-center gap-5 overflow-x-auto border-b border-[var(--line)]" role="tablist" aria-label="工具分类">
      {allCategories.map((category) => {
        const active = selectedCategory === category.id;
        return (
          <button
            type="button"
            role="tab"
            aria-selected={active}
            key={category.id}
            onClick={() => setSelectedCategory(category.id)}
            className={cn(
              'min-h-11 shrink-0 border-b-2 px-1 text-sm font-medium transition-colors duration-150',
              active
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'
            )}
          >
            {category.name}
          </button>
        );
      })}
    </div>
  );
}
