'use client';

import { useState } from 'react';
import { Send, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUserStore } from '@/stores/useUserStore';

const RATING_TAGS = ['上手快', '功能强', '价格贵', '中文友好', 'API 好用', '效果出色', '响应慢', '免费够用', '需翻墙', '推荐'];

interface RatingWidgetProps {
  toolId: number;
  currentRating?: number;
  onRated?: (score: number) => void;
}

export function RatingWidget({ toolId, currentRating = 0, onRated }: RatingWidgetProps) {
  const [score, setScore] = useState(currentRating);
  const [hoverScore, setHoverScore] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const setRating = useUserStore((state) => state.setRating);
  const displayScore = hoverScore || score;

  const toggleTag = (tag: string) => {
    setSelectedTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]);
  };

  const handleSubmit = async () => {
    if (score === 0) return;
    setSubmitting(true);
    setError('');
    try {
      const saved = await setRating(toolId, score, selectedTags, comment);
      if (!saved) { setError('评价提交失败，请稍后重试'); return; }
      setSubmitted(true);
      onRated?.(score);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return <div className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-lg border border-[var(--accent-soft)] bg-[var(--accent-soft)] p-5 text-center"><Star className="h-5 w-5 fill-current text-[var(--accent)]" /><p className="text-sm text-[var(--accent)]">感谢评价</p></div>;
  }

  return (
    <div className="space-y-4 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5">
      <div className="flex flex-wrap items-center justify-center gap-1">
        {[1, 2, 3, 4, 5].map((value) => (
          <button type="button" key={value} onMouseEnter={() => setHoverScore(value)} onMouseLeave={() => setHoverScore(0)} onClick={() => setScore(value)} className="flex h-11 w-11 items-center justify-center rounded-md hover:bg-[var(--surface-subtle)]" aria-label={`${value} 星`}>
            <Star className={cn('h-7 w-7', value <= displayScore ? 'fill-amber-400 text-amber-400' : 'text-[var(--line-strong)]')} />
          </button>
        ))}
        {score > 0 ? <span className="ml-2 text-sm text-[var(--muted)]">{score} 分</span> : null}
      </div>

      {score > 0 ? (
        <div className="space-y-3">
          <p className="text-xs text-[var(--muted)]">选择评价标签（可选）</p>
          <div className="flex flex-wrap gap-2">
            {RATING_TAGS.map((tag) => {
              const selected = selectedTags.includes(tag);
              return <button type="button" key={tag} onClick={() => toggleTag(tag)} aria-pressed={selected} className={cn('min-h-11 rounded-md border px-3 text-xs', selected ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]' : 'border-[var(--line)] text-[var(--muted)] hover:bg-[var(--surface-subtle)]')}>{tag}</button>;
            })}
          </div>
          <div>
            <label htmlFor={`rating-comment-${toolId}`} className="sr-only">一句话评价</label>
            <input id={`rating-comment-${toolId}`} type="text" value={comment} onChange={(event) => setComment(event.target.value.slice(0, 50))} placeholder="一句话评价（50 字以内，可选）" maxLength={50} className="h-12 w-full rounded-md border border-[var(--line-strong)] bg-[var(--surface)] px-3 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--muted-subtle)] focus:border-[var(--accent)]" />
            <p className="mt-1 text-right text-[10px] text-[var(--muted-subtle)]">{comment.length}/50</p>
          </div>
          {error ? <p className="text-center text-xs text-[var(--danger)]">{error}</p> : null}
          <button type="button" onClick={handleSubmit} disabled={submitting} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-[var(--accent)] text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"><Send className="h-4 w-4" />{submitting ? '提交中…' : '提交评价'}</button>
        </div>
      ) : null}
    </div>
  );
}
