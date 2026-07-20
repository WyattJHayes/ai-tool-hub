'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useFixedSurfaceGeometry } from '@/hooks/useFixedSurfaceGeometry';
import { useCompareStore } from '@/stores/useCompareStore';

export function getNextRemovalToolId(
  selectedTools: readonly { id: number }[],
  removedToolId: number,
): number | null {
  const removedIndex = selectedTools.findIndex((tool) => tool.id === removedToolId);
  if (removedIndex < 0 || selectedTools.length <= 2) return null;
  return selectedTools[removedIndex + 1]?.id ?? selectedTools[removedIndex - 1]?.id ?? null;
}

export default function CompareTray() {
  const pathname = usePathname();
  const router = useRouter();
  const { selectedTools, removeTool, clearAll } = useCompareStore();
  const trayRef = useRef<HTMLElement>(null);
  const compareButtonRef = useRef<HTMLButtonElement>(null);
  const removeButtonRefs = useRef(new Map<number, HTMLButtonElement>());
  const [announcement, setAnnouncement] = useState('');
  const onComparePage = pathname === '/compare';
  const visible = !onComparePage && selectedTools.length >= 2;
  useFixedSurfaceGeometry(trayRef, '--compare-tray-block-size', visible);

  const handleRemove = (toolId: number, toolName: string) => {
    const nextRemovalToolId = getNextRemovalToolId(selectedTools, toolId);
    removeTool(toolId);
    setAnnouncement(`已移除 ${toolName}`);
    requestAnimationFrame(() => {
      if (nextRemovalToolId !== null) {
        (removeButtonRefs.current.get(nextRemovalToolId) || compareButtonRef.current)?.focus({ preventScroll: true });
        return;
      }
      const main = document.querySelector<HTMLElement>('main');
      if (main) {
        main.tabIndex = -1;
        main.focus({ preventScroll: true });
      }
    });
  };

  if (!visible) return <p className="sr-only" aria-live="polite">{announcement}</p>;

  return (
    <>
      <p className="sr-only" aria-live="polite">{announcement}</p>
      <div
        aria-hidden="true"
        className="h-[calc(var(--compare-tray-block-size)+var(--mobile-nav-block-size))] md:h-[var(--compare-tray-block-size)]"
      />
      <aside
        ref={trayRef}
        data-compare-tray
        aria-label="已选工具对比"
        className="fixed inset-x-2 bottom-[var(--mobile-nav-block-size)] z-[90] overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 md:inset-x-0 md:bottom-0 md:rounded-none md:border-x-0 md:border-b-0 md:px-6"
      >
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-2 sm:gap-3">
          <div className="min-w-0 flex-1">
            <span className="text-sm font-medium text-[var(--ink)]">已选 {selectedTools.length}/4 款</span>
            <div
              data-compare-selected-tools
              className="mt-0.5 flex min-w-0 gap-1 overflow-hidden sm:mt-1 sm:gap-2 sm:overflow-x-auto"
            >
              {selectedTools.map((tool) => (
                <span
                  key={tool.id}
                  className="inline-flex min-w-0 flex-1 items-center gap-0.5 text-xs text-[var(--muted)] sm:flex-none sm:shrink-0 sm:gap-1 sm:rounded sm:border sm:border-[var(--line)] sm:px-2 sm:py-1 sm:text-[var(--ink)]"
                >
                  <span className="truncate">{tool.name}</span>
                  <button
                    ref={(node) => {
                      if (node) removeButtonRefs.current.set(tool.id, node);
                      else removeButtonRefs.current.delete(tool.id);
                    }}
                    type="button"
                    onClick={() => handleRemove(tool.id, tool.name)}
                    aria-label={`移除 ${tool.name}`}
                    className="flex h-11 w-11 shrink-0 items-center justify-center"
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
            ref={compareButtonRef}
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
