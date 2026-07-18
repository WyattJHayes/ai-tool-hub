'use client';

import { useState } from 'react';
import { Star, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUserStore } from '@/stores/useUserStore';

const RATING_TAGS = [
  '上手快', '功能强', '价格贵', '中文友好', 'API好用',
  '效果出色', '响应慢', '免费够用', '需翻墙', '推荐',
];

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
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async () => {
    if (score === 0) return;
    setSubmitting(true);
    setError('');
    try {
      const saved = await setRating(toolId, score, selectedTags, comment);
      if (!saved) {
        setError('评价提交失败，请稍后重试');
        return;
      }
      setSubmitted(true);
      onRated?.(score);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20">
          <Star className="h-5 w-5 fill-emerald-400 text-emerald-400" />
        </div>
        <p className="text-sm text-white/70">感谢评价！</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      {/* Star rating */}
      <div className="flex items-center justify-center gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onMouseEnter={() => setHoverScore(n)}
            onMouseLeave={() => setHoverScore(0)}
            onClick={() => setScore(n)}
            className="transition-transform hover:scale-110"
          >
            <Star
              className={cn(
                'h-8 w-8 transition-colors',
                n <= displayScore ? 'fill-amber-400 text-amber-400' : 'text-white/15'
              )}
            />
          </button>
        ))}
        {score > 0 && (
          <span className="ml-2 text-sm text-white/50">{score} 分</span>
        )}
      </div>

      {/* Tags */}
      {score > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-white/40">选择标签评价（可选）</p>
          <div className="flex flex-wrap gap-2">
            {RATING_TAGS.map((tag) => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={cn(
                  'rounded-full px-3 py-1 text-xs transition-colors',
                  selectedTags.includes(tag)
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : 'bg-white/5 text-white/40 border border-white/10 hover:bg-white/10'
                )}
              >
                {tag}
              </button>
            ))}
          </div>

          {/* Short comment */}
          <div>
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, 50))}
              placeholder="一句话评价（50字以内，可选）"
              maxLength={50}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-blue-500/50"
            />
            <p className="mt-1 text-right text-[10px] text-white/20">{comment.length}/50</p>
          </div>

          {/* Submit */}
          {error && <p className="text-center text-xs text-red-400">{error}</p>}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            {submitting ? '提交中...' : '提交评价'}
          </button>
        </div>
      )}
    </div>
  );
}
