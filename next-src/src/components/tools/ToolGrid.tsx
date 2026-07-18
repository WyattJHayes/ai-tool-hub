'use client';

import { SearchX } from 'lucide-react';
import { useToolStore } from '@/stores/useToolStore';
import { ToolCard } from './ToolCard';

export function ToolGrid() {
  const filteredTools = useToolStore((state) => state.filteredTools);
  const isLoading = useToolStore((state) => state.isLoading);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-label="正在加载工具">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="h-60 rounded-lg border border-[var(--line)] bg-[var(--surface)]" />
        ))}
      </div>
    );
  }

  if (filteredTools.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-[var(--line-strong)] bg-[var(--surface)] px-6 py-16 text-center">
        <SearchX className="h-7 w-7 text-[var(--muted-subtle)]" />
        <div>
          <p className="text-base font-medium text-[var(--ink)]">没有找到匹配的工具</p>
          <p className="mt-1 text-sm text-[var(--muted)]">试试更换关键词或筛选条件</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--muted)]">
        共找到 <span className="font-semibold text-[var(--ink)]">{filteredTools.length}</span> 个工具
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredTools.map((tool) => (
          <ToolCard key={tool.id} tool={tool} />
        ))}
      </div>
    </div>
  );
}
