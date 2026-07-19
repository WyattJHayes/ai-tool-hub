'use client';

import { useEffect, useMemo, useState } from 'react';
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

  useEffect(() => {
    if (!dataLoaded) loadData();
  }, [dataLoaded, loadData]);

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
  const activeFilterCount = Number(Boolean(state.categoryId)) + Number(Boolean(state.price)) + state.origins.length + state.platforms.length;
  const clearSecondary = () => update({ categoryId: null, price: null, origins: [], platforms: [] });
  const retry = () => {
    retryLoadData();
    retryScenes();
  };

  return (
    <main className="mx-auto max-w-7xl px-4 pb-36 pt-10 text-[var(--ink)] sm:px-6 sm:pb-24">
      <header>
        <h1 className="text-2xl font-semibold sm:text-3xl">工具目录</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">按任务、能力和使用条件比较工具</p>
      </header>
      <div className="mt-6">
        <TaskContextBar
          state={state}
          scenes={scenes}
          categories={categories}
          resultCount={resultCount}
          isLoading={isLoading || scenesLoading}
          activeFilterCount={activeFilterCount}
          onPatch={update}
          onOpenFilters={() => setFiltersOpen(true)}
        />
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <FilterRail state={state} platformOptions={platforms} onPatch={update} onClear={clearSecondary} />
        <ToolDecisionList
          groups={groups}
          returnPath={currentPath}
          isLoading={isLoading || scenesLoading}
          error={error || scenesError}
          onRetry={retry}
          onClear={clearSecondary}
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
