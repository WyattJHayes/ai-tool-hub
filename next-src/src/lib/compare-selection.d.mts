import type { CompareAddOutcome, CompareAvailability } from '../types/tool';

export const MAX_COMPARE_TOOLS: 4;
export function tryAddCompareTool<T extends { id: number }>(
  selectedTools: T[],
  tool: T
): { selectedTools: T[]; outcome: CompareAddOutcome };
export function getCompareAvailability<T extends { id: number }>(
  selectedTools: readonly T[],
  toolId: number
): CompareAvailability;
