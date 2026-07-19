'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Check, ExternalLink, Plus, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCompareStore } from '@/stores/useCompareStore';
import { useToolStore } from '@/stores/useToolStore';
import { getCategoryNames, getRelatedTools } from '@/lib/tools-data';
import { ToolCard } from '@/components/tools/ToolCard';
import type { Tool } from '@/types/tool';
import { ToolIcon } from '@/lib/icon-map';
import { trackClick } from '@/lib/api';

const COMPARE_ROWS = [
  { key: 'category', label: '分类' },
  { key: 'origin', label: '来源' },
  { key: 'login', label: '登录要求' },
  { key: 'price', label: '定价' },
  { key: 'valueTag', label: '性价比' },
  { key: 'platform', label: '平台' },
  { key: 'difficulty', label: '使用难度' },
];

export default function ComparePage() {
  const router = useRouter();
  const { selectedTools, removeTool, clearAll, addTool } = useCompareStore();
  const { tools, categories, loadData, dataLoaded } = useToolStore();
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (selectedTools.length >= 2) trackClick(0, '__compare__', undefined, selectedTools.map((tool) => tool.name).join(',')).catch(() => {});
  }, [selectedTools]);

  useEffect(() => {
    if (!dataLoaded) loadData();
  }, [dataLoaded, loadData]);

  if (selectedTools.length < 2) {
    return (
      <main className="flex min-h-[70vh] flex-col items-center justify-center gap-5 px-4 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--accent)]"><Plus className="h-6 w-6" /></span>
        <div><h1 className="text-2xl font-semibold">请先选择工具</h1><p className="mt-2 text-[var(--muted)]">在工具卡片中勾选 2 至 4 个工具后开始对比</p></div>
        <Link href="/tools" className="flex min-h-11 items-center rounded-md bg-[var(--accent)] px-5 text-sm font-medium text-white hover:bg-[var(--accent-hover)]">前往工具目录</Link>
      </main>
    );
  }

  const candidates = tools.filter((tool) => !selectedTools.some((selected) => selected.id === tool.id) && (!searchTerm || tool.name.toLowerCase().includes(searchTerm.toLowerCase()) || tool.desc.toLowerCase().includes(searchTerm.toLowerCase())));
  const relatedBuckets = new Map<string, Tool[]>();
  for (const selected of selectedTools) {
    const related = getRelatedTools(tools, selected, 3).filter((tool) => !selectedTools.some((current) => current.id === tool.id));
    if (related.length) relatedBuckets.set(selected.name, related);
  }

  const getCellValue = (tool: Tool, key: string) => {
    if (key === 'category') return getCategoryNames(categories, tool.categories || [tool.category]);
    if (key === 'origin') return tool.toolTags?.includes('国产') ? '国产' : '海外';
    if (key === 'login') return tool.toolTags?.includes('无需登录') ? '无需登录' : '需登录';
    if (key === 'price') {
      if (!tool.pricing?.length) return '未知';
      const free = tool.pricing.find((plan) => plan.price === 0);
      const paid = tool.pricing.find((plan) => plan.price > 0);
      if (free && paid) return `${free.plan} / ${paid.plan} ${paid.price}${paid.unit}`;
      if (free) return '完全免费';
      return `${tool.pricing[0].plan} ${tool.pricing[0].price}${tool.pricing[0].unit}`;
    }
    if (key === 'valueTag') return tool.valueTag || '未知';
    if (key === 'platform') return (tool.platform || []).join('、') || '未知';
    if (key === 'difficulty') return ({ beginner: '入门', intermediate: '进阶', advanced: '高级' } as Record<string, string>)[tool.difficulty || ''] || '未知';
    return '-';
  };

  return (
    <main className="min-h-screen bg-[var(--page)] text-[var(--ink)]">
      <header className="border-b border-[var(--line)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-4 sm:px-6">
          <button type="button" onClick={() => router.back()} className="flex h-11 w-11 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--surface-subtle)]" aria-label="返回上一页"><ArrowLeft className="h-4 w-4" /></button>
          <h1 className="min-w-0 flex-1 text-xl font-semibold">工具对比 <span className="text-sm font-normal text-[var(--muted)]">({selectedTools.length}/4)</span></h1>
          {selectedTools.length < 4 ? <button type="button" onClick={() => setShowAddPanel(true)} className="flex min-h-11 items-center gap-1.5 rounded-md border border-[var(--line)] px-3 text-sm font-medium hover:bg-[var(--surface-subtle)]"><Plus className="h-4 w-4" />添加工具</button> : null}
          <button type="button" onClick={clearAll} className="min-h-11 rounded-md px-3 text-sm text-[var(--danger)] hover:bg-red-50 dark:hover:bg-red-950/40">清除全部</button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <section className="overflow-x-auto">
          <div className="grid gap-3" style={{ gridTemplateColumns: `180px repeat(${selectedTools.length}, minmax(220px, 1fr))`, minWidth: 180 + selectedTools.length * 232 }}>
            <div />
            {selectedTools.map((tool) => (
              <div key={tool.id} className="relative flex min-h-[190px] flex-col items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5 text-center">
                <button type="button" onClick={() => removeTool(tool.id)} className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--surface-subtle)]" aria-label={`移除 ${tool.name}`}><X className="h-4 w-4" /></button>
                <span className="flex h-12 w-12 items-center justify-center rounded-md bg-[var(--surface-subtle)] text-[var(--accent)]"><ToolIcon name={tool.icon} className="h-6 w-6" /></span>
                <h2 className="font-semibold">{tool.name}</h2>
                <p className="line-clamp-2 text-xs text-[var(--muted)]">{tool.desc}</p>
                <a href={tool.url} target="_blank" rel="noopener noreferrer" className="mt-auto flex min-h-11 items-center gap-1 text-xs font-medium text-[var(--accent)]">访问 <ExternalLink className="h-3.5 w-3.5" /></a>
              </div>
            ))}

            {COMPARE_ROWS.map((row) => {
              const values = selectedTools.map((tool) => getCellValue(tool, row.key));
              const freeValues = row.key === 'price' ? values.map((value) => value === '完全免费' || value.startsWith('Free')) : values.map(() => false);
              return (
                <div key={row.key} className="contents">
                  <div className="flex items-center border-b border-[var(--line)] bg-[var(--surface-subtle)] px-4 py-3 text-sm font-medium">{row.label}</div>
                  {values.map((value, index) => <div key={`${row.key}-${index}`} className={cn('flex items-center justify-center gap-1.5 border-b border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-center text-sm', freeValues[index] ? 'font-medium text-[var(--accent)]' : 'text-[var(--muted)]')}>{freeValues[index] ? <Check className="h-4 w-4" /> : null}{value}</div>)}
                </div>
              );
            })}
          </div>
        </section>

        {selectedTools.some((tool) => tool.pricing?.length) ? (
          <section className="mt-10"><h2 className="mb-4 text-xl font-semibold">定价对比</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{selectedTools.map((tool) => <div key={tool.id} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5"><h3 className="mb-3 font-semibold">{tool.name}</h3>{tool.pricing?.length ? <div className="space-y-2">{tool.pricing.map((plan) => <div key={`${plan.plan}-${plan.price}`} className={cn('rounded-md border p-3', plan.highlight ? 'border-[var(--accent)]' : 'border-[var(--line)]')}><div className="flex justify-between gap-3"><span className="text-sm font-medium">{plan.plan}</span><span className="text-sm font-semibold">{plan.price === 0 ? '免费' : `${plan.price} ${plan.unit}`}</span></div><p className="mt-1 text-xs text-[var(--muted)]">{plan.quota}</p></div>)}</div> : <p className="text-sm text-[var(--muted)]">暂无定价信息</p>}</div>)}</div></section>
        ) : null}

        {relatedBuckets.size ? <section className="mt-12"><h2 className="mb-5 text-xl font-semibold">同类替代工具</h2>{Array.from(relatedBuckets.entries()).map(([name, related]) => <div key={name} className="mb-8"><p className="mb-3 text-sm text-[var(--muted)]">与 <span className="font-medium text-[var(--ink)]">{name}</span> 同类</p><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{related.map((tool) => <ToolCard key={tool.id} tool={tool} />)}</div></div>)}</section> : null}
      </div>

      {showAddPanel ? (
        <div className="fixed inset-0 z-[200] flex items-start justify-center bg-black/50 px-4 pt-20">
          <div className="w-full max-w-lg rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[0_16px_48px_rgba(0,0,0,0.2)]" role="dialog" aria-modal="true" aria-labelledby="add-tool-title">
            <div className="mb-4 flex items-center justify-between"><h2 id="add-tool-title" className="font-semibold">添加工具到对比</h2><button type="button" onClick={() => setShowAddPanel(false)} className="flex h-11 w-11 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--surface-subtle)]" aria-label="关闭添加工具窗口"><X className="h-4 w-4" /></button></div>
            <div className="relative mb-4"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-subtle)]" /><input type="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="搜索工具" aria-label="搜索可添加的工具" className="h-12 w-full rounded-md border border-[var(--line-strong)] bg-[var(--surface)] pl-10 pr-3 text-sm outline-none focus:border-[var(--accent)]" /></div>
            <div className="max-h-80 space-y-1 overflow-y-auto">{candidates.slice(0, 20).map((tool) => <button type="button" key={tool.id} onClick={() => { addTool(tool); if (selectedTools.length >= 3) setShowAddPanel(false); }} className="flex min-h-[60px] w-full items-center gap-3 rounded-md px-3 text-left hover:bg-[var(--surface-subtle)]"><ToolIcon name={tool.icon} className="h-5 w-5 text-[var(--accent)]" /><span className="min-w-0"><span className="block text-sm font-semibold">{tool.name}</span><span className="block truncate text-xs text-[var(--muted)]">{tool.desc}</span></span></button>)}{candidates.length === 0 ? <p className="py-8 text-center text-sm text-[var(--muted)]">没有更多可添加的工具</p> : null}</div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
