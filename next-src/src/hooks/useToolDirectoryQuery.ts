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
  useEffect(() => {
    pathnameRef.current = pathname;
    routerRef.current = router;
    if (committedPathRef.current !== currentPath) {
      committedPathRef.current = currentPath;
      latestStateRef.current = state;
    }
  }, [currentPath, pathname, router, state]);
  const update = useCallback((patch: DirectoryQueryPatch) => {
    const resolvedPatch = typeof patch === 'function' ? patch(latestStateRef.current) : patch;
    const next = patchDirectoryQuery(latestStateRef.current, resolvedPatch) as DirectoryQueryState;
    latestStateRef.current = next;
    const query = serializeDirectoryQuery(next);
    routerRef.current.replace(`${pathnameRef.current}${query ? `?${query}` : ''}`, { scroll: false });
  }, []);
  return { state, update, currentPath };
}
