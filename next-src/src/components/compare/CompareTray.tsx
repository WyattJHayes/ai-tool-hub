'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useRef } from 'react';
import { X } from 'lucide-react';
import { useFixedSurfaceGeometry } from '@/hooks/useFixedSurfaceGeometry';
import { useCompareStore } from '@/stores/useCompareStore';

export default function CompareTray() {
  const pathname = usePathname();
  const router = useRouter();
  const { selectedTools, removeTool, clearAll } = useCompareStore();
  const trayRef = useRef<HTMLElement>(null);
  const onComparePage = pathname === '/compare';
  const visible = !onComparePage && selectedTools.length >= 2;
  useFixedSurfaceGeometry(trayRef, '--compare-tray-block-size', visible);

  if (!visible) return null;

  return (
    <>
      <div
        aria-hidden="true"
        className="h-[calc(var(--compare-tray-block-size)+var(--mobile-nav-block-size))] md:h-[var(--compare-tray-block-size)]"
      />
      <aside
        ref={trayRef}
        data-compare-tray
        aria-label="已选工具对比"
        className="fixed inset-x-0 bottom-[var(--mobile-nav-block-size)] z-[90] overflow-hidden border-t border-[var(--line)] bg-[var(--surface)] px-4 py-2 md:bottom-0 md:px-6"
      >
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <span className="text-sm font-medium text-[var(--ink)]">已选 {selectedTools.length}/4 款</span>
            <div className="mt-1 hidden gap-2 overflow-x-auto sm:flex">
              {selectedTools.map((tool) => (
                <span
                  key={tool.id}
                  className="inline-flex shrink-0 items-center gap-1 rounded border border-[var(--line)] px-2 py-1 text-xs"
                >
                  {tool.name}
                  <button
                    type="button"
                    onClick={() => removeTool(tool.id)}
                    aria-label={`移除 ${tool.name}`}
                    className="flex h-6 w-6 items-center justify-center"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={clearAll}
            className="hidden min-h-11 px-3 text-sm text-[var(--muted)] sm:block"
          >
            清除
          </button>
          <button
            type="button"
            onClick={() => router.push('/compare')}
            className="min-h-11 rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-white"
          >
            比较 {selectedTools.length} 款
          </button>
        </div>
      </aside>
    </>
  );
}
