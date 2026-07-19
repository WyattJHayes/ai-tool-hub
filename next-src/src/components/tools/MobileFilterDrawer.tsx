'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { FilterFields } from './FilterFields';
import type { Category, DirectoryQueryPatch, DirectoryQueryState, PlatformValue } from '@/types/tool';

interface MobileFilterDrawerProps {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  state: DirectoryQueryState;
  platformOptions: PlatformValue[];
  onPatch: (patch: DirectoryQueryPatch) => void;
  onClear: () => void;
}

export function MobileFilterDrawer(props: MobileFilterDrawerProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const desktopQuery = window.matchMedia('(min-width: 1024px)');
    const syncDialog = (isDesktop: boolean) => {
      if (isDesktop) {
        if (dialog.open) dialog.close();
        return;
      }
      if (props.open && !dialog.open) dialog.showModal();
      if (!props.open && dialog.open) dialog.close();
    };
    const handleBreakpointChange = (event: MediaQueryListEvent) => syncDialog(event.matches);
    syncDialog(desktopQuery.matches);
    desktopQuery.addEventListener('change', handleBreakpointChange);
    return () => desktopQuery.removeEventListener('change', handleBreakpointChange);
  }, [props.open]);
  return (
    <dialog ref={ref} onClose={props.onClose} aria-labelledby="mobile-filter-title" className="m-0 ml-auto h-full max-h-none w-[min(360px,92vw)] border-l border-[var(--line)] bg-[var(--surface)] p-0 backdrop:bg-black/40 lg:hidden">
      <div className="flex h-16 items-center justify-between border-b border-[var(--line)] px-4"><h2 id="mobile-filter-title" className="font-semibold">筛选工具</h2><button type="button" onClick={props.onClose} className="flex h-11 w-11 items-center justify-center" aria-label="关闭筛选"><X className="h-4 w-4" /></button></div>
      <div className="p-4">
        {!props.state.sceneId ? <label className="mb-6 block text-sm font-semibold">分类<select aria-label="选择分类" value={props.state.categoryId || ''} onChange={(event) => props.onPatch({ categoryId: event.target.value || null })} className="mt-2 min-h-11 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm font-normal text-[var(--ink)]"><option value="">全部分类</option>{props.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label> : null}
        <FilterFields state={props.state} platformOptions={props.platformOptions} radioGroupName="price-mobile" onPatch={props.onPatch} onClear={props.onClear} />
      </div>
    </dialog>
  );
}
