'use client';

import { useToolStore } from '@/stores/useToolStore';
import { SearchBar } from './SearchBar';

export function HeroSection() {
  const tools = useToolStore((state) => state.tools);

  return (
    <section className="border-b border-[var(--line)] bg-[var(--surface)]">
      <div className="mx-auto max-w-7xl px-4 py-9 sm:px-6 sm:py-12">
        <div className="max-w-3xl">
          <h1 className="text-3xl font-semibold leading-tight text-[var(--ink)] sm:text-4xl">
            按任务找到合适的 AI 工具
          </h1>
          <p className="mt-3 text-base text-[var(--muted)] sm:text-lg">
            收录实用工具，帮你更快完成写作、设计、研究和开发
          </p>
          <div className="mt-6">
            <SearchBar />
          </div>
          <p className="mt-3 text-xs text-[var(--muted-subtle)]">
            {tools.length > 0 ? `${tools.length}+ 款工具` : '工具目录'} · 每周更新
          </p>
        </div>
      </div>
    </section>
  );
}
