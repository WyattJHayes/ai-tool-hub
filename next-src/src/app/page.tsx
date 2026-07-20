'use client';

import { useEffect, useMemo } from 'react';
import { SearchBar } from '@/components/hero/SearchBar';
import { TaskEntryList } from '@/components/home/TaskEntryList';
import { ToolDecisionList } from '@/components/tools/ToolDecisionList';
import { useSceneData } from '@/hooks/useSceneData';
import { createToolDecisionModel } from '@/lib/tool-decision.mjs';
import { useToolStore } from '@/stores/useToolStore';

export default function Home() {
  const {
    tools,
    categories,
    isLoading,
    error,
    loadData,
    retryLoadData,
    dataLoaded,
  } = useToolStore();
  const { scenes, isLoading: scenesLoading, error: scenesError, retry: retryScenes } = useSceneData();

  useEffect(() => {
    if (!dataLoaded) loadData();
  }, [dataLoaded, loadData]);

  const weeklyTools = useMemo(() => {
    const hot = tools.filter((tool) => tool.status === 'hot');
    const selected = [...hot];
    for (const tool of tools) {
      if (selected.length >= 6) break;
      if (!selected.some((candidate) => candidate.id === tool.id)) selected.push(tool);
    }
    return selected.slice(0, 6).map((tool) => createToolDecisionModel(tool, scenes, categories));
  }, [categories, scenes, tools]);

  return (
    <main data-console-home className="min-h-screen bg-[var(--page)] text-[var(--ink)]">
      <section data-instrument-section="primary">
        <div className="mx-auto max-w-[1160px] px-4 py-9 sm:px-0 sm:pb-0 sm:pt-12">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">按任务找到合适的 AI 工具</h1>
            <p className="mt-3 text-[var(--muted)]">先确定任务，再比较能力、价格和使用条件</p>
            <div className="mt-6"><SearchBar /></div>
          </div>
        </div>
      </section>
      <section data-instrument-section="tasks" className="instrument-section border-t border-[var(--line)]">
        <div className="mx-auto max-w-[1160px] px-4 py-9 sm:px-0 sm:py-12">
          <h2 className="mb-5 text-xl font-semibold sm:text-2xl">你要完成什么？</h2>
          {scenesLoading ? <div role="status" className="h-52 border-y border-[var(--line)]" /> : null}
          {scenesError ? <div role="alert" className="border-l-4 border-[var(--signal)] bg-[var(--signal-soft)] p-4 text-[var(--signal-ink)]"><p>{scenesError}</p><button type="button" onClick={retryScenes} className="mt-3 min-h-11 rounded-md border border-[var(--signal-ink)] px-4">重新加载</button></div> : null}
          {!scenesLoading && !scenesError ? <TaskEntryList scenes={scenes} /> : null}
        </div>
      </section>
      <section data-instrument-section="weekly" className="instrument-section border-t border-[var(--line)]">
        <div className="mx-auto max-w-[1160px] px-4 py-9 sm:px-0 sm:py-12">
          <h2 className="mb-5 text-xl font-semibold sm:text-2xl">本周值得试</h2>
          <ToolDecisionList groups={[{ id: 'weekly', items: weeklyTools }]} variant="compact" showCompare={false} isLoading={isLoading} error={error} onRetry={retryLoadData} />
        </div>
      </section>
    </main>
  );
}
