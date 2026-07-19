'use client';

import { useCallback, useMemo } from 'react';
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
  const update = useCallback((patch: Partial<DirectoryQueryState>) => {
    const next = patchDirectoryQuery(state, patch) as DirectoryQueryState;
    const query = serializeDirectoryQuery(next);
    router.replace(`${pathname}${query ? `?${query}` : ''}`, { scroll: false });
  }, [pathname, router, state]);
  return { state, update, currentPath };
}
