'use client';

import { ArrowRight, ExternalLink, Heart } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import type { Tool } from '@/types/tool';
import { useUserStore } from '@/stores/useUserStore';
import { useCompareStore } from '@/stores/useCompareStore';
import { getPricingHighlight, getToolSlug } from '@/lib/tools-data';
import { cn } from '@/lib/utils';
import { trackClick } from '@/lib/api';
import { ToolIcon } from '@/lib/icon-map';

const TAG_LABELS: Record<string, string> = {
  free: '免费',
  vip: 'VIP',
  new: '新收录',
  hot: '常用',
  domestic: '国产',
};

const TAG_STYLES: Record<string, string> = {
  free: 'border-[var(--accent-soft)] bg-[var(--accent-soft)] text-[var(--accent)]',
  hot: 'border-red-100 bg-red-50 text-[var(--danger)] dark:border-red-950 dark:bg-red-950/40',
  vip: 'border-amber-100 bg-amber-50 text-[var(--warning)] dark:border-amber-950 dark:bg-amber-950/40',
};

interface ToolCardProps {
  tool: Tool;
}

export function ToolCard({ tool }: ToolCardProps) {
  const toggleFavorite = useUserStore((state) => state.toggleFavorite);
  const isFavorite = useUserStore((state) => state.isFavorite(tool.id));
  const { selectedTools, addTool, removeTool, isSelected } = useCompareStore();
  const [compareAnnouncement, setCompareAnnouncement] = useState('');
  const compareSelected = isSelected(tool.id);
  const compareDisabled = !compareSelected && selectedTools.length >= 4;
  const slug = getToolSlug(tool);
  const priceLabel = getPricingHighlight(tool.pricing);
  const platformLabel = tool.platform?.[0];

  const handleCompare = () => {
    if (compareSelected) {
      removeTool(tool.id);
      setCompareAnnouncement('已移出比较');
      return;
    }

    const outcome = addTool(tool);
    setCompareAnnouncement(outcome === 'limit-reached' ? '最多比较 4 款工具，请先移除一款' : '已加入比较');
  };

  const displayTags = [
    ...(tool.status === 'hot' ? ['hot'] : []),
    ...(tool.tags || []),
    ...(tool.toolTags?.includes('国产') ? ['domestic'] : []),
  ]
    .filter((tag, index, all) => all.indexOf(tag) === index)
    .slice(0, 2);

  return (
    <article className="group flex h-full min-h-[240px] flex-col rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 transition-colors duration-150 hover:border-[var(--line-strong)]">
      <div className="flex items-start gap-3">
        <Link href={`/tools/${slug}`} className="flex min-w-0 flex-1 items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[var(--surface-subtle)] text-[var(--accent)]">
            <ToolIcon name={tool.icon} className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-base font-semibold text-[var(--ink)]">{tool.name}</span>
            <span className="mt-1 flex flex-wrap gap-1">
              {displayTags.map((tag) => (
                <span
                  key={tag}
                  className={cn(
                    'rounded border px-1.5 py-0.5 text-[10px] font-medium leading-4',
                    TAG_STYLES[tag] || 'border-[var(--line)] bg-[var(--surface-subtle)] text-[var(--muted)]'
                  )}
                >
                  {TAG_LABELS[tag] || tag}
                </span>
              ))}
            </span>
          </span>
        </Link>

        <label className="flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 text-xs text-[var(--muted)]">
          <input
            type="checkbox"
            checked={compareSelected}
            aria-disabled={compareDisabled}
            aria-label={`${compareSelected ? '取消对比' : '加入对比'} ${tool.name}`}
            onChange={handleCompare}
            className="h-4 w-4 rounded border-[var(--line-strong)] accent-[var(--accent)]"
          />
          <span>对比</span>
        </label>
        <span className="sr-only" aria-live="polite">{compareAnnouncement}</span>
      </div>

      <Link href={`/tools/${slug}`} className="mt-3 min-h-11 flex flex-1">
        <p className="line-clamp-2 text-sm leading-6 text-[var(--muted)]">{tool.desc}</p>
      </Link>

      <div className="mt-4 flex min-h-6 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--muted-subtle)]">
        {(tool.valueTag || priceLabel) ? <span>{tool.valueTag || priceLabel}</span> : null}
        {platformLabel ? <><span aria-hidden="true">·</span><span>{platformLabel}</span></> : null}
        {tool.updateTime ? <><span aria-hidden="true">·</span><span>{tool.updateTime}</span></> : null}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-[var(--line)] pt-3">
        <Link href={`/tools/${slug}`} className="flex min-h-11 items-center gap-1 text-xs font-medium text-[var(--accent)] hover:text-[var(--accent-hover)]">
          查看详情 <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => toggleFavorite(tool.id)}
            className="flex h-11 w-11 items-center justify-center rounded-md text-[var(--muted-subtle)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--danger)]"
            aria-label={isFavorite ? `取消收藏 ${tool.name}` : `收藏 ${tool.name}`}
            title={isFavorite ? '取消收藏' : '收藏'}
          >
            <Heart className={cn('h-[18px] w-[18px]', isFavorite && 'fill-current text-[var(--danger)]')} />
          </button>
          <a
            href={tool.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackClick(tool.id, slug, 'card')}
            className="flex h-11 items-center gap-1.5 rounded-md border border-[var(--line)] px-3 text-xs font-medium text-[var(--ink)] transition-colors hover:border-[var(--line-strong)] hover:bg-[var(--surface-subtle)]"
            aria-label={`访问 ${tool.name}`}
          >
            访问 <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </article>
  );
}
