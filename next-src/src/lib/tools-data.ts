import type { ToolsData, Tool, Category, SceneData } from '@/types/tool';
import { deriveToolPrice } from '@/lib/tool-decision.mjs';

let cachedData: ToolsData | null = null;
let cachedScenes: SceneData | null = null;

export async function getToolsData(): Promise<ToolsData> {
  if (cachedData) return cachedData;
  const res = await fetch('/data/tools.json');
  cachedData = await res.json() as ToolsData;
  return cachedData;
}

export async function getScenesData(): Promise<SceneData> {
  if (cachedScenes) return cachedScenes;
  const res = await fetch('/data/scenes.json');
  if (!res.ok) throw new Error('Failed to load /data/scenes.json');
  const data = await res.json() as SceneData;
  if (!Array.isArray(data.scenes)) throw new Error('Invalid scene payload');
  cachedScenes = data;
  return data;
}

export function clearScenesDataCache(): void {
  cachedScenes = null;
}

export function getToolSlug(tool: Tool): string {
  // Use tool ID as slug for URL stability (Chinese names don't slugify well)
  return String(tool.id);
}

export function getToolById(tools: Tool[], id: number): Tool | undefined {
  return tools.find(t => t.id === id);
}

export function getToolBySlug(tools: Tool[], slug: string): Tool | undefined {
  // Support both ID-based slugs and legacy name-based slugs
  const byId = tools.find(t => String(t.id) === slug);
  if (byId) return byId;
  return tools.find(t => {
    const nameSlug = t.name.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-').replace(/(^-|-$)/g, '');
    return nameSlug === slug;
  });
}

export function getToolsByCategory(tools: Tool[], categoryId: string): Tool[] {
  if (categoryId === 'all') return tools;
  return tools.filter(t =>
    t.category === categoryId ||
    (t.categories && t.categories.includes(categoryId))
  );
}

export function getCategoryName(categories: Category[], id: string): string {
  return categories.find(c => c.id === id)?.name ?? id;
}

export function getCategoryNames(categories: Category[], ids: string[]): string {
  return ids.map(id => getCategoryName(categories, id)).join(' / ');
}

export function getToolsByIds(tools: Tool[], ids: number[]): Tool[] {
  return ids.map(id => tools.find(t => t.id === id)).filter(Boolean) as Tool[];
}

export function getRelatedTools(tools: Tool[], tool: Tool, limit = 4): Tool[] {
  return tools
    .filter(t =>
      t.id !== tool.id &&
      (t.category === tool.category ||
        (tool.categories && t.categories && t.categories.some(c => tool.categories.includes(c))))
    )
    .slice(0, limit);
}

export function getPricingHighlight(pricing: Tool['pricing']): string {
  return deriveToolPrice({ pricing }).summary || '';
}

export function filterTools(tools: Tool[], filters: {
  category: string;
  sort: string;
  searchTerm: string;
  advancedFilters: { price: string[]; origin: string[]; status: string[] };
}): Tool[] {
  let result = [...tools];

  if (filters.category !== 'all') {
    result = result.filter(t =>
      t.category === filters.category ||
      (t.categories && t.categories.includes(filters.category))
    );
  }

  if (filters.searchTerm) {
    const term = filters.searchTerm.toLowerCase();
    result = result.filter(t =>
      t.name.toLowerCase().includes(term) ||
      t.desc.toLowerCase().includes(term)
    );
  }

  const { price, origin, status } = filters.advancedFilters;
  if (price.length > 0) {
    result = result.filter(t => price.some(p => t.tags.includes(p)));
  }
  if (origin.length > 0) {
    result = result.filter(t => origin.some(o => t.toolTags?.includes(o)));
  }
  if (status.length > 0) {
    result = result.filter(t => status.some(s => t.status === s || t.tags.includes(s)));
  }

  switch (filters.sort) {
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
  }

  return result;
}
