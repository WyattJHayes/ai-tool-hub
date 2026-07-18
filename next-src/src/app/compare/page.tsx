'use client';


import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  X,
  ExternalLink,
  Check,

  Plus,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCompareStore } from '@/stores/useCompareStore';
import { useToolStore } from '@/stores/useToolStore';
import { getCategoryNames, getRelatedTools } from '@/lib/tools-data';
import { ToolCard } from '@/components/tools/ToolCard';
import type { Tool } from '@/types/tool';
import { ToolIcon } from '@/lib/icon-map';

const COMPARE_ROWS = [
  { key: 'category', label: '分类' },
  { key: 'origin', label: '国产/海外' },
  { key: 'login', label: '登录要求' },
  { key: 'price', label: '定价' },
  { key: 'valueTag', label: '性价比' },
  { key: 'platform', label: '平台' },
  { key: 'difficulty', label: '使用难度' },
];

import { trackClick } from '@/lib/api';

export default function ComparePage() {
  const router = useRouter();
  const { selectedTools, removeTool, clearAll, addTool } = useCompareStore();
  const { tools, categories, loadData, dataLoaded } = useToolStore();
  const [showAddPanel, setShowAddPanel] = useState(false);

  useEffect(() => {
    if (selectedTools.length >= 2) {
      trackClick(0, '__compare__', undefined, selectedTools.map(t => t.name).join(',')).catch(() => {});
    }
  }, [selectedTools.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!dataLoaded) loadData();
  }, [dataLoaded, loadData]);

  if (selectedTools.length < 2) {
    return (
            <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-950 px-4 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white/5">
          <Plus className="h-10 w-10 text-white/20" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">请先选择工具</h1>
          <p className="mt-2 text-white/50">
            在首页勾选 2-4 个工具后点击「开始对比」
          </p>
        </div>
        <Link
          href="/"
          className="rounded-xl bg-white/10 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-white/15"
        >
          返回首页选择
        </Link>
      </div>
    );
  }

  const candidates = tools.filter(
    (t) =>
      !selectedTools.find((s) => s.id === t.id) &&
      (searchTerm
        ? t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.desc.toLowerCase().includes(searchTerm.toLowerCase())
        : true)
  );

  const relatedBuckets = new Map<string, Tool[]>();
  for (const sel of selectedTools) {
    const related = getRelatedTools(tools, sel, 3).filter(
      (r) => !selectedTools.find((s) => s.id === r.id)
    );
    if (related.length > 0) relatedBuckets.set(sel.name, related);
  }

  const getCellValue = (tool: Tool, key: string) => {
    switch (key) {
      case 'category':
        return getCategoryNames(categories, tool.categories || [tool.category]);
      case 'origin':
        return tool.toolTags?.includes('国产') ? '国产' : '海外';
      case 'login':
        return tool.toolTags?.includes('无需登录') ? '无需登录' : '需登录';
      case 'price': {
        if (!tool.pricing || tool.pricing.length === 0) return '未知';
        const free = tool.pricing.find((p) => p.price === 0);
        const paid = tool.pricing.find((p) => p.price > 0);
        if (free && paid) return `${free.plan} / ${paid.plan} ${paid.price}${paid.unit}`;
        if (free) return '完全免费';
        const first = tool.pricing[0];
        return `${first.plan} ${first.price}${first.unit}`;
      }
      case 'valueTag':
        return tool.valueTag || '未知';
      case 'platform':
        return (tool.platform || tool.toolTags?.filter((t) =>
          ['网页版', '客户端', 'IDE插件', 'CLI工具', '本地部署', 'API服务'].includes(t)
        ) || []).join('、') || '未知';
      case 'difficulty': {
        const map: Record<string, string> = {
          beginner: '入门',
          intermediate: '进阶',
          advanced: '高级',
        };
        return map[tool.difficulty || ''] || '未知';
      }
      default:
        return '-';
    }
  };

  const isBestForRow = (key: string, values: string[]): boolean[] => {
    if (key === 'price') {
      const hasFree = values.map((v) => v === '完全免费' || v.startsWith('Free'));
      if (hasFree.some(Boolean)) return hasFree;
    }
    return values.map(() => false);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="sticky top-0 z-50 border-b border-white/10 bg-gray-950/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-6 py-4">
          <button
            onClick={() => router.back()}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/50 transition-colors hover:bg-white/5 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="text-lg font-semibold">
            工具对比
            <span className="ml-2 text-sm font-normal text-white/40">
              ({selectedTools.length}/4)
            </span>
          </h1>
          <div className="flex-1" />
          {selectedTools.length < 4 && (
            <button
              onClick={() => setShowAddPanel(!showAddPanel)}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            >
              <Plus className="h-4 w-4" />
              添加工具
            </button>
          )}
          <button
            onClick={clearAll}
            className="rounded-lg px-3 py-2 text-sm text-white/40 transition-colors hover:bg-red-500/10 hover:text-red-400"
          >
            清除全部
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Tool headers */}
        <div className="mb-8 grid gap-4" style={{ gridTemplateColumns: `180px repeat(${selectedTools.length}, 1fr)` }}>
          <div />
          {selectedTools.map((tool) => (
            <div
              key={tool.id}
              className="relative flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-6"
            >
              <button
                onClick={() => removeTool(tool.id)}
                className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full text-white/30 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 text-2xl">
                <ToolIcon name={tool.icon} className="h-8 w-8 text-white/70" />
              </div>
              <h2 className="text-center font-semibold">{tool.name}</h2>
              <p className="text-center text-xs text-white/40 line-clamp-2">{tool.desc}</p>
              <a
                href={tool.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/60 transition-colors hover:bg-blue-500/10 hover:text-blue-400"
              >
                访问 <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          ))}
        </div>

        {/* Comparison table */}
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full">
            <tbody>
              {COMPARE_ROWS.map((row) => {
                const values = selectedTools.map((t) => getCellValue(t, row.key));
                const bests = isBestForRow(row.key, values);
                return (
                        <tr
                    key={row.key}
                    className="border-b border-white/5 last:border-0"
                  >
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-white/50 bg-white/[0.02] w-[180px]">
                      {row.label}
                    </td>
                    {values.map((val, i) => (
                      <td
                        key={i}
                        className={cn(
                          'px-6 py-4 text-sm text-center',
                          bests[i]
                            ? 'text-emerald-400 font-medium'
                            : 'text-white/70'
                        )}
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          {bests[i] && <Check className="h-3.5 w-3.5 text-emerald-400" />}
                          {val}
                        </div>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pricing comparison */}
        {selectedTools.some((t) => t.pricing && t.pricing.length > 0) && (
          <div className="mt-8">
            <h2 className="mb-4 text-xl font-semibold">定价对比</h2>
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${selectedTools.length}, 1fr)` }}>
              {selectedTools.map((tool) => (
                <div key={tool.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                  <h3 className="mb-3 text-center font-medium">{tool.name}</h3>
                  {(!tool.pricing || tool.pricing.length === 0) ? (
                    <p className="text-center text-sm text-white/30">暂无定价信息</p>
                  ) : (
                    <div className="space-y-2">
                      {tool.pricing.map((p, i) => (
                        <div
                          key={i}
                          className={cn(
                            'rounded-xl p-3',
                            p.highlight
                              ? 'border border-blue-500/30 bg-blue-500/10'
                              : 'bg-white/[0.03]'
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{p.plan}</span>
                            <span className={cn('text-sm font-bold', p.price === 0 ? 'text-emerald-400' : 'text-white')}>
                              {p.price === 0 ? '免费' : `${p.price} ${p.unit}`}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-white/40">{p.quota}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Similar recommendations */}
        {relatedBuckets.size > 0 && (
          <div className="mt-12">
            <h2 className="mb-6 text-xl font-semibold">同类替代工具</h2>
            {Array.from(relatedBuckets.entries()).map(([name, related]) => (
              <div key={name} className="mb-8">
                <p className="mb-3 text-sm text-white/40">
                  与 <span className="text-white/60">{name}</span> 同类
                </p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {related.map((t) => (
                    <ToolCard key={t.id} tool={t} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add tool panel */}
      {showAddPanel && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 backdrop-blur-sm pt-20">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-gray-900 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold">添加工具到对比</h3>
              <button
                onClick={() => setShowAddPanel(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="搜索工具..."
                className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-white outline-none placeholder:text-white/30 focus:border-blue-500/50"
              />
            </div>
            <div className="max-h-80 space-y-1 overflow-y-auto">
              {candidates.slice(0, 20).map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => {
                    addTool(tool);
                    if (selectedTools.length >= 3) setShowAddPanel(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-white/5"
                >
                  <ToolIcon name={tool.icon} className="h-5 w-5 text-white/60" />
                  <div>
                    <p className="text-sm font-medium text-white/90">{tool.name}</p>
                    <p className="text-xs text-white/40">{tool.desc}</p>
                  </div>
                </button>
              ))}
              {candidates.length === 0 && (
                <p className="py-8 text-center text-sm text-white/30">没有更多可添加的工具</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
