import type {
  Category,
  DirectoryQueryCatalog,
  DirectoryQueryState,
  Scene,
  Tool,
  ToolDecisionGroup,
} from '../types/tool';

interface QueryReader {
  get(name: string): string | null;
}

export function parseDirectoryQuery(
  params: QueryReader,
  catalog: DirectoryQueryCatalog
): DirectoryQueryState;
export function patchDirectoryQuery(
  state: DirectoryQueryState,
  patch: Partial<DirectoryQueryState>
): DirectoryQueryState;
export function serializeDirectoryQuery(state: DirectoryQueryState): string;
export function selectDirectoryGroups(
  tools: readonly Tool[],
  scenes: readonly Scene[],
  categories: readonly Category[],
  state: DirectoryQueryState,
  clickStats: Readonly<Record<string, number>>
): ToolDecisionGroup[];
export function sanitizeToolsReturnPath(value?: string | null): string;
export function buildToolDetailHref(slug: string, from?: string | null): string;
