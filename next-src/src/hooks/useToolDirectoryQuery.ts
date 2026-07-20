'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { parseDirectoryQuery, patchDirectoryQuery, serializeDirectoryQuery } from '@/lib/tools-query-state.mjs';
import type { DirectoryQueryCatalog, DirectoryQueryPatch, DirectoryQueryState } from '@/types/tool';

export function useToolDirectoryQuery(catalog: DirectoryQueryCatalog) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const state = useMemo(() => parseDirectoryQuery(searchParams, catalog) as DirectoryQueryState, [catalog, searchParams]);
  const currentPath = useMemo(() => {
    const query = searchParams.toString();
    return `${pathname}${query ? `?${query}` : ''}`;
  }, [pathname, searchParams]);
  const pathnameRef = useRef(pathname);
  const committedPathRef = useRef(currentPath);
  const latestStateRef = useRef(state);
  const pendingPathRef = useRef<string | null>(null);
  const pendingPatchesRef = useRef<Partial<DirectoryQueryState>[]>([]);
  useEffect(() => {
    pathnameRef.current = pathname;
    const pendingPath = pendingPathRef.current;
    if (!pendingPath || pendingPath === currentPath) {
      committedPathRef.current = currentPath;
      latestStateRef.current = state;
      pendingPathRef.current = null;
      pendingPatchesRef.current = [];
      return;
    }
    if (committedPathRef.current === currentPath) {
      const reconciledState = pendingPatchesRef.current.reduce<DirectoryQueryState>(
        (current, pendingPatch) => patchDirectoryQuery(current, pendingPatch) as DirectoryQueryState,
        state
      );
      latestStateRef.current = reconciledState;
      const query = serializeDirectoryQuery(reconciledState);
      const correctedPath = `${pathname}${query ? `?${query}` : ''}`;
      if (correctedPath !== pendingPath) {
        pendingPathRef.current = correctedPath;
        window.history.replaceState(null, '', correctedPath);
      }
      return;
    }
    window.history.replaceState(null, '', pendingPath);
  }, [currentPath, pathname, state]);
  const update = useCallback((patch: DirectoryQueryPatch) => {
    const resolvedPatch = typeof patch === 'function' ? patch(latestStateRef.current) : patch;
    const next = patchDirectoryQuery(latestStateRef.current, resolvedPatch) as DirectoryQueryState;
    const pendingPatches = [...pendingPatchesRef.current, resolvedPatch];
    latestStateRef.current = next;
    const query = serializeDirectoryQuery(next);
    const nextPath = `${pathnameRef.current}${query ? `?${query}` : ''}`;
    if (nextPath === committedPathRef.current) {
      pendingPathRef.current = null;
      pendingPatchesRef.current = [];
    } else {
      pendingPathRef.current = nextPath;
      pendingPatchesRef.current = pendingPatches;
    }
    window.history.replaceState(null, '', nextPath);
  }, []);
  return { state, update, currentPath };
}
