# Task-First Decision Matrix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the homepage, tool directory, and tool detail flow around task selection and aligned decision rows so users can compare task fit, capabilities, and price without fabricated scores.

**Architecture:** Keep the existing App Router, Zustand stores, APIs, JSON schema, and neutral visual system. Add pure `.mjs` derivation/query modules that are directly testable with Node, then render their typed models through focused client components; `/tools` remains a Server Component shell with a Suspense-wrapped client controller because it reads `useSearchParams`.

**Tech Stack:** Next.js 16.2, React 18, TypeScript 5, Tailwind CSS 3.4, Zustand 5, Lucide React, Node 22 `node:test`, root Playwright 1.60.

## Global Constraints

- Production scope is `next-src`; do not edit the legacy root Vite UI, `/love`, the resume optimizer, Supabase schema, or API response shapes.
- Complete Task 0's Image Gen reference gate before Task 1 code changes and treat the accepted images as the visual source of truth.
- Preserve the repository's installed Next.js, React, Tailwind, Zustand, and Supabase versions; this plan adds no runtime or test dependency.
- Use `scenes[].toolIds` as the canonical task mapping and ignore the drifting `sceneToolMapping` name map.
- Never display a match percentage or use scene order, category order, `status`, `difficulty`, or `relatedTools` to derive task match. The explicit user-selected `hot` sort and the approved deterministic weekly `status === 'hot'` selection remain unchanged and are not presented as match scores.
- A directory row shows the current task, at most two capability summaries, and the price summary; placeholder capabilities fall back to the real description.
- Light tokens remain `#F6F7F4`, `#FFFFFF`, `#171A17`, and `#176B4D`; radii remain `4–8px`; letter spacing is `0`.
- Mobile primary targets are at least `44px`; `320px` width must not overflow; the compare tray must sit above the bottom navigation and safe area.
- The comparison page layout is out of scope; only its shared tray visibility and obsolete `platforms` fallback change.
- Pure behavior tests use `.mjs` because the repo has no TypeScript runtime test loader. Do not run `node --test next-src/tests/*.test.mjs` without `TEST_BASE_URL`; run the explicit unit list and API regressions separately.
- Each implementation task from Task 1 through Task 12 must end with `git diff --check` for touched files and a focused commit. Task 13 creates a focused correction commit only when review changes files. Do not stage `.superpowers/` visual-companion or Image Gen reference artifacts.

---

## File Responsibility Map

- `next-src/src/types/tool.ts`: canonical TypeScript contracts for decision models, query state, filter values, and comparison outcomes.
- `next-src/src/lib/tool-decision.mjs` and `next-src/src/lib/tool-decision.d.mts`: framework-free task/capability/origin/platform/price/alternative derivation and its strict TypeScript boundary.
- `next-src/src/lib/tools-query-state.mjs` and `next-src/src/lib/tools-query-state.d.mts`: URL parsing/normalization, filtering/grouping/sorting, and safe detail/return links plus their strict boundary.
- `next-src/src/lib/compare-selection.mjs` and `next-src/src/lib/compare-selection.d.mts`: framework-free four-tool transitions and exact result types.
- `next-src/src/lib/tools-data.ts`, `next-src/src/stores/useToolStore.ts`, and `next-src/src/hooks/useSceneData.ts`: canonical static fetches/caches, API-to-static tool fallback, terminal errors, and retry/reset behavior.
- `next-src/src/stores/useCompareStore.ts` and `next-src/src/hooks/useToolDirectoryQuery.ts`: cross-route comparison state and URL-backed directory updates/current raw return path.
- `next-src/src/components/hero/SearchBar.tsx`: shared local search draft, homepage push handoff, controlled directory replace behavior, suggestions, and history.
- `next-src/src/components/tools/ToolDecisionRow.tsx` and `next-src/src/components/tools/ToolDecisionList.tsx`: aligned/compact rows, titled groups, loading/error/empty states, and accessible compare-limit feedback.
- `next-src/src/components/home/TaskEntryList.tsx`, `next-src/src/components/tools/TaskContextBar.tsx`, `next-src/src/components/tools/FilterFields.tsx`, `next-src/src/components/tools/FilterRail.tsx`, and `next-src/src/components/tools/MobileFilterDrawer.tsx`: canonical task entry and controlled desktop/mobile filtering without duplicated derivation.
- `next-src/src/app/page.tsx`, `next-src/src/components/tools/ToolsBrowseClient.tsx`, `next-src/src/components/tools/ToolsPageSkeleton.tsx`, and `next-src/src/app/tools/page.tsx`: homepage and Suspense-safe URL-driven directory composition.
- `next-src/src/components/tools/ToolDecisionSummary.tsx`, `next-src/src/components/tools/ToolEvidenceSections.tsx`, `next-src/src/components/tools/ToolDetailClient.tsx`, and `next-src/src/app/tools/[slug]/page.tsx`: summary-first detail evidence, retry/not-found states, alternatives, and async route props.
- `next-src/src/components/compare/CompareTray.tsx`, `next-src/src/components/layout/PageShell.tsx`, `next-src/src/components/layout/BottomNav.tsx`, `next-src/src/components/tools/ToolCard.tsx`, and `next-src/src/app/compare/page.tsx`: one global tray, safe fixed-surface geometry, nested nav state, and legacy-consumer compatibility.
- `next-src/src/app/layout.tsx` and `next-src/src/app/globals.css`: root tray mount, local Geist variable, approved tokens, and fixed-surface dimensions.
- `next-src/src/components/hero/HeroSection.tsx`, `next-src/src/components/scenes/SceneCard.tsx`, `next-src/src/components/tools/CategoryFilter.tsx`, `next-src/src/components/tools/SortBar.tsx`, `next-src/src/components/tools/ToolGrid.tsx`, and `next-src/src/components/compare/CompareBar.tsx`: superseded components deleted only when their replacement route/global owner lands.
- `next-src/tests/task-decision.test.mjs`, `next-src/tests/tools-query-state.test.mjs`, `next-src/tests/compare-selection.test.mjs`, `next-src/tests/data-loading-contract.test.mjs`, `next-src/tests/task-first-ui-contract.test.mjs`, and `next-src/tests/editorial-ui-contract.test.mjs`: pure and source-level behavior contracts.
- `scripts/task-first-ui-guard.mjs`, `scripts/review-regressions.mjs`, and `.github/workflows/deploy.yml`: production browser workflow/geometry guard and CI enforcement.

---

### Task 0: Lock the Image Gen Visual References

**Files:**
- Create, untracked: `.superpowers/visual-references/task-first/home-desktop.png`
- Create, untracked: `.superpowers/visual-references/task-first/directory-desktop.png`
- Create, untracked: `.superpowers/visual-references/task-first/detail-desktop.png`
- Create, untracked: `.superpowers/visual-references/task-first/directory-mobile.png`
- Create, untracked: `.superpowers/visual-references/task-first/acceptance.md`

**Interfaces:**
- Consumes: the approved design spec, current neutral visual tokens, canonical Chinese copy, and the `build-web-apps:frontend-app-builder` plus `imagegen` skills.
- Produces: four user-accepted bitmap references with exact paths and a manifest that Task 13 uses for native-size screenshot comparison.

- [ ] **Step 1: Prepare the untracked reference directory and invoke the required skills**

Invoke `build-web-apps:frontend-app-builder`, then `imagegen`, before any code edit. Create the untracked destination:

```bash
mkdir -p .superpowers/visual-references/task-first
```

- [ ] **Step 2: Generate the four complete, readable UI concepts**

Use the built-in Image Gen tool once per surface. Prefix every prompt with this exact shared brief:

```text
Use case: ui-mockup. Create a production-readable interface concept for the existing Chinese AI Tool Hub, whose audience compares AI tools by task, capabilities, price, source, and platform. Preserve the approved task-first information architecture and visible Chinese copy; do not invent metrics, match scores, recommendations, routes, claims, or product areas. Use code-native-looking UI text and controls. Neutral editorial system: page #F6F7F4, white surface #FFFFFF, main text #171A17, green accent #176B4D, restrained charcoal dark-theme compatibility, local-Geist-like western numerals with system Chinese fallback, zero letter spacing, 4-8px radii, thin borders, almost no shadow. Open bands, rails, lists, and aligned rows; no marketing cards, nested cards, gradients, glass, glow, or decorative illustration. Lucide-style outline controls, 44px primary targets, dense but calm professional comparison workspace. Every label must be large and readable enough for implementation extraction.
```

Append each corresponding surface brief and generate a fresh standalone image:

```text
HOME DESKTOP, 1440x900. Show the complete first screen: quiet 64px navigation; compact title “按任务找到合适的 AI 工具”; supporting copy “先确定任务，再比较能力、价格和使用条件”; one prominent search input; immediately below, “你要完成什么？” with all eight canonical task entries in an open four-column/two-row list; then the visible start of “本周值得试” using compact decision rows, not cards. Keep the first viewport useful and show a hint of downstream rows. No data overview or leaderboard promotion.
```

```text
DIRECTORY DESKTOP, 1440x900. Show “工具目录”, a TaskContextBar with search, task, category when applicable, result count, and sort; a narrow left FilterRail for price, source, and real platform values; and an aligned ToolDecisionList. Rows must visibly align compare checkbox, icon/name/source/platform, applicable task with “任务映射” or “同类工具”, at most two capability summaries, price summary, and icon-only detail action. Show “任务匹配” and “同类工具” headings for research, with a two-tool CompareTray fixed at the bottom. No external-link action in rows and no match percentages.
```

```text
DETAIL DESKTOP, 1440x900. Show an evidence-first tool detail for Perplexity AI: return-to-directory link; top decision summary with name, real description, applicable tasks, up to two valid capabilities, price summary, primary “访问官网”, secondary favorite and compare actions; main content with complete capabilities, pricing/limits, tags/update, rating and reviews; a narrow in-flow sticky decision rail; and the start of compact “替代方案” rows. Preserve the quiet neutral system and do not use a card grid.
```

```text
DIRECTORY MOBILE, 390x844. Show the research directory with no page-level horizontal overflow: search; one stable three-column control row for task, filter, and sort; compact vertical decision items that preserve tool, task, capabilities, price, then detail order; 44px compare target in the upper right; readable untruncated tool names; a two-tool CompareTray above the 64px bottom navigation and safe area. Show wrapping and fixed-surface spacing clearly. No horizontal chip scroller.
```

Move or copy the four accepted generation outputs from the built-in Image Gen output location to the exact filenames in this task.

- [ ] **Step 3: Inspect and reject ambiguous concepts**

Use `view_image` on all four saved files. Reject and regenerate any image with unreadable text, missing sections, a card-grid reinterpretation, invented scores/copy, wrong field order, gradients, palette drift, clipped content, a missing mobile tray/nav separation, or controls too small to extract. Iterate one targeted correction per regeneration.

- [ ] **Step 4: Record the reference manifest**

Create `.superpowers/visual-references/task-first/acceptance.md` with this exact content:

```markdown
# Task-First Visual Reference Manifest

- Home desktop, 1440x900: `/Users/weijiahao/Downloads/ai-tool-hub/.superpowers/visual-references/task-first/home-desktop.png`
- Directory desktop, 1440x900: `/Users/weijiahao/Downloads/ai-tool-hub/.superpowers/visual-references/task-first/directory-desktop.png`
- Detail desktop, 1440x900: `/Users/weijiahao/Downloads/ai-tool-hub/.superpowers/visual-references/task-first/detail-desktop.png`
- Directory mobile, 390x844: `/Users/weijiahao/Downloads/ai-tool-hub/.superpowers/visual-references/task-first/directory-mobile.png`
- Locked tokens: `#F6F7F4`, `#FFFFFF`, `#171A17`, `#176B4D`, `4-8px`, `letter-spacing: 0`
- Allowed first-view copy: `按任务找到合适的 AI 工具`; `先确定任务，再比较能力、价格和使用条件`; `你要完成什么？`; `本周值得试`; `工具目录`
```

- [ ] **Step 5: Obtain the visual gate approval**

Show all four images to the user, state that they lock layout/copy/palette/component geometry for implementation, and pause. Continue to Task 1 only after explicit approval. Then append an `Approval:` line to `acceptance.md` containing the output of `date '+%Y-%m-%dT%H:%M:%S%z'` followed by the user's exact approval message. Do not commit or stage any Task 0 artifact.

---

### Task 1: Decision Data Model and Derivation

**Files:**
- Modify: `next-src/src/types/tool.ts`
- Create: `next-src/src/lib/tool-decision.mjs`
- Create: `next-src/src/lib/tool-decision.d.mts`
- Modify: `next-src/src/lib/tools-data.ts`
- Create: `next-src/tests/task-decision.test.mjs`

**Interfaces:**
- Consumes: `Tool`, `Category`, `Scene`, and `PricingPlan` from `next-src/src/types/tool.ts`.
- Produces: `buildSceneToolIndex(scenes: readonly Scene[]): Map<number, Scene[]>`; `deriveToolTasks(tool: Tool, sceneIndex: Map<number, Scene[]>, categories: readonly Category[]): ToolTaskProfile`; `deriveSceneTaskCell(tool: Tool, selectedScene: Scene, sceneIndex: Map<number, Scene[]>): SceneTaskCell`; `deriveCapabilities(tool: Tool): string[]`; `deriveCapabilitySummary(tool: Tool): string[]`; `deriveToolOrigins(tool: Tool): OriginValue[]`; `deriveToolPlatforms(tool: Tool): PlatformValue[]`; `deriveAvailablePlatforms(tools: readonly Tool[]): PlatformValue[]`; `deriveToolPrice(tool: Pick<Tool, 'pricing' | 'valueTag'>): DerivedPrice`; `groupToolsForScene(tools: readonly Tool[], scene: Scene): { taskMatches: Tool[]; relatedTools: Tool[] }`; and `createToolDecisionModel(tool: Tool, scenes: readonly Scene[], categories: readonly Category[], selectedScene?: Scene | null, existingIndex?: Map<number, Scene[]> | null): ToolDecisionModel`.

- [ ] **Step 1: Write the failing derivation tests**

Create `next-src/tests/task-decision.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const helperUrl = new URL('../src/lib/tool-decision.mjs', import.meta.url);
const toolsData = JSON.parse(readFileSync(new URL('../public/data/tools.json', import.meta.url), 'utf8'));
const sceneData = JSON.parse(readFileSync(new URL('../public/data/scenes.json', import.meta.url), 'utf8'));
const byId = new Map(toolsData.tools.map((tool) => [tool.id, tool]));

test('derives explicit tasks in scene-file order and category fallback', async () => {
  const { buildSceneToolIndex, deriveToolTasks } = await import(helperUrl);
  const index = buildSceneToolIndex(sceneData.scenes);
  assert.deepEqual(
    deriveToolTasks(byId.get(2), index, toolsData.categories).items.map((task) => task.label),
    ['做PPT', '写文案']
  );
  assert.deepEqual(
    deriveToolTasks(byId.get(7), index, toolsData.categories).items.map((task) => task.label),
    ['AI写作', 'AI代码']
  );
});

test('uses selected scene as the primary task and identifies its source', async () => {
  const { buildSceneToolIndex, deriveSceneTaskCell } = await import(helperUrl);
  const index = buildSceneToolIndex(sceneData.scenes);
  const research = sceneData.scenes.find((scene) => scene.id === 'research');
  assert.deepEqual(deriveSceneTaskCell(byId.get(71), research, index), {
    primary: { id: 'research', label: '做调研' },
    relation: 'task-match',
    additionalExplicitCount: 0,
  });
  assert.equal(deriveSceneTaskCell(byId.get(2), research, index).relation, 'category-related');
});

test('filters generic capabilities and falls back to the real description', async () => {
  const { deriveCapabilities, deriveCapabilitySummary } = await import(helperUrl);
  const generic = byId.get(73);
  assert.deepEqual(deriveCapabilities(generic), []);
  assert.deepEqual(deriveCapabilitySummary(generic), [generic.desc]);
  assert.deepEqual(deriveCapabilitySummary(byId.get(2)), ['GPT-4o多模态', 'DALL·E 3绘图']);
});

test('derives platform, origin, and price predicates from canonical fields', async () => {
  const { deriveToolOrigins, deriveToolPlatforms, deriveToolPrice } = await import(helperUrl);
  assert.deepEqual(deriveToolPlatforms(byId.get(2)), ['web']);
  assert.deepEqual(deriveToolPlatforms(byId.get(67)), ['web', 'local']);
  assert.deepEqual(deriveToolOrigins(byId.get(2)), ['overseas']);
  assert.deepEqual(deriveToolPrice(byId.get(9)).filters, ['free-tier', 'fully-free']);
  assert.equal(deriveToolPrice(byId.get(9)).summary, '免费');
  assert.deepEqual(deriveToolPrice(byId.get(11)).filters, ['paid-only']);
  assert.equal(deriveToolPrice(byId.get(11)).summary, 'Basic $10');
  assert.deepEqual(deriveToolPrice({ pricing: [] }).filters, []);
  assert.deepEqual(deriveToolPrice({ pricing: [{ price: -1 }, { price: 0 }] }).filters, ['free-tier']);
});

test('all real tools produce nonempty tasks and capability summaries', async () => {
  const { buildSceneToolIndex, deriveCapabilitySummary, deriveToolTasks } = await import(helperUrl);
  const index = buildSceneToolIndex(sceneData.scenes);
  for (const tool of toolsData.tools) {
    assert.ok(deriveToolTasks(tool, index, toolsData.categories).items.length > 0, tool.name);
    assert.ok(deriveCapabilitySummary(tool).length > 0, tool.name);
  }
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
node --test next-src/tests/task-decision.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/lib/tool-decision.mjs`.

- [ ] **Step 3: Add shared decision types and tighten the scene icon type**

In `next-src/src/types/tool.ts`, change `Scene.icon` to `string` and add the following types. Keep the legacy `Tool.scenes` and `Tool.platforms` declarations temporarily because out-of-scope `ToolCard` and `/compare` consumers still compile against them; Task 9 removes both declarations in the same commit that removes the final reads.

```ts
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
```

- [ ] **Step 4: Implement the pure decision helper**

Create `next-src/src/lib/tool-decision.mjs` with these exact rules:

```js
const GENERIC_CAPABILITIES = new Set(['AI驱动', '高效便捷', '持续更新']);
const PLATFORM_VALUES = new Set(['web', 'local', 'cli', 'desktop']);

export const RELATED_CATEGORY_IDS_BY_SCENE = Object.freeze({
  ppt: ['office', 'design'],
  coding: ['code'],
  video: ['video'],
  drawing: ['painting', 'design'],
  copywriting: ['writing'],
  music: ['music'],
  research: ['search'],
  agent: ['agent'],
});

export function normalizeSceneLabel(name) {
  return String(name || '').trim().replace(/^我要/, '');
}

export function buildSceneToolIndex(scenes) {
  const index = new Map();
  for (const scene of scenes) {
    for (const toolId of scene.toolIds) {
      const current = index.get(toolId) || [];
      index.set(toolId, [...current, scene]);
    }
  }
  return index;
}

export function deriveToolTasks(tool, sceneIndex, categories) {
  const explicit = sceneIndex.get(tool.id) || [];
  if (explicit.length > 0) {
    return {
      source: 'scene-mapping',
      items: explicit.map((scene) => ({
        id: scene.id,
        label: normalizeSceneLabel(scene.name),
        source: 'scene',
      })),
    };
  }
  const names = new Map(categories.map((category) => [category.id, category.name]));
  return {
    source: 'category-fallback',
    items: (tool.categories || [tool.category]).map((id) => ({
      id,
      label: names.get(id) || id,
      source: 'category',
    })),
  };
}

export function deriveSceneTaskCell(tool, selectedScene, sceneIndex) {
  const explicit = sceneIndex.get(tool.id) || [];
  const mapped = explicit.some((scene) => scene.id === selectedScene.id);
  return {
    primary: { id: selectedScene.id, label: normalizeSceneLabel(selectedScene.name) },
    relation: mapped ? 'task-match' : 'category-related',
    additionalExplicitCount: explicit.filter((scene) => scene.id !== selectedScene.id).length,
  };
}

export function deriveCapabilities(tool) {
  const seen = new Set();
  const result = [];
  for (const value of tool.highlights || []) {
    const capability = String(value || '').trim();
    if (!capability || GENERIC_CAPABILITIES.has(capability) || seen.has(capability)) continue;
    seen.add(capability);
    result.push(capability);
  }
  return result;
}

export function deriveCapabilitySummary(tool) {
  const capabilities = deriveCapabilities(tool);
  return capabilities.length > 0 ? capabilities.slice(0, 2) : [String(tool.desc || '').trim()].filter(Boolean);
}

export function deriveToolOrigins(tool) {
  const tags = new Set(tool.toolTags || []);
  return [tags.has('国产') ? 'domestic' : null, tags.has('海外') ? 'overseas' : null].filter(Boolean);
}

export function deriveToolPlatforms(tool) {
  const result = [];
  for (const value of tool.platform || []) {
    if (PLATFORM_VALUES.has(value) && !result.includes(value)) result.push(value);
  }
  if ((tool.toolTags || []).includes('网页版') && !result.includes('web')) result.push('web');
  return result;
}

export function deriveAvailablePlatforms(tools) {
  const found = new Set(tools.flatMap(deriveToolPlatforms));
  return ['web', 'local', 'cli', 'desktop'].filter((value) => found.has(value));
}

export function deriveToolPrice(tool) {
  const plans = tool.pricing || [];
  const free = plans.some((plan) => plan.price === 0);
  const fullyFree = plans.length > 0 && plans.every((plan) => plan.price === 0);
  const paidOnly = plans.length > 0 && plans.every((plan) => plan.price > 0);
  const filters = [];
  if (free) filters.push('free-tier');
  if (fullyFree) filters.push('fully-free');
  if (paidOnly) filters.push('paid-only');
  const freePlan = plans.find((plan) => plan.price === 0);
  const highlighted = plans.find((plan) => plan.highlight);
  const summary = freePlan
    ? '免费'
    : highlighted
      ? `${highlighted.plan} ${highlighted.price > 0 ? `$${highlighted.price}` : ''}`.trim()
      : plans[0]?.plan || null;
  return { summary, valueTag: tool.valueTag || null, filters };
}

export function groupToolsForScene(tools, scene) {
  const explicitIds = new Set(scene.toolIds);
  const relatedCategories = new Set(RELATED_CATEGORY_IDS_BY_SCENE[scene.id] || []);
  return {
    taskMatches: tools.filter((tool) => explicitIds.has(tool.id)),
    relatedTools: tools.filter((tool) =>
      !explicitIds.has(tool.id) && (tool.categories || [tool.category]).some((id) => relatedCategories.has(id))
    ),
  };
}

export function createToolDecisionModel(tool, scenes, categories, selectedScene = null, existingIndex = null) {
  const sceneIndex = existingIndex || buildSceneToolIndex(scenes);
  const profile = deriveToolTasks(tool, sceneIndex, categories);
  return {
    tool,
    tasks: profile.items,
    taskCell: selectedScene ? deriveSceneTaskCell(tool, selectedScene, sceneIndex) : null,
    capabilities: deriveCapabilities(tool),
    capabilitySummary: deriveCapabilitySummary(tool),
    origin: deriveToolOrigins(tool)[0] || null,
    platforms: deriveToolPlatforms(tool),
    price: deriveToolPrice(tool),
  };
}
```

- [ ] **Step 5: Declare the strict TypeScript boundary for the JavaScript helper**

Create `next-src/src/lib/tool-decision.d.mts`:

```ts
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
```

- [ ] **Step 6: Remove the duplicate pricing implementation**

In `next-src/src/lib/tools-data.ts`, import `deriveToolPrice` and replace `getPricingHighlight` with:

```ts
import { deriveToolPrice } from '@/lib/tool-decision.mjs';

export function getPricingHighlight(pricing: Tool['pricing']): string {
  return deriveToolPrice({ pricing }).summary || '';
}
```

- [ ] **Step 7: Run focused verification**

Run:

```bash
node --test next-src/tests/task-decision.test.mjs
npm --prefix next-src run lint
git diff --check -- next-src/src/types/tool.ts next-src/src/lib/tool-decision.mjs next-src/src/lib/tool-decision.d.mts next-src/src/lib/tools-data.ts next-src/tests/task-decision.test.mjs
```

Expected: all tests PASS, lint exits 0, and no whitespace errors are reported.

- [ ] **Step 8: Commit**

```bash
git add next-src/src/types/tool.ts next-src/src/lib/tool-decision.mjs next-src/src/lib/tool-decision.d.mts next-src/src/lib/tools-data.ts next-src/tests/task-decision.test.mjs
git commit -m "feat: derive task-first tool decision data"
```

---

### Task 2: URL Query Contract and Directory Selection

**Files:**
- Modify: `next-src/src/types/tool.ts`
- Create: `next-src/src/lib/tools-query-state.mjs`
- Create: `next-src/src/lib/tools-query-state.d.mts`
- Create: `next-src/tests/tools-query-state.test.mjs`

**Interfaces:**
- Consumes: Task 1 decision helpers, `DirectoryQueryCatalog`, `DirectoryQueryState`, raw `Tool[]`/`Scene[]`/`Category[]`, any `{ get(name: string): string | null }` query reader, and `Record<string, number>` click stats.
- Produces: `parseDirectoryQuery(params: { get(name: string): string | null }, catalog: DirectoryQueryCatalog): DirectoryQueryState`; `patchDirectoryQuery(state: DirectoryQueryState, patch: Partial<DirectoryQueryState>): DirectoryQueryState`; `serializeDirectoryQuery(state: DirectoryQueryState): string`; `selectDirectoryGroups(tools: readonly Tool[], scenes: readonly Scene[], categories: readonly Category[], state: DirectoryQueryState, clickStats: Readonly<Record<string, number>>): ToolDecisionGroup[]`; `sanitizeToolsReturnPath(value?: string | null): string`; and `buildToolDetailHref(slug: string, from?: string | null): string`.

- [ ] **Step 1: Write failing query and grouping tests**

Create `next-src/tests/tools-query-state.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const helperUrl = new URL('../src/lib/tools-query-state.mjs', import.meta.url);
const toolsData = JSON.parse(readFileSync(new URL('../public/data/tools.json', import.meta.url), 'utf8'));
const sceneData = JSON.parse(readFileSync(new URL('../public/data/scenes.json', import.meta.url), 'utf8'));
const catalog = {
  sceneIds: new Set(sceneData.scenes.map((scene) => scene.id)),
  categoryIds: new Set(toolsData.categories.map((category) => category.id)),
  platforms: new Set(['web', 'local', 'cli', 'desktop']),
};

test('scene wins over category and invalid values are ignored', async () => {
  const { parseDirectoryQuery } = await import(helperUrl);
  const state = parseDirectoryQuery(new URLSearchParams('scene=research&category=writing&price=bad&origin=domestic,bad'), catalog);
  assert.equal(state.sceneId, 'research');
  assert.equal(state.categoryId, null);
  assert.equal(state.price, null);
  assert.deepEqual(state.origins, ['domestic']);
});

test('serialization is stable and omits defaults', async () => {
  const { parseDirectoryQuery, serializeDirectoryQuery } = await import(helperUrl);
  const state = parseDirectoryQuery(new URLSearchParams('q=%20Claude%20&platform=cli,web&sort=name-asc'), catalog);
  assert.equal(serializeDirectoryQuery(state), 'q=Claude&platform=web%2Ccli&sort=name-asc');
});

test('patching scene and category keeps them mutually exclusive', async () => {
  const { parseDirectoryQuery, patchDirectoryQuery, serializeDirectoryQuery } = await import(helperUrl);
  const empty = parseDirectoryQuery(new URLSearchParams(), catalog);
  const scene = patchDirectoryQuery(empty, { sceneId: 'research' });
  assert.equal(scene.categoryId, null);
  const category = patchDirectoryQuery(scene, { categoryId: 'writing' });
  assert.equal(category.sceneId, null);
  assert.equal(serializeDirectoryQuery(patchDirectoryQuery(empty, { searchTerm: '   ' })), '');
});

test('research groups preserve source order and search capabilities', async () => {
  const { parseDirectoryQuery, selectDirectoryGroups } = await import(helperUrl);
  const state = parseDirectoryQuery(new URLSearchParams('scene=research'), catalog);
  const groups = selectDirectoryGroups(toolsData.tools, sceneData.scenes, toolsData.categories, state, {});
  assert.deepEqual(groups[0].items.map((item) => item.tool.id), [71, 72, 94]);
  assert.deepEqual(groups[1].items.map((item) => item.tool.id), [2, 9, 73, 74, 80, 88, 90]);

  const searched = selectDirectoryGroups(
    toolsData.tools,
    sceneData.scenes,
    toolsData.categories,
    { ...state, searchTerm: '引用' },
    {}
  );
  assert.ok(searched.flatMap((group) => group.items).some((item) => item.tool.id === 71));

  const visibleTaskSearch = selectDirectoryGroups(
    toolsData.tools,
    sceneData.scenes,
    toolsData.categories,
    { ...state, searchTerm: '做调研' },
    {}
  );
  assert.ok(visibleTaskSearch[1].items.some((item) => item.tool.id === 2));
});

test('return paths remain same-origin and directory-only', async () => {
  const { buildToolDetailHref, sanitizeToolsReturnPath } = await import(helperUrl);
  assert.equal(sanitizeToolsReturnPath('/tools?scene=research'), '/tools?scene=research');
  assert.equal(sanitizeToolsReturnPath('/tools?scene=research&unknown=keep&price=bad'), '/tools?scene=research&unknown=keep&price=bad');
  assert.equal(sanitizeToolsReturnPath('https://example.com'), '/tools');
  assert.equal(buildToolDetailHref('71', '/tools?scene=research'), '/tools/71?from=%2Ftools%3Fscene%3Dresearch');
  assert.equal(
    buildToolDetailHref('71', '/tools?scene=research&unknown=keep&price=bad'),
    '/tools/71?from=%2Ftools%3Fscene%3Dresearch%26unknown%3Dkeep%26price%3Dbad'
  );
});
```

- [ ] **Step 2: Run the test and verify RED**

```bash
node --test next-src/tests/tools-query-state.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Add the directory query type**

Append to `next-src/src/types/tool.ts`:

```ts
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
```

- [ ] **Step 4: Implement parsing, serialization, selection, and safe return paths**

Create `next-src/src/lib/tools-query-state.mjs`. Use fixed parameter order and stable sorting:

```js
import {
  buildSceneToolIndex,
  createToolDecisionModel,
  groupToolsForScene,
} from './tool-decision.mjs';

const PRICE_VALUES = ['free-tier', 'fully-free', 'paid-only'];
const ORIGIN_VALUES = ['domestic', 'overseas'];
const PLATFORM_VALUES = ['web', 'local', 'cli', 'desktop'];
const SORT_VALUES = ['default', 'hot', 'free-first', 'domestic', 'name-asc', 'name-desc', 'popular'];

function parseCsv(value, allowed) {
  const found = new Set(String(value || '').split(',').map((item) => item.trim()).filter((item) => allowed.includes(item)));
  return allowed.filter((item) => found.has(item));
}

export function parseDirectoryQuery(params, catalog) {
  const rawScene = String(params.get('scene') || '').trim();
  const sceneId = catalog.sceneIds.has(rawScene) ? rawScene : null;
  const rawCategory = String(params.get('category') || '').trim();
  const categoryId = !sceneId && catalog.categoryIds.has(rawCategory) ? rawCategory : null;
  const rawPrice = String(params.get('price') || '').trim();
  const price = PRICE_VALUES.includes(rawPrice) ? rawPrice : null;
  const rawSort = String(params.get('sort') || '').trim();
  return {
    sceneId,
    searchTerm: String(params.get('q') || '').trim(),
    categoryId,
    price,
    origins: parseCsv(params.get('origin'), ORIGIN_VALUES),
    platforms: parseCsv(params.get('platform'), PLATFORM_VALUES.filter((value) => catalog.platforms.has(value))),
    sort: SORT_VALUES.includes(rawSort) ? rawSort : 'default',
  };
}

export function patchDirectoryQuery(state, patch) {
  const next = { ...state, ...patch };
  if (Object.hasOwn(patch, 'searchTerm')) next.searchTerm = String(patch.searchTerm || '').trim();
  if (Object.hasOwn(patch, 'sceneId') && patch.sceneId) next.categoryId = null;
  if (Object.hasOwn(patch, 'categoryId') && patch.categoryId) next.sceneId = null;
  return next;
}

export function serializeDirectoryQuery(state) {
  const params = new URLSearchParams();
  const searchTerm = String(state.searchTerm || '').trim();
  if (state.sceneId) params.set('scene', state.sceneId);
  if (searchTerm) params.set('q', searchTerm);
  if (state.categoryId) params.set('category', state.categoryId);
  if (state.price) params.set('price', state.price);
  if (state.origins.length) params.set('origin', ORIGIN_VALUES.filter((value) => state.origins.includes(value)).join(','));
  if (state.platforms.length) params.set('platform', PLATFORM_VALUES.filter((value) => state.platforms.includes(value)).join(','));
  if (state.sort !== 'default') params.set('sort', state.sort);
  return params.toString();
}

function matchesSearch(model, term) {
  const query = term.toLocaleLowerCase('zh-CN');
  if (!query) return true;
  return [
    model.tool.name,
    model.tool.desc,
    ...model.capabilities,
    ...model.tasks.map((task) => task.label),
    model.taskCell?.primary.label || '',
    ...(model.tool.toolTags || []),
  ].some((value) => String(value).toLocaleLowerCase('zh-CN').includes(query));
}

function filterModels(models, state) {
  return models.filter((model) =>
    matchesSearch(model, state.searchTerm) &&
    (!state.categoryId || (model.tool.categories || [model.tool.category]).includes(state.categoryId)) &&
    (!state.price || model.price.filters.includes(state.price)) &&
    (!state.origins.length || (model.origin && state.origins.includes(model.origin))) &&
    (!state.platforms.length || model.platforms.some((value) => state.platforms.includes(value)))
  );
}

function sortModels(models, sort, clickStats) {
  const sourceIndex = new Map(models.map((model, index) => [model.tool.id, index]));
  return [...models].sort((left, right) => {
    if (sort === 'hot') return Number(right.tool.status === 'hot') - Number(left.tool.status === 'hot') || sourceIndex.get(left.tool.id) - sourceIndex.get(right.tool.id);
    if (sort === 'free-first') return Number(!left.price.filters.includes('free-tier')) - Number(!right.price.filters.includes('free-tier')) || sourceIndex.get(left.tool.id) - sourceIndex.get(right.tool.id);
    if (sort === 'domestic') return Number(left.origin !== 'domestic') - Number(right.origin !== 'domestic') || sourceIndex.get(left.tool.id) - sourceIndex.get(right.tool.id);
    if (sort === 'name-asc') return left.tool.name.localeCompare(right.tool.name, 'zh');
    if (sort === 'name-desc') return right.tool.name.localeCompare(left.tool.name, 'zh');
    if (sort === 'popular') return (clickStats[String(right.tool.id)] || 0) - (clickStats[String(left.tool.id)] || 0) || sourceIndex.get(left.tool.id) - sourceIndex.get(right.tool.id);
    return sourceIndex.get(left.tool.id) - sourceIndex.get(right.tool.id);
  });
}

export function selectDirectoryGroups(tools, scenes, categories, state, clickStats) {
  const selectedScene = scenes.find((scene) => scene.id === state.sceneId) || null;
  const sceneIndex = buildSceneToolIndex(scenes);
  const makeModels = (source) => filterModels(
    source.map((tool) => createToolDecisionModel(tool, scenes, categories, selectedScene, sceneIndex)),
    state
  );
  if (!selectedScene) {
    return [{ id: 'all', items: sortModels(makeModels(tools), state.sort, clickStats) }];
  }
  const grouped = groupToolsForScene(tools, selectedScene);
  return [
    { id: 'matched', title: '任务匹配', items: sortModels(makeModels(grouped.taskMatches), state.sort, clickStats) },
    { id: 'related', title: '同类工具', items: sortModels(makeModels(grouped.relatedTools), state.sort, clickStats) },
  ];
}

export function sanitizeToolsReturnPath(value) {
  return value === '/tools' || String(value || '').startsWith('/tools?') ? String(value) : '/tools';
}

export function buildToolDetailHref(slug, from) {
  return `/tools/${encodeURIComponent(slug)}?from=${encodeURIComponent(sanitizeToolsReturnPath(from))}`;
}
```

- [ ] **Step 5: Declare the strict TypeScript boundary for query state**

Create `next-src/src/lib/tools-query-state.d.mts`:

```ts
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
```

- [ ] **Step 6: Run focused verification**

```bash
node --test next-src/tests/tools-query-state.test.mjs next-src/tests/task-decision.test.mjs
npm --prefix next-src run lint
git diff --check -- next-src/src/types/tool.ts next-src/src/lib/tools-query-state.mjs next-src/src/lib/tools-query-state.d.mts next-src/tests/tools-query-state.test.mjs
```

Expected: all commands exit 0.

- [ ] **Step 7: Commit**

```bash
git add next-src/src/types/tool.ts next-src/src/lib/tools-query-state.mjs next-src/src/lib/tools-query-state.d.mts next-src/tests/tools-query-state.test.mjs
git commit -m "feat: make tool directory state URL-driven"
```

---

### Task 3: Resilient Tool and Scene Loading

**Files:**
- Modify: `next-src/src/stores/useToolStore.ts`
- Modify: `next-src/src/lib/tools-data.ts`
- Create: `next-src/src/hooks/useSceneData.ts`
- Create: `next-src/tests/data-loading-contract.test.mjs`

**Interfaces:**
- Consumes: `/api/tools`, `/data/tools.json`, `/data/scenes.json`, `fetch`, and Zustand.
- Produces: `useToolStore.error: string | null`, `useToolStore.retryLoadData(): Promise<void>`, `clearScenesDataCache(): void`, and `useSceneData(): { scenes: Scene[]; isLoading: boolean; error: string | null; retry: () => void }`.

- [ ] **Step 1: Write the failing loading contract**

Create `next-src/tests/data-loading-contract.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('tool loading validates responses and exposes retryable terminal errors', () => {
  const store = read('src/stores/useToolStore.ts');
  assert.match(store, /error: string \| null/);
  assert.match(store, /retryLoadData: \(\) => Promise<void>/);
  assert.match(store, /if \(!res\.ok\) throw new Error/);
  assert.match(store, /error: '工具数据暂时无法加载'/);
});

test('canonical scenes load through a focused retryable hook', () => {
  const hook = read('src/hooks/useSceneData.ts');
  const data = read('src/lib/tools-data.ts');
  assert.match(hook, /getScenesData\(\)/);
  assert.match(hook, /clearScenesDataCache\(\)/);
  assert.match(hook, /const retry = useCallback/);
  assert.match(hook, /error/);
  assert.match(data, /if \(!res\.ok\) throw new Error/);
  assert.match(data, /if \(!Array\.isArray\(data\.scenes\)\)/);
  assert.match(data, /export function clearScenesDataCache/);
});
```

- [ ] **Step 2: Run the test and verify RED**

```bash
node --test next-src/tests/data-loading-contract.test.mjs
```

Expected: FAIL because `useSceneData.ts` does not exist and the store has no error contract.

- [ ] **Step 3: Add validated fallback loading and retry to the store**

In the existing `ToolStore` interface, add:

```ts
  error: string | null;
  retryLoadData: () => Promise<void>;
```

In the Zustand initializer, add:

```ts
  error: null,
```

Replace the existing `loadData` method and add `retryLoadData` immediately after it:

```ts
  loadData: async () => {
    if (get().dataLoaded) return;
    set({ isLoading: true, error: null });
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
      set({
        tools: data.tools,
        categories: data.categories,
        filteredTools: data.tools,
        isLoading: false,
        dataLoaded: true,
        error: null,
      });
    } catch {
      set({ isLoading: false, dataLoaded: false, error: '工具数据暂时无法加载' });
    }
    try {
      const res = await fetch('/api/track/click');
      const data = await res.json();
      if (data.clicks) set({ clickStats: data.clicks });
    } catch {
      // Analytics failure must not block catalog data.
    }
  },
  retryLoadData: async () => {
    set({ dataLoaded: false, error: null });
    await get().loadData();
  },
```

- [ ] **Step 4: Make scene caching validate responses and reset on retry**

In `next-src/src/lib/tools-data.ts`, replace `getScenesData` and add the cache reset:

```ts
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
```

- [ ] **Step 5: Add the canonical scene-data hook**

Create `next-src/src/hooks/useSceneData.ts`:

```ts
'use client';

import { useCallback, useEffect, useState } from 'react';
import { clearScenesDataCache, getScenesData } from '@/lib/tools-data';
import type { Scene } from '@/types/tool';

export function useSceneData() {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    clearScenesDataCache();
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);
    getScenesData()
      .then((data) => {
        if (!active) return;
        if (!Array.isArray(data.scenes)) throw new Error('Invalid scene payload');
        setScenes(data.scenes);
      })
      .catch(() => {
        if (active) setError('任务数据暂时无法加载');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  return { scenes, isLoading, error, retry };
}
```

- [ ] **Step 6: Run focused verification**

```bash
node --test next-src/tests/data-loading-contract.test.mjs
npm --prefix next-src run lint
npm --prefix next-src run build
git diff --check -- next-src/src/stores/useToolStore.ts next-src/src/lib/tools-data.ts next-src/src/hooks/useSceneData.ts next-src/tests/data-loading-contract.test.mjs
```

Expected: contract tests, lint, and build PASS.

- [ ] **Step 7: Commit**

```bash
git add next-src/src/stores/useToolStore.ts next-src/src/lib/tools-data.ts next-src/src/hooks/useSceneData.ts next-src/tests/data-loading-contract.test.mjs
git commit -m "fix: expose retryable directory data loading"
```

---

### Task 4: Comparison Limit Contract

**Files:**
- Modify: `next-src/src/types/tool.ts`
- Create: `next-src/src/lib/compare-selection.mjs`
- Create: `next-src/src/lib/compare-selection.d.mts`
- Modify: `next-src/src/stores/useCompareStore.ts`
- Create: `next-src/tests/compare-selection.test.mjs`

**Interfaces:**
- Consumes: any `T extends { id: number }` selected item.
- Produces: `MAX_COMPARE_TOOLS: 4`; `tryAddCompareTool<T extends { id: number }>(selectedTools: T[], tool: T): { selectedTools: T[]; outcome: CompareAddOutcome }`; `getCompareAvailability<T extends { id: number }>(selectedTools: readonly T[], toolId: number): CompareAvailability`; and `useCompareStore.addTool(tool: Tool): CompareAddOutcome`.

- [ ] **Step 1: Write the failing comparison-state tests**

Create `next-src/tests/compare-selection.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';

const helperUrl = new URL('../src/lib/compare-selection.mjs', import.meta.url);

test('adds, deduplicates, and enforces the four-tool limit without copying on no-op', async () => {
  const { tryAddCompareTool } = await import(helperUrl);
  const initial = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
  const duplicate = tryAddCompareTool(initial, { id: 2 });
  assert.equal(duplicate.outcome, 'already-selected');
  assert.equal(duplicate.selectedTools, initial);
  const limited = tryAddCompareTool(initial, { id: 5 });
  assert.equal(limited.outcome, 'limit-reached');
  assert.equal(limited.selectedTools, initial);
  const added = tryAddCompareTool(initial.slice(0, 3), { id: 5 });
  assert.equal(added.outcome, 'added');
  assert.deepEqual(added.selectedTools.map((tool) => tool.id), [1, 2, 3, 5]);
});

test('availability keeps selected tools removable at capacity', async () => {
  const { getCompareAvailability } = await import(helperUrl);
  const selected = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
  assert.equal(getCompareAvailability(selected, 1), 'selected');
  assert.equal(getCompareAvailability(selected, 5), 'limit-reached');
});
```

- [ ] **Step 2: Run the test and verify RED**

```bash
node --test next-src/tests/compare-selection.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement the pure transition helper**

Create `next-src/src/lib/compare-selection.mjs`:

```js
export const MAX_COMPARE_TOOLS = 4;

export function tryAddCompareTool(selectedTools, tool) {
  if (selectedTools.some((selected) => selected.id === tool.id)) {
    return { selectedTools, outcome: 'already-selected' };
  }
  if (selectedTools.length >= MAX_COMPARE_TOOLS) {
    return { selectedTools, outcome: 'limit-reached' };
  }
  return { selectedTools: [...selectedTools, tool], outcome: 'added' };
}

export function getCompareAvailability(selectedTools, toolId) {
  if (selectedTools.some((tool) => tool.id === toolId)) return 'selected';
  return selectedTools.length >= MAX_COMPARE_TOOLS ? 'limit-reached' : 'available';
}
```

- [ ] **Step 4: Add exact comparison result types and the JavaScript declaration boundary**

Append to `next-src/src/types/tool.ts`:

```ts
export type CompareAddOutcome = 'added' | 'already-selected' | 'limit-reached';
export type CompareAvailability = 'selected' | 'limit-reached' | 'available';
```

Create `next-src/src/lib/compare-selection.d.mts`:

```ts
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
```

- [ ] **Step 5: Make the Zustand store return outcomes**

In `next-src/src/stores/useCompareStore.ts`, define:

```ts
import { tryAddCompareTool } from '@/lib/compare-selection.mjs';
import type { CompareAddOutcome, Tool } from '@/types/tool';

interface CompareStore {
  selectedTools: Tool[];
  addTool: (tool: Tool) => CompareAddOutcome;
  removeTool: (toolId: number) => void;
  clearAll: () => void;
  isSelected: (toolId: number) => boolean;
}
```

Replace `addTool` with:

```ts
  addTool: (tool) => {
    const result = tryAddCompareTool(get().selectedTools, tool);
    if (result.outcome === 'added') set({ selectedTools: result.selectedTools as Tool[] });
    return result.outcome;
  },
```

- [ ] **Step 6: Run focused verification**

```bash
node --test next-src/tests/compare-selection.test.mjs
npm --prefix next-src run lint
git diff --check -- next-src/src/types/tool.ts next-src/src/lib/compare-selection.mjs next-src/src/lib/compare-selection.d.mts next-src/src/stores/useCompareStore.ts next-src/tests/compare-selection.test.mjs
```

Expected: tests and lint PASS, and no whitespace errors are reported.

- [ ] **Step 7: Commit**

```bash
git add next-src/src/types/tool.ts next-src/src/lib/compare-selection.mjs next-src/src/lib/compare-selection.d.mts next-src/src/stores/useCompareStore.ts next-src/tests/compare-selection.test.mjs
git commit -m "feat: expose accessible comparison limits"
```

Expected: the commit contains only comparison-state files.

---

### Task 5: Shared Decision Row and List

**Files:**
- Create: `next-src/src/components/tools/ToolDecisionRow.tsx`
- Create: `next-src/src/components/tools/ToolDecisionList.tsx`
- Create: `next-src/tests/task-first-ui-contract.test.mjs`

**Interfaces:**
- Consumes: `ToolDecisionModel`, `ToolDecisionGroup[]`, `buildToolDetailHref(slug: string, from?: string | null): string`, `getCompareAvailability<T>(selectedTools, toolId): CompareAvailability`, and `useCompareStore.addTool(tool: Tool): CompareAddOutcome`.
- Produces: `ToolDecisionRow(props: ToolDecisionRowProps): JSX.Element` where `ToolDecisionRowProps = { model: ToolDecisionModel; detailHref: string; variant?: 'matrix' | 'compact'; selected: boolean; compareDisabled: boolean; showCompare?: boolean; onCompareToggle: () => void; onCompareLimit: () => void }`; and `ToolDecisionList(props: ToolDecisionListProps): JSX.Element` where `ToolDecisionListProps = { groups: ToolDecisionGroup[]; returnPath?: string; variant?: 'matrix' | 'compact'; isLoading?: boolean; error?: string | null; onRetry?: () => void; onClear?: () => void; showCompare?: boolean; emptyState?: ReactNode }`.

- [ ] **Step 1: Write the failing component-boundary contract**

Create `next-src/tests/task-first-ui-contract.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('decision rows preserve the approved field and accessibility contract', () => {
  const row = read('src/components/tools/ToolDecisionRow.tsx');
  assert.match(row, /data-field="tool"/);
  assert.match(row, /data-field="task"/);
  assert.match(row, /data-field="capabilities"/);
  assert.match(row, /data-field="price"/);
  assert.match(row, /aria-disabled=/);
  assert.match(row, /对比.*model\.tool\.name/);
  assert.match(row, /className=\{cn\('flex h-11 w-11/);
  assert.match(row, /additionalTaskCount/);
});

test('the decision list owns loading, retry, empty, and live limit feedback', () => {
  const list = read('src/components/tools/ToolDecisionList.tsx');
  assert.match(list, /role="status"/);
  assert.match(list, /aria-live="polite"/);
  assert.match(list, /清除筛选/);
  assert.match(list, /重新加载/);
  assert.doesNotMatch(list, /ToolCard/);
});

test('superseded components still exist until their route replacement tasks', () => {
  assert.equal(existsSync(new URL('../src/components/tools/ToolGrid.tsx', import.meta.url)), true);
});
```

- [ ] **Step 2: Run the contract and verify RED**

```bash
node --test next-src/tests/task-first-ui-contract.test.mjs
```

Expected: FAIL because the new components do not exist.

- [ ] **Step 3: Implement the controlled decision row**

Create `next-src/src/components/tools/ToolDecisionRow.tsx` with this public structure:

```tsx
'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { ToolIcon } from '@/lib/icon-map';
import { cn } from '@/lib/utils';
import type { ToolDecisionModel } from '@/types/tool';

interface ToolDecisionRowProps {
  model: ToolDecisionModel;
  detailHref: string;
  variant?: 'matrix' | 'compact';
  selected: boolean;
  compareDisabled: boolean;
  showCompare?: boolean;
  onCompareToggle: () => void;
  onCompareLimit: () => void;
}

const originLabels = { domestic: '国产', overseas: '海外' } as const;

export function ToolDecisionRow({
  model,
  detailHref,
  variant = 'matrix',
  selected,
  compareDisabled,
  showCompare = true,
  onCompareToggle,
  onCompareLimit,
}: ToolDecisionRowProps) {
  const task = model.taskCell?.primary || model.tasks[0];
  const relation = model.taskCell?.relation === 'task-match' ? '任务映射' : '同类工具';
  const additionalTaskCount = model.taskCell?.additionalExplicitCount ?? Math.max(0, model.tasks.length - 1);
  const handleCompare = () => {
    if (compareDisabled && !selected) {
      onCompareLimit();
      return;
    }
    onCompareToggle();
  };

  return (
    <li
      data-tool-decision-row
      className={cn(
        'grid min-w-0 items-center gap-3 border-b border-[var(--line)] bg-[var(--surface)] px-3 py-3',
        variant === 'matrix'
          ? 'grid-cols-[minmax(0,1fr)_44px] md:grid-cols-[44px_minmax(120px,.9fr)_minmax(110px,.75fr)_minmax(180px,1.25fr)_minmax(88px,.6fr)_44px] lg:grid-cols-[44px_minmax(150px,1fr)_minmax(130px,.85fr)_minmax(220px,1.35fr)_minmax(100px,.65fr)_44px]'
          : 'grid-cols-[minmax(0,1fr)_44px] rounded-md border'
      )}
    >
      {showCompare ? (
        <label className={cn('flex h-11 w-11 cursor-pointer items-center justify-center justify-self-center', variant === 'compact' ? 'col-start-2 row-start-1' : 'max-md:col-start-2 max-md:row-start-1')}>
          <input
            type="checkbox"
            checked={selected}
            aria-disabled={compareDisabled && !selected}
            aria-label={`${selected ? '取消对比' : '加入对比'} ${model.tool.name}`}
            onChange={handleCompare}
            className="h-4 w-4 accent-[var(--accent)]"
          />
        </label>
      ) : <span className={cn('h-11 w-11', variant === 'compact' ? 'col-start-2 row-start-1' : 'max-md:col-start-2 max-md:row-start-1')} aria-hidden="true" />}

      <div data-field="tool" className={cn('flex min-w-0 items-center gap-3', variant === 'compact' ? 'col-start-1 row-start-1' : 'max-md:col-start-1 max-md:row-start-1')}>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[var(--surface-subtle)] text-[var(--accent)]">
          <ToolIcon name={model.tool.icon} className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <strong className="block break-words text-sm leading-5 text-[var(--ink)]">{model.tool.name}</strong>
          <span className="block truncate text-xs text-[var(--muted-subtle)]">
            {[model.origin ? originLabels[model.origin] : null, ...model.platforms].filter(Boolean).join(' · ')}
          </span>
        </span>
      </div>

      <div data-field="task" className={cn('min-w-0', variant === 'compact' ? 'col-span-2' : 'max-md:col-span-2')}>
        <span className="block text-sm font-medium text-[var(--accent)]">{task?.label || '工具目录'}</span>
        <span className="text-xs text-[var(--muted-subtle)]">
          {model.taskCell ? relation : model.tasks[0]?.source === 'scene' ? '任务映射' : '同类工具'}
          {additionalTaskCount ? ` +${additionalTaskCount}` : ''}
        </span>
      </div>

      <div data-field="capabilities" className={cn('flex min-w-0 flex-wrap gap-1.5', variant === 'compact' ? 'col-span-2' : 'max-md:col-span-2')}>
        {model.capabilitySummary.map((capability) => (
          <span key={capability} className="rounded bg-[var(--surface-subtle)] px-2 py-1 text-xs text-[var(--muted)]">
            {capability}
          </span>
        ))}
      </div>

      <div data-field="price" className={cn('text-sm text-[var(--muted)]', variant === 'compact' ? 'col-span-1' : 'max-md:col-span-1')}>
        {model.price.summary || model.price.valueTag || '查看定价'}
      </div>

      <Link
        href={detailHref}
        prefetch={false}
        aria-label={`查看 ${model.tool.name} 详情`}
        className={cn('flex h-11 w-11 items-center justify-center rounded-md text-[var(--accent)] hover:bg-[var(--accent-soft)]', variant === 'compact' ? 'col-start-2' : 'max-md:col-start-2')}
      >
        <ChevronRight className="h-4 w-4" />
      </Link>
    </li>
  );
}
```

- [ ] **Step 4: Implement the store-connected list and stable states**

Create `next-src/src/components/tools/ToolDecisionList.tsx`:

```tsx
'use client';

import { useState, type ReactNode } from 'react';
import { getCompareAvailability } from '@/lib/compare-selection.mjs';
import { buildToolDetailHref } from '@/lib/tools-query-state.mjs';
import { getToolSlug } from '@/lib/tools-data';
import { useCompareStore } from '@/stores/useCompareStore';
import type { ToolDecisionGroup } from '@/types/tool';
import { ToolDecisionRow } from './ToolDecisionRow';

interface ToolDecisionListProps {
  groups: ToolDecisionGroup[];
  returnPath?: string;
  variant?: 'matrix' | 'compact';
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onClear?: () => void;
  showCompare?: boolean;
  emptyState?: ReactNode;
}

export function ToolDecisionList({
  groups,
  returnPath,
  variant = 'matrix',
  isLoading = false,
  error = null,
  onRetry,
  onClear,
  showCompare = true,
  emptyState,
}: ToolDecisionListProps) {
  const { selectedTools, addTool, removeTool } = useCompareStore();
  const [announcement, setAnnouncement] = useState('');
  const items = groups.flatMap((group) => group.items);

  if (isLoading) {
    return <div role="status" aria-label="正在加载工具" className="space-y-2">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-[88px] border-b border-[var(--line)] bg-[var(--surface)]" />)}</div>;
  }
  if (error) {
    return <div role="alert" className="border-l-4 border-[var(--danger)] bg-[var(--surface)] p-5"><p>{error}</p><button type="button" onClick={onRetry} className="mt-3 min-h-11 rounded-md border border-[var(--line)] px-4">重新加载</button></div>;
  }
  if (items.length === 0) {
    return emptyState || <div className="py-16 text-center"><p className="text-base font-medium">没有符合这些条件的工具</p><button type="button" onClick={onClear} className="mt-3 min-h-11 rounded-md border border-[var(--line)] px-4">清除筛选</button></div>;
  }

  return (
    <div>
      <p className="sr-only" aria-live="polite">{announcement}</p>
      {groups.map((group) => (
        <section key={group.id} className="mb-8" aria-labelledby={`group-${group.id}`}>
          {group.title ? <h2 id={`group-${group.id}`} className="mb-3 text-sm font-semibold text-[var(--ink)]">{group.title} <span className="font-normal text-[var(--muted)]">{group.items.length}</span></h2> : null}
          {group.items.length ? <ul className="overflow-hidden border-y border-[var(--line)]">
            {group.items.map((model) => {
              const availability = getCompareAvailability(selectedTools, model.tool.id);
              const selected = availability === 'selected';
              const detailPath = `/tools/${getToolSlug(model.tool)}`;
              return (
                <ToolDecisionRow
                  key={model.tool.id}
                  model={model}
                  variant={variant}
                  showCompare={showCompare}
                  selected={selected}
                  compareDisabled={availability === 'limit-reached'}
                  detailHref={returnPath ? buildToolDetailHref(getToolSlug(model.tool), returnPath) : detailPath}
                  onCompareToggle={() => selected ? removeTool(model.tool.id) : addTool(model.tool)}
                  onCompareLimit={() => setAnnouncement('最多比较 4 款工具，请先移除一款')}
                />
              );
            })}
          </ul> : group.title ? <p className="border-y border-[var(--line)] py-8 text-center text-sm text-[var(--muted)]">本组暂无符合条件的工具</p> : null}
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Run focused verification**

```bash
node --test next-src/tests/task-first-ui-contract.test.mjs next-src/tests/compare-selection.test.mjs
npm --prefix next-src run lint
npm --prefix next-src run build
git diff --check -- next-src/src/components/tools/ToolDecisionRow.tsx next-src/src/components/tools/ToolDecisionList.tsx next-src/tests/task-first-ui-contract.test.mjs
```

Expected: source contracts, comparison tests, lint, and build PASS; no whitespace errors are reported.

- [ ] **Step 6: Commit**

```bash
git add next-src/src/components/tools/ToolDecisionRow.tsx next-src/src/components/tools/ToolDecisionList.tsx next-src/tests/task-first-ui-contract.test.mjs
git commit -m "feat: add task-first decision rows"
```

Expected: the commit contains only the shared decision components and their contract test.

---

### Task 6: Task-First Homepage and Search Handoff

**Files:**
- Create: `next-src/src/components/home/TaskEntryList.tsx`
- Modify: `next-src/src/components/hero/SearchBar.tsx`
- Modify: `next-src/src/app/page.tsx`
- Delete: `next-src/src/components/hero/HeroSection.tsx`
- Delete: `next-src/src/components/scenes/SceneCard.tsx`
- Modify: `next-src/tests/editorial-ui-contract.test.mjs`
- Modify: `next-src/tests/task-first-ui-contract.test.mjs`

**Interfaces:**
- Consumes: `useSceneData(): { scenes: Scene[]; isLoading: boolean; error: string | null; retry: () => void }`, `useToolStore`, `createToolDecisionModel(...): ToolDecisionModel`, and `ToolDecisionList(props): JSX.Element`.
- Produces: `TaskEntryList(props: { scenes: Scene[] }): JSX.Element`; the Task 6 default `SearchBar(): JSX.Element` whose submit path is `/tools?q=<encoded query>`; and `Home(): JSX.Element` with a deterministic `{ id: 'weekly'; items: ToolDecisionModel[] }` group capped at six tools.

- [ ] **Step 1: Replace stale homepage assertions with failing task-first assertions**

Update the homepage test in `next-src/tests/editorial-ui-contract.test.mjs` to:

```js
test('puts canonical task entry before deterministic weekly decision rows', () => {
  const home = read('src/app/page.tsx');
  assert.match(home, /按任务找到合适的 AI 工具/);
  assert.match(home, /<TaskEntryList scenes=\{scenes\}/);
  assert.match(home, /id: 'weekly'/);
  assert.match(home, /<ToolDecisionList/);
  assert.doesNotMatch(home, /const scenes: Scene\[\]/);
  assert.doesNotMatch(home, /<ToolCard/);
  assert.doesNotMatch(home, /数据概览/);
  assert.ok(home.indexOf('<TaskEntryList') < home.indexOf('本周值得试'));
});
```

Append to `next-src/tests/task-first-ui-contract.test.mjs`:

```js
test('homepage tasks use canonical scene ids and search preserves the query', () => {
  const entries = read('src/components/home/TaskEntryList.tsx');
  const search = read('src/components/hero/SearchBar.tsx');
  assert.match(entries, /`\/tools\?scene=\$\{encodeURIComponent\(scene\.id\)\}`/);
  assert.match(search, /params\.set\('q', term\)/);
});
```

In the existing `uses flat comparison-oriented tool cards and tab-like filters` test, replace the two stale SearchBar assertions with:

```js
  assert.doesNotMatch(search, /usePathname/);
  assert.match(search, /params\.set\('q', term\)/);
```

- [ ] **Step 2: Run the UI contracts and verify RED**

```bash
node --test next-src/tests/editorial-ui-contract.test.mjs next-src/tests/task-first-ui-contract.test.mjs
```

Expected: FAIL on the hardcoded scene array and old `ToolCard` homepage.

- [ ] **Step 3: Add the canonical task-entry component**

Create `next-src/src/components/home/TaskEntryList.tsx`:

```tsx
import Link from 'next/link';
import { Bot, Code, Music, Palette, PenTool, Presentation, Search, Video, type LucideIcon } from 'lucide-react';
import type { Scene } from '@/types/tool';

const sceneIcons: Record<string, LucideIcon> = {
  presentation: Presentation,
  code: Code,
  video: Video,
  palette: Palette,
  'pen-tool': PenTool,
  music: Music,
  search: Search,
  bot: Bot,
};

export function TaskEntryList({ scenes }: { scenes: Scene[] }) {
  return (
    <div className="grid grid-cols-1 border-y border-[var(--line)] sm:grid-cols-2 lg:grid-cols-4">
      {scenes.map((scene) => {
        const Icon = sceneIcons[scene.icon] || Bot;
        return (
          <Link
            key={scene.id}
            href={`/tools?scene=${encodeURIComponent(scene.id)}`}
            className="group flex min-h-[104px] items-center gap-3 border-b border-[var(--line)] px-4 py-4 hover:bg-[var(--surface-subtle)] sm:border-r"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[var(--accent-soft)] text-[var(--accent)]"><Icon className="h-5 w-5" /></span>
            <span className="min-w-0"><strong className="block text-sm">{scene.name.replace(/^我要/, '')}</strong><span className="mt-1 block text-xs text-[var(--muted)]">{scene.description}</span></span>
          </Link>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Make SearchBar hand off an encoded query instead of store filter state**

In `SearchBar.tsx`, remove `usePathname`, `storedSearchTerm`, `setSearchTerm`, and the filter debounce. Initialize `value` to `''` and use these callbacks:

```tsx
  const openResultsPage = useCallback((term: string) => {
    const params = new URLSearchParams();
    if (term) params.set('q', term);
    router.push(`/tools${params.size ? `?${params.toString()}` : ''}`);
  }, [router]);

  const handleChange = useCallback((nextValue: string) => {
    setValue(nextValue);
  }, []);

  const submitTerm = useCallback((rawValue: string) => {
    const term = rawValue.trim();
    if (term) addSearchHistory(term);
    openResultsPage(term);
    inputRef.current?.blur();
  }, [addSearchHistory, openResultsPage]);

  const handleSubmit = useCallback(() => submitTerm(value), [submitTerm, value]);

  const handleClear = () => {
    setValue('');
    inputRef.current?.focus();
  };
```

Because Task 6 removes `debounceRef`, replace the keyboard-shortcut effect cleanup with:

```tsx
    return () => window.removeEventListener('keydown', handleShortcut);
```

Call `submitTerm(term)` from history items and `submitTerm(tool.name)` from suggestions. Directory truth now comes only from its URL.

- [ ] **Step 5: Recompose the homepage in the approved order**

In `next-src/src/app/page.tsx`, remove the `Link`, scene-icon, `Scene`, `SceneCard`, and `ToolCard` imports, then add:

```tsx
import { TaskEntryList } from '@/components/home/TaskEntryList';
import { ToolDecisionList } from '@/components/tools/ToolDecisionList';
import { useSceneData } from '@/hooks/useSceneData';
import { createToolDecisionModel } from '@/lib/tool-decision.mjs';
```

Inside `Home`, replace the current tool-store destructuring and curated-tools memo with:

```tsx
const {
  tools,
  categories,
  isLoading,
  error,
  loadData,
  retryLoadData,
  dataLoaded,
} = useToolStore();
const { scenes, isLoading: scenesLoading, error: scenesError, retry: retryScenes } = useSceneData();

const weeklyTools = useMemo(() => {
  const hot = tools.filter((tool) => tool.status === 'hot');
  const selected = [...hot];
  for (const tool of tools) {
    if (selected.length >= 6) break;
    if (!selected.some((candidate) => candidate.id === tool.id)) selected.push(tool);
  }
  return selected.slice(0, 6).map((tool) => createToolDecisionModel(tool, scenes, categories));
}, [categories, scenes, tools]);
```

Render sections in this exact order:

```tsx
<section className="border-b border-[var(--line)] bg-[var(--surface)]">
  <div className="mx-auto max-w-7xl px-4 py-9 sm:px-6 sm:py-12">
    <div className="max-w-3xl">
      <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">按任务找到合适的 AI 工具</h1>
      <p className="mt-3 text-[var(--muted)]">先确定任务，再比较能力、价格和使用条件</p>
      <div className="mt-6"><SearchBar /></div>
    </div>
  </div>
</section>
<section className="mx-auto max-w-7xl px-4 py-9 sm:px-6 sm:py-12">
  <h2 className="mb-5 text-xl font-semibold sm:text-2xl">你要完成什么？</h2>
  {scenesLoading ? <div role="status" className="h-52 border-y border-[var(--line)]" /> : null}
  {scenesError ? <div role="alert"><p>{scenesError}</p><button type="button" onClick={retryScenes}>重新加载</button></div> : null}
  {!scenesLoading && !scenesError ? <TaskEntryList scenes={scenes} /> : null}
</section>
<section className="border-y border-[var(--line)] bg-[var(--surface)]">
  <div className="mx-auto max-w-7xl px-4 py-9 sm:px-6 sm:py-12">
    <h2 className="mb-5 text-xl font-semibold sm:text-2xl">本周值得试</h2>
    <ToolDecisionList groups={[{ id: 'weekly', items: weeklyTools }]} variant="compact" isLoading={isLoading} error={error} onRetry={retryLoadData} />
  </div>
</section>
```

Delete `HeroSection.tsx` and `SceneCard.tsx` after imports are removed.

- [ ] **Step 6: Run focused verification**

```bash
node --test next-src/tests/editorial-ui-contract.test.mjs next-src/tests/task-first-ui-contract.test.mjs next-src/tests/task-decision.test.mjs
npm --prefix next-src run lint
npm --prefix next-src run build
git diff --check -- next-src/src/app/page.tsx next-src/src/components/home/TaskEntryList.tsx next-src/src/components/hero/SearchBar.tsx next-src/src/components/hero/HeroSection.tsx next-src/src/components/scenes/SceneCard.tsx next-src/tests/editorial-ui-contract.test.mjs next-src/tests/task-first-ui-contract.test.mjs
```

Expected: tests, lint, and build PASS; deleted components have no remaining import and no whitespace errors are reported.

- [ ] **Step 7: Commit**

```bash
git add next-src/src/app/page.tsx next-src/src/components/home/TaskEntryList.tsx next-src/src/components/hero/SearchBar.tsx next-src/src/components/hero/HeroSection.tsx next-src/src/components/scenes/SceneCard.tsx next-src/tests/editorial-ui-contract.test.mjs next-src/tests/task-first-ui-contract.test.mjs
git commit -m "feat: make homepage discovery task-first"
```

Expected: the commit contains the task-first homepage, search handoff, deleted superseded components, and updated contracts.

---

### Task 7: Controlled Directory Controls and Query Hook

**Files:**
- Create: `next-src/src/hooks/useToolDirectoryQuery.ts`
- Create: `next-src/src/components/tools/TaskContextBar.tsx`
- Create: `next-src/src/components/tools/FilterFields.tsx`
- Create: `next-src/src/components/tools/FilterRail.tsx`
- Create: `next-src/src/components/tools/MobileFilterDrawer.tsx`
- Modify: `next-src/src/components/hero/SearchBar.tsx`
- Modify: `next-src/tests/task-first-ui-contract.test.mjs`

**Interfaces:**
- Consumes: `DirectoryQueryCatalog`, `DirectoryQueryState`, `parseDirectoryQuery`, `patchDirectoryQuery`, `serializeDirectoryQuery`, Next `usePathname/useRouter/useSearchParams`, and `Scene[]`/`Category[]`/`PlatformValue[]` option data.
- Produces: `useToolDirectoryQuery(catalog: DirectoryQueryCatalog): { state: DirectoryQueryState; update: (patch: Partial<DirectoryQueryState>) => void; currentPath: string }`; `SearchBar(props?: { value?: string; onValueChange?: (value: string) => void; onSubmit?: (value: string) => void }): JSX.Element`; `FilterFields(props: { state: DirectoryQueryState; platformOptions: PlatformValue[]; radioGroupName: string; onPatch: (patch: Partial<DirectoryQueryState>) => void; onClear: () => void }): JSX.Element`; `FilterRail(props: FilterRailProps): JSX.Element`; `MobileFilterDrawer(props: MobileFilterDrawerProps): JSX.Element`; and `TaskContextBar(props: TaskContextBarProps): JSX.Element`.

- [ ] **Step 1: Add failing control and Suspense-boundary contracts**

Append to `next-src/tests/task-first-ui-contract.test.mjs`:

```js
test('directory controls are URL-driven and mobile filters use a dialog', () => {
  const hook = read('src/hooks/useToolDirectoryQuery.ts');
  const bar = read('src/components/tools/TaskContextBar.tsx');
  const rail = read('src/components/tools/FilterRail.tsx');
  const drawer = read('src/components/tools/MobileFilterDrawer.tsx');
  assert.match(hook, /useSearchParams/);
  assert.match(hook, /router\.replace/);
  assert.match(hook, /serializeDirectoryQuery/);
  assert.match(hook, /currentPath/);
  assert.match(bar, /categoryId/);
  assert.match(bar, /sceneId/);
  assert.match(drawer, /<dialog/);
  assert.match(drawer, /showModal\(\)/);
  assert.match(rail, /radioGroupName="price-desktop"/);
  assert.match(drawer, /radioGroupName="price-mobile"/);
});
```

- [ ] **Step 2: Run the contract and verify RED**

```bash
node --test next-src/tests/task-first-ui-contract.test.mjs
```

Expected: FAIL because the hook and controls do not exist.

- [ ] **Step 3: Add the URL-driven hook**

Create `next-src/src/hooks/useToolDirectoryQuery.ts`:

```ts
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
```

- [ ] **Step 4: Complete SearchBar's controlled URL-query behavior**

Add props, a local debounced draft, controlled synchronization, and the following final callbacks to `SearchBar.tsx`. The local draft keeps typing responsive; `onValueChange` and `onSubmit` remain the only directory-state writers:

```tsx
interface SearchBarProps {
  value?: string;
  onValueChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
}

export function SearchBar({ value: controlledValue, onValueChange, onSubmit }: SearchBarProps = {}) {
  const [value, setValue] = useState(controlledValue || '');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (controlledValue !== undefined) setValue(controlledValue);
  }, [controlledValue]);

  const handleChange = useCallback((nextValue: string) => {
    setValue(nextValue);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onValueChange?.(nextValue), 300);
  }, [onValueChange]);

  const submitTerm = useCallback((rawValue: string) => {
    const term = rawValue.trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setValue(term);
    if (term) addSearchHistory(term);
    if (onSubmit) onSubmit(term);
    else openResultsPage(term);
    inputRef.current?.blur();
  }, [addSearchHistory, onSubmit, openResultsPage]);

  const handleSubmit = useCallback(() => submitTerm(value), [submitTerm, value]);

  const handleClear = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setValue('');
    onValueChange?.('');
    inputRef.current?.focus();
  };
```

In the existing keyboard-shortcut effect, use this cleanup after reintroducing `debounceRef`:

```tsx
    return () => {
      window.removeEventListener('keydown', handleShortcut);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
```

Keep Task 6's history and suggestion handlers calling `submitTerm(term)` and `submitTerm(tool.name)` respectively. Do not call `router.push` directly from history or suggestion items.

- [ ] **Step 5: Implement the shared filter fields**

Create `FilterFields.tsx` as controlled radio/checkbox groups:

```tsx
'use client';

import type { DirectoryQueryState, OriginValue, PlatformValue, PriceFilterValue } from '@/types/tool';

interface FilterFieldsProps {
  state: DirectoryQueryState;
  platformOptions: PlatformValue[];
  radioGroupName: string;
  onPatch: (patch: Partial<DirectoryQueryState>) => void;
  onClear: () => void;
}

const prices: { value: PriceFilterValue | null; label: string }[] = [
  { value: null, label: '不限价格' },
  { value: 'free-tier', label: '有免费额度' },
  { value: 'fully-free', label: '完全免费' },
  { value: 'paid-only', label: '仅付费' },
];
const origins: { value: OriginValue; label: string }[] = [
  { value: 'domestic', label: '国产' },
  { value: 'overseas', label: '海外' },
];
const platformLabels: Record<PlatformValue, string> = {
  web: '网页版',
  local: '本地部署',
  cli: '命令行',
  desktop: '桌面端',
};

function toggleValue<T extends string>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export function FilterFields({ state, platformOptions, radioGroupName, onPatch, onClear }: FilterFieldsProps) {
  return (
    <div className="space-y-6">
      <fieldset><legend className="mb-2 text-sm font-semibold">价格</legend>{prices.map((option) => <label key={option.value || 'all'} className="flex min-h-11 items-center gap-2 text-sm"><input type="radio" name={radioGroupName} checked={state.price === option.value} onChange={() => onPatch({ price: option.value })} />{option.label}</label>)}</fieldset>
      <fieldset><legend className="mb-2 text-sm font-semibold">来源</legend>{origins.map((option) => <label key={option.value} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={state.origins.includes(option.value)} onChange={() => onPatch({ origins: toggleValue(state.origins, option.value) })} />{option.label}</label>)}</fieldset>
      {platformOptions.length ? <fieldset><legend className="mb-2 text-sm font-semibold">平台</legend>{platformOptions.map((value) => <label key={value} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={state.platforms.includes(value)} onChange={() => onPatch({ platforms: toggleValue(state.platforms, value) })} />{platformLabels[value]}</label>)}</fieldset> : null}
      <button type="button" onClick={onClear} className="min-h-11 w-full rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">清除筛选</button>
    </div>
  );
}
```

- [ ] **Step 6: Implement the desktop filter rail**

Create `FilterRail.tsx`:

```tsx
import { FilterFields } from './FilterFields';
import type { DirectoryQueryState, PlatformValue } from '@/types/tool';

interface FilterRailProps {
  state: DirectoryQueryState;
  platformOptions: PlatformValue[];
  onPatch: (patch: Partial<DirectoryQueryState>) => void;
  onClear: () => void;
}

export function FilterRail(props: FilterRailProps) {
  return <aside className="hidden border-r border-[var(--line)] pr-5 lg:block" aria-label="工具筛选"><FilterFields {...props} radioGroupName="price-desktop" /></aside>;
}
```

- [ ] **Step 7: Implement the mobile filter drawer**

Create `MobileFilterDrawer.tsx` using a native dialog and explicit ref initialization:

```tsx
'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { FilterFields } from './FilterFields';
import type { Category, DirectoryQueryState, PlatformValue } from '@/types/tool';

interface MobileFilterDrawerProps {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  state: DirectoryQueryState;
  platformOptions: PlatformValue[];
  onPatch: (patch: Partial<DirectoryQueryState>) => void;
  onClear: () => void;
}

export function MobileFilterDrawer(props: MobileFilterDrawerProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (props.open && !dialog.open) dialog.showModal();
    if (!props.open && dialog.open) dialog.close();
  }, [props.open]);
  return (
    <dialog ref={ref} onClose={props.onClose} className="m-0 ml-auto h-full max-h-none w-[min(360px,92vw)] border-l border-[var(--line)] bg-[var(--surface)] p-0 backdrop:bg-black/40 lg:hidden">
      <div className="flex h-16 items-center justify-between border-b border-[var(--line)] px-4"><h2 className="font-semibold">筛选工具</h2><button type="button" onClick={props.onClose} className="flex h-11 w-11 items-center justify-center" aria-label="关闭筛选"><X className="h-4 w-4" /></button></div>
      <div className="p-4">
        {!props.state.sceneId ? <label className="mb-6 block text-sm font-semibold">分类<select aria-label="选择分类" value={props.state.categoryId || ''} onChange={(event) => props.onPatch({ categoryId: event.target.value || null })} className="mt-2 min-h-11 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm font-normal text-[var(--ink)]"><option value="">全部分类</option>{props.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label> : null}
        <FilterFields state={props.state} platformOptions={props.platformOptions} radioGroupName="price-mobile" onPatch={props.onPatch} onClear={props.onClear} />
      </div>
    </dialog>
  );
}
```

- [ ] **Step 8: Implement the context bar**

Create `TaskContextBar.tsx`:

```tsx
'use client';

import { SlidersHorizontal } from 'lucide-react';
import { SearchBar } from '@/components/hero/SearchBar';
import type { Category, DirectoryQueryState, Scene, SortOption } from '@/types/tool';

interface TaskContextBarProps {
  state: DirectoryQueryState;
  scenes: Scene[];
  categories: Category[];
  resultCount: number;
  isLoading: boolean;
  activeFilterCount: number;
  onPatch: (patch: Partial<DirectoryQueryState>) => void;
  onOpenFilters: () => void;
}

const sorts: { value: SortOption; label: string }[] = [
  { value: 'default', label: '默认顺序' },
  { value: 'hot', label: '热门优先' },
  { value: 'popular', label: '热度优先' },
  { value: 'free-first', label: '免费优先' },
  { value: 'domestic', label: '国产优先' },
  { value: 'name-asc', label: '名称 A-Z' },
  { value: 'name-desc', label: '名称 Z-A' },
];

export function TaskContextBar({ state, scenes, categories, resultCount, isLoading, activeFilterCount, onPatch, onOpenFilters }: TaskContextBarProps) {
  return (
    <section aria-label="目录条件" className="border-y border-[var(--line)] bg-[var(--surface)] py-4">
      <SearchBar value={state.searchTerm} onValueChange={(searchTerm) => onPatch({ searchTerm })} onSubmit={(searchTerm) => onPatch({ searchTerm })} />
      <div className="mt-3 grid grid-cols-3 gap-2 lg:grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_minmax(160px,.7fr)]">
        <label className="min-w-0 text-xs text-[var(--muted)]">任务<select aria-label="选择任务" value={state.sceneId || ''} onChange={(event) => onPatch({ sceneId: event.target.value || null })} className="mt-1 min-h-11 w-full min-w-0 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-sm text-[var(--ink)] sm:px-3"><option value="">全部任务</option>{scenes.map((scene) => <option key={scene.id} value={scene.id}>{scene.name.replace(/^我要/, '')}</option>)}</select></label>
        <div className="min-w-0">
          {!state.sceneId ? <label className="hidden min-w-0 text-xs text-[var(--muted)] lg:block">分类<select aria-label="选择分类" value={state.categoryId || ''} onChange={(event) => onPatch({ categoryId: event.target.value || null })} className="mt-1 min-h-11 w-full min-w-0 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--ink)]"><option value="">全部分类</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label> : <div className="hidden lg:block" aria-hidden="true" />}
          <span className="block text-xs text-[var(--muted)] lg:hidden">筛选</span>
          <button type="button" onClick={onOpenFilters} className="mt-1 inline-flex min-h-11 w-full min-w-0 items-center justify-center gap-1 rounded-md border border-[var(--line)] px-2 text-sm lg:hidden"><SlidersHorizontal className="h-4 w-4 shrink-0" /><span className="truncate">筛选{activeFilterCount ? ` ${activeFilterCount}` : ''}</span></button>
        </div>
        <label className="min-w-0 text-xs text-[var(--muted)]">排序<select aria-label="工具排序" value={state.sort} onChange={(event) => onPatch({ sort: event.target.value as SortOption })} className="mt-1 min-h-11 w-full min-w-0 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-sm text-[var(--ink)] sm:px-3">{sorts.map((sort) => <option key={sort.value} value={sort.value}>{sort.label}</option>)}</select></label>
      </div>
      <p role="status" className="mt-3 flex min-h-11 items-center text-sm text-[var(--muted)]">{isLoading ? '正在加载' : `${resultCount} 款工具`}</p>
    </section>
  );
}
```

- [ ] **Step 9: Run focused verification**

```bash
node --test next-src/tests/task-first-ui-contract.test.mjs next-src/tests/tools-query-state.test.mjs
npm --prefix next-src run lint
npm --prefix next-src run build
git diff --check -- next-src/src/hooks/useToolDirectoryQuery.ts next-src/src/components/tools/TaskContextBar.tsx next-src/src/components/tools/FilterFields.tsx next-src/src/components/tools/FilterRail.tsx next-src/src/components/tools/MobileFilterDrawer.tsx next-src/src/components/hero/SearchBar.tsx next-src/tests/task-first-ui-contract.test.mjs
```

Expected: query tests, UI contract, lint, and build PASS; no whitespace errors are reported.

- [ ] **Step 10: Commit**

```bash
git add next-src/src/hooks/useToolDirectoryQuery.ts next-src/src/components/tools/TaskContextBar.tsx next-src/src/components/tools/FilterFields.tsx next-src/src/components/tools/FilterRail.tsx next-src/src/components/tools/MobileFilterDrawer.tsx next-src/src/components/hero/SearchBar.tsx next-src/tests/task-first-ui-contract.test.mjs
git commit -m "feat: add URL-driven directory controls"
```

Expected: the commit contains the URL query hook, shared controls, drawer, and updated search contract.

---

### Task 8: Suspense-Safe Tool Directory Page

**Files:**
- Modify: `next-src/src/app/tools/page.tsx`
- Create: `next-src/src/components/tools/ToolsBrowseClient.tsx`
- Create: `next-src/src/components/tools/ToolsPageSkeleton.tsx`
- Delete: `next-src/src/components/tools/CategoryFilter.tsx`
- Delete: `next-src/src/components/tools/SortBar.tsx`
- Delete: `next-src/src/components/tools/ToolGrid.tsx`
- Modify: `next-src/tests/editorial-ui-contract.test.mjs`
- Modify: `next-src/tests/task-first-ui-contract.test.mjs`

**Interfaces:**
- Consumes: `selectDirectoryGroups(...): ToolDecisionGroup[]`, `deriveAvailablePlatforms(tools): PlatformValue[]`, `useToolDirectoryQuery(catalog)`, `useSceneData()`, `useToolStore`, and the controlled Task 5/7 components.
- Produces: `ToolsPageSkeleton(): JSX.Element`; `ToolsBrowseClient(): JSX.Element`; and `ToolsBrowsePage(): JSX.Element`, a Server Component that renders `<Suspense fallback={<ToolsPageSkeleton />}><ToolsBrowseClient /></Suspense>`.

- [ ] **Step 1: Add failing route-level contracts**

Append to `task-first-ui-contract.test.mjs`:

```js
test('tools route wraps search-param client logic in Suspense', () => {
  const page = read('src/app/tools/page.tsx');
  const client = read('src/components/tools/ToolsBrowseClient.tsx');
  assert.match(page, /<Suspense fallback=\{<ToolsPageSkeleton/);
  assert.match(page, /<ToolsBrowseClient/);
  assert.match(client, /selectDirectoryGroups/);
  assert.match(client, /useToolDirectoryQuery/);
  assert.doesNotMatch(client, /filteredTools|selectedCategory|setSort|setSearchTerm/);
});
```

Replace the Task 5 `superseded components still exist until their route replacement tasks` test with:

```js
test('superseded directory components are removed with the route replacement', () => {
  for (const relativePath of [
    '../src/components/tools/CategoryFilter.tsx',
    '../src/components/tools/SortBar.tsx',
    '../src/components/tools/ToolGrid.tsx',
  ]) {
    assert.equal(existsSync(new URL(relativePath, import.meta.url)), false, relativePath);
  }
});
```

Replace the stale `uses flat comparison-oriented tool cards and tab-like filters` test in `editorial-ui-contract.test.mjs` with:

```js
test('uses aligned decision rows and quiet URL-driven controls', () => {
  const row = read('src/components/tools/ToolDecisionRow.tsx');
  const context = read('src/components/tools/TaskContextBar.tsx');
  const filters = read('src/components/tools/FilterFields.tsx');
  const search = read('src/components/hero/SearchBar.tsx');

  assert.doesNotMatch(row, /rotateX|scan_2s|backdrop-blur|bg-gradient|rounded-2xl/);
  assert.match(row, /data-field="tool"/);
  assert.match(row, /data-field="task"/);
  assert.match(row, /data-field="capabilities"/);
  assert.match(row, /data-field="price"/);
  assert.match(context, /sceneId/);
  assert.match(context, /categoryId/);
  assert.match(filters, /<fieldset/);
  assert.doesNotMatch(context, /rounded-full|bg-gradient/);
  assert.doesNotMatch(search, /backdrop-blur|rounded-2xl|shadow-\[0_0/);
  assert.match(search, /params\.set\('q', term\)/);
});
```

- [ ] **Step 2: Run the route contracts and verify RED**

```bash
node --test next-src/tests/editorial-ui-contract.test.mjs next-src/tests/task-first-ui-contract.test.mjs
```

Expected: FAIL because the client controller and Suspense shell do not exist.

- [ ] **Step 3: Create the stable route fallback**

Create `ToolsPageSkeleton.tsx`:

```tsx
export function ToolsPageSkeleton() {
  return (
    <main className="mx-auto max-w-7xl px-4 pb-32 pt-10 sm:px-6">
      <div className="h-9 w-48 bg-[var(--surface-subtle)]" />
      <div className="mt-6 h-14 border border-[var(--line)] bg-[var(--surface)]" />
      <div className="mt-8 space-y-2" role="status" aria-label="正在加载工具目录">
        {Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-[88px] border-b border-[var(--line)] bg-[var(--surface)]" />)}
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Build the client controller**

Create `ToolsBrowseClient.tsx`. Its main derivation must be:

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { deriveAvailablePlatforms } from '@/lib/tool-decision.mjs';
import { selectDirectoryGroups } from '@/lib/tools-query-state.mjs';
import { useToolDirectoryQuery } from '@/hooks/useToolDirectoryQuery';
import { useSceneData } from '@/hooks/useSceneData';
import { useToolStore } from '@/stores/useToolStore';
import { FilterRail } from './FilterRail';
import { MobileFilterDrawer } from './MobileFilterDrawer';
import { TaskContextBar } from './TaskContextBar';
import { ToolDecisionList } from './ToolDecisionList';

export function ToolsBrowseClient() {
  const { tools, categories, clickStats, isLoading, error, dataLoaded, loadData, retryLoadData } = useToolStore();
  const { scenes, isLoading: scenesLoading, error: scenesError, retry: retryScenes } = useSceneData();
  const [filtersOpen, setFiltersOpen] = useState(false);
  useEffect(() => { if (!dataLoaded) loadData(); }, [dataLoaded, loadData]);
  const platforms = useMemo(() => deriveAvailablePlatforms(tools), [tools]);
  const catalog = useMemo(() => ({
    sceneIds: new Set(scenes.map((scene) => scene.id)),
    categoryIds: new Set(categories.map((category) => category.id)),
    platforms: new Set(platforms),
  }), [categories, platforms, scenes]);
  const { state, update, currentPath } = useToolDirectoryQuery(catalog);
  const groups = useMemo(
    () => selectDirectoryGroups(tools, scenes, categories, state, clickStats),
    [categories, clickStats, scenes, state, tools]
  );
  const resultCount = groups.reduce((total, group) => total + group.items.length, 0);
  const activeFilterCount = Number(Boolean(state.categoryId)) + Number(Boolean(state.price)) + state.origins.length + state.platforms.length;
  const clearSecondary = () => update({ categoryId: null, price: null, origins: [], platforms: [] });
  const retry = () => { retryLoadData(); retryScenes(); };

  return (
    <main className="mx-auto max-w-7xl px-4 pb-36 pt-10 text-[var(--ink)] sm:px-6 sm:pb-24">
      <header><h1 className="text-2xl font-semibold sm:text-3xl">工具目录</h1><p className="mt-2 text-sm text-[var(--muted)]">按任务、能力和使用条件比较工具</p></header>
      <div className="mt-6"><TaskContextBar state={state} scenes={scenes} categories={categories} resultCount={resultCount} isLoading={isLoading || scenesLoading} activeFilterCount={activeFilterCount} onPatch={update} onOpenFilters={() => setFiltersOpen(true)} /></div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <FilterRail state={state} platformOptions={platforms} onPatch={update} onClear={clearSecondary} />
        <ToolDecisionList groups={groups} returnPath={currentPath} isLoading={isLoading || scenesLoading} error={error || scenesError} onRetry={retry} onClear={clearSecondary} />
      </div>
      <MobileFilterDrawer open={filtersOpen} onClose={() => setFiltersOpen(false)} categories={categories} state={state} platformOptions={platforms} onPatch={update} onClear={clearSecondary} />
    </main>
  );
}
```

- [ ] **Step 5: Replace the route with a Server Component Suspense shell**

Replace `next-src/src/app/tools/page.tsx`:

```tsx
import { Suspense } from 'react';
import { ToolsBrowseClient } from '@/components/tools/ToolsBrowseClient';
import { ToolsPageSkeleton } from '@/components/tools/ToolsPageSkeleton';

export default function ToolsBrowsePage() {
  return (
    <Suspense fallback={<ToolsPageSkeleton />}>
      <ToolsBrowseClient />
    </Suspense>
  );
}
```

Delete `CategoryFilter.tsx`, `SortBar.tsx`, and `ToolGrid.tsx` after `rg` confirms no remaining imports.

- [ ] **Step 6: Run focused verification**

```bash
node --test next-src/tests/tools-query-state.test.mjs next-src/tests/task-first-ui-contract.test.mjs next-src/tests/editorial-ui-contract.test.mjs
npm --prefix next-src run lint
npm --prefix next-src run build
if rg -n "CategoryFilter|SortBar|ToolGrid" next-src/src; then
  echo "obsolete directory component import remains" >&2
  exit 1
fi
git diff --check -- next-src/src/app/tools/page.tsx next-src/src/components/tools next-src/tests/editorial-ui-contract.test.mjs next-src/tests/task-first-ui-contract.test.mjs
```

Expected: tests, lint, build, the obsolete-import guard, and whitespace check all exit 0.

- [ ] **Step 7: Commit**

```bash
git add next-src/src/app/tools/page.tsx next-src/src/components/tools/ToolsBrowseClient.tsx next-src/src/components/tools/ToolsPageSkeleton.tsx next-src/src/components/tools/CategoryFilter.tsx next-src/src/components/tools/SortBar.tsx next-src/src/components/tools/ToolGrid.tsx next-src/tests/editorial-ui-contract.test.mjs next-src/tests/task-first-ui-contract.test.mjs
git commit -m "feat: replace tool cards with a decision matrix"
```

Expected: the commit contains the Suspense shell, client controller, stable skeleton, component deletions, and updated contracts.

---

### Task 9: Single Compare Tray and Mobile Navigation Geometry

**Files:**
- Create: `next-src/src/components/compare/CompareTray.tsx`
- Delete: `next-src/src/components/compare/CompareBar.tsx`
- Modify: `next-src/src/app/layout.tsx`
- Modify: `next-src/src/components/layout/PageShell.tsx`
- Modify: `next-src/src/components/layout/BottomNav.tsx`
- Modify: `next-src/src/components/tools/ToolCard.tsx`
- Modify: `next-src/src/app/compare/page.tsx`
- Modify: `next-src/src/types/tool.ts`
- Modify: `next-src/src/app/globals.css`
- Modify: `next-src/tests/task-first-ui-contract.test.mjs`

**Interfaces:**
- Consumes: `useCompareStore(): CompareStore`, `usePathname(): string`, `useRouter().push('/compare')`, the existing `ToolCard(props: { tool: Tool }): JSX.Element`, and Task 4 `CompareAddOutcome`.
- Produces: `CompareTray(): JSX.Element | null`; `BottomNav(): JSX.Element` whose active predicate is exact-root or nested-prefix; `PageShell(props: { children: ReactNode; showNavbar?: boolean; showFooter?: boolean }): JSX.Element`; canonical `tool.platform` reads in `ToolCard` and `/compare`; and fixed CSS dimensions `--mobile-nav-height: 64px`, `--compare-tray-height: 72px`.

- [ ] **Step 1: Add failing tray and navigation contracts**

Append to `next-src/tests/task-first-ui-contract.test.mjs`:

```js
test('root layout mounts one compare tray and no alternate shell duplicates it', () => {
  const layout = read('src/app/layout.tsx');
  const shell = read('src/components/layout/PageShell.tsx');
  const tray = read('src/components/compare/CompareTray.tsx');
  assert.equal((layout.match(/<CompareTray/g) || []).length, 1);
  assert.doesNotMatch(shell, /CompareTray|CompareBar/);
  assert.match(tray, /pathname === '\/compare'/);
  assert.match(tray, /data-compare-tray/);
  assert.match(tray, /mobile-nav-height/);
});

test('mobile navigation recognizes nested tool routes', () => {
  const nav = read('src/components/layout/BottomNav.tsx');
  assert.match(nav, /pathname\.startsWith\(`\$\{item\.href\}\/`\)/);
});

test('legacy tool surfaces use canonical platform and accessible compare limits', () => {
  const card = read('src/components/tools/ToolCard.tsx');
  const compare = read('src/app/compare/page.tsx');
  assert.doesNotMatch(card, /tool\.platforms/);
  assert.doesNotMatch(compare, /tool\.platforms/);
  assert.match(card, /limit-reached/);
  assert.match(card, /aria-live="polite"/);
});
```

- [ ] **Step 2: Run the contract and verify RED**

```bash
node --test next-src/tests/task-first-ui-contract.test.mjs
```

Expected: FAIL because `CompareTray.tsx` does not exist and nested routes are not active.

- [ ] **Step 3: Define shared fixed-surface dimensions**

Add to `:root` in `next-src/src/app/globals.css`:

```css
  --mobile-nav-height: 64px;
  --compare-tray-height: 72px;
```

Keep these values in `.dark`; they are dimensions, not colors.

- [ ] **Step 4: Replace CompareBar with the single route-aware tray**

Create `next-src/src/components/compare/CompareTray.tsx`:

```tsx
'use client';

import { usePathname, useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { useCompareStore } from '@/stores/useCompareStore';

export default function CompareTray() {
  const pathname = usePathname();
  const router = useRouter();
  const { selectedTools, removeTool, clearAll } = useCompareStore();
  if (pathname === '/compare' || selectedTools.length < 2) return null;

  return (
    <>
      <div aria-hidden="true" className="h-[calc(var(--compare-tray-height)+var(--mobile-nav-height)+1px+env(safe-area-inset-bottom,0px))] md:h-[var(--compare-tray-height)]" />
      <aside
        data-compare-tray
        aria-label="已选工具对比"
        className="fixed inset-x-0 bottom-[calc(var(--mobile-nav-height)+1px+env(safe-area-inset-bottom,0px))] z-[90] h-[var(--compare-tray-height)] overflow-hidden border-t border-[var(--line)] bg-[var(--surface)] px-4 py-2 md:bottom-0 md:px-6"
      >
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <span className="text-sm font-medium text-[var(--ink)]">已选 {selectedTools.length}/4 款</span>
            <div className="mt-1 hidden gap-2 overflow-x-auto sm:flex">
              {selectedTools.map((tool) => (
                <span key={tool.id} className="inline-flex shrink-0 items-center gap-1 rounded border border-[var(--line)] px-2 py-1 text-xs">
                  {tool.name}<button type="button" onClick={() => removeTool(tool.id)} aria-label={`移除 ${tool.name}`} className="flex h-6 w-6 items-center justify-center"><X className="h-3 w-3" /></button>
                </span>
              ))}
            </div>
          </div>
          <button type="button" onClick={clearAll} className="hidden min-h-11 px-3 text-sm text-[var(--muted)] sm:block">清除</button>
          <button type="button" onClick={() => router.push('/compare')} className="min-h-11 rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-white">比较 {selectedTools.length} 款</button>
        </div>
      </aside>
    </>
  );
}
```

- [ ] **Step 5: Mount the single tray and remove the duplicate shell tray**

In root `layout.tsx`, replace the `CompareBar` import with:

```tsx
import CompareTray from '@/components/compare/CompareTray';
```

Replace `<CompareBar />` after `<Footer />` and before `<BottomNav />` with:

```tsx
<CompareTray />
```

Replace `next-src/src/components/layout/PageShell.tsx` with the tray-free shell:

```tsx
'use client';

import type { ReactNode } from 'react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

interface PageShellProps {
  children: ReactNode;
  showNavbar?: boolean;
  showFooter?: boolean;
}

export function PageShell({ children, showNavbar = true, showFooter = true }: PageShellProps) {
  return (
    <div className="min-h-screen bg-[var(--page)] text-[var(--ink)]">
      {showNavbar ? <Navbar /> : null}
      <ErrorBoundary>{children}</ErrorBoundary>
      {showFooter ? <Footer /> : null}
    </div>
  );
}
```

Delete `next-src/src/components/compare/CompareBar.tsx` after these replacements.

- [ ] **Step 6: Fix nested mobile navigation state**

In `BottomNav.tsx`, replace the exact-only active check with:

```tsx
const active = item.href === '/'
  ? pathname === '/'
  : pathname === item.href || pathname.startsWith(`${item.href}/`);
```

- [ ] **Step 7: Make legacy tool cards explain comparison limits**

In `ToolCard.tsx`, add the React import, replace the compare-store selection, and use the canonical platform:

```tsx
import { useState } from 'react';

const { selectedTools, addTool, removeTool, isSelected } = useCompareStore();
const [compareAnnouncement, setCompareAnnouncement] = useState('');
const compareSelected = isSelected(tool.id);
const compareDisabled = !compareSelected && selectedTools.length >= 4;
const platformLabel = tool.platform?.[0];
const handleCompare = () => {
  if (compareSelected) {
    removeTool(tool.id);
    setCompareAnnouncement('已移出比较');
    return;
  }
  const outcome = addTool(tool);
  setCompareAnnouncement(outcome === 'limit-reached' ? '最多比较 4 款工具，请先移除一款' : '已加入比较');
};
```

Replace the existing compare label with:

```tsx
<label className="flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 text-xs text-[var(--muted)]">
  <input
    type="checkbox"
    checked={compareSelected}
    aria-disabled={compareDisabled}
    aria-label={`${compareSelected ? '取消对比' : '加入对比'} ${tool.name}`}
    onChange={handleCompare}
    className="h-4 w-4 rounded border-[var(--line-strong)] accent-[var(--accent)]"
  />
  <span>对比</span>
</label>
<span className="sr-only" aria-live="polite">{compareAnnouncement}</span>
```

- [ ] **Step 8: Remove the final legacy platform-field reads**

In `app/compare/page.tsx`, replace `(tool.platform || tool.platforms || [])` with `(tool.platform || [])`. Do not change compare-page layout.

After both consumers use `tool.platform`, remove the absent `scenes?: string[]` and `platforms?: string[]` declarations from `Tool` in `next-src/src/types/tool.ts`.

- [ ] **Step 9: Run focused verification**

```bash
node --test next-src/tests/compare-selection.test.mjs next-src/tests/task-first-ui-contract.test.mjs next-src/tests/editorial-ui-contract.test.mjs
npm --prefix next-src run lint
npm --prefix next-src run build
if rg -n "tool\.(scenes|platforms)" next-src/src; then
  echo "legacy tool field read remains" >&2
  exit 1
fi
git diff --check -- next-src/src/components/compare/CompareTray.tsx next-src/src/components/compare/CompareBar.tsx next-src/src/components/layout/PageShell.tsx next-src/src/components/layout/BottomNav.tsx next-src/src/components/tools/ToolCard.tsx next-src/src/app/compare/page.tsx next-src/src/app/layout.tsx next-src/src/app/globals.css next-src/src/types/tool.ts next-src/tests/task-first-ui-contract.test.mjs
```

Expected: all commands exit 0.

- [ ] **Step 10: Commit**

```bash
git add next-src/src/components/compare/CompareTray.tsx next-src/src/components/compare/CompareBar.tsx next-src/src/components/layout/PageShell.tsx next-src/src/components/layout/BottomNav.tsx next-src/src/components/tools/ToolCard.tsx next-src/src/app/compare/page.tsx next-src/src/app/layout.tsx next-src/src/app/globals.css next-src/src/types/tool.ts next-src/tests/task-first-ui-contract.test.mjs
git commit -m "fix: keep compare tray clear of mobile navigation"
```

---

### Task 10: Evidence-First Tool Detail Page

**Files:**
- Modify: `next-src/src/lib/tool-decision.mjs`
- Modify: `next-src/src/lib/tool-decision.d.mts`
- Modify: `next-src/tests/task-decision.test.mjs`
- Create: `next-src/src/components/tools/ToolDecisionSummary.tsx`
- Create: `next-src/src/components/tools/ToolEvidenceSections.tsx`
- Create: `next-src/src/components/tools/ToolDetailClient.tsx`
- Modify: `next-src/src/app/tools/[slug]/page.tsx`
- Modify: `next-src/tests/task-first-ui-contract.test.mjs`

**Interfaces:**
- Consumes: `ToolDecisionModel`, `selectAlternativeTools(tool: Tool, tools: readonly Tool[], scenes: readonly Scene[], limit?: number): Tool[]`, `sanitizeToolsReturnPath(value?: string | null): string`, `RatingData`, tool/user/compare stores, ratings/tracking APIs, and compact `ToolDecisionList`.
- Produces: `ToolDecisionSummary(props: ToolDecisionSummaryProps): JSX.Element`; `ToolEvidenceSections(props: { model: ToolDecisionModel; currentRating: number; ratingData: RatingData }): JSX.Element`; `ToolDetailClient(props: { slug: string; from?: string }): JSX.Element`; and `ToolDetailPage(props: { params: Promise<{ slug: string }>; searchParams: Promise<{ from?: string | string[] }> }): Promise<JSX.Element>`.

- [ ] **Step 1: Add failing alternative and route-boundary tests**

Append to `next-src/tests/task-decision.test.mjs`:

```js
test('alternatives prioritize shared explicit tasks then category fallback', async () => {
  const { selectAlternativeTools } = await import(helperUrl);
  const alternatives = selectAlternativeTools(byId.get(71), toolsData.tools, sceneData.scenes, 6);
  assert.equal(alternatives.includes(byId.get(71)), false);
  assert.ok(alternatives.some((tool) => sceneData.scenes.find((scene) => scene.id === 'research').toolIds.includes(tool.id)));
});
```

Append to `task-first-ui-contract.test.mjs`:

```js
test('detail route resolves async params outside the client and uses decision evidence', () => {
  const page = read('src/app/tools/[slug]/page.tsx');
  const client = read('src/components/tools/ToolDetailClient.tsx');
  assert.match(page, /await params/);
  assert.match(page, /await searchParams/);
  assert.match(page, /<ToolDetailClient slug=\{slug\} from=\{from\}/);
  assert.match(client, /ToolDecisionSummary/);
  assert.match(client, /selectAlternativeTools/);
  assert.match(client, /variant="compact"/);
  assert.doesNotMatch(client, /<ToolCard/);
  assert.match(client, /lg:sticky lg:top-\[/);
  assert.match(client, /error.*retryLoadData/);
});
```

- [ ] **Step 2: Run tests and verify RED**

```bash
node --test next-src/tests/task-decision.test.mjs next-src/tests/task-first-ui-contract.test.mjs
```

Expected: FAIL because `selectAlternativeTools` and detail components do not exist.

- [ ] **Step 3: Add deterministic task-first alternatives**

Append to `tool-decision.mjs`:

```js
export function selectAlternativeTools(tool, tools, scenes, limit = 6) {
  const matchingScenes = scenes.filter((scene) => scene.toolIds.includes(tool.id));
  const explicitIds = new Set(matchingScenes.flatMap((scene) => scene.toolIds));
  const categories = new Set(tool.categories || [tool.category]);
  const explicit = tools.filter((candidate) => candidate.id !== tool.id && explicitIds.has(candidate.id));
  const related = tools.filter((candidate) =>
    candidate.id !== tool.id &&
    !explicitIds.has(candidate.id) &&
    (candidate.categories || [candidate.category]).some((id) => categories.has(id))
  );
  return [...explicit, ...related].slice(0, limit);
}
```

Append the corresponding declaration to `next-src/src/lib/tool-decision.d.mts`:

```ts
export function selectAlternativeTools(
  tool: Tool,
  tools: readonly Tool[],
  scenes: readonly Scene[],
  limit?: number
): Tool[];
```

- [ ] **Step 4: Create the controlled summary component**

Create `ToolDecisionSummary.tsx`:

```tsx
import { ExternalLink, Heart, Plus, X } from 'lucide-react';
import { ToolIcon } from '@/lib/icon-map';
import type { ToolDecisionModel } from '@/types/tool';

interface ToolDecisionSummaryProps {
  model: ToolDecisionModel;
  favorite: boolean;
  compared: boolean;
  compareDisabled: boolean;
  compareAnnouncement: string;
  onToggleFavorite: () => void;
  onToggleCompare: () => void;
  onVisit: () => void;
}

export function ToolDecisionSummary({
  model,
  favorite,
  compared,
  compareDisabled,
  compareAnnouncement,
  onToggleFavorite,
  onToggleCompare,
  onVisit,
}: ToolDecisionSummaryProps) {
  return (
    <section className="mt-4 border-y border-[var(--line)] bg-[var(--surface)] py-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-subtle)] text-[var(--accent)]">
          <ToolIcon name={model.tool.icon} className="h-8 w-8" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-semibold sm:text-4xl">{model.tool.name}</h1>
          <p className="mt-2 max-w-3xl text-base text-[var(--muted)]">{model.tool.desc}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {model.tasks.map((task) => <span key={`${task.source}-${task.id}`} className="rounded border border-[var(--line)] px-2 py-1 text-xs text-[var(--muted)]">{task.label}</span>)}
          </div>
          {model.capabilities.length ? <div className="mt-3 flex flex-wrap gap-2">
            {model.capabilitySummary.map((capability) => <span key={capability} className="rounded bg-[var(--accent-soft)] px-2 py-1 text-xs text-[var(--accent)]">{capability}</span>)}
          </div> : null}
          <p className="mt-4 text-sm font-medium text-[var(--ink)]">{model.price.summary || model.price.valueTag || '查看官网定价'}</p>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        <a href={model.tool.url} target="_blank" rel="noopener noreferrer" onClick={onVisit} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-white">访问官网 <ExternalLink className="h-4 w-4" /></a>
        <button type="button" onClick={onToggleFavorite} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[var(--line)] px-4 text-sm"><Heart className={`h-4 w-4 ${favorite ? 'fill-current text-[var(--danger)]' : ''}`} />{favorite ? '已收藏' : '收藏'}</button>
        <button type="button" aria-disabled={compareDisabled && !compared} onClick={onToggleCompare} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[var(--line)] px-4 text-sm">{compared ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{compared ? '已加入比较' : '加入比较'}</button>
        <p className="sr-only" aria-live="polite">{compareAnnouncement}</p>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Extract the complete evidence sections**

Create `ToolEvidenceSections.tsx`:

```tsx
import { Calendar, Check, Star } from 'lucide-react';
import { RatingWidget } from '@/components/ratings/RatingWidget';
import { cn } from '@/lib/utils';
import type { ToolDecisionModel } from '@/types/tool';

export interface RatingData {
  avg_rating: number;
  rating_count: number;
  reviews: { score: number; tags: string[]; comment: string }[];
}

interface ToolEvidenceSectionsProps {
  model: ToolDecisionModel;
  currentRating: number;
  ratingData: RatingData;
}

export function ToolEvidenceSections({ model, currentRating, ratingData }: ToolEvidenceSectionsProps) {
  const tool = model.tool;
  return (
    <div className="space-y-10">
      {model.capabilities.length ? <section aria-labelledby="capabilities-title">
        <h2 id="capabilities-title" className="mb-4 text-lg font-semibold">核心能力</h2>
        <ul className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
          {model.capabilities.map((capability) => (
            <li key={capability} className="flex items-start gap-3 py-3 text-sm text-[var(--muted)]"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" />{capability}</li>
          ))}
        </ul>
      </section> : null}

      {tool.pricing?.length ? (
        <section aria-labelledby="pricing-title">
          <h2 id="pricing-title" className="mb-4 text-lg font-semibold">定价与限制</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {tool.pricing.map((plan) => (
              <article key={`${plan.plan}-${plan.price}`} className={cn('border border-[var(--line)] bg-[var(--surface)] p-4', plan.highlight && 'border-[var(--accent)]')}>
                <div className="flex items-start justify-between gap-3"><h3 className="font-semibold">{plan.plan}</h3>{plan.highlight ? <span className="rounded bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] text-[var(--accent)]">推荐</span> : null}</div>
                <p className="mt-2 text-xl font-semibold">{plan.price === 0 ? '免费' : `${plan.price} ${plan.unit}`}</p>
                <p className="mt-2 text-sm text-[var(--muted)]">{plan.quota}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="metadata-title">
        <h2 id="metadata-title" className="mb-4 text-lg font-semibold">使用信息</h2>
        <div className="flex flex-wrap gap-2">{[...tool.tags, ...(tool.toolTags || [])].map((tag, index) => <span key={`${tag}-${index}`} className="rounded border border-[var(--line)] px-2 py-1 text-xs text-[var(--muted)]">{tag}</span>)}</div>
        {tool.updateTime ? <p className="mt-4 flex items-center gap-2 text-xs text-[var(--muted-subtle)]"><Calendar className="h-3.5 w-3.5" />更新于 {tool.updateTime}</p> : null}
      </section>

      <section aria-labelledby="rating-title">
        <h2 id="rating-title" className="mb-4 text-lg font-semibold">评价</h2>
        <RatingWidget toolId={tool.id} currentRating={currentRating} />
      </section>

      {ratingData.rating_count > 0 ? (
        <section aria-labelledby="reviews-title">
          <h2 id="reviews-title" className="mb-4 text-lg font-semibold">用户评价</h2>
          <div className="mb-4 flex items-center gap-3"><span className="text-3xl font-semibold">{ratingData.avg_rating.toFixed(1)}</span><span className="text-sm text-[var(--muted)]">{ratingData.rating_count} 条评价</span></div>
          <ul className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
            {ratingData.reviews.slice(0, 5).map((review, index) => (
              <li key={`${review.score}-${index}`} className="py-3">
                <div className="flex gap-0.5">{[1, 2, 3, 4, 5].map((score) => <Star key={score} className={cn('h-3.5 w-3.5', score <= review.score ? 'fill-amber-400 text-amber-400' : 'text-[var(--line-strong)]')} />)}</div>
                {review.tags.length ? <p className="mt-2 text-xs text-[var(--muted)]">{review.tags.join(' · ')}</p> : null}
                {review.comment ? <p className="mt-2 text-sm text-[var(--muted)]">{review.comment}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 6: Move interactive detail behavior into a client component**

Create `next-src/src/components/tools/ToolDetailClient.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { getRatings, trackClick } from '@/lib/api';
import { createToolDecisionModel, selectAlternativeTools } from '@/lib/tool-decision.mjs';
import { sanitizeToolsReturnPath } from '@/lib/tools-query-state.mjs';
import { getToolSlug } from '@/lib/tools-data';
import { useSceneData } from '@/hooks/useSceneData';
import { useCompareStore } from '@/stores/useCompareStore';
import { useToolStore } from '@/stores/useToolStore';
import { useUserStore } from '@/stores/useUserStore';
import { ToolDecisionList } from './ToolDecisionList';
import { ToolDecisionSummary } from './ToolDecisionSummary';
import { ToolEvidenceSections, type RatingData } from './ToolEvidenceSections';

interface ToolDetailClientProps {
  slug: string;
  from?: string;
}

const EMPTY_RATINGS: RatingData = { avg_rating: 0, rating_count: 0, reviews: [] };

export function ToolDetailClient({ slug, from }: ToolDetailClientProps) {
  const { tools, categories, isLoading, dataLoaded, loadData, error, retryLoadData } = useToolStore();
  const { scenes, isLoading: scenesLoading, error: scenesError, retry: retryScenes } = useSceneData();
  const { isFavorite, toggleFavorite, getRating } = useUserStore();
  const { selectedTools, addTool, removeTool } = useCompareStore();
  const [ratingData, setRatingData] = useState<RatingData>(EMPTY_RATINGS);
  const [announcement, setAnnouncement] = useState('');
  const returnPath = sanitizeToolsReturnPath(from);
  const tool = useMemo(
    () => tools.find((candidate) => getToolSlug(candidate) === slug) || null,
    [slug, tools]
  );
  const model = useMemo(
    () => tool ? createToolDecisionModel(tool, scenes, categories) : null,
    [categories, scenes, tool]
  );
  const alternatives = useMemo(
    () => tool
      ? selectAlternativeTools(tool, tools, scenes, 6)
        .map((candidate) => createToolDecisionModel(candidate, scenes, categories))
      : [],
    [categories, scenes, tool, tools]
  );

  useEffect(() => {
    if (!dataLoaded) loadData();
  }, [dataLoaded, loadData]);

  useEffect(() => {
    if (!tool) return;
    trackClick(tool.id, getToolSlug(tool), 'detail');
    getRatings(tool.id)
      .then((data) => setRatingData(data as RatingData))
      .catch(() => setRatingData(EMPTY_RATINGS));
  }, [tool]);

  if (isLoading || scenesLoading) {
    return <main className="flex min-h-[70vh] items-center justify-center text-sm text-[var(--muted)]">正在加载工具信息…</main>;
  }
  if (!tool && error) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-xl items-center px-4">
        <div role="alert" className="w-full border-l-4 border-[var(--danger)] bg-[var(--surface)] p-5">
          <h1 className="text-lg font-semibold">工具数据暂时无法加载</h1>
          <button type="button" onClick={retryLoadData} className="mt-4 min-h-11 rounded-md border border-[var(--line)] px-4 text-sm">重新加载</button>
        </div>
      </main>
    );
  }
  if (!tool || !model) {
    return <main className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-4 text-center"><h1 className="text-2xl font-semibold">工具未找到</h1><Link href={returnPath} className="min-h-11 rounded-md bg-[var(--accent)] px-5 py-3 text-sm text-white">返回工具目录</Link></main>;
  }

  const favorite = isFavorite(tool.id);
  const compared = selectedTools.some((selected) => selected.id === tool.id);
  const compareDisabled = !compared && selectedTools.length >= 4;
  const handleCompare = () => {
    if (compared) {
      removeTool(tool.id);
      setAnnouncement('已移出比较');
      return;
    }
    const outcome = addTool(tool);
    setAnnouncement(outcome === 'limit-reached' ? '最多比较 4 款工具，请先移除一款' : '已加入比较');
  };
  const handleFavorite = () => toggleFavorite(tool.id);
  const handleVisit = () => trackClick(tool.id, getToolSlug(tool), 'detail', 'primary-action');

  return (
    <main className="mx-auto max-w-6xl px-4 pb-32 pt-8 sm:px-6">
      <Link href={returnPath} className="inline-flex min-h-11 items-center gap-2 text-sm text-[var(--muted)]">返回工具目录</Link>
      {scenesError ? <div role="alert" className="mt-4 border-l-4 border-[var(--warning)] bg-[var(--surface)] p-4 text-sm"><p>{scenesError}，当前仅显示分类回退。</p><button type="button" onClick={retryScenes} className="mt-2 min-h-11 rounded-md border border-[var(--line)] px-3">重新加载任务</button></div> : null}
      <ToolDecisionSummary model={model} favorite={favorite} compared={compared} compareDisabled={compareDisabled} compareAnnouncement={announcement} onToggleFavorite={handleFavorite} onToggleCompare={handleCompare} onVisit={handleVisit} />
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div className="min-w-0">
          <ToolEvidenceSections model={model} currentRating={getRating(model.tool.id)} ratingData={ratingData} />
          {alternatives.length ? <section className="mt-12" aria-labelledby="alternatives-title"><h2 id="alternatives-title" className="mb-4 text-lg font-semibold">替代方案</h2><ToolDecisionList groups={[{ id: 'alternatives', items: alternatives }]} variant="compact" returnPath={returnPath} /></section> : null}
        </div>
        <aside className="h-fit border-l border-[var(--line)] pl-5 lg:sticky lg:top-[88px]">
          <h2 className="text-sm font-semibold">决策摘要</h2>
          <dl className="mt-3 space-y-3 text-sm"><div><dt>适用任务</dt><dd>{model.tasks.map((task) => task.label).join('、')}</dd></div><div><dt>价格</dt><dd>{model.price.summary || model.price.valueTag || '查看官网'}</dd></div></dl>
        </aside>
      </div>
    </main>
  );
}
```

- [ ] **Step 7: Make the route wrapper resolve Next.js 16 async request props**

Replace `app/tools/[slug]/page.tsx` with:

```tsx
import { ToolDetailClient } from '@/components/tools/ToolDetailClient';

interface ToolDetailPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ from?: string | string[] }>;
}

export default async function ToolDetailPage({ params, searchParams }: ToolDetailPageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const from = Array.isArray(query.from) ? query.from[0] : query.from;
  return <ToolDetailClient slug={slug} from={from} />;
}
```

- [ ] **Step 8: Run focused verification**

```bash
node --test next-src/tests/task-decision.test.mjs next-src/tests/tools-query-state.test.mjs next-src/tests/task-first-ui-contract.test.mjs next-src/tests/editorial-ui-contract.test.mjs
npm --prefix next-src run lint
npm --prefix next-src run build
git diff --check -- next-src/src/lib/tool-decision.mjs next-src/src/lib/tool-decision.d.mts next-src/tests/task-decision.test.mjs next-src/src/components/tools/ToolDecisionSummary.tsx next-src/src/components/tools/ToolEvidenceSections.tsx next-src/src/components/tools/ToolDetailClient.tsx 'next-src/src/app/tools/[slug]/page.tsx' next-src/tests/task-first-ui-contract.test.mjs
```

Expected: unit tests, contracts, lint, and build PASS.

- [ ] **Step 9: Commit**

```bash
git add next-src/src/lib/tool-decision.mjs next-src/src/lib/tool-decision.d.mts next-src/tests/task-decision.test.mjs next-src/src/components/tools/ToolDecisionSummary.tsx next-src/src/components/tools/ToolEvidenceSections.tsx next-src/src/components/tools/ToolDetailClient.tsx 'next-src/src/app/tools/[slug]/page.tsx' next-src/tests/task-first-ui-contract.test.mjs
git commit -m "feat: make tool details evidence-first"
```

---

### Task 11: Local Geist Typography

**Files:**
- Modify: `next-src/src/app/layout.tsx`
- Modify: `next-src/src/app/globals.css`
- Modify: `next-src/tests/editorial-ui-contract.test.mjs`

**Interfaces:**
- Consumes: `next/font/local`, `next-src/src/app/fonts/GeistVF.woff`, root layout, and the existing `--font` token.
- Produces: `geistSans.variable: string` bound to `--font-geist`, `<html className={geistSans.variable}>`, and `--font: var(--font-geist), Arial, 'PingFang SC', 'Microsoft YaHei', sans-serif`.

- [ ] **Step 1: Add the failing local-font contract**

In `editorial-ui-contract.test.mjs`, add:

```js
test('loads local Geist without changing the neutral token system', () => {
  const layout = read('src/app/layout.tsx');
  const css = read('src/app/globals.css');
  assert.match(layout, /localFont/);
  assert.match(layout, /GeistVF\.woff/);
  assert.match(layout, /className=\{geistSans\.variable\}/);
  assert.match(css, /--font: var\(--font-geist\)/);
  assert.match(css, /letter-spacing: 0/);
});
```

- [ ] **Step 2: Run the font contract and verify RED**

```bash
node --test next-src/tests/editorial-ui-contract.test.mjs
```

Expected: FAIL on the missing local Geist wiring.

- [ ] **Step 3: Wire the existing local Geist file**

In `layout.tsx`:

```tsx
import localFont from 'next/font/local';

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist',
  display: 'swap',
});
```

Apply `className={geistSans.variable}` to `<html>` and keep `<body className="min-h-screen">`. In `globals.css`, set:

```css
  --font: var(--font-geist), Arial, 'PingFang SC', 'Microsoft YaHei', sans-serif;
```

Do not change approved color tokens.

- [ ] **Step 4: Verify the font integration**

```bash
node --test next-src/tests/editorial-ui-contract.test.mjs
npm --prefix next-src run lint
npm --prefix next-src run build
git diff --check -- next-src/src/app/layout.tsx next-src/src/app/globals.css next-src/tests/editorial-ui-contract.test.mjs
```

Expected: contract, lint, build, and whitespace checks exit 0.

- [ ] **Step 5: Commit the typography integration**

```bash
git add next-src/src/app/layout.tsx next-src/src/app/globals.css next-src/tests/editorial-ui-contract.test.mjs
git commit -m "style: use local Geist typography"
```

---

### Task 12: Browser Guard and CI Enforcement

**Files:**
- Create: `scripts/task-first-ui-guard.mjs`
- Modify: `.github/workflows/deploy.yml`
- Modify: `scripts/review-regressions.mjs`

**Interfaces:**
- Consumes: `TASK_FIRST_UI_URL: string`, root Playwright `chromium`, the production Next server, and the complete task-first UI.
- Produces: `scripts/task-first-ui-guard.mjs` that exits 0 and prints `task-first UI guard passed` only after workflow, URL, responsive, accessibility, error, and geometry checks; CI starts the app at `127.0.0.1:4181` and executes that guard.

- [ ] **Step 1: Add the failing CI wiring contract**

In `scripts/review-regressions.mjs`, append this entry to the existing `[pattern, message]` array that checks `workflowTestJob`:

```js
  [
    /TASK_FIRST_UI_URL=http:\/\/127\.0\.0\.1:4181 node scripts\/task-first-ui-guard\.mjs/,
    'CI must run the task-first Next.js browser guard',
  ],
```

- [ ] **Step 2: Run the CI contract and verify RED**

```bash
node scripts/review-regressions.mjs
```

Expected: FAIL with `CI must run the task-first Next.js browser guard`.

- [ ] **Step 3: Create the repeatable Playwright guard**

Create `scripts/task-first-ui-guard.mjs` using role/name selectors, URL restoration checks, and geometry checks:

```js
import { chromium } from 'playwright';

const baseUrl = process.env.TASK_FIRST_UI_URL || 'http://127.0.0.1:3101';
const failures = [];
const fail = (message) => failures.push(message);

async function assertNoOverflow(page, label) {
  const layout = await page.evaluate(() => ({
    viewportWidth: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  if (layout.scrollWidth > layout.viewportWidth) fail(`${label}: horizontal overflow ${layout.scrollWidth} > ${layout.viewportWidth}`);
}

async function assertTrayGeometry(page, label) {
  const geometry = await page.evaluate(() => {
    const trayElement = document.querySelector('[data-compare-tray]');
    const navElement = document.querySelector('nav[aria-label="移动端导航"]');
    if (!trayElement || !navElement || getComputedStyle(navElement).display === 'none') return null;
    const tray = trayElement.getBoundingClientRect();
    const nav = navElement.getBoundingClientRect();
    if (nav.height === 0) return null;
    return { trayBottom: Math.round(tray.bottom), navTop: Math.round(nav.top) };
  });
  if (geometry && geometry.trayBottom > geometry.navTop) fail(`${label}: compare tray overlaps mobile nav`);
}

async function runFlow(page) {
  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
  await page.getByRole('link', { name: /做调研/ }).click();
  await page.waitForURL(/\/tools\?scene=research/);
  const price = page.getByRole('radio', { name: '有免费额度' });
  await price.check();
  await page.waitForURL(/scene=research.*price=free-tier/);
  await page.reload({ waitUntil: 'networkidle' });
  if (!await price.isChecked()) fail('directory: price filter was not restored after refresh');
  const rows = page.locator('[data-tool-decision-row]');
  if (await rows.count() < 5) fail('directory: fewer than five decision rows');
  await rows.nth(0).getByRole('checkbox').check();
  await rows.nth(1).getByRole('checkbox').check();
  await page.getByRole('link', { name: /查看 .* 详情/ }).first().click();
  await page.goBack({ waitUntil: 'networkidle' });
  await page.waitForURL(/scene=research.*price=free-tier/);
  if (!await price.isChecked()) fail('directory: price filter was not restored by browser Back');
  if (await page.locator('[data-compare-tray]').count() !== 1) fail('directory: compare tray missing after browser Back');
  await page.getByRole('link', { name: /查看 .* 详情/ }).first().click();
  await page.getByRole('link', { name: /返回工具目录/ }).click();
  await page.waitForURL(/scene=research.*price=free-tier/);
  if (await page.locator('[data-compare-tray]').count() !== 1) fail('directory: compare tray missing after SPA detail return');
  await assertNoOverflow(page, 'desktop directory');
  await page.getByRole('button', { name: /比较 2 款/ }).click();
  await page.waitForURL(/\/compare/);
  if (await page.locator('[data-compare-tray]').count() !== 0) fail('compare: global tray must be hidden');
}

async function assertKeyboardAndTheme(page) {
  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
  const search = page.getByRole('combobox', { name: /搜索工具/ });
  await search.focus();
  await page.keyboard.press('Tab');
  const focusTag = await page.evaluate(() => document.activeElement?.tagName || '');
  if (!['A', 'BUTTON', 'INPUT', 'SELECT'].includes(focusTag)) fail(`keyboard: unexpected focus target ${focusTag}`);
  await page.getByRole('button', { name: '切换到暗色主题' }).click();
  if (!await page.locator('html.dark').count()) fail('theme: dark class was not applied');
  await page.getByRole('button', { name: '切换到亮色主题' }).click();
}

async function assertCompareLimit(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/tools?scene=research`, { waitUntil: 'networkidle' });
  const checks = page.locator('[data-tool-decision-row]').getByRole('checkbox');
  for (let index = 0; index < 4; index += 1) await checks.nth(index).check();
  await checks.nth(4).focus();
  await page.keyboard.press('Space');
  if (await checks.nth(4).isChecked()) fail('compare limit: fifth tool was selected');
  const announcement = page.locator('[aria-live="polite"]').filter({ hasText: '最多比较 4 款工具' });
  if (await announcement.count() === 0) fail('compare limit: aria-live explanation missing');
  await context.close();
}

async function assertDoubleFailure(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  let failRequests = true;
  await page.route('**/api/tools', (route) => failRequests ? route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }) : route.continue());
  await page.route('**/data/tools.json', (route) => failRequests ? route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }) : route.continue());
  await page.goto(`${baseUrl}/tools`, { waitUntil: 'networkidle' });
  const alert = page.getByRole('alert');
  if (await alert.count() === 0 || !String(await alert.textContent()).includes('工具数据暂时无法加载')) {
    fail('data failure: retryable inline error missing');
  }
  const retry = page.getByRole('button', { name: '重新加载' });
  if (await retry.count() === 0) fail('data failure: retry action missing');
  failRequests = false;
  await retry.click();
  await page.locator('[data-tool-decision-row]').first().waitFor();
  await context.close();
}

async function assertSceneRecovery(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  let failScene = true;
  await page.route('**/data/scenes.json', (route) => failScene ? route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }) : route.continue());
  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
  const alert = page.getByRole('alert').filter({ hasText: '任务数据暂时无法加载' });
  if (await alert.count() !== 1) fail('scene failure: retryable inline error missing');
  failScene = false;
  await alert.getByRole('button', { name: '重新加载' }).click();
  await page.getByRole('link', { name: /做调研/ }).waitFor();
  await context.close();
}

async function assertUrlStateAndEmptyHistory(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const stateUrl = `${baseUrl}/tools?scene=research&q=${encodeURIComponent('引用')}&price=free-tier&origin=overseas&platform=web&sort=name-asc`;
  await page.goto(stateUrl, { waitUntil: 'networkidle' });
  const search = page.getByRole('combobox', { name: /搜索工具/ });
  if (await search.inputValue() !== '引用') fail('URL state: search query was not restored');
  if (await page.getByRole('combobox', { name: '选择任务' }).inputValue() !== 'research') fail('URL state: scene was not restored');
  if (!await page.getByRole('radio', { name: '有免费额度' }).isChecked()) fail('URL state: price was not restored');
  if (!await page.getByRole('checkbox', { name: '海外' }).isChecked()) fail('URL state: origin was not restored');
  if (!await page.getByRole('checkbox', { name: '网页版' }).isChecked()) fail('URL state: platform was not restored');
  if (await page.getByRole('combobox', { name: '工具排序' }).inputValue() !== 'name-asc') fail('URL state: sort was not restored');
  await page.reload({ waitUntil: 'networkidle' });
  if (await search.inputValue() !== '引用') fail('URL state: search query was lost after reload');

  const emptyUrl = `${baseUrl}/tools?scene=research&q=__no_such_tool__`;
  await page.goto(emptyUrl, { waitUntil: 'networkidle' });
  if (await page.getByText('没有符合这些条件的工具').count() !== 1) fail('empty state: expected message missing');
  await page.goBack({ waitUntil: 'networkidle' });
  if (await search.inputValue() !== '引用') fail('URL state: browser Back did not restore the search query');
  await page.goForward({ waitUntil: 'networkidle' });
  if (await page.getByText('没有符合这些条件的工具').count() !== 1) fail('URL state: browser Forward did not restore the empty result');
  await context.close();
}

async function assertDetailNotFound(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/tools/999999`, { waitUntil: 'networkidle' });
  if (await page.getByRole('heading', { name: '工具未找到' }).count() !== 1) fail('detail: not-found state missing');
  if (await page.getByRole('link', { name: '返回工具目录' }).count() !== 1) fail('detail: not-found return link missing');
  await context.close();
}

async function assertRawReturnPath(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const rawPath = '/tools?scene=research&unknown=keep&price=bad';
  await page.goto(`${baseUrl}${rawPath}`, { waitUntil: 'networkidle' });
  await page.getByRole('link', { name: /查看 .* 详情/ }).first().click();
  await page.waitForURL((url) => url.searchParams.get('from') === rawPath);
  await page.getByRole('link', { name: '返回工具目录' }).click();
  await page.waitForURL((url) => `${url.pathname}${url.search}` === rawPath);
  await context.close();
}

async function assertSearchInteractions(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
  const homeSearch = page.getByRole('combobox', { name: /搜索工具/ });
  await homeSearch.fill('Perplexity');
  await page.getByRole('button', { name: '搜索 Perplexity AI' }).click();
  await page.waitForURL((url) => url.pathname === '/tools' && url.searchParams.get('q') === 'Perplexity AI');
  await page.getByRole('link', { name: 'AI Tool Hub', exact: true }).click();
  await homeSearch.focus();
  await page.getByRole('button', { name: '再次搜索 Perplexity AI' }).click();
  await page.waitForURL((url) => url.pathname === '/tools' && url.searchParams.get('q') === 'Perplexity AI');

  const directorySearch = page.getByRole('combobox', { name: /搜索工具/ });
  await directorySearch.fill('ChatGPT');
  await page.waitForURL((url) => url.pathname === '/tools' && url.searchParams.get('q') === 'ChatGPT');
  if (await page.locator('[data-tool-decision-row]').count() === 0) fail('search: typed directory query produced no rows');
  await page.getByRole('button', { name: '清除搜索' }).click();
  await page.waitForURL((url) => url.pathname === '/tools' && !url.searchParams.has('q'));
  await context.close();
}

async function assertResponsiveGeometry(page) {
  const viewports = [
    { width: 1280, height: 720 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
    { width: 320, height: 844 },
  ];
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto(`${baseUrl}/tools?scene=research`, { waitUntil: 'networkidle' });
    await assertNoOverflow(page, `${viewport.width}x${viewport.height}`);
    const rows = page.locator('[data-tool-decision-row]');
    await rows.nth(0).getByRole('checkbox').check();
    await rows.nth(1).getByRole('checkbox').check();
    if (await page.locator('[data-compare-tray]').count() !== 1) fail(`${viewport.width}x${viewport.height}: compare tray missing`);
    await assertNoOverflow(page, `${viewport.width}x${viewport.height} with tray`);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const obstruction = await page.evaluate(() => {
      const lastRow = Array.from(document.querySelectorAll('[data-tool-decision-row]')).at(-1)?.getBoundingClientRect();
      const tray = document.querySelector('[data-compare-tray]')?.getBoundingClientRect();
      return lastRow && tray ? { lastBottom: Math.round(lastRow.bottom), trayTop: Math.round(tray.top) } : null;
    });
    if (obstruction && obstruction.lastBottom > obstruction.trayTop) fail(`${viewport.width}x${viewport.height}: compare tray obscures the last row`);
    await assertTrayGeometry(page, `${viewport.width}x${viewport.height}`);
    const taskSelect = page.getByRole('combobox', { name: '选择任务' });
    await taskSelect.focus();
    await page.keyboard.press('Tab');
    if (!await page.evaluate(() => ['BUTTON', 'INPUT', 'SELECT', 'A'].includes(document.activeElement?.tagName || ''))) fail(`${viewport.width}x${viewport.height}: keyboard focus left interactive controls`);
    if (viewport.width < 1024) {
      const filterButton = page.getByRole('button', { name: /^筛选/ });
      await filterButton.focus();
      await page.keyboard.press('Enter');
      if (!await page.getByRole('dialog').isVisible()) fail(`${viewport.width}x${viewport.height}: filter drawer did not open from keyboard`);
      await page.keyboard.press('Escape');
    }
    await page.getByRole('button', { name: '切换到暗色主题' }).click();
    if (!await page.locator('html.dark').count()) fail(`${viewport.width}x${viewport.height}: dark theme missing`);
    await page.getByRole('button', { name: '切换到亮色主题' }).click();
  }
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleIssues = [];
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) consoleIssues.push(message.text());
  });

  await runFlow(page);
  await assertKeyboardAndTheme(page);
  await assertResponsiveGeometry(page);
  await assertCompareLimit(browser);
  await assertDoubleFailure(browser);
  await assertSceneRecovery(browser);
  await assertUrlStateAndEmptyHistory(browser);
  await assertDetailNotFound(browser);
  await assertRawReturnPath(browser);
  await assertSearchInteractions(browser);

  if (consoleIssues.length) fail(`console issues: ${consoleIssues.slice(0, 5).join(' | ')}`);
  await browser.close();
  if (failures.length) {
    console.error(failures.join('\n'));
    process.exit(1);
  }
  console.log('task-first UI guard passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 4: Wire explicit unit tests and the Next UI guard into CI**

In `.github/workflows/deploy.yml`, add the explicit pure/source test command to “Verify Next.js application”:

```yaml
          node --test \
            next-src/tests/task-decision.test.mjs \
            next-src/tests/tools-query-state.test.mjs \
            next-src/tests/compare-selection.test.mjs \
            next-src/tests/data-loading-contract.test.mjs \
            next-src/tests/search-suggestions.test.mjs \
            next-src/tests/editorial-ui-contract.test.mjs \
            next-src/tests/task-first-ui-contract.test.mjs
```

After “Install Chromium”, add:

```yaml
      - name: Run Next.js task-first UI guard
        run: |
          npm --prefix next-src run start -- --hostname 127.0.0.1 --port 4181 > /tmp/ai-tool-hub-task-first.log 2>&1 &
          next_pid=$!
          trap 'kill "$next_pid"' EXIT
          for attempt in $(seq 1 30); do
            if curl --fail --silent http://127.0.0.1:4181/ >/dev/null; then
              break
            fi
            if [ "$attempt" -eq 30 ]; then
              cat /tmp/ai-tool-hub-task-first.log
              exit 1
            fi
            sleep 1
          done
          TASK_FIRST_UI_URL=http://127.0.0.1:4181 node scripts/task-first-ui-guard.mjs
```

- [ ] **Step 5: Run the complete automated suite**

Run the pure/source tests explicitly:

```bash
node --test \
  next-src/tests/task-decision.test.mjs \
  next-src/tests/tools-query-state.test.mjs \
  next-src/tests/compare-selection.test.mjs \
  next-src/tests/data-loading-contract.test.mjs \
  next-src/tests/search-suggestions.test.mjs \
  next-src/tests/editorial-ui-contract.test.mjs \
  next-src/tests/task-first-ui-contract.test.mjs
npm --prefix next-src run lint
npm --prefix next-src run build
node scripts/review-regressions.mjs
git diff --check
```

Expected: every command exits 0.

- [ ] **Step 6: Run API regressions and the repeatable browser guard**

Start a fresh production server, wait for readiness, run both guards, and always stop that exact process:

```bash
set -euo pipefail
npm --prefix next-src run start -- --hostname 127.0.0.1 --port 3101 > /tmp/ai-tool-hub-task-first-local.log 2>&1 &
next_pid=$!
trap 'kill "$next_pid" 2>/dev/null || true' EXIT
for attempt in $(seq 1 30); do
  if ! kill -0 "$next_pid" 2>/dev/null; then
    cat /tmp/ai-tool-hub-task-first-local.log
    exit 1
  fi
  if curl --fail --silent http://127.0.0.1:3101/ >/dev/null; then
    break
  fi
  if [ "$attempt" -eq 30 ]; then
    cat /tmp/ai-tool-hub-task-first-local.log
    exit 1
  fi
  sleep 1
done
TEST_BASE_URL=http://127.0.0.1:3101 node next-src/tests/api-regressions.test.mjs
TASK_FIRST_UI_URL=http://127.0.0.1:3101 node scripts/task-first-ui-guard.mjs
kill "$next_pid" 2>/dev/null || true
wait "$next_pid" 2>/dev/null || true
trap - EXIT
```

Expected: API regressions PASS, the guard prints `task-first UI guard passed`, and port 3101 is released before the step exits.

- [ ] **Step 7: Commit the browser and CI guard**

```bash
git add scripts/task-first-ui-guard.mjs .github/workflows/deploy.yml scripts/review-regressions.mjs
git commit -m "test: guard task-first discovery flow"
```

Expected: the commit contains only the repeatable browser guard and CI/regression wiring.

---

### Task 13: Fidelity and Completion Verification

**Files:**
- Modify only when a review finds a concrete mismatch: the exact task-first production or test file named by Browser/IAB fidelity review or `build-web-apps:react-best-practices`

**Interfaces:**
- Consumes: the four accepted Task 0 references, the running production app, Browser/IAB, `view_image`, `build-web-apps:react-best-practices`, and `superpowers:verification-before-completion`.
- Produces: a fidelity ledger with at least seven named comparison points, zero unresolved non-intentional mismatch, green automated/browser verification, and an optional focused correction commit containing only reviewed task-first files.

- [ ] **Step 1: Perform Browser/IAB fidelity verification**

Use Browser/IAB first at `1440x900`, `1280x720`, `390x844`, and `320x844`. Verify the complete path from homepage task selection through directory filtering, two-tool selection, detail return, and compare entry; verify keyboard focus and both themes. Capture current implementation screenshots, then use `view_image` on every accepted Image Gen reference and the matching latest screenshot.

Write a fidelity ledger in the task commentary with at least these comparison points: visible copy, first-viewport composition, task/ability/price field order, palette and typography, fixed tray/nav geometry, loading/empty/error states, and mobile wrapping. Fix every non-intentional mismatch before continuing. Remove temporary screenshots from the repo; `/tmp` artifacts may remain outside version control.

- [ ] **Step 2: Run the React-specific review**

Invoke `build-web-apps:react-best-practices` after all TSX edits. Record each actionable finding, apply the fixes in the files named by the review, and rerun the focused tests for every changed task.

- [ ] **Step 3: Run final verification after review fixes**

Invoke `superpowers:verification-before-completion`, then rerun every command from Task 12 Step 5 and both commands from Task 12 Step 6. Repeat Browser/IAB screenshot comparison from Task 13 Step 1 for any visual file changed by the React review.

Expected: all automated commands exit 0, the production browser guard prints `task-first UI guard passed`, and the fidelity ledger has no unresolved non-intentional mismatch.

- [ ] **Step 4: Commit any final review corrections**

```bash
git add \
  next-src/src/app/page.tsx \
  next-src/src/app/tools/page.tsx \
  'next-src/src/app/tools/[slug]/page.tsx' \
  next-src/src/app/compare/page.tsx \
  next-src/src/app/layout.tsx \
  next-src/src/app/globals.css \
  next-src/src/components/home/TaskEntryList.tsx \
  next-src/src/components/hero/SearchBar.tsx \
  next-src/src/components/tools/ToolDecisionRow.tsx \
  next-src/src/components/tools/ToolDecisionList.tsx \
  next-src/src/components/tools/TaskContextBar.tsx \
  next-src/src/components/tools/FilterFields.tsx \
  next-src/src/components/tools/FilterRail.tsx \
  next-src/src/components/tools/MobileFilterDrawer.tsx \
  next-src/src/components/tools/ToolsBrowseClient.tsx \
  next-src/src/components/tools/ToolsPageSkeleton.tsx \
  next-src/src/components/tools/ToolDecisionSummary.tsx \
  next-src/src/components/tools/ToolEvidenceSections.tsx \
  next-src/src/components/tools/ToolDetailClient.tsx \
  next-src/src/components/tools/ToolCard.tsx \
  next-src/src/components/compare/CompareTray.tsx \
  next-src/src/components/layout/PageShell.tsx \
  next-src/src/components/layout/BottomNav.tsx \
  next-src/src/hooks/useSceneData.ts \
  next-src/src/hooks/useToolDirectoryQuery.ts \
  next-src/src/stores/useToolStore.ts \
  next-src/src/stores/useCompareStore.ts \
  next-src/src/lib/tool-decision.mjs \
  next-src/src/lib/tool-decision.d.mts \
  next-src/src/lib/tools-query-state.mjs \
  next-src/src/lib/tools-query-state.d.mts \
  next-src/src/lib/compare-selection.mjs \
  next-src/src/lib/compare-selection.d.mts \
  next-src/src/lib/tools-data.ts \
  next-src/src/types/tool.ts \
  next-src/tests/task-decision.test.mjs \
  next-src/tests/tools-query-state.test.mjs \
  next-src/tests/compare-selection.test.mjs \
  next-src/tests/data-loading-contract.test.mjs \
  next-src/tests/task-first-ui-contract.test.mjs \
  next-src/tests/editorial-ui-contract.test.mjs
if git diff --cached --quiet; then
  echo "No final review correction commit is needed"
else
  git commit -m "fix: address task-first final review"
fi
```

Expected: either no review correction was needed, or the focused commit contains every final correction; `.superpowers/` and temporary screenshots remain unstaged.
