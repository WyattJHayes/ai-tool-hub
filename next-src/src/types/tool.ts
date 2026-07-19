export interface PricingPlan {
  plan: string;
  price: number;
  unit: string;
  quota: string;
  highlight: boolean;
}

export interface Tool {
  id: number;
  name: string;
  category: string;
  categories: string[];
  icon: string;
  desc: string;
  tags: string[];
  toolTags: string[];
  url: string;
  status?: string;
  platforms?: string[];
  difficulty?: string;
  updateTime?: string;
  pricing?: PricingPlan[];
  valueTag?: string;
  scenes?: string[];
  highlights?: string[];
  platform?: string[];
  relatedTools?: number[];
}

export interface Category {
  id: string;
  name: string;
  icon: string;
}

export interface Scene {
  id: string;
  name: string;
  icon: string;
  description: string;
  toolIds: number[];
}

export interface SceneData {
  scenes: Scene[];
  sceneToolMapping: Record<string, string[]>;
}

export interface ToolsData {
  version: string;
  lastUpdated: string;
  categories: Category[];
  tools: Tool[];
}

export const PRICE_FILTER_VALUES = ['free-tier', 'fully-free', 'paid-only'] as const;
export type PriceFilterValue = (typeof PRICE_FILTER_VALUES)[number];
export const ORIGIN_VALUES = ['domestic', 'overseas'] as const;
export type OriginValue = (typeof ORIGIN_VALUES)[number];
export const PLATFORM_VALUES = ['web', 'local', 'cli', 'desktop'] as const;
export type PlatformValue = (typeof PLATFORM_VALUES)[number];

export interface DerivedTask {
  id: string;
  label: string;
  source: 'scene' | 'category';
}

export interface ToolTaskProfile {
  source: 'scene-mapping' | 'category-fallback';
  items: DerivedTask[];
}

export interface SceneTaskCell {
  primary: { id: string; label: string };
  relation: 'task-match' | 'category-related';
  additionalExplicitCount: number;
}

export interface DerivedPrice {
  summary: string | null;
  valueTag: string | null;
  filters: PriceFilterValue[];
}

export interface ToolDecisionModel {
  tool: Tool;
  tasks: DerivedTask[];
  taskCell: SceneTaskCell | null;
  capabilities: string[];
  capabilitySummary: string[];
  origin: OriginValue | null;
  platforms: PlatformValue[];
  price: DerivedPrice;
}

export interface ToolDecisionGroup {
  id: 'matched' | 'related' | 'all' | 'weekly' | 'alternatives';
  title?: string;
  items: ToolDecisionModel[];
}

export type SortOption = 'default' | 'hot' | 'free-first' | 'domestic' | 'name-asc' | 'name-desc' | 'popular';

export interface DirectoryQueryState {
  sceneId: string | null;
  searchTerm: string;
  categoryId: string | null;
  price: PriceFilterValue | null;
  origins: OriginValue[];
  platforms: PlatformValue[];
  sort: SortOption;
}

export interface DirectoryQueryCatalog {
  sceneIds: Set<string>;
  categoryIds: Set<string>;
  platforms: Set<PlatformValue>;
}

export interface FilterState {
  category: string;
  sort: SortOption;
  searchTerm: string;
  advancedFilters: {
    price: string[];
    origin: string[];
    status: string[];
  };
}

export type CompareAddOutcome = 'added' | 'already-selected' | 'limit-reached';
export type CompareAvailability = 'selected' | 'limit-reached' | 'available';
