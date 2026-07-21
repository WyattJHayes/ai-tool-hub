'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { ToolIcon } from '@/lib/icon-map';
import { cn } from '@/lib/utils';
import type { ToolDecisionModel } from '@/types/tool';

interface ToolDecisionRowProps {
  model: ToolDecisionModel;
  detailHref: string;
  variant?: 'matrix' | 'compact';
  selected: boolean;
  compareDisabled: boolean;
  showCompare?: boolean;
  onCompareToggle: () => void;
  onCompareLimit: () => void;
}

const originLabels = { domestic: '国产', overseas: '海外' } as const;
const platformLabels = { web: '网页版', local: '本地部署', cli: '命令行', desktop: '桌面端' } as const;

export function ToolDecisionRow({
  model,
  detailHref,
  variant = 'matrix',
  selected,
  compareDisabled,
  showCompare = true,
  onCompareToggle,
  onCompareLimit,
}: ToolDecisionRowProps) {
  const task = model.taskCell?.primary || model.tasks[0];
  const relation = model.taskCell?.relation === 'task-match' ? '任务映射' : '同类工具';
  const additionalTaskCount = model.taskCell?.additionalExplicitCount ?? Math.max(0, model.tasks.length - 1);
  const handleCompare = () => {
    if (compareDisabled && !selected) {
      onCompareLimit();
      return;
    }
    onCompareToggle();
  };

  return (
    <li
      data-tool-decision-row
      data-selected={selected ? 'true' : undefined}
      className={cn(
        "relative grid min-w-0 items-center gap-1 border-b border-[var(--line)] bg-[var(--surface)] px-3 py-2 before:pointer-events-none before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-transparent before:transition-colors before:content-[''] md:gap-3 md:py-3",
        selected && 'bg-[var(--accent-soft)] before:bg-[var(--accent)]',
        !selected && 'hover:bg-[var(--surface-hover)]',
        variant === 'matrix'
          ? 'grid-cols-[minmax(0,1fr)_44px] md:grid-cols-[44px_minmax(120px,.9fr)_minmax(110px,.75fr)_minmax(180px,1.25fr)_minmax(88px,.6fr)_44px] lg:grid-cols-[44px_minmax(150px,1fr)_minmax(130px,.85fr)_minmax(220px,1.35fr)_minmax(100px,.65fr)_44px]'
          : 'grid-cols-[minmax(0,1fr)_44px] md:grid-cols-[44px_minmax(120px,.9fr)_minmax(110px,.75fr)_minmax(180px,1.25fr)_minmax(88px,.6fr)_44px] lg:grid-cols-[44px_minmax(150px,1fr)_minmax(130px,.85fr)_minmax(220px,1.35fr)_minmax(100px,.65fr)_44px]'
      )}
    >
      {showCompare ? (
        <label className={cn('flex h-11 w-11 cursor-pointer items-center justify-center justify-self-center', variant === 'compact' ? 'col-start-2 row-start-1 md:col-start-1 md:row-start-1' : 'max-md:col-start-2 max-md:row-start-1')}>
          <input
            type="checkbox"
            checked={selected}
            aria-disabled={compareDisabled && !selected}
            aria-label={`${selected ? '取消对比' : '加入对比'} ${model.tool.name}`}
            onChange={handleCompare}
            className="h-4 w-4 accent-[var(--accent)]"
          />
        </label>
      ) : <span className={cn('h-11 w-11', variant === 'compact' ? 'col-start-2 row-start-1 md:col-start-1 md:row-start-1' : 'max-md:col-start-2 max-md:row-start-1')} aria-hidden="true" />}

      <div data-field="tool" className={cn('flex min-w-0 items-center gap-3', variant === 'compact' ? 'col-start-1 row-start-1 md:col-start-2 md:row-start-1' : 'max-md:col-start-1 max-md:row-start-1')}>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[var(--surface-subtle)] text-[var(--accent)]">
          <ToolIcon name={model.tool.icon} className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <strong className="block break-words text-sm leading-5 text-[var(--ink)]">{model.tool.name}</strong>
          <span className="block truncate text-xs text-[var(--muted)]">
            {[model.origin ? originLabels[model.origin] : null, ...model.platforms.map((platform) => platformLabels[platform])].filter(Boolean).join(' · ')}
          </span>
        </span>
      </div>

      <div data-field="task" className={cn('min-w-0 max-md:flex max-md:items-center max-md:gap-2', variant === 'compact' ? 'col-span-2 md:col-span-1 md:col-start-3 md:row-start-1' : 'max-md:col-span-2')}>
        <span className="block text-sm font-medium text-[var(--accent-ink)] max-md:inline">{task?.label || '工具目录'}</span>
        <span className="text-xs text-[var(--muted)]">
          {model.taskCell ? relation : model.tasks[0]?.source === 'scene' ? '任务映射' : '同类工具'}
          {additionalTaskCount ? ` +${additionalTaskCount}` : ''}
        </span>
      </div>

      <div data-field="capabilities" className={cn('flex min-w-0 flex-wrap gap-1.5', variant === 'compact' ? 'col-span-2 md:col-span-1 md:col-start-4 md:row-start-1' : 'max-md:col-span-2')}>
        {model.capabilitySummary.map((capability) => (
          <span key={capability} className="rounded bg-[var(--surface-subtle)] px-2 py-1 text-xs text-[var(--muted)]">
            {capability}
          </span>
        ))}
      </div>

      <div data-field="price" className={cn('text-sm text-[var(--muted)]', variant === 'compact' ? 'col-span-1 md:col-start-5 md:row-start-1' : 'max-md:col-span-1')}>
        {model.price.summary || model.price.valueTag || '查看定价'}
      </div>

      <Link
        href={detailHref}
        prefetch={false}
        aria-label={`查看 ${model.tool.name} 详情`}
        className={cn('flex h-11 w-11 items-center justify-center rounded-md text-[var(--accent)] hover:bg-[var(--accent-soft)]', variant === 'compact' ? 'col-start-2 md:col-start-6 md:row-start-1' : 'max-md:col-start-2')}
      >
        <ChevronRight className="h-4 w-4" />
      </Link>
    </li>
  );
}
