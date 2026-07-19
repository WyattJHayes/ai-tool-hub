import { FilterFields } from './FilterFields';
import type { DirectoryQueryPatch, DirectoryQueryState, PlatformValue } from '@/types/tool';

interface FilterRailProps {
  state: DirectoryQueryState;
  platformOptions: PlatformValue[];
  onPatch: (patch: DirectoryQueryPatch) => void;
  onClear: () => void;
}

export function FilterRail(props: FilterRailProps) {
  return <aside className="hidden border-r border-[var(--line)] pr-5 lg:block" aria-label="工具筛选"><FilterFields {...props} radioGroupName="price-desktop" /></aside>;
}
