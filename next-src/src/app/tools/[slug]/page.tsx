'use client';


import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, ExternalLink, Heart, Check, Star,
  Calendar, Layers, Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { trackClick, getRatings } from '@/lib/api';
import { RatingWidget } from '@/components/ratings/RatingWidget';
import { useToolStore } from '@/stores/useToolStore';
import { useUserStore } from '@/stores/useUserStore';
import { getToolSlug, getRelatedTools, getCategoryNames } from '@/lib/tools-data';
import { ToolCard } from '@/components/tools/ToolCard';
import { ToolIcon } from '@/lib/icon-map';


const difficultyColors: Record<string, string> = {
  beginner: 'text-emerald-400 bg-emerald-500/15',
  intermediate: 'text-amber-400 bg-amber-500/15',
  advanced: 'text-red-400 bg-red-500/15',
};

const difficultyLabels: Record<string, string> = {
  beginner: '入门友好',
  intermediate: '进阶使用',
  advanced: '高级专业',
};

export default function ToolDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { tools, categories, isLoading, loadData, dataLoaded } = useToolStore();
  const { isFavorite, toggleFavorite, getRating } = useUserStore();
  const [ratingData, setRatingData] = useState<{ avg_rating: number; rating_count: number; reviews: { score: number; tags: string[]; comment: string }[] }>({ avg_rating: 0, rating_count: 0, reviews: [] });
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
            <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-950 px-4 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white/5">
          <span className="text-4xl">🔍</span>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">工具未找到</h1>
          <p className="mt-2 text-white/50">该工具可能已下线或链接有误</p>
        </div>
        <Link
          href="/"
          className="rounded-xl bg-white/10 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-white/15"
        >
          返回首页
        </Link>
      </div>
    );
  }

  if (!tool) {
    return (
            <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    );
  }

  const favorite = isFavorite(tool.id);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="sticky top-0 z-50 border-b border-white/10 bg-gray-950/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-4">
          <Link
            href="/"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/50 transition-colors hover:bg-white/5 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-lg font-semibold">{tool.name}</h1>
          <div className="flex-1" />
          <button
            onClick={() => toggleFavorite(tool.id)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition-colors',
              favorite
                ? 'bg-red-500/15 text-red-400'
                : 'border border-white/10 text-white/50 hover:bg-white/5 hover:text-white'
            )}
          >
            <Heart className={cn('h-4 w-4', favorite && 'fill-red-400')} />
            {favorite ? '已收藏' : '收藏'}
          </button>
          <a
            href={tool.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
          >
            访问官网 <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-8">
        {/* Basic info card */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            {/* Icon */}
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 text-4xl">
              <ToolIcon name={tool.icon} className="h-10 w-10 text-blue-300" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-3xl font-bold">{tool.name}</h2>
                {tool.status === 'hot' && (
                  <span className="rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-medium text-red-400">
                    热门
                  </span>
                )}
              </div>
              <p className="mt-2 text-lg text-white/60">{tool.desc}</p>

              {/* Meta tags */}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {tool.categories && (
                  <span className="flex items-center gap-1 rounded-full bg-violet-500/15 px-3 py-1 text-xs text-violet-400">
                    <Layers className="h-3 w-3" />
                    {getCategoryNames(categories, tool.categories || [tool.category])}
                  </span>
                )}
                {tool.valueTag && (
                  <span className={cn(
                    'rounded-full px-3 py-1 text-xs font-medium',
                    tool.valueTag === '免费够用' ? 'bg-emerald-500/15 text-emerald-400' :
                    tool.valueTag === '纯付费' ? 'bg-red-500/15 text-red-400' :
                    'bg-blue-500/15 text-blue-400'
                  )}>
                    {tool.valueTag}
                  </span>
                )}
                {tool.difficulty && (
                  <span className={cn('rounded-full px-3 py-1 text-xs font-medium', difficultyColors[tool.difficulty])}>
                    {difficultyLabels[tool.difficulty]}
                  </span>
                )}
                {tool.toolTags?.includes('国产') && (
                  <span className="rounded-full bg-purple-500/15 px-3 py-1 text-xs text-purple-400">国产</span>
                )}
                {tool.updateTime && (
                  <span className="flex items-center gap-1 text-xs text-white/30">
                    <Calendar className="h-3 w-3" />
                    更新于 {tool.updateTime}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Highlights */}
        {tool.highlights && tool.highlights.length > 0 && (
          <div className="mt-6">
            <h3 className="mb-4 text-lg font-semibold">核心功能</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {tool.highlights.map((h, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3"
                >
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/20">
                    <Check className="h-3.5 w-3.5 text-blue-400" />
                  </div>
                  <span className="text-sm text-white/70">{h}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pricing table */}
        {tool.pricing && tool.pricing.length > 0 && (
          <div className="mt-8">
            <h3 className="mb-4 text-lg font-semibold">定价方案</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {tool.pricing.map((plan, i) => (
                <div
                  key={i}
                  className={cn(
                    'rounded-2xl border p-5',
                    plan.highlight
                      ? 'border-blue-500/30 bg-blue-500/[0.08]'
                      : 'border-white/10 bg-white/[0.03]'
                  )}
                >
                  {plan.highlight && (
                    <span className="mb-2 inline-block rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-medium text-blue-400">
                      推荐
                    </span>
                  )}
                  <h4 className="text-lg font-semibold">{plan.plan}</h4>
                  <div className="mt-2">
                    <span className={cn('text-2xl font-bold', plan.price === 0 ? 'text-emerald-400' : 'text-white')}>
                      {plan.price === 0 ? '免费' : `${plan.price}`}
                    </span>
                    {plan.price > 0 && (
                      <span className="text-sm text-white/40"> {plan.unit}</span>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-white/50">{plan.quota}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tags */}
        <div className="mt-8">
          <h3 className="mb-4 text-lg font-semibold">标签</h3>
          <div className="flex flex-wrap gap-2">
            {tool.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-white/5 px-3 py-1.5 text-xs text-white/50">
                {tag}
              </span>
            ))}
            {tool.toolTags?.map((tag) => (
              <span key={tag} className="rounded-full bg-white/5 px-3 py-1.5 text-xs text-white/50">
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Verified date */}
        <div className="mt-6 flex items-center gap-2 text-xs text-white/25">
          <Shield className="h-3.5 w-3.5" />
          <span>信息最后验证：{tool.updateTime || '未知'}</span>
        </div>


        {/* Rating */}
        <div className="mt-8">
          <h3 className="mb-4 text-lg font-semibold">评价</h3>
          <RatingWidget toolId={tool.id} currentRating={getRating(tool.id)} />
        </div>


        {/* R-04: Rating aggregation */}
        {ratingData.rating_count > 0 && (
          <div className="mt-6">
            <h3 className="mb-4 text-lg font-semibold">用户评价</h3>
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-3xl font-bold text-amber-400">{ratingData.avg_rating.toFixed(1)}</span>
                <div>
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5].map(n => (
                      <Star key={n} className={cn('h-4 w-4', n <= Math.round(ratingData.avg_rating) ? 'fill-amber-400 text-amber-400' : 'text-white/15')} />
                    ))}
                  </div>
                  <p className="text-xs text-white/30">{ratingData.rating_count} 条评价</p>
                </div>
              </div>
            </div>
            {ratingData.reviews.length > 0 && (
              <div className="space-y-2">
                {ratingData.reviews.slice(0, 5).map((review, i) => (
                  <div key={i} className="rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex gap-0.5">
                        {[1,2,3,4,5].map(n => (
                          <Star key={n} className={cn('h-3 w-3', n <= review.score ? 'fill-amber-400 text-amber-400' : 'text-white/15')} />
                        ))}
                      </div>
                      {review.tags.length > 0 && (
                        <div className="flex gap-1">
                          {review.tags.map((tag: string) => (
                            <span key={tag} className="rounded-full bg-blue-500/10 px-1.5 py-0.5 text-[10px] text-blue-400">{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    {review.comment && <p className="text-sm text-white/50">{review.comment}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* DP-06: Update log */}
        <div className="mt-8">
          <h3 className="mb-4 text-lg font-semibold">更新记录</h3>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                <Calendar className="h-4 w-4 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-white/70">最后更新</p>
                <p className="text-xs text-white/40">{tool.updateTime || '暂无记录'}</p>
              </div>
            </div>
            <div className="mt-4 border-t border-white/5 pt-4">
              <p className="text-xs text-white/30">
                该工具信息由编辑团队定期核查。如发现信息有误，欢迎反馈。
              </p>
            </div>
          </div>
        </div>

        {/* Related tools */}
        {relatedTools.length > 0 && (
          <div className="mt-12">
            <h3 className="mb-6 text-xl font-semibold">替代方案</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {relatedTools.map((t) => (
                <ToolCard key={t.id} tool={t} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
