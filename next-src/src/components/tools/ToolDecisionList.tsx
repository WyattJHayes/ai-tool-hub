'use client';

import { useState, type ReactNode } from 'react';
import { getCompareAvailability } from '@/lib/compare-selection.mjs';
import { buildToolDetailHref } from '@/lib/tools-query-state.mjs';
import { getToolSlug } from '@/lib/tools-data';
import { useCompareStore } from '@/stores/useCompareStore';
import type { ToolDecisionGroup } from '@/types/tool';
import { ToolDecisionRow } from './ToolDecisionRow';

interface ToolDecisionListProps {
  groups: ToolDecisionGroup[];
  returnPath?: string;
  variant?: 'matrix' | 'compact';
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onClear?: () => void;
  showCompare?: boolean;
  emptyState?: ReactNode;
}

export function ToolDecisionList({
  groups,
  returnPath,
  variant = 'matrix',
  isLoading = false,
  error = null,
  onRetry,
  onClear,
  showCompare = true,
  emptyState,
}: ToolDecisionListProps) {
  const { selectedTools, addTool, removeTool } = useCompareStore();
  const [announcement, setAnnouncement] = useState('');
  const items = groups.flatMap((group) => group.items);

  if (isLoading) {
    return <div role="status" aria-label="正在加载工具" className="space-y-2">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-[88px] border-b border-[var(--line)] bg-[var(--surface)]" />)}</div>;
  }
  if (error) {
    return <div role="alert" className="border-l-4 border-[var(--signal)] bg-[var(--signal-soft)] p-5 text-[var(--signal-ink)]"><p>{error}</p><button type="button" onClick={onRetry} className="mt-3 min-h-11 rounded-md border border-[var(--signal-ink)] px-4 text-[var(--signal-ink)]">重新加载</button></div>;
  }
  if (items.length === 0) {
    return emptyState || <div className="py-16 text-center"><p className="text-base font-medium">没有符合这些条件的工具</p><button type="button" onClick={onClear} className="mt-3 min-h-11 rounded-md border border-[var(--line-strong)] px-4">清除筛选</button></div>;
  }

  return (
    <div>
      <p className="sr-only" aria-live="polite">{announcement}</p>
      {groups.map((group) => (
        <section key={group.id} className="mb-8" aria-labelledby={group.title ? `group-${group.id}` : undefined}>
          {group.title ? <h2 id={`group-${group.id}`} className="mb-3 text-sm font-semibold text-[var(--ink)]">{group.title} <span className="font-normal text-[var(--muted)]">{group.items.length}</span></h2> : null}
          {group.items.length ? <ul className="overflow-hidden border-y border-[var(--line)]">
            {group.items.map((model) => {
              const availability = getCompareAvailability(selectedTools, model.tool.id);
              const selected = availability === 'selected';
              const detailPath = `/tools/${getToolSlug(model.tool)}`;
              return (
                <ToolDecisionRow
                  key={model.tool.id}
                  model={model}
                  variant={variant}
                  showCompare={showCompare}
                  selected={selected}
                  compareDisabled={availability === 'limit-reached'}
                  detailHref={returnPath ? buildToolDetailHref(getToolSlug(model.tool), returnPath) : detailPath}
                  onCompareToggle={() => selected ? removeTool(model.tool.id) : addTool(model.tool)}
                  onCompareLimit={() => setAnnouncement('最多比较 4 款工具，请先移除一款')}
                />
              );
            })}
          </ul> : group.title ? <p className="border-y border-[var(--line)] py-8 text-center text-sm text-[var(--muted)]">本组暂无符合条件的工具</p> : null}
        </section>
      ))}
    </div>
  );
}
