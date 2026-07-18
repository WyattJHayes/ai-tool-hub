'use client';

import { useEffect } from 'react';
import { useToolStore } from '@/stores/useToolStore';
import { CategoryFilter } from '@/components/tools/CategoryFilter';
import { SortBar } from '@/components/tools/SortBar';
import { ToolGrid } from '@/components/tools/ToolGrid';
import { SearchBar } from '@/components/hero/SearchBar';

export default function ToolsBrowsePage() {
  const { loadData, dataLoaded } = useToolStore();

  useEffect(() => {
    if (!dataLoaded) loadData();
  }, [dataLoaded, loadData]);

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 pb-24 pt-10 text-[var(--ink)] sm:px-6 sm:pb-16 sm:pt-12">
      <div className="max-w-3xl">
        <h1 className="text-2xl font-semibold sm:text-3xl">工具目录</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">按任务、价格和来源筛选，快速比较可用工具</p>
        <div className="mt-6">
          <SearchBar />
        </div>
      </div>

      <div className="mt-8">
        <CategoryFilter />
      </div>
      <div className="mt-4">
        <SortBar />
      </div>
      <div className="mt-7">
        <ToolGrid />
      </div>
    </main>
  );
}
