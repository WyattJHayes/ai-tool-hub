'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Calendar, Check, ExternalLink, Heart, Layers, Shield, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getRatings, trackClick } from '@/lib/api';
import { RatingWidget } from '@/components/ratings/RatingWidget';
import { useToolStore } from '@/stores/useToolStore';
import { useUserStore } from '@/stores/useUserStore';
import { getCategoryNames, getRelatedTools, getToolSlug } from '@/lib/tools-data';
import { ToolCard } from '@/components/tools/ToolCard';
import { ToolIcon } from '@/lib/icon-map';

const difficultyStyles: Record<string, string> = {
  beginner: 'border-[var(--accent-soft)] bg-[var(--accent-soft)] text-[var(--accent)]',
  intermediate: 'border-amber-100 bg-amber-50 text-[var(--warning)] dark:border-amber-950 dark:bg-amber-950/40',
  advanced: 'border-red-100 bg-red-50 text-[var(--danger)] dark:border-red-950 dark:bg-red-950/40',
};

const difficultyLabels: Record<string, string> = {
  beginner: '入门友好',
  intermediate: '进阶使用',
  advanced: '高级专业',
};

type RatingData = {
  avg_rating: number;
  rating_count: number;
  reviews: { score: number; tags: string[]; comment: string }[];
};

export default function ToolDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { tools, categories, isLoading, loadData, dataLoaded } = useToolStore();
  const { isFavorite, toggleFavorite, getRating } = useUserStore();
  const [ratingData, setRatingData] = useState<RatingData>({ avg_rating: 0, rating_count: 0, reviews: [] });

  const tool = useMemo(
    () => tools.find((candidate) => getToolSlug(candidate) === slug) || null,
    [tools, slug]
  );
  const relatedTools = useMemo(
    () => tool ? getRelatedTools(tools, tool, 6) : [],
    [tools, tool]
  );

  useEffect(() => {
    if (!dataLoaded) loadData();
  }, [dataLoaded, loadData]);

  useEffect(() => {
    if (!tool) return;
    trackClick(tool.id, getToolSlug(tool), 'detail');
    getRatings(tool.id).then(setRatingData).catch(() => {});
  }, [tool]);

  if (!tool && !isLoading) {
    return (
      <main className="flex min-h-[70vh] flex-col items-center justify-center gap-5 px-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface)] text-2xl">?</div>
        <div>
          <h1 className="text-2xl font-semibold text-[var(--ink)]">工具未找到</h1>
          <p className="mt-2 text-[var(--muted)]">该工具可能已下线或链接有误</p>
        </div>
        <Link href="/tools" className="flex min-h-11 items-center rounded-md bg-[var(--accent)] px-5 text-sm font-medium text-white hover:bg-[var(--accent-hover)]">返回工具目录</Link>
      </main>
    );
  }

  if (!tool) {
    return <main className="flex min-h-[70vh] items-center justify-center text-sm text-[var(--muted)]">正在加载工具信息…</main>;
  }

  const favorite = isFavorite(tool.id);

  return (
    <main className="min-h-screen bg-[var(--page)] text-[var(--ink)]">
      <div className="sticky top-16 z-40 border-b border-[var(--line)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2 sm:px-6">
          <Link href="/tools" className="flex h-11 w-11 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)]" aria-label="返回工具目录">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span className="min-w-0 flex-1 truncate text-sm font-semibold sm:text-base">{tool.name}</span>
          <button
            type="button"
            onClick={() => toggleFavorite(tool.id)}
            className={cn(
              'flex min-h-11 items-center gap-1.5 rounded-md px-3 text-sm transition-colors',
              favorite ? 'bg-red-50 text-[var(--danger)] dark:bg-red-950/40' : 'text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)]'
            )}
          >
            <Heart className={cn('h-4 w-4', favorite && 'fill-current')} />
            <span className="hidden sm:inline">{favorite ? '已收藏' : '收藏'}</span>
          </button>
          <a href={tool.url} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center gap-1.5 rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-white hover:bg-[var(--accent-hover)]">
            访问官网 <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <section className="border-b border-[var(--line)] pb-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-subtle)] text-[var(--accent)]">
              <ToolIcon name={tool.icon} className="h-8 w-8" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-semibold sm:text-4xl">{tool.name}</h1>
                {tool.status === 'hot' ? <span className="rounded border border-red-100 bg-red-50 px-2 py-0.5 text-xs text-[var(--danger)] dark:border-red-950 dark:bg-red-950/40">常用</span> : null}
              </div>
              <p className="mt-2 text-base text-[var(--muted)] sm:text-lg">{tool.desc}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                {tool.categories ? (
                  <span className="flex items-center gap-1 rounded border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-[var(--muted)]">
                    <Layers className="h-3 w-3" /> {getCategoryNames(categories, tool.categories || [tool.category])}
                  </span>
                ) : null}
                {tool.valueTag ? <span className="rounded border border-[var(--accent-soft)] bg-[var(--accent-soft)] px-2.5 py-1 font-medium text-[var(--accent)]">{tool.valueTag}</span> : null}
                {tool.difficulty ? <span className={cn('rounded border px-2.5 py-1 font-medium', difficultyStyles[tool.difficulty])}>{difficultyLabels[tool.difficulty]}</span> : null}
                {tool.toolTags?.includes('国产') ? <span className="rounded border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-[var(--muted)]">国产</span> : null}
                {tool.updateTime ? <span className="flex items-center gap-1 px-1 text-[var(--muted-subtle)]"><Calendar className="h-3 w-3" />更新于 {tool.updateTime}</span> : null}
              </div>
            </div>
          </div>
        </section>

        {tool.highlights?.length ? (
          <section className="mt-8">
            <h2 className="mb-4 text-lg font-semibold">核心功能</h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {tool.highlights.map((highlight) => (
                <div key={highlight} className="flex items-center gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
                  <Check className="h-4 w-4 shrink-0 text-[var(--accent)]" />
                  <span className="text-sm text-[var(--muted)]">{highlight}</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {tool.pricing?.length ? (
          <section className="mt-8">
            <h2 className="mb-4 text-lg font-semibold">定价方案</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {tool.pricing.map((plan) => (
                <div key={`${plan.plan}-${plan.price}`} className={cn('rounded-lg border bg-[var(--surface)] p-5', plan.highlight ? 'border-[var(--accent)]' : 'border-[var(--line)]')}>
                  {plan.highlight ? <span className="mb-2 inline-block rounded bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--accent)]">推荐</span> : null}
                  <h3 className="text-base font-semibold">{plan.plan}</h3>
                  <div className="mt-2">
                    <span className="text-2xl font-semibold text-[var(--ink)]">{plan.price === 0 ? '免费' : plan.price}</span>
                    {plan.price > 0 ? <span className="text-sm text-[var(--muted)]"> {plan.unit}</span> : null}
                  </div>
                  <p className="mt-2 text-sm text-[var(--muted)]">{plan.quota}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">标签</h2>
          <div className="flex flex-wrap gap-2">
            {[...tool.tags, ...(tool.toolTags || [])].map((tag, index) => (
              <span key={`${tag}-${index}`} className="rounded border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-xs text-[var(--muted)]">{tag}</span>
            ))}
          </div>
          <div className="mt-5 flex items-center gap-2 text-xs text-[var(--muted-subtle)]">
            <Shield className="h-3.5 w-3.5" />信息最后验证：{tool.updateTime || '未知'}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="mb-4 text-lg font-semibold">评价</h2>
          <RatingWidget toolId={tool.id} currentRating={getRating(tool.id)} />
        </section>

        {ratingData.rating_count > 0 ? (
          <section className="mt-8">
            <h2 className="mb-4 text-lg font-semibold">用户评价</h2>
            <div className="mb-4 flex items-center gap-3">
              <span className="text-3xl font-semibold text-[var(--ink)]">{ratingData.avg_rating.toFixed(1)}</span>
              <div>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((score) => <Star key={score} className={cn('h-4 w-4', score <= Math.round(ratingData.avg_rating) ? 'fill-amber-400 text-amber-400' : 'text-[var(--line-strong)]')} />)}
                </div>
                <p className="text-xs text-[var(--muted)]">{ratingData.rating_count} 条评价</p>
              </div>
            </div>
            <div className="space-y-2">
              {ratingData.reviews.slice(0, 5).map((review, index) => (
                <div key={index} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <div className="flex gap-0.5">{[1, 2, 3, 4, 5].map((score) => <Star key={score} className={cn('h-3 w-3', score <= review.score ? 'fill-amber-400 text-amber-400' : 'text-[var(--line-strong)]')} />)}</div>
                    {review.tags.map((tag) => <span key={tag} className="rounded bg-[var(--surface-subtle)] px-1.5 py-0.5 text-[10px] text-[var(--muted)]">{tag}</span>)}
                  </div>
                  {review.comment ? <p className="text-sm text-[var(--muted)]">{review.comment}</p> : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-8">
          <h2 className="mb-4 text-lg font-semibold">更新记录</h2>
          <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--surface-subtle)] text-[var(--accent)]"><Calendar className="h-4 w-4" /></span>
              <div><p className="text-sm font-medium">最后更新</p><p className="text-xs text-[var(--muted)]">{tool.updateTime || '暂无记录'}</p></div>
            </div>
            <p className="mt-4 border-t border-[var(--line)] pt-4 text-xs text-[var(--muted)]">该工具信息由编辑团队定期核查。如发现信息有误，欢迎反馈。</p>
          </div>
        </section>

        {relatedTools.length ? (
          <section className="mt-12">
            <h2 className="mb-5 text-xl font-semibold">替代方案</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {relatedTools.map((relatedTool) => <ToolCard key={relatedTool.id} tool={relatedTool} />)}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
