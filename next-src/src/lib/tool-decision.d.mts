import type {
  Category,
  DerivedPrice,
  OriginValue,
  PlatformValue,
  Scene,
  SceneTaskCell,
  Tool,
  ToolDecisionModel,
  ToolTaskProfile,
} from '../types/tool';

export const RELATED_CATEGORY_IDS_BY_SCENE: Readonly<Record<string, readonly string[]>>;
export function normalizeSceneLabel(name: unknown): string;
export function buildSceneToolIndex(scenes: readonly Scene[]): Map<number, Scene[]>;
export function deriveToolTasks(
  tool: Tool,
  sceneIndex: Map<number, Scene[]>,
  categories: readonly Category[]
): ToolTaskProfile;
export function deriveSceneTaskCell(
  tool: Tool,
  selectedScene: Scene,
  sceneIndex: Map<number, Scene[]>
): SceneTaskCell;
export function deriveCapabilities(tool: Tool): string[];
export function deriveCapabilitySummary(tool: Tool): string[];
export function deriveToolOrigins(tool: Tool): OriginValue[];
export function deriveToolPlatforms(tool: Tool): PlatformValue[];
export function deriveAvailablePlatforms(tools: readonly Tool[]): PlatformValue[];
export function deriveToolPrice(tool: Pick<Tool, 'pricing' | 'valueTag'>): DerivedPrice;
export function groupToolsForScene(
  tools: readonly Tool[],
  scene: Scene
): { taskMatches: Tool[]; relatedTools: Tool[] };
export function createToolDecisionModel(
  tool: Tool,
  scenes: readonly Scene[],
  categories: readonly Category[],
  selectedScene?: Scene | null,
  existingIndex?: Map<number, Scene[]> | null
): ToolDecisionModel;
export function selectAlternativeTools(
  tool: Tool,
  tools: readonly Tool[],
  scenes: readonly Scene[],
  limit?: number
): Tool[];
