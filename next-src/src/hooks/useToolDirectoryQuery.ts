'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { parseDirectoryQuery, patchDirectoryQuery, serializeDirectoryQuery } from '@/lib/tools-query-state.mjs';
import type { DirectoryQueryCatalog, DirectoryQueryPatch, DirectoryQueryState } from '@/types/tool';

export function useToolDirectoryQuery(catalog: DirectoryQueryCatalog) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const state = useMemo(() => parseDirectoryQuery(searchParams, catalog) as DirectoryQueryState, [catalog, searchParams]);
  const currentPath = useMemo(() => {
    const query = searchParams.toString();
    return `${pathname}${query ? `?${query}` : ''}`;
  }, [pathname, searchParams]);
  const pathnameRef = useRef(pathname);
  const routerRef = useRef(router);
  const committedPathRef = useRef(currentPath);
  const latestStateRef = useRef(state);
  const pendingPathRef = useRef<string | null>(null);
  const pendingPatchesRef = useRef<Partial<DirectoryQueryState>[]>([]);
  useEffect(() => {
    pathnameRef.current = pathname;
    routerRef.current = router;
    committedPathRef.current = currentPath;
    if (!pendingPathRef.current || pendingPathRef.current === currentPath) {
      latestStateRef.current = state;
      pendingPathRef.current = null;
      pendingPatchesRef.current = [];
    } else {
      latestStateRef.current = pendingPatchesRef.current.reduce<DirectoryQueryState>(
        (current, pendingPatch) => patchDirectoryQuery(current, pendingPatch) as DirectoryQueryState,
        state
      );
    }
  }, [currentPath, pathname, router, state]);
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
    routerRef.current.replace(nextPath, { scroll: false });
  }, []);
  return { state, update, currentPath };
}
