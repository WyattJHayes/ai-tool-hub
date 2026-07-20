'use client';

import { SlidersHorizontal } from 'lucide-react';
import { SearchBar } from '@/components/hero/SearchBar';
import type { Category, DirectoryQueryPatch, DirectoryQueryState, Scene, SortOption } from '@/types/tool';

interface TaskContextBarProps {
  state: DirectoryQueryState;
  scenes: Scene[];
  categories: Category[];
  activeFilterCount: number;
  onPatch: (patch: DirectoryQueryPatch) => void;
  onOpenFilters: () => void;
}

const sorts: { value: SortOption; label: string }[] = [
  { value: 'default', label: '任务优先' },
  { value: 'hot', label: '热门优先' },
  { value: 'popular', label: '热度优先' },
  { value: 'free-first', label: '免费优先' },
  { value: 'domestic', label: '国产优先' },
  { value: 'name-asc', label: '名称 A-Z' },
  { value: 'name-desc', label: '名称 Z-A' },
];

export function TaskContextBar({ state, scenes, categories, activeFilterCount, onPatch, onOpenFilters }: TaskContextBarProps) {
  return (
    <section aria-label="目录条件" className="border-y border-[var(--line)] bg-[var(--surface)] py-0 sm:py-4">
      <SearchBar compact ariaLabel="搜索工具、任务或能力" placeholder="搜索当前任务下的工具或能力" value={state.searchTerm} onValueChange={(searchTerm) => onPatch({ searchTerm })} onSubmit={(searchTerm) => onPatch({ searchTerm })} />
      <div data-directory-controls className="mt-3 grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2 lg:grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_minmax(160px,.7fr)]">
        <label className="min-w-0 max-w-full overflow-hidden text-xs text-[var(--muted)]"><span className="sr-only lg:not-sr-only">任务</span><select aria-label="选择任务" value={state.sceneId || ''} onChange={(event) => onPatch({ sceneId: event.target.value || null })} className="mt-1 min-h-11 w-full min-w-0 max-w-full rounded-md border border-[var(--line-strong)] bg-[var(--surface)] px-2 text-sm text-[var(--ink)] sm:px-3"><option value="">全部任务</option>{scenes.map((scene) => <option key={scene.id} value={scene.id}>{scene.name.replace(/^我要/, '')}</option>)}</select></label>
        <div className="min-w-0">
          {!state.sceneId ? <label className="hidden min-w-0 max-w-full text-xs text-[var(--muted)] lg:block">分类<select aria-label="选择分类" value={state.categoryId || ''} onChange={(event) => onPatch({ categoryId: event.target.value || null })} className="mt-1 min-h-11 w-full min-w-0 max-w-full rounded-md border border-[var(--line-strong)] bg-[var(--surface)] px-3 text-sm text-[var(--ink)]"><option value="">全部分类</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label> : <div className="hidden lg:block" aria-hidden="true" />}
          <span className="sr-only">筛选</span>
          <button type="button" onClick={onOpenFilters} className="mt-1 inline-flex min-h-11 w-full min-w-0 max-w-full items-center justify-center gap-1 overflow-hidden rounded-md border border-[var(--line-strong)] px-2 text-sm lg:hidden"><SlidersHorizontal className="h-4 w-4 shrink-0" /><span className="truncate">筛选{activeFilterCount ? ` ${activeFilterCount}` : ''}</span></button>
        </div>
        <label className="min-w-0 max-w-full overflow-hidden text-xs text-[var(--muted)]"><span className="sr-only lg:not-sr-only">排序</span><select aria-label="工具排序" value={state.sort} onChange={(event) => onPatch({ sort: event.target.value as SortOption })} className="mt-1 min-h-11 w-full min-w-0 max-w-full rounded-md border border-[var(--line-strong)] bg-[var(--surface)] px-2 text-sm text-[var(--ink)] sm:px-3">{sorts.map((sort) => <option key={sort.value} value={sort.value}>{sort.label}</option>)}</select></label>
      </div>
    </section>
  );
}
