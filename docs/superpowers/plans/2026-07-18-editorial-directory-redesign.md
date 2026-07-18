# Editorial Directory Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the production Next.js interface from a neon AI landing page into a compact editorial tool directory while preserving all existing data and user workflows.

**Architecture:** Keep the existing App Router, Zustand stores, API routes, and data model. Replace presentation inside the existing layout, hero, search, filter, scene, and tool-card components; add one pure search-suggestion helper so duplicate handling is testable independently; validate the finished behavior in the in-app Browser at desktop and mobile sizes.

**Tech Stack:** Next.js 16 App Router, React 18, TypeScript, Tailwind CSS 3, Zustand, Lucide React, Node test runner, in-app Browser.

## Global Constraints

- Production scope is `next-src`; do not change `/love`, the resume optimizer, Supabase schema, or deployment-domain isolation.
- Use `#F6F7F4` for the light page, `#171A17` for primary text, and `#176B4D` as the single brand accent.
- Card and input radius is at most `8px`; status tag radius is `4px`.
- Remove purple-blue gradients, particles, grid backgrounds, glass blur, scan effects, and 3D tilt from the affected production surfaces.
- Keep search, category filtering, sorting, favorites, comparison, authentication, click tracking, routes, and static-data fallback behavior.
- Mobile primary targets are at least `44px`; the desktop shortcut hint must be hidden below `640px`.

---

### Task 1: Search Suggestion Contract

**Files:**
- Create: `next-src/src/lib/search-suggestions.ts`
- Create: `next-src/tests/search-suggestions.test.mjs`
- Modify: `next-src/src/components/hero/SearchBar.tsx`

**Interfaces:**
- Consumes: `Tool[]` from `src/types/tool.ts`.
- Produces: `getSearchSuggestions(tools: Tool[], query: string, limit?: number): Tool[]`.

- [ ] **Step 1: Write the failing helper test**

```js
test('returns each matching tool once and respects the limit', () => {
  const source = readFileSync(helperPath, 'utf8');
  assert.match(source, /export function getSearchSuggestions/);
  assert.match(source, /new Set<number>/);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test next-src/tests/search-suggestions.test.mjs`

Expected: failure because `src/lib/search-suggestions.ts` does not exist.

- [ ] **Step 3: Implement deterministic suggestion de-duplication**

```ts
export function getSearchSuggestions(tools: Tool[], query: string, limit = 6): Tool[] {
  const term = query.trim().toLocaleLowerCase('zh-CN');
  if (!term) return [];
  const seen = new Set<number>();
  return tools.filter((tool) => {
    if (seen.has(tool.id)) return false;
    const matched = tool.name.toLocaleLowerCase('zh-CN').includes(term)
      || tool.desc.toLocaleLowerCase('zh-CN').includes(term)
      || tool.toolTags?.some((tag) => tag.toLocaleLowerCase('zh-CN').includes(term));
    if (matched) seen.add(tool.id);
    return matched;
  }).slice(0, limit);
}
```

- [ ] **Step 4: Use the helper in SearchBar and add mobile shortcut behavior**

Replace the inline `filter(...).slice(0, 6)` with `useMemo(() => getSearchSuggestions(tools, value), [tools, value])`; add `aria-label` to clear and suggestion controls; apply `hidden sm:flex` to the shortcut hint.

- [ ] **Step 5: Run the helper test, lint, and commit**

Run: `node --test next-src/tests/search-suggestions.test.mjs && npm --prefix next-src run lint`

Expected: PASS with no lint errors.

Commit: `fix: deduplicate tool search suggestions`

### Task 2: Neutral Layout and Navigation

**Files:**
- Modify: `next-src/src/app/globals.css`
- Modify: `next-src/src/app/layout.tsx`
- Modify: `next-src/src/components/layout/Navbar.tsx`
- Modify: `next-src/src/components/layout/BottomNav.tsx`
- Modify: `next-src/src/components/layout/Footer.tsx`
- Modify: `next-src/src/components/layout/PageShell.tsx`

**Interfaces:**
- Consumes: the existing theme state and routes.
- Produces: shared CSS variables `--page`, `--surface`, `--surface-subtle`, `--ink`, `--muted`, `--line`, and `--accent`.

- [ ] **Step 1: Add a source-level visual contract test**

Create assertions in `next-src/tests/editorial-ui-contract.test.mjs` that the global stylesheet contains `--accent: #176b4d`, does not contain `gridMove`, and that the layout theme color is `#f6f7f4`.

- [ ] **Step 2: Run the visual contract and verify RED**

Run: `node --test next-src/tests/editorial-ui-contract.test.mjs`

Expected: failure on the old neon variables and grid animation.

- [ ] **Step 3: Replace global visual tokens and motion**

Define the approved light and dark neutral tokens, set `body` to a solid page background, remove `body::before`, `gridMove`, `scan`, and glass utilities, and add `prefers-reduced-motion` handling plus visible `:focus-visible` outlines.

- [ ] **Step 4: Flatten layout chrome**

Use a white/charcoal sticky navigation with a 1px divider, text navigation for `/tools`, `/scenes`, and `/leaderboard`, square icon buttons with accessible labels, a solid mobile bottom bar, and a restrained footer.

- [ ] **Step 5: Run the contract and lint**

Run: `node --test next-src/tests/editorial-ui-contract.test.mjs && npm --prefix next-src run lint`

Expected: PASS.

Commit: `style: establish editorial directory visual system`

### Task 3: Homepage Information Architecture

**Files:**
- Modify: `next-src/src/app/page.tsx`
- Modify: `next-src/src/components/hero/HeroSection.tsx`
- Modify: `next-src/src/components/scenes/SceneCard.tsx`

**Interfaces:**
- Consumes: `tools`, `categories`, and existing `SceneCard` tracking.
- Produces: compact homepage sections ordered as search header, curated tools, and task scenes.

- [ ] **Step 1: Extend the UI contract test**

Assert that the homepage includes `按任务找到合适的 AI 工具` and `本周值得试`, does not include `数据概览`, and that the first content grid maps `hotTools` through `ToolCard`.

- [ ] **Step 2: Run and verify RED**

Run: `node --test next-src/tests/editorial-ui-contract.test.mjs`

Expected: failure on old hero copy and the statistics section.

- [ ] **Step 3: Build the compact directory header**

Render a left-aligned `max-w-7xl` header with a `36px` maximum heading, specific supporting copy, `SearchBar`, and one quiet metadata line for tool count and update cadence.

- [ ] **Step 4: Put real tools in the first viewport**

Render up to six hot tools through `ToolCard`; keep the leaderboard link as a secondary text action; remove the statistics section entirely.

- [ ] **Step 5: Flatten scene navigation**

Use compact bordered scene rows with one icon, title, description, and arrow; remove violet hover shadows and rounded-2xl cards.

- [ ] **Step 6: Run tests and lint**

Run: `node --test next-src/tests/editorial-ui-contract.test.mjs && npm --prefix next-src run lint`

Expected: PASS.

Commit: `feat: turn homepage into an editorial tool directory`

### Task 4: Tool Browsing Controls and Cards

**Files:**
- Modify: `next-src/src/components/hero/SearchBar.tsx`
- Modify: `next-src/src/components/tools/CategoryFilter.tsx`
- Modify: `next-src/src/components/tools/SortBar.tsx`
- Modify: `next-src/src/components/tools/ToolCard.tsx`
- Modify: `next-src/src/components/tools/ToolGrid.tsx`
- Modify: `next-src/src/app/tools/page.tsx`

**Interfaces:**
- Consumes: existing Zustand filtering, comparison, favorite, and tracking actions.
- Produces: flat tab-like filters and dense comparison-oriented cards.

- [ ] **Step 1: Add card and control assertions**

Assert that `ToolCard.tsx` has no `rotateX`, `scan_2s`, `backdrop-blur`, or `bg-gradient`; requires `tool.updateTime`, `tool.platforms`, and accessible labels; assert that CategoryFilter has no `rounded-full` or gradient active state.

- [ ] **Step 2: Run and verify RED**

Run: `node --test next-src/tests/editorial-ui-contract.test.mjs`

Expected: failure on tilt, gradients, and pill filters.

- [ ] **Step 3: Replace the card presentation**

Remove tilt state and mouse handlers. Use a flat 8px bordered card, neutral icon block, two-line description, two value tags maximum, and a metadata row containing price, first platform, and update date when available. Keep compare, favorite, detail, and external-link actions.

- [ ] **Step 4: Replace pill filters and improve mobile controls**

Use 44px-high text tabs with an accent underline, a horizontally scrollable sort segment with rectangular buttons, and prevent page-level horizontal overflow.

- [ ] **Step 5: Align the tools page and loading/empty states**

Use the global tokens for headings, counts, skeletons, and empty-state controls. Ensure search is the primary control and content clears the fixed mobile navigation.

- [ ] **Step 6: Run tests and lint**

Run: `node --test next-src/tests/*.test.mjs && npm --prefix next-src run lint`

Expected: all tests pass and lint reports no errors.

Commit: `style: make tool browsing dense and comparison focused`

### Task 5: Build and Browser Verification

**Files:**
- Modify only if verification exposes a regression in the files above.

**Interfaces:**
- Consumes: production Next.js application.
- Produces: screenshot and interaction evidence at desktop and mobile sizes.

- [ ] **Step 1: Run repository checks**

Run: `npm --prefix next-src run lint && npm --prefix next-src run build && node --test next-src/tests/*.test.mjs && git diff --check`

Expected: all commands exit 0.

- [ ] **Step 2: Start the production app locally**

Run: `npm --prefix next-src run dev -- --hostname 127.0.0.1 --port 3101`

Expected: Next.js reports ready at `http://127.0.0.1:3101`.

- [ ] **Step 3: Verify the desktop flow in Browser**

Flow: `/` loads -> first viewport shows search and real tools -> search `ChatGPT` -> unique suggestion appears -> selecting it filters tools -> opening a card navigates to its detail route.

Check page identity, meaningful DOM, no framework overlay, console warnings/errors, and a `1440x900` screenshot.

- [ ] **Step 4: Verify the mobile flow in Browser**

Set `390x844`, reload `/`, confirm tool content in the first viewport, no `⌘K` hint, no page-level horizontal overflow, no overlap with bottom navigation, and all primary targets at least 44px. Capture a screenshot.

- [ ] **Step 5: Run visual mismatch audit and final regression checks**

Confirm there are no visible particle/grid/glow layers, purple-blue gradients, glass cards, 3D tilt, duplicated search suggestions, missing focus states, clipping, or console errors. Re-run the commands from Step 1 after any fix.

- [ ] **Step 6: Commit verified implementation**

Run: `git add next-src docs/superpowers/plans/2026-07-18-editorial-directory-redesign.md && git commit -m "feat: redesign AI Tool Hub as an editorial directory"`

Expected: clean working tree and a commit containing only the approved redesign.
