import { create } from 'zustand';
import type { Tool, Category, SortOption } from '@/types/tool';
import { trackClick } from '@/lib/api';

interface ToolStore {
  tools: Tool[];
  categories: Category[];
  filteredTools: Tool[];
  selectedCategory: string;
  sort: SortOption;
  searchTerm: string;
  isLoading: boolean;
  clickStats: Record<string, number>;
  searchHistory: string[];
  dataLoaded: boolean;
  error: string | null;

  setTools: (tools: Tool[]) => void;
  setCategories: (categories: Category[]) => void;
  setSelectedCategory: (category: string) => void;
  setSort: (sort: SortOption) => void;
  setSearchTerm: (term: string) => void;
  setClickStats: (stats: Record<string, number>) => void;
  addSearchHistory: (term: string) => void;
  loadData: () => Promise<void>;
  retryLoadData: () => Promise<void>;
  applyFilters: () => void;
}

const MAX_HISTORY = 5;
let catalogLoadGeneration = 0;
let catalogLoadPromise: Promise<void> | null = null;

export const useToolStore = create<ToolStore>((set, get) => ({
  tools: [],
  categories: [],
  filteredTools: [],
  selectedCategory: 'all',
  sort: 'default',
  searchTerm: '',
  isLoading: true,
  clickStats: {},
  searchHistory: [],
  dataLoaded: false,
  error: null,

  setTools: (tools) => {
    set({ tools, filteredTools: tools, isLoading: false });
  },
  setCategories: (categories) => set({ categories }),
  setSelectedCategory: (category) => {
    set({ selectedCategory: category });
    get().applyFilters();
    // Tracking: filter_apply
    trackClick(0, '__filter__', undefined, `category:${category}`).catch(() => {});
  },
  setSort: (sort) => {
    set({ sort });
    get().applyFilters();
    // Tracking: filter_apply
    trackClick(0, '__filter__', undefined, `sort:${sort}`).catch(() => {});
  },
  setSearchTerm: (term) => {
    set({ searchTerm: term });
    get().applyFilters();
    // S-05: Search logging + S-03: history
    if (term.trim()) {
      trackClick(0, '__search__', undefined, term).catch(() => {});
    }
  },
  setClickStats: (stats) => set({ clickStats: stats }),

  addSearchHistory: (term) => {
    if (!term.trim()) return;
    const history = get().searchHistory.filter(h => h !== term);
    history.unshift(term);
    set({ searchHistory: history.slice(0, MAX_HISTORY) });
  },

  loadData: async () => {
    if (get().dataLoaded) return;
    if (catalogLoadPromise) return catalogLoadPromise;

    const generation = catalogLoadGeneration;
    set({ isLoading: true, error: null });
    const loadPromise = (async () => {
      const load = async (url: string) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to load ${url}`);
        const data = await res.json();
        if (!Array.isArray(data.tools) || !Array.isArray(data.categories)) {
          throw new Error(`Invalid tools payload from ${url}`);
        }
        return data;
      };
      try {
        let data;
        try {
          data = await load('/api/tools');
        } catch {
          data = await load('/data/tools.json');
        }
        if (generation !== catalogLoadGeneration) return;
        set({
          tools: data.tools,
          categories: data.categories,
          filteredTools: data.tools,
          isLoading: false,
          dataLoaded: true,
          error: null,
        });
      } catch {
        if (generation !== catalogLoadGeneration) return;
        set({ isLoading: false, dataLoaded: false, error: '工具数据暂时无法加载' });
      }
      try {
        const res = await fetch('/api/track/click');
        const data = await res.json();
        if (generation === catalogLoadGeneration && data.clicks) {
          set({ clickStats: data.clicks });
        }
      } catch {
        // Analytics failure must not block catalog data.
      }
    })();

    catalogLoadPromise = loadPromise;
    try {
      await loadPromise;
    } finally {
      if (catalogLoadPromise === loadPromise) catalogLoadPromise = null;
    }
  },
  retryLoadData: async () => {
    catalogLoadGeneration += 1;
    catalogLoadPromise = null;
    set({ dataLoaded: false, error: null });
    await get().loadData();
  },

  applyFilters: () => {
    const { tools, selectedCategory, sort, searchTerm } = get();
    let result = [...tools];

    if (selectedCategory !== 'all') {
      result = result.filter(t =>
        t.category === selectedCategory ||
        (t.categories && t.categories.includes(selectedCategory))
      );
    }

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(t =>
        t.name.toLowerCase().includes(lower) ||
        t.desc.toLowerCase().includes(lower) ||
        (t.valueTag && t.valueTag.toLowerCase().includes(lower))
      );
    }

    switch (sort) {
      case 'hot':
        result.sort((a, b) => (b.status === 'hot' ? 1 : 0) - (a.status === 'hot' ? 1 : 0));
        break;
      case 'free-first':
        result.sort((a, b) => (a.tags.includes('free') ? -1 : 1) - (b.tags.includes('free') ? -1 : 1));
        break;
      case 'domestic':
        result.sort((a, b) => (a.toolTags?.includes('国产') ? -1 : 1) - (b.toolTags?.includes('国产') ? -1 : 1));
        break;
      case 'name-asc':
        result.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
        break;
      case 'name-desc':
        result.sort((a, b) => b.name.localeCompare(a.name, 'zh'));
        break;
      case 'popular': {
        const stats = get().clickStats;
        result.sort((a, b) => (stats[String(b.id)] || 0) - (stats[String(a.id)] || 0));
        break;
      }
    }

    set({ filteredTools: result });
  },
}));
