'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useToolDirectoryQuery } from '@/hooks/useToolDirectoryQuery';
import { useSceneData } from '@/hooks/useSceneData';
import { deriveAvailablePlatforms } from '@/lib/tool-decision.mjs';
import { selectDirectoryGroups } from '@/lib/tools-query-state.mjs';
import { useToolStore } from '@/stores/useToolStore';
import { FilterRail } from './FilterRail';
import { MobileFilterDrawer } from './MobileFilterDrawer';
import { TaskContextBar } from './TaskContextBar';
import { ToolDecisionList } from './ToolDecisionList';

export function ToolsBrowseClient() {
  const { tools, categories, clickStats, isLoading, error, dataLoaded, loadData, retryLoadData } = useToolStore();
  const { scenes, isLoading: scenesLoading, error: scenesError, retry: retryScenes } = useSceneData();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const catalogLoadRequestedRef = useRef(false);

  useEffect(() => {
    if (dataLoaded) {
      catalogLoadRequestedRef.current = false;
      return;
    }
    if (error || (isLoading && catalogLoadRequestedRef.current)) return;
    catalogLoadRequestedRef.current = true;
    void loadData();
  }, [dataLoaded, error, isLoading, loadData]);

  const platforms = useMemo(() => deriveAvailablePlatforms(tools), [tools]);
  const catalog = useMemo(() => ({
    sceneIds: new Set(scenes.map((scene) => scene.id)),
    categoryIds: new Set(categories.map((category) => category.id)),
    platforms: new Set(platforms),
  }), [categories, platforms, scenes]);
  const { state, update, currentPath } = useToolDirectoryQuery(catalog);
  const groups = useMemo(
    () => selectDirectoryGroups(tools, scenes, categories, state, clickStats),
    [categories, clickStats, scenes, state, tools]
  );
  const resultCount = groups.reduce((total, group) => total + group.items.length, 0);
  const sceneLabel = scenes.find((scene) => scene.id === state.sceneId)?.name.replace(/^我要/, '');
  const activeFilterCount = Number(Boolean(state.categoryId)) + Number(Boolean(state.price)) + state.origins.length + state.platforms.length;
  const clearSecondary = () => update({ categoryId: null, price: null, origins: [], platforms: [] });
  const clearEmptyState = () => update({ searchTerm: '', categoryId: null, price: null, origins: [], platforms: [] });
  const retry = () => {
    if (error) {
      catalogLoadRequestedRef.current = true;
      void retryLoadData();
    }
    if (scenesError) retryScenes();
  };

  return (
    <main className="mx-auto max-w-7xl px-4 pb-36 pt-2 text-[var(--ink)] sm:px-6 sm:pb-24 sm:pt-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">工具目录</h1>
          <p className="mt-2 hidden text-sm text-[var(--muted)] sm:block">按任务、能力和使用条件比较工具</p>
        </div>
        <p role="status" className="mt-1 shrink-0 text-sm text-[var(--muted)]">
          {isLoading || scenesLoading ? '正在加载' : `${sceneLabel ? `${sceneLabel} · ` : ''}${resultCount} 款工具`}
        </p>
      </header>
      <div className="mt-2 sm:mt-6">
        <TaskContextBar
          state={state}
          scenes={scenes}
          categories={categories}
          activeFilterCount={activeFilterCount}
          onPatch={update}
          onOpenFilters={() => setFiltersOpen(true)}
        />
      </div>
      <div className="mt-4 grid gap-6 lg:mt-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <FilterRail state={state} platformOptions={platforms} onPatch={update} onClear={clearSecondary} />
        <ToolDecisionList
          groups={groups}
          returnPath={currentPath}
          isLoading={isLoading || scenesLoading}
          error={error || scenesError}
          onRetry={retry}
          onClear={clearEmptyState}
        />
      </div>
      <MobileFilterDrawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        categories={categories}
        state={state}
        platformOptions={platforms}
        onPatch={update}
        onClear={clearSecondary}
      />
    </main>
  );
}
