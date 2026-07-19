'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { parseDirectoryQuery, patchDirectoryQuery, serializeDirectoryQuery } from '@/lib/tools-query-state.mjs';
import type { DirectoryQueryCatalog, DirectoryQueryState } from '@/types/tool';

export function useToolDirectoryQuery(catalog: DirectoryQueryCatalog) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const state = useMemo(() => parseDirectoryQuery(searchParams, catalog) as DirectoryQueryState, [catalog, searchParams]);
  const currentPath = useMemo(() => {
    const query = searchParams.toString();
    return `${pathname}${query ? `?${query}` : ''}`;
  }, [pathname, searchParams]);
  const committedPathRef = useRef(currentPath);
  const latestStateRef = useRef(state);
  const reconcileCommittedState = useCallback(() => {
    if (committedPathRef.current === currentPath) return;
    committedPathRef.current = currentPath;
    latestStateRef.current = state;
  }, [currentPath, state]);
  useEffect(reconcileCommittedState, [reconcileCommittedState]);
  const update = useCallback((patch: Partial<DirectoryQueryState>) => {
    reconcileCommittedState();
    const next = patchDirectoryQuery(latestStateRef.current, patch) as DirectoryQueryState;
    latestStateRef.current = next;
    const query = serializeDirectoryQuery(next);
    router.replace(`${pathname}${query ? `?${query}` : ''}`, { scroll: false });
  }, [pathname, reconcileCommittedState, router]);
  return { state, update, currentPath };
}
