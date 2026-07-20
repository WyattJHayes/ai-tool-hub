import { create } from 'zustand';
import { tryAddCompareTool } from '@/lib/compare-selection.mjs';
import type { CompareAddOutcome, Tool } from '@/types/tool';

interface CompareStore {
  selectedTools: Tool[];
  addTool: (tool: Tool) => CompareAddOutcome;
  removeTool: (toolId: number) => void;
  clearAll: () => void;
  isSelected: (toolId: number) => boolean;
}

export const useCompareStore = create<CompareStore>((set, get) => ({
  selectedTools: [],

  addTool: (tool) => {
    const result = tryAddCompareTool(get().selectedTools, tool);
    if (result.outcome === 'added') set({ selectedTools: result.selectedTools as Tool[] });
    return result.outcome;
  },

  removeTool: (toolId) => {
    set({ selectedTools: get().selectedTools.filter(t => t.id !== toolId) });
  },

  clearAll: () => set({ selectedTools: [] }),

  isSelected: (toolId) => get().selectedTools.some(t => t.id === toolId),
}));
