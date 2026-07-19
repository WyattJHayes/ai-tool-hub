'use client';

import type { DirectoryQueryPatch, DirectoryQueryState, OriginValue, PlatformValue, PriceFilterValue } from '@/types/tool';

interface FilterFieldsProps {
  state: DirectoryQueryState;
  platformOptions: PlatformValue[];
  radioGroupName: string;
  onPatch: (patch: DirectoryQueryPatch) => void;
  onClear: () => void;
}

const prices: { value: PriceFilterValue | null; label: string }[] = [
  { value: null, label: '不限价格' },
  { value: 'free-tier', label: '有免费额度' },
  { value: 'fully-free', label: '完全免费' },
  { value: 'paid-only', label: '仅付费' },
];
const origins: { value: OriginValue; label: string }[] = [
  { value: 'domestic', label: '国产' },
  { value: 'overseas', label: '海外' },
];
const platformLabels: Record<PlatformValue, string> = {
  web: '网页版',
  local: '本地部署',
  cli: '命令行',
  desktop: '桌面端',
};

function toggleValue<T extends string>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export function FilterFields({ state, platformOptions, radioGroupName, onPatch, onClear }: FilterFieldsProps) {
  return (
    <div className="space-y-6">
      <fieldset><legend className="mb-2 text-sm font-semibold">价格</legend>{prices.map((option) => <label key={option.value || 'all'} className="flex min-h-11 items-center gap-2 text-sm"><input type="radio" name={radioGroupName} checked={state.price === option.value} onChange={() => onPatch({ price: option.value })} />{option.label}</label>)}</fieldset>
      <fieldset><legend className="mb-2 text-sm font-semibold">来源</legend>{origins.map((option) => <label key={option.value} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={state.origins.includes(option.value)} onChange={() => onPatch((currentState) => ({ origins: toggleValue(currentState.origins, option.value) }))} />{option.label}</label>)}</fieldset>
      {platformOptions.length ? <fieldset><legend className="mb-2 text-sm font-semibold">平台</legend>{platformOptions.map((value) => <label key={value} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={state.platforms.includes(value)} onChange={() => onPatch((currentState) => ({ platforms: toggleValue(currentState.platforms, value) }))} />{platformLabels[value]}</label>)}</fieldset> : null}
      <button type="button" onClick={onClear} className="min-h-11 w-full rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">清除筛选</button>
    </div>
  );
}
