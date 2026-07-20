import { Calendar, Check, Star } from 'lucide-react';
import { RatingWidget } from '@/components/ratings/RatingWidget';
import { cn } from '@/lib/utils';
import type { ToolDecisionModel } from '@/types/tool';

export interface RatingData {
  avg_rating: number;
  rating_count: number;
  reviews: { score: number; tags: string[]; comment: string }[];
}

export type RatingState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; data: RatingData };

interface ToolEvidenceSectionsProps {
  model: ToolDecisionModel;
  currentRating: number;
  ratingState: RatingState;
  onRated: (score: number) => void;
}

export function ToolEvidenceSections({ model, currentRating, ratingState, onRated }: ToolEvidenceSectionsProps) {
  const tool = model.tool;
  const metadataTags = tool.toolTags?.length ? tool.toolTags : tool.tags;
  const ratingData = ratingState.status === 'ready' ? ratingState.data : null;
  return (
    <div className="space-y-3">
      {model.capabilities.length ? (
        <section aria-labelledby="capabilities-title">
          <h2 id="capabilities-title" className="mb-1 text-lg font-semibold leading-6">核心能力</h2>
          <ul className="grid border-y border-[var(--line)] sm:grid-cols-2 sm:gap-x-8">
            {model.capabilities.map((capability) => (
              <li key={capability} className="flex items-center gap-3 border-b border-[var(--line)] py-1.5 text-sm text-[var(--ink)] last:border-b-0">
                <Check className="h-4 w-4 shrink-0 text-[var(--accent)]" />{capability}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {tool.pricing?.length ? (
        <section aria-labelledby="pricing-title">
          <h2 id="pricing-title" className="mb-1 text-lg font-semibold leading-6">定价与限制</h2>
          <div className="overflow-x-auto border-y border-[var(--line)]">
            <table className="w-full min-w-[520px] table-fixed text-left text-sm">
              <thead className="text-xs font-normal text-[var(--muted)]">
                <tr>
                  <th className="w-[19%] px-3 py-1.5 font-normal">方案</th>
                  <th className="w-[35%] px-3 py-1.5 font-normal">价格</th>
                  <th className="px-3 py-1.5 font-normal">额度</th>
                </tr>
              </thead>
              <tbody>
                {tool.pricing.map((plan) => (
                  <tr key={`${plan.plan}-${plan.price}`} className={cn('border-t border-[var(--line)]', plan.highlight && 'bg-[var(--accent-soft)]/30')}>
                    <th className="px-3 py-1.5 font-semibold">{plan.plan}</th>
                    <td className="px-3 py-1.5">{plan.price === 0 ? '免费' : `${plan.price} ${plan.unit}`}</td>
                    <td className="px-3 py-1.5">{plan.quota}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section aria-labelledby="metadata-title">
        <h2 id="metadata-title" className="mb-1 text-lg font-semibold leading-6">信息</h2>
        <dl className="border-y border-[var(--line)] text-sm">
          <div className="grid grid-cols-[108px_minmax(0,1fr)] border-b border-[var(--line)] py-2">
            <dt className="text-[var(--muted)]">标签</dt>
            <dd className="flex flex-wrap gap-x-4 gap-y-1">{metadataTags.map((tag, index) => <span key={`${tag}-${index}`}>{tag}</span>)}</dd>
          </div>
          {tool.updateTime ? (
            <div className="grid grid-cols-[108px_minmax(0,1fr)] py-2">
              <dt className="text-[var(--muted)]">最近更新</dt>
              <dd className="flex items-center gap-2"><Calendar className="h-3.5 w-3.5 text-[var(--muted-subtle)]" />{tool.updateTime}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section aria-labelledby="rating-title">
        <h2 id="rating-title" className="mb-1 text-lg font-semibold leading-6">评分与评论</h2>
        {ratingState.status === 'loading' ? (
          <div role="status" className="border-y border-[var(--line)] py-3 text-sm text-[var(--muted)]">正在加载评分…</div>
        ) : ratingState.status === 'error' ? (
          <div role="alert" className="rounded-md border border-[var(--signal-ink)] bg-[var(--signal-soft)] px-3 py-2 text-sm text-[var(--signal-ink)]">评分暂时无法加载，当前无法确认评价状态。</div>
        ) : ratingState.status === 'ready' && ratingData !== null && ratingData.rating_count === 0 ? (
          <details className="group border-y border-[var(--line)]">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-2 [&::-webkit-details-marker]:hidden">
              <span className="min-w-0">
                <strong className="block text-sm">暂无评分</strong>
                <span className="block text-xs text-[var(--muted)]">还没有用户评价</span>
              </span>
              <span className="inline-flex min-h-11 shrink-0 items-center rounded-md border border-[var(--line-strong)] px-4 text-sm font-medium group-open:bg-[var(--surface-subtle)]">提交评价</span>
            </summary>
            <div className="border-t border-[var(--line)] py-2 [&>div]:min-h-0 [&>div]:rounded-none [&>div]:border-0 [&>div]:bg-transparent [&>div]:p-0">
              <RatingWidget toolId={tool.id} currentRating={currentRating} onRated={onRated} />
            </div>
          </details>
        ) : (
          <div className="border-y border-[var(--line)] py-1 [&>div]:min-h-0 [&>div]:rounded-none [&>div]:border-0 [&>div]:bg-transparent [&>div]:p-0">
            <RatingWidget toolId={tool.id} currentRating={currentRating} onRated={onRated} />
          </div>
        )}
      </section>

      {ratingState.status === 'ready' && ratingData !== null && ratingData.rating_count > 0 ? (
        <section aria-labelledby="reviews-title">
          <h2 id="reviews-title" className="mb-1 text-lg font-semibold leading-6">用户评价</h2>
          <div className="mb-3 flex items-center gap-3"><span className="text-3xl font-semibold">{ratingData.avg_rating.toFixed(1)}</span><span className="text-sm text-[var(--muted)]">{ratingData.rating_count} 条评价</span></div>
          <ul className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
            {ratingData.reviews.slice(0, 5).map((review, index) => (
              <li key={`${review.score}-${index}`} className="py-3">
                <span className="sr-only">{review.score} / 5 分</span>
                <div aria-hidden="true" className="flex gap-0.5">{[1, 2, 3, 4, 5].map((score) => <Star key={score} className={cn('h-3.5 w-3.5', score <= review.score ? 'fill-[var(--accent)] text-[var(--accent)]' : 'text-[var(--line-strong)]')} />)}</div>
                {review.tags.length ? <p className="mt-2 text-xs text-[var(--muted)]">{review.tags.join(' · ')}</p> : null}
                {review.comment ? <p className="mt-2 text-sm text-[var(--muted)]">{review.comment}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
