'use client';

import Link from 'next/link';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { trackClick } from '@/lib/api';
import { createToolDecisionModel, selectAlternativeTools } from '@/lib/tool-decision.mjs';
import { sanitizeToolsReturnPath } from '@/lib/tools-query-state.mjs';
import { getToolSlug } from '@/lib/tools-data';
import { useSceneData } from '@/hooks/useSceneData';
import { useCompareStore } from '@/stores/useCompareStore';
import { useToolStore } from '@/stores/useToolStore';
import { useUserStore } from '@/stores/useUserStore';
import { ToolDecisionList } from './ToolDecisionList';
import { ToolDecisionSummary } from './ToolDecisionSummary';
import { ToolEvidenceSections, type RatingData, type RatingState } from './ToolEvidenceSections';

interface ToolDetailClientProps {
  slug: string;
  from?: string;
}

const EMPTY_RATINGS: RatingData = { avg_rating: 0, rating_count: 0, reviews: [] };
const platformLabels = { web: '网页版', local: '本地', cli: '命令行', desktop: '桌面端' } as const;

export function isRatingData(value: unknown): value is RatingData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, unknown>;
  if (
    typeof data.avg_rating !== 'number' ||
    !Number.isFinite(data.avg_rating) ||
    data.avg_rating < 0 ||
    data.avg_rating > 5
  ) return false;
  if (typeof data.rating_count !== 'number' || !Number.isInteger(data.rating_count) || data.rating_count < 0) return false;
  if (!Array.isArray(data.reviews)) return false;
  const reviewsAreValid = data.reviews.every((value) => {
    if (!value || typeof value !== 'object') return false;
    const review = value as Record<string, unknown>;
    return typeof review.score === 'number' &&
      Number.isInteger(review.score) &&
      review.score >= 1 &&
      review.score <= 5 &&
      Array.isArray(review.tags) &&
      review.tags.every((tag) => typeof tag === 'string') &&
      typeof review.comment === 'string';
  });
  if (!reviewsAreValid) return false;
  if (data.rating_count === 0) return data.avg_rating === 0 && data.reviews.length === 0;
  return data.avg_rating >= 1;
}

async function getRatings(toolId: number): Promise<RatingData> {
  const response = await fetch(`/api/ratings?tool_id=${toolId}`);
  if (!response.ok) throw new Error('Failed to load ratings');
  const data: unknown = await response.json();
  if (!isRatingData(data)) throw new Error('Invalid ratings payload');
  return data;
}

export function ToolDetailClient({ slug, from }: ToolDetailClientProps) {
  const { tools, categories, isLoading, dataLoaded, loadData, error, retryLoadData } = useToolStore();
  const { scenes, isLoading: scenesLoading, error: scenesError, retry: retryScenes } = useSceneData();
  const { isFavorite, toggleFavorite, getRating } = useUserStore();
  const { selectedTools, addTool, removeTool } = useCompareStore();
  const [storedRatingState, setRatingState] = useState<{ toolId: number; state: RatingState } | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const returnPath = sanitizeToolsReturnPath(from);
  const tool = useMemo(
    () => tools.find((candidate) => getToolSlug(candidate) === slug) || null,
    [slug, tools]
  );
  const activeToolIdRef = useRef<number | null>(tool?.id ?? null);
  const ratingRequestGeneration = useRef(0);
  const model = useMemo(
    () => tool ? createToolDecisionModel(tool, scenes, categories) : null,
    [categories, scenes, tool]
  );
  const ratingState: RatingState = storedRatingState && storedRatingState.toolId === tool?.id
    ? storedRatingState.state
    : { status: 'loading' };
  const alternatives = useMemo(
    () => tool
      ? selectAlternativeTools(tool, tools, scenes, 6)
        .map((candidate) => createToolDecisionModel(candidate, scenes, categories))
      : [],
    [categories, scenes, tool, tools]
  );

  useEffect(() => {
    if (!dataLoaded) loadData();
  }, [dataLoaded, loadData]);

  useEffect(() => {
    activeToolIdRef.current = tool?.id ?? null;
  }, [tool?.id]);

  useEffect(() => {
    if (!tool) return;
    let active = true;
    const generation = ratingRequestGeneration.current + 1;
    ratingRequestGeneration.current = generation;
    trackClick(tool.id, getToolSlug(tool), 'detail');
    getRatings(tool.id)
      .then((data) => {
        if (active && ratingRequestGeneration.current === generation) {
          setRatingState({ toolId: tool.id, state: { status: 'ready', data } });
        }
      })
      .catch(() => {
        if (active && ratingRequestGeneration.current === generation) {
          setRatingState({ toolId: tool.id, state: { status: 'error' } });
        }
      });
    return () => {
      active = false;
    };
  }, [tool]);

  if (isLoading || scenesLoading) {
    return <main className="flex min-h-[70vh] items-center justify-center text-sm text-[var(--muted)]">正在加载工具信息…</main>;
  }
  if (!tool && error) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-xl items-center px-4">
        <div role="alert" className="w-full border-l-4 border-[var(--signal)] bg-[var(--signal-soft)] p-5 text-[var(--signal-ink)]">
          <h1 className="text-lg font-semibold">工具数据暂时无法加载</h1>
          <button type="button" onClick={retryLoadData} className="mt-4 min-h-11 rounded-md border border-[var(--signal-ink)] px-4 text-sm text-[var(--signal-ink)]">重新加载</button>
        </div>
      </main>
    );
  }
  if (!tool || !model) {
    return <main className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-4 text-center"><h1 className="text-2xl font-semibold">工具未找到</h1><Link href={returnPath} className="inline-flex min-h-11 items-center rounded-md bg-[var(--accent)] px-5 text-sm text-[var(--on-accent)]">返回工具目录</Link></main>;
  }

  const favorite = isFavorite(tool.id);
  const compared = selectedTools.some((selected) => selected.id === tool.id);
  const compareDisabled = !compared && selectedTools.length >= 4;
  const handleCompare = () => {
    if (compared) {
      removeTool(tool.id);
      setAnnouncement('已移出比较');
      return;
    }
    const outcome = addTool(tool);
    setAnnouncement(outcome === 'limit-reached' ? '最多比较 4 款工具，请先移除一款' : '已加入比较');
  };
  const handleFavorite = () => toggleFavorite(tool.id);
  const handleVisit = () => trackClick(tool.id, getToolSlug(tool), 'detail', 'primary-action');
  const handleRated = (score: number) => {
    const toolId = tool.id;
    const generation = ratingRequestGeneration.current + 1;
    ratingRequestGeneration.current = generation;
    setRatingState((current) => {
      const currentData = current?.toolId === toolId && current.state.status === 'ready'
        ? current.state.data
        : EMPTY_RATINGS;
      const currentCount = currentData.rating_count;
      return {
        toolId,
        state: {
          status: 'ready',
          data: {
            ...currentData,
            avg_rating: ((currentData.avg_rating * currentCount) + score) / (currentCount + 1),
            rating_count: currentCount + 1,
          },
        },
      };
    });
    getRatings(toolId)
      .then((refreshed) => {
        if (
          activeToolIdRef.current !== toolId ||
          ratingRequestGeneration.current !== generation
        ) return;
        if (refreshed.rating_count > 0) {
          setRatingState({ toolId, state: { status: 'ready', data: refreshed } });
        }
      })
      .catch(() => {
        // The successful optimistic rating remains visible when refresh is unavailable.
      });
  };

  return (
    <main className="mx-auto max-w-[1230px] px-4 pb-32 text-[var(--ink)] sm:px-6">
      <Link href={returnPath} className="inline-flex min-h-11 items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--ink)]"><ArrowLeft className="h-4 w-4" />返回工具目录</Link>
      {scenesError ? <div role="alert" className="mt-2 border-l-4 border-[var(--signal)] bg-[var(--signal-soft)] p-4 text-sm text-[var(--signal-ink)]"><p>{scenesError}，当前仅显示分类回退。</p><button type="button" onClick={retryScenes} className="mt-2 min-h-11 rounded-md border border-[var(--signal-ink)] px-3 text-[var(--signal-ink)]">重新加载任务</button></div> : null}
      <ToolDecisionSummary model={model} favorite={favorite} compared={compared} compareDisabled={compareDisabled} compareAnnouncement={announcement} onToggleFavorite={handleFavorite} onToggleCompare={handleCompare} onVisit={handleVisit} />
      <div className="mt-1 grid gap-8 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0">
          <ToolEvidenceSections model={model} currentRating={getRating(model.tool.id)} ratingState={ratingState} onRated={handleRated} />
          {alternatives.length ? <section className="mt-3" aria-labelledby="alternatives-title"><h2 id="alternatives-title" className="mb-1 text-lg font-semibold leading-6">替代方案</h2><ToolDecisionList groups={[{ id: 'alternatives', items: alternatives }]} variant="compact" returnPath={returnPath} /></section> : null}
        </div>
        <aside data-carbon-surface className="carbon-tool-surface h-fit border border-[var(--line-strong)] bg-[var(--surface)] p-4 text-[var(--ink)] lg:sticky lg:top-[88px]">
          <h2 className="border-b border-[var(--line)] pb-3 text-base font-semibold">决策摘要</h2>
          <dl className="text-sm">
            <div className="border-b border-[var(--line)] py-3"><dt className="text-xs text-[var(--muted)]">适用任务</dt><dd className="mt-1 font-semibold">{model.tasks.map((task) => task.label).join('、')}</dd></div>
            <div className="border-b border-[var(--line)] py-3"><dt className="text-xs text-[var(--muted)]">核心能力</dt><dd className="mt-1 font-semibold">{model.capabilitySummary.join(' · ')}</dd></div>
            <div className="border-b border-[var(--line)] py-3"><dt className="text-xs text-[var(--muted)]">价格</dt><dd className="mt-1 font-semibold">{model.price.summary || model.price.valueTag || '查看官网'}</dd></div>
            <div className="py-3"><dt className="text-xs text-[var(--muted)]">平台</dt><dd className="mt-1 font-semibold">{model.platforms.map((platform) => platformLabels[platform]).join('、') || '查看官网'}</dd></div>
          </dl>
          <a href={model.tool.url} target="_blank" rel="noopener noreferrer" onClick={handleVisit} className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-[var(--on-accent)] hover:bg-[var(--accent-hover)]">访问官网 <ExternalLink className="h-4 w-4" /></a>
          <button type="button" aria-pressed={compared} aria-disabled={compareDisabled && !compared} onClick={handleCompare} className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-md border border-[var(--line-strong)] px-4 text-sm font-medium hover:bg-[var(--surface-subtle)]">{compared ? '移出比较' : '加入比较'}</button>
        </aside>
      </div>
    </main>
  );
}
