import { ExternalLink, Heart, Plus, X } from 'lucide-react';
import { ToolIcon } from '@/lib/icon-map';
import type { ToolDecisionModel } from '@/types/tool';

interface ToolDecisionSummaryProps {
  model: ToolDecisionModel;
  favorite: boolean;
  compared: boolean;
  compareDisabled: boolean;
  compareAnnouncement: string;
  onToggleFavorite: () => void;
  onToggleCompare: () => void;
  onVisit: () => void;
}

export function ToolDecisionSummary({
  model,
  favorite,
  compared,
  compareDisabled,
  compareAnnouncement,
  onToggleFavorite,
  onToggleCompare,
  onVisit,
}: ToolDecisionSummaryProps) {
  return (
    <section className="border-y border-[var(--line)] py-4 sm:py-5">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-start">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-subtle)] text-[var(--accent)]">
            <ToolIcon name={model.tool.icon} className="h-8 w-8" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-semibold leading-tight">{model.tool.name}</h1>
            <p className="mt-1.5 max-w-3xl text-base text-[var(--muted)]">{model.tool.desc}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {model.tasks.map((task) => (
                <span key={`${task.source}-${task.id}`} className="rounded border-l-2 border-[var(--accent)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--muted)]">
                  {task.source === 'scene' ? <strong className="mr-1 text-[var(--accent-ink)]">适用任务</strong> : null}{task.label}
                </span>
              ))}
              {model.capabilitySummary.map((capability) => (
                <span key={capability} className="rounded border-l-2 border-[var(--accent)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--ink)]">{capability}</span>
              ))}
              <span className="rounded border-l-2 border-[var(--accent)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--muted)]">
                <strong className="mr-1 text-[var(--accent-ink)]">价格</strong>{model.price.summary || model.price.valueTag || '查看官网定价'}
              </span>
            </div>
          </div>
        </div>

        <div className="grid w-full shrink-0 grid-cols-[minmax(0,1fr)_44px] gap-2 lg:w-[276px]">
          <a href={model.tool.url} target="_blank" rel="noopener noreferrer" onClick={onVisit} className="col-span-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-[var(--on-accent)] hover:bg-[var(--accent-hover)]">
            访问官网 <ExternalLink className="h-4 w-4" />
          </a>
          <button type="button" aria-pressed={favorite} onClick={onToggleFavorite} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[var(--line-strong)] bg-[var(--surface)] px-4 text-sm font-medium hover:bg-[var(--surface-subtle)]">
            <Heart className={`h-4 w-4 ${favorite ? 'fill-current text-[var(--accent)]' : ''}`} />{favorite ? '已收藏' : '收藏'}
          </button>
          <button type="button" aria-pressed={compared} aria-disabled={compareDisabled && !compared} aria-label={compared ? '移出比较' : '加入比较'} onClick={onToggleCompare} className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-[var(--line-strong)] bg-[var(--surface)] hover:bg-[var(--surface-subtle)]">
            {compared ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          </button>
          <p className="sr-only" aria-live="polite">{compareAnnouncement}</p>
        </div>
      </div>
    </section>
  );
}
