# Carbon Console Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace AI Tool Hub's gray-green presentation with the approved carbon-console light and dark themes without changing routes, copy, data, field order, task flow, or interaction behavior.

**Architecture:** Put the complete palette, contrast-safe foregrounds, radii, and motion timing in global semantic CSS variables. A scoped `.carbon-tool-surface` remaps the same component variables for the detail rail, compare tray, and compare column headers, so components never hardcode a second theme. Source contracts enforce exact tokens and semantic color usage; a Playwright guard verifies computed tokens, focus colors, carbon surfaces, layout invariance, responsive overflow, and the required screenshot matrix.

**Tech Stack:** Next.js 16 App Router, React 18, TypeScript, Tailwind CSS 3.4, Zustand, Lucide, Node's built-in test runner, Playwright Chromium, GitHub Actions.

## Global Constraints

- Design source of truth: `docs/superpowers/specs/2026-07-20-carbon-console-theme-design.md`.
- Existing task-first screenshots are layout, density, copy, and responsive truth only; their gray-green colors are superseded.
- Light core tokens are exactly `#F3F6F8`, `#FFFFFF`, `#081218`, and `#007E99`.
- Dark core tokens are exactly `#080B0E`, `#10161A`, `#E8F7FB`, and `#46D9F2`.
- `#F28B3C` and derived signal colors are restricted to warnings, errors, unavailable services, blocking limits, and irreversible confirmations.
- Detail decision rail, global compare tray, and compare column headers use carbon tool surfaces in both themes.
- Controls use contrast-safe strong borders; normal text is at least 4.5:1 and control/focus boundaries are at least 3:1.
- Components use 4px or 6px radii, 120-160ms color/background/border transitions, and `ease-out`.
- Do not add gradients, glow, decorative grids, glass effects, scale, hover translation, rotation, invented metrics, or new UI libraries.
- Preserve all current routes, visible copy, data, URL state, field order, loading/error/empty behavior, comparison behavior, and 44px targets.
- Preserve existing brand/product assets. The existing `favicon.svg` is outside the source palette scan and is not redesigned here.
- Work incrementally with the current reviewed changes in `CompareTray.tsx`, `SearchBar.tsx`, `ToolDecisionRow.tsx`, `ToolDetailClient.tsx`, and `ToolEvidenceSections.tsx`; never replace those files wholesale.
- Keep `.superpowers/` and `design-qa.md` unstaged. Browser screenshots and composites go under `/tmp/carbon-console-qa`.
- If the shell Node runtime is broken, call `codex_app__load_workspace_dependencies` and use its Node executable and package paths for every `node`, `npm`, Playwright, and Sharp command below.

## File Map

**Create**

- `next-src/tests/carbon-theme-contract.test.mjs`: exact token, WCAG contrast, semantic source-scan, metadata, guard, and CI contracts.
- `scripts/carbon-theme-ui-guard.mjs`: rendered route/theme/viewport matrix, screenshot capture, computed-style checks, and optional side-by-side composites.

**Modify: foundation and CI**

- `next-src/src/app/globals.css`: theme tokens, carbon scope, focus, radius, and motion variables.
- `next-src/tailwind.config.ts`: map `rounded`, `rounded-md`, and `rounded-lg` to 4/6px and set default motion easing.
- `next-src/src/app/layout.tsx`: light/dark browser theme metadata.
- `next-src/public/manifest.json`: remove legacy black/purple PWA colors.
- `next-src/tests/editorial-ui-contract.test.mjs`: replace superseded gray-green assertions.
- `.github/workflows/deploy.yml`: run the new source contract and browser guard in CI.

**Modify: global discovery surfaces**

- `next-src/src/components/layout/Navbar.tsx`
- `next-src/src/components/layout/BottomNav.tsx`
- `next-src/src/components/hero/SearchBar.tsx`
- `next-src/src/components/home/TaskEntryList.tsx`
- `next-src/src/app/page.tsx`
- `next-src/src/components/tools/TaskContextBar.tsx`
- `next-src/src/components/tools/FilterFields.tsx`
- `next-src/src/components/tools/MobileFilterDrawer.tsx`

**Modify: decision flow and carbon tools**

- `next-src/src/components/tools/ToolDecisionRow.tsx`
- `next-src/src/components/tools/ToolDecisionList.tsx`
- `next-src/src/components/compare/CompareTray.tsx`
- `next-src/src/components/tools/ToolDecisionSummary.tsx`
- `next-src/src/components/tools/ToolDetailClient.tsx`
- `next-src/src/components/tools/ToolEvidenceSections.tsx`
- `next-src/src/components/ratings/RatingWidget.tsx`
- `next-src/src/app/compare/page.tsx`

**Modify: remaining routes and status semantics**

- `next-src/src/components/tools/ToolCard.tsx`
- `next-src/src/app/scenes/page.tsx`
- `next-src/src/app/scenes/[slug]/page.tsx`
- `next-src/src/app/leaderboard/page.tsx`
- `next-src/src/app/user/page.tsx`
- `next-src/src/components/auth/AuthModal.tsx`
- `next-src/src/components/common/ErrorBoundary.tsx`
- `next-src/tests/task-first-ui-contract.test.mjs`

---

### Task 0: Lock the Reviewed Task-First Baseline

**Files:**

- Stage and commit only the ten currently reviewed source/test files listed below.
- Preserve unstaged: `.superpowers/`, `design-qa.md`.

**Interfaces:**

- Consumes: the reviewed uncommitted catalog race, search, rating-state, contrast, and compare-focus fixes.
- Produces: a clean tracked baseline for theme commits; no theme behavior.

- [ ] **Step 1: Inspect the exact baseline diff and whitespace**

Run:

```bash
git diff --check -- \
  next-src/src/components/compare/CompareTray.tsx \
  next-src/src/components/hero/SearchBar.tsx \
  next-src/src/components/tools/ToolDecisionRow.tsx \
  next-src/src/components/tools/ToolDetailClient.tsx \
  next-src/src/components/tools/ToolEvidenceSections.tsx \
  next-src/src/stores/useToolStore.ts \
  next-src/tests/data-loading-contract.test.mjs \
  next-src/tests/editorial-ui-contract.test.mjs \
  next-src/tests/task-first-ui-contract.test.mjs \
  scripts/task-first-ui-guard.mjs
git diff --stat -- \
  next-src/src/components/compare/CompareTray.tsx \
  next-src/src/components/hero/SearchBar.tsx \
  next-src/src/components/tools/ToolDecisionRow.tsx \
  next-src/src/components/tools/ToolDetailClient.tsx \
  next-src/src/components/tools/ToolEvidenceSections.tsx \
  next-src/src/stores/useToolStore.ts \
  next-src/tests/data-loading-contract.test.mjs \
  next-src/tests/editorial-ui-contract.test.mjs \
  next-src/tests/task-first-ui-contract.test.mjs \
  scripts/task-first-ui-guard.mjs
```

Expected: no whitespace errors; the stat contains only the ten reviewed files.

- [ ] **Step 2: Re-run the baseline source suite**

Run from `next-src`:

```bash
node --test \
  tests/task-decision.test.mjs \
  tests/tools-query-state.test.mjs \
  tests/compare-selection.test.mjs \
  tests/data-loading-contract.test.mjs \
  tests/search-suggestions.test.mjs \
  tests/editorial-ui-contract.test.mjs \
  tests/task-first-ui-contract.test.mjs
npm run lint
npm run build
```

Expected: 61 source tests pass, lint exits 0, and the production build exits 0.

- [ ] **Step 3: Commit the reviewed baseline without local evidence files**

```bash
git add \
  next-src/src/components/compare/CompareTray.tsx \
  next-src/src/components/hero/SearchBar.tsx \
  next-src/src/components/tools/ToolDecisionRow.tsx \
  next-src/src/components/tools/ToolDetailClient.tsx \
  next-src/src/components/tools/ToolEvidenceSections.tsx \
  next-src/src/stores/useToolStore.ts \
  next-src/tests/data-loading-contract.test.mjs \
  next-src/tests/editorial-ui-contract.test.mjs \
  next-src/tests/task-first-ui-contract.test.mjs \
  scripts/task-first-ui-guard.mjs
git diff --cached --name-only
git commit -m "fix: finalize task-first review findings"
```

Expected staged names: exactly the ten paths above. `.superpowers/` and `design-qa.md` remain unstaged.

---

### Task 1: Establish the Semantic Theme Foundation

**Files:**

- Create: `next-src/tests/carbon-theme-contract.test.mjs`
- Modify: `next-src/tests/editorial-ui-contract.test.mjs:53-67`
- Modify: `next-src/src/app/globals.css:5-105`
- Modify: `next-src/tailwind.config.ts:9-16`
- Modify: `next-src/src/app/layout.tsx:42-46`
- Modify: `next-src/public/manifest.json:7-8`

**Interfaces:**

- Consumes: approved values from `2026-07-20-carbon-console-theme-design.md`.
- Produces: `--on-accent`, `--signal-*`, `--tool-*`, `.carbon-tool-surface`, 4/6px radius mappings, and 140ms/ease-out defaults used by every later task.

- [ ] **Step 1: Write failing token, contrast, metadata, radius, and motion contracts**

Create `next-src/tests/carbon-theme-contract.test.mjs` with:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const readRepo = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const css = read('src/app/globals.css');

function cssBlock(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\n\\}`));
  assert.ok(match, `missing CSS block ${selector}`);
  return match[1];
}

function token(block, name) {
  const match = block.match(new RegExp(`--${name}:\\s*([^;]+);`));
  assert.ok(match, `missing token --${name}`);
  return match[1].trim().toLowerCase();
}

function luminance(hex) {
  const channels = hex.match(/[0-9a-f]{2}/gi).map((value) => Number.parseInt(value, 16) / 255);
  const linear = channels.map((value) => value <= 0.04045
    ? value / 12.92
    : ((value + 0.055) / 1.055) ** 2.4);
  return (0.2126 * linear[0]) + (0.7152 * linear[1]) + (0.0722 * linear[2]);
}

function contrast(foreground, background) {
  const values = [luminance(foreground), luminance(background)].sort((left, right) => right - left);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test('defines the approved light, dark, signal, and carbon tool tokens', () => {
  const light = cssBlock(':root');
  const dark = cssBlock('.dark');
  const carbon = cssBlock('.carbon-tool-surface');

  assert.deepEqual({
    page: token(light, 'page'),
    surface: token(light, 'surface'),
    ink: token(light, 'ink'),
    mutedSubtle: token(light, 'muted-subtle'),
    lineStrong: token(light, 'line-strong'),
    accent: token(light, 'accent'),
    accentInk: token(light, 'accent-ink'),
    onAccent: token(light, 'on-accent'),
    signal: token(light, 'signal'),
    signalInk: token(light, 'signal-ink'),
    toolSurface: token(light, 'tool-surface'),
    toolAccent: token(light, 'tool-accent'),
    toolOnAccent: token(light, 'tool-on-accent'),
    toolSignalInk: token(light, 'tool-signal-ink'),
  }, {
    page: '#f3f6f8',
    surface: '#ffffff',
    ink: '#081218',
    mutedSubtle: '#5f717b',
    lineStrong: '#6f838d',
    accent: '#007e99',
    accentInk: '#005b70',
    onAccent: '#ffffff',
    signal: '#f28b3c',
    signalInk: '#8a3900',
    toolSurface: '#10161a',
    toolAccent: '#46d9f2',
    toolOnAccent: '#081218',
    toolSignalInk: '#ffb57d',
  });
  assert.deepEqual({
    page: token(dark, 'page'),
    surface: token(dark, 'surface'),
    ink: token(dark, 'ink'),
    mutedSubtle: token(dark, 'muted-subtle'),
    lineStrong: token(dark, 'line-strong'),
    accent: token(dark, 'accent'),
    accentInk: token(dark, 'accent-ink'),
    onAccent: token(dark, 'on-accent'),
    signal: token(dark, 'signal'),
    signalInk: token(dark, 'signal-ink'),
    toolSurface: token(dark, 'tool-surface'),
  }, {
    page: '#080b0e',
    surface: '#10161a',
    ink: '#e8f7fb',
    mutedSubtle: '#7f949e',
    lineStrong: '#58707b',
    accent: '#46d9f2',
    accentInk: '#8aeaf9',
    onAccent: '#081218',
    signal: '#f28b3c',
    signalInk: '#ffb57d',
    toolSurface: '#0c1216',
  });
  for (const mapping of [
    ['surface', 'tool-surface'],
    ['ink', 'tool-ink'],
    ['muted', 'tool-muted'],
    ['line-strong', 'tool-line'],
    ['accent', 'tool-accent'],
    ['on-accent', 'tool-on-accent'],
    ['signal', 'tool-signal'],
    ['signal-ink', 'tool-signal-ink'],
    ['signal-soft', 'tool-signal-soft'],
  ]) {
    assert.match(carbon, new RegExp(`--${mapping[0]}:\\s*var\\(--${mapping[1]}\\)`));
  }
});

test('keeps every required text and control color pair above its WCAG threshold', () => {
  const light = cssBlock(':root');
  const dark = cssBlock('.dark');
  const checks = [
    [token(light, 'muted-subtle'), token(light, 'page'), 4.5],
    [token(light, 'accent-ink'), token(light, 'page'), 4.5],
    [token(light, 'line-strong'), token(light, 'surface'), 3],
    [token(light, 'on-accent'), token(light, 'accent'), 4.5],
    [token(light, 'signal-ink'), token(light, 'signal-soft'), 4.5],
    [token(light, 'tool-ink'), token(light, 'tool-surface'), 4.5],
    [token(light, 'tool-muted'), token(light, 'tool-surface'), 4.5],
    [token(light, 'tool-line'), token(light, 'tool-surface'), 3],
    [token(light, 'tool-on-accent'), token(light, 'tool-accent'), 4.5],
    [token(light, 'tool-signal-ink'), token(light, 'tool-signal-soft'), 4.5],
    [token(dark, 'muted-subtle'), token(dark, 'surface'), 4.5],
    [token(dark, 'accent-ink'), token(dark, 'surface'), 4.5],
    [token(dark, 'line-strong'), token(dark, 'surface'), 3],
    [token(dark, 'on-accent'), token(dark, 'accent'), 4.5],
    [token(dark, 'signal-ink'), token(dark, 'signal-soft'), 4.5],
    [token(light, 'tool-ink'), token(dark, 'tool-surface'), 4.5],
    [token(light, 'tool-line'), token(dark, 'tool-surface'), 3],
  ];
  for (const [foreground, background, minimum] of checks) {
    assert.ok(contrast(foreground, background) >= minimum, `${foreground} on ${background}`);
  }
});

test('maps browser metadata, radii, and default motion to the approved system', () => {
  const layout = read('src/app/layout.tsx');
  const manifest = JSON.parse(read('public/manifest.json'));
  const tailwind = read('tailwind.config.ts');

  assert.match(layout, /media: '\(prefers-color-scheme: light\)', color: '#F3F6F8'/);
  assert.match(layout, /media: '\(prefers-color-scheme: dark\)', color: '#080B0E'/);
  assert.equal(manifest.background_color, '#F3F6F8');
  assert.equal(manifest.theme_color, '#F3F6F8');
  assert.match(css, /--radius:\s*6px/);
  assert.match(css, /--radius-sm:\s*4px/);
  assert.doesNotMatch(css, /border-radius:\s*8px/);
  assert.match(css, /--transition-duration:\s*140ms/);
  assert.match(css, /transition-property:\s*color, background-color, border-color, outline-color/);
  assert.match(tailwind, /lg:\s*'var\(--radius\)'/);
  assert.match(tailwind, /DEFAULT:\s*'140ms'/);
  assert.match(tailwind, /DEFAULT:\s*'ease-out'/);
});
```

In `editorial-ui-contract.test.mjs`, replace the old palette test with:

```js
test('uses the carbon console color system without animated grid decoration', () => {
  const css = read('src/app/globals.css');

  assert.match(css, /--page:\s*#f3f6f8/i);
  assert.match(css, /--accent:\s*#007e99/i);
  assert.match(css, /\.dark[\s\S]*--page:\s*#080b0e/i);
  assert.match(css, /\.dark[\s\S]*--accent:\s*#46d9f2/i);
  assert.doesNotMatch(css, /gridMove|repeating-linear-gradient|--neon-purple/i);
});
```

In its navigation/viewport test, replace the old single `themeColor` assertion with:

```js
assert.match(layout, /media: '\(prefers-color-scheme: light\)', color: '#F3F6F8'/);
assert.match(layout, /media: '\(prefers-color-scheme: dark\)', color: '#080B0E'/);
```

- [ ] **Step 2: Run the focused contracts to verify they fail on the old theme**

Run from `next-src`:

```bash
node --test tests/carbon-theme-contract.test.mjs tests/editorial-ui-contract.test.mjs
```

Expected: FAIL on the old `#f6f7f4`, `#176b4d`, metadata, manifest, radius, and missing carbon-token assertions.

- [ ] **Step 3: Implement the complete global token and scoped carbon system**

Replace the color/radius section of `globals.css` with the following values. Keep navigation, mobile-nav, tray-size, max-width, font, and reduced-motion behavior unchanged; change the scrollbar thumb's raw 8px radius to `var(--radius)`.

```css
:root {
  color-scheme: light;
  --page: #f3f6f8;
  --surface: #ffffff;
  --surface-subtle: #eaf0f3;
  --surface-hover: #e2ebef;
  --ink: #081218;
  --muted: #465861;
  --muted-subtle: #5f717b;
  --line: #cfdae0;
  --line-strong: #6f838d;
  --accent: #007e99;
  --accent-hover: #00667d;
  --accent-soft: #d9f1f6;
  --accent-ink: #005b70;
  --on-accent: #ffffff;
  --signal: #f28b3c;
  --signal-ink: #8a3900;
  --signal-soft: #fff0e5;
  --tool-surface: #10161a;
  --tool-surface-subtle: #151e23;
  --tool-surface-hover: #1a272d;
  --tool-ink: #e8f7fb;
  --tool-muted: #a4b8c1;
  --tool-muted-subtle: #7f949e;
  --tool-line-subtle: #26343b;
  --tool-line: #58707b;
  --tool-accent: #46d9f2;
  --tool-accent-hover: #75e5f7;
  --tool-accent-soft: #123840;
  --tool-accent-ink: #8aeaf9;
  --tool-on-accent: #081218;
  --tool-signal: #f28b3c;
  --tool-signal-ink: #ffb57d;
  --tool-signal-soft: #3a2114;
  --danger: var(--signal-ink);
  --warning: var(--signal-ink);
  --radius: 6px;
  --radius-sm: 4px;
  --transition-duration: 140ms;
  --nav-height: 64px;
  --mobile-nav-block-size: 0px;
  --compare-tray-block-size: 0px;
  --max-width: 1280px;
  --font: var(--font-geist), Arial, 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

.dark {
  color-scheme: dark;
  --page: #080b0e;
  --surface: #10161a;
  --surface-subtle: #151e23;
  --surface-hover: #1a272d;
  --ink: #e8f7fb;
  --muted: #a4b8c1;
  --muted-subtle: #7f949e;
  --line: #26343b;
  --line-strong: #58707b;
  --accent: #46d9f2;
  --accent-hover: #75e5f7;
  --accent-soft: #123840;
  --accent-ink: #8aeaf9;
  --on-accent: #081218;
  --signal: #f28b3c;
  --signal-ink: #ffb57d;
  --signal-soft: #3a2114;
  --tool-surface: #0c1216;
  --danger: var(--signal-ink);
  --warning: var(--signal-ink);
}

.carbon-tool-surface {
  color-scheme: dark;
  --surface: var(--tool-surface);
  --surface-subtle: var(--tool-surface-subtle);
  --surface-hover: var(--tool-surface-hover);
  --ink: var(--tool-ink);
  --muted: var(--tool-muted);
  --muted-subtle: var(--tool-muted-subtle);
  --line: var(--tool-line-subtle);
  --line-strong: var(--tool-line);
  --accent: var(--tool-accent);
  --accent-hover: var(--tool-accent-hover);
  --accent-soft: var(--tool-accent-soft);
  --accent-ink: var(--tool-accent-ink);
  --on-accent: var(--tool-on-accent);
  --signal: var(--tool-signal);
  --signal-ink: var(--tool-signal-ink);
  --signal-soft: var(--tool-signal-soft);
  color: var(--ink);
  background: var(--surface);
}
```

The `--danger` and `--warning` aliases are temporary compatibility aliases. Task 6 removes them after all consumers use signal or neutral semantics.

After the existing tap-highlight rule, apply the theme motion only to non-layout properties:

```css
a,
button,
input,
select,
textarea,
summary {
  transition-property: color, background-color, border-color, outline-color;
  transition-duration: var(--transition-duration);
  transition-timing-function: ease-out;
}
```

In the existing `::-webkit-scrollbar-thumb` rule, replace only its radius declaration with:

```css
border-radius: var(--radius);
```

Update `tailwind.config.ts` inside `theme.extend`:

```ts
borderRadius: {
  DEFAULT: 'var(--radius-sm)',
  sm: 'var(--radius-sm)',
  md: 'var(--radius)',
  lg: 'var(--radius)',
},
transitionDuration: {
  DEFAULT: '140ms',
},
transitionTimingFunction: {
  DEFAULT: 'ease-out',
},
```

Update viewport metadata:

```ts
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F3F6F8' },
    { media: '(prefers-color-scheme: dark)', color: '#080B0E' },
  ],
};
```

Update the manifest without changing its name, copy, start URL, icons, or scope:

```json
"background_color": "#F3F6F8",
"theme_color": "#F3F6F8"
```

- [ ] **Step 4: Run focused tests, lint, and build**

Run from `next-src`:

```bash
node --test tests/carbon-theme-contract.test.mjs tests/editorial-ui-contract.test.mjs
npm run lint
npm run build
```

Expected: the focused contracts pass, lint exits 0, and Next produces a successful production build.

- [ ] **Step 5: Commit the foundation**

```bash
git add \
  next-src/tests/carbon-theme-contract.test.mjs \
  next-src/tests/editorial-ui-contract.test.mjs \
  next-src/src/app/globals.css \
  next-src/tailwind.config.ts \
  next-src/src/app/layout.tsx \
  next-src/public/manifest.json
git commit -m "feat: define carbon console theme foundation"
```

---

### Task 2: Theme the App Chrome, Search, and Directory Controls

**Files:**

- Modify: `next-src/tests/carbon-theme-contract.test.mjs`
- Modify: `next-src/tests/task-first-ui-contract.test.mjs:116-137`
- Modify: `next-src/src/components/layout/Navbar.tsx:38-91`
- Modify: `next-src/src/components/layout/BottomNav.tsx:27-46`
- Modify: `next-src/src/components/hero/SearchBar.tsx:156-267`
- Modify: `next-src/src/components/home/TaskEntryList.tsx:7-16`
- Modify: `next-src/src/app/page.tsx:48-52`
- Modify: `next-src/src/components/tools/TaskContextBar.tsx:28-37`
- Modify: `next-src/src/components/tools/FilterFields.tsx:34-40`
- Modify: `next-src/src/components/tools/MobileFilterDrawer.tsx:38-42`

**Interfaces:**

- Consumes: global `accent-ink`, `on-accent`, `line-strong`, `surface-hover`, and duration/easing mappings.
- Produces: contrast-safe app chrome, primary search action, fixed 3px search/task rails, and native controls that later browser tests can target without layout shift.

- [ ] **Step 1: Add failing chrome and control contracts**

Append to `carbon-theme-contract.test.mjs`:

```js
test('uses contrast-safe chrome, primary actions, active rails, and control borders', () => {
  const navbar = read('src/components/layout/Navbar.tsx');
  const bottomNav = read('src/components/layout/BottomNav.tsx');
  const search = read('src/components/hero/SearchBar.tsx');
  const tasks = read('src/components/home/TaskEntryList.tsx');
  const home = read('src/app/page.tsx');
  const context = read('src/components/tools/TaskContextBar.tsx');
  const filters = read('src/components/tools/FilterFields.tsx');
  const drawer = read('src/components/tools/MobileFilterDrawer.tsx');

  assert.match(navbar, /active \? 'text-\[var\(--accent-ink\)\]'/);
  assert.match(bottomNav, /active \? 'text-\[var\(--accent-ink\)\]'/);
  assert.match(search, /text-\[var\(--on-accent\)\]/);
  assert.doesNotMatch(search, /rgba\(23,26,23/);
  assert.match(search, /border-l-\[3px\] border-l-transparent/);
  assert.match(search, /border-l-\[var\(--accent\)\]/);
  assert.match(tasks, /border-l-\[3px\] border-l-transparent/);
  assert.match(tasks, /hover:border-l-\[var\(--accent\)\]/);
  assert.match(home, /border-\[var\(--signal\)\]/);
  assert.match(home, /bg-\[var\(--signal-soft\)\]/);
  assert.equal((context.match(/border-\[var\(--line-strong\)\]/g) || []).length, 4);
  assert.match(filters, /accent-\[var\(--accent\)\]/);
  assert.match(filters, /border-\[var\(--line-strong\)\]/);
  assert.match(drawer, /border-l border-\[var\(--line-strong\)\]/);
});
```

Update the task-first search contract with:

```js
assert.match(search, /text-\[var\(--on-accent\)\]/);
assert.doesNotMatch(search, /bg-\[var\(--accent\)\][^'"\n]*text-\[var\(--surface\)\]/);
```

- [ ] **Step 2: Run the focused test to verify the current chrome fails**

Run from `next-src`:

```bash
node --test --test-name-pattern="contrast-safe chrome|search combobox" \
  tests/carbon-theme-contract.test.mjs \
  tests/task-first-ui-contract.test.mjs
```

Expected: FAIL because the current nav uses `accent`, controls use `line`, search uses `surface` text, and active 3px rails are absent.

- [ ] **Step 3: Apply the exact chrome and control mappings**

Use these class mappings without changing elements, labels, callbacks, or layout tracks:

```tsx
// Navbar.tsx
active ? 'text-[var(--accent-ink)]' : 'text-[var(--muted)] hover:text-[var(--ink)]'

// BottomNav.tsx
active ? 'text-[var(--accent-ink)]' : 'text-[var(--muted-subtle)] hover:text-[var(--ink)]'

// SearchBar.tsx, filled submit action
'min-w-[64px] bg-[var(--accent)] px-5 text-sm font-medium text-[var(--on-accent)] hover:bg-[var(--accent-hover)]'

// SearchBar.tsx, every option reserves the rail; the active option fills it
'flex min-h-12 w-full border-l-[3px] border-l-transparent border-b border-[var(--line)] px-4 text-left last:border-b-0 hover:bg-[var(--surface-hover)]'
activeIndex === index && 'border-l-[var(--accent)] bg-[var(--accent-soft)]'

// SearchBar.tsx, neutral floating shadow
'shadow-[0_12px_30px_rgba(0,0,0,0.16)]'

// TaskEntryList.tsx, stable hover rail
'group flex min-h-[104px] items-center justify-between gap-3 border-l-[3px] border-l-transparent border-b border-[var(--line)] px-5 py-4 hover:border-l-[var(--accent)] hover:bg-[var(--surface-hover)] sm:border-r lg:min-h-[90px]'
```

In `TaskContextBar.tsx`, change the three `select` borders and the mobile filter-button border from `line` to `line-strong`. In `FilterFields.tsx`, give every radio/checkbox `className="h-4 w-4 border border-[var(--line-strong)] accent-[var(--accent)]"` and change the clear button to `line-strong`. In `MobileFilterDrawer.tsx`, use `line-strong` for the dialog boundary and category select. Render the existing homepage scene error with its copy and handler unchanged:

```tsx
<div role="alert" className="border-l-4 border-[var(--signal)] bg-[var(--signal-soft)] p-4 text-[var(--signal-ink)]">
  <p>{scenesError}</p>
  <button type="button" onClick={retryScenes} className="mt-3 min-h-11 rounded-md border border-[var(--signal-ink)] px-4">重新加载</button>
</div>
```

- [ ] **Step 4: Run focused and behavior-preserving checks**

Run from `next-src`:

```bash
node --test \
  tests/carbon-theme-contract.test.mjs \
  tests/search-suggestions.test.mjs \
  tests/task-first-ui-contract.test.mjs
npm run lint
```

Expected: all focused contracts and existing search/URL behavior tests pass; lint exits 0.

- [ ] **Step 5: Commit the chrome and controls**

```bash
git add \
  next-src/tests/carbon-theme-contract.test.mjs \
  next-src/tests/task-first-ui-contract.test.mjs \
  next-src/src/components/layout/Navbar.tsx \
  next-src/src/components/layout/BottomNav.tsx \
  next-src/src/components/hero/SearchBar.tsx \
  next-src/src/components/home/TaskEntryList.tsx \
  next-src/src/app/page.tsx \
  next-src/src/components/tools/TaskContextBar.tsx \
  next-src/src/components/tools/FilterFields.tsx \
  next-src/src/components/tools/MobileFilterDrawer.tsx
git commit -m "feat: theme discovery chrome and controls"
```

---

### Task 3: Add Stable Decision Rails and the Carbon Compare Tray

**Files:**

- Modify: `next-src/tests/carbon-theme-contract.test.mjs`
- Modify: `next-src/tests/task-first-ui-contract.test.mjs:51-72,666-674`
- Modify: `next-src/src/components/tools/ToolDecisionRow.tsx:44-107`
- Modify: `next-src/src/components/tools/ToolDecisionList.tsx:38-73`
- Modify: `next-src/src/components/compare/CompareTray.tsx:49-107`

**Interfaces:**

- Consumes: `.carbon-tool-surface` and the existing `selected`, compare-limit, focus-handoff, and fixed-surface geometry behavior.
- Produces: `data-selected="true"` rows with non-shifting 3px rails and a `data-carbon-surface` compare tray for browser verification.

- [ ] **Step 1: Add failing decision-row and tray contracts**

Append to `carbon-theme-contract.test.mjs`:

```js
test('uses stable selected rails and a scoped carbon compare tray', () => {
  const row = read('src/components/tools/ToolDecisionRow.tsx');
  const list = read('src/components/tools/ToolDecisionList.tsx');
  const tray = read('src/components/compare/CompareTray.tsx');

  assert.match(row, /data-selected=\{selected \? 'true' : undefined\}/);
  assert.match(row, /before:w-\[3px\]/);
  assert.match(row, /before:bg-transparent/);
  assert.match(row, /selected && 'bg-\[var\(--accent-soft\)\] before:bg-\[var\(--accent\)\]'/);
  assert.match(row, /text-\[var\(--accent-ink\)\]/);
  assert.match(list, /border-\[var\(--signal\)\]/);
  assert.match(list, /bg-\[var\(--signal-soft\)\]/);
  assert.match(tray, /data-carbon-surface/);
  assert.match(tray, /carbon-tool-surface/);
  assert.match(tray, /border-\[var\(--line-strong\)\]/);
  assert.match(tray, /text-\[var\(--on-accent\)\]/);
});
```

Update the existing mobile-tray contract to keep its inset, selected-name, focus, and 44px assertions and replace its old border assertion with:

```js
assert.match(tray, /carbon-tool-surface/);
assert.match(tray, /data-carbon-surface/);
assert.match(tray, /fixed inset-x-2/);
assert.match(tray, /rounded-md border border-\[var\(--line-strong\)\]/);
```

- [ ] **Step 2: Run the focused test to verify the row and tray fail**

Run from `next-src`:

```bash
node --test --test-name-pattern="stable selected rails|decision rows preserve|mobile compare tray|compare-tray removal" \
  tests/carbon-theme-contract.test.mjs \
  tests/task-first-ui-contract.test.mjs \
  tests/editorial-ui-contract.test.mjs
```

Expected: FAIL on the missing selected rail, carbon scope, and new signal classes; existing compare-focus behavior remains green.

- [ ] **Step 3: Implement the selected row without changing grid geometry**

Add `data-selected` and stable pseudo-element classes to the existing `li`:

```tsx
<li
  data-tool-decision-row
  data-selected={selected ? 'true' : undefined}
  className={cn(
    "relative grid min-w-0 items-center gap-1 border-b border-[var(--line)] bg-[var(--surface)] px-3 py-2 before:pointer-events-none before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-transparent before:transition-colors before:content-[''] md:gap-3 md:py-3",
    selected && 'bg-[var(--accent-soft)] before:bg-[var(--accent)]',
    !selected && 'hover:bg-[var(--surface-hover)]',
    variant === 'matrix'
      ? 'grid-cols-[minmax(0,1fr)_44px] md:grid-cols-[44px_minmax(120px,.9fr)_minmax(110px,.75fr)_minmax(180px,1.25fr)_minmax(88px,.6fr)_44px] lg:grid-cols-[44px_minmax(150px,1fr)_minmax(130px,.85fr)_minmax(220px,1.35fr)_minmax(100px,.65fr)_44px]'
      : 'grid-cols-[minmax(0,1fr)_44px] rounded-md border md:grid-cols-[44px_minmax(120px,.9fr)_minmax(110px,.75fr)_minmax(180px,1.25fr)_minmax(88px,.6fr)_44px] md:rounded-none md:border-x-0 md:border-t-0 lg:grid-cols-[44px_minmax(150px,1fr)_minmax(130px,.85fr)_minmax(220px,1.35fr)_minmax(100px,.65fr)_44px]',
  )}
>
```

Change the task label from `text-[var(--accent)]` to `text-[var(--accent-ink)]`. Do not alter checkbox, field, link, or grid ordering.

In `ToolDecisionList.tsx`, use this error/control styling while retaining the same copy and callbacks:

```tsx
<div role="alert" className="border-l-4 border-[var(--signal)] bg-[var(--signal-soft)] p-5 text-[var(--signal-ink)]">
  <p>{error}</p>
  <button type="button" onClick={onRetry} className="mt-3 min-h-11 rounded-md border border-[var(--signal-ink)] px-4 text-[var(--signal-ink)]">重新加载</button>
</div>
```

Also change the empty-state clear button to `line-strong`.

- [ ] **Step 4: Apply the carbon scope to the existing compare tray**

Keep fixed positioning, geometry variables, selected names, 44px remove buttons, live feedback, and focus handoff unchanged. Update only the aside surface and primary foreground:

```tsx
<aside
  ref={trayRef}
  data-compare-tray
  data-carbon-surface
  aria-label="已选工具对比"
  className="carbon-tool-surface fixed inset-x-2 bottom-[var(--mobile-nav-block-size)] z-[90] overflow-hidden rounded-md border border-[var(--line-strong)] bg-[var(--surface)] px-3 py-2 text-[var(--ink)] shadow-[0_-8px_24px_rgba(0,0,0,0.18)] md:inset-x-0 md:bottom-0 md:rounded-none md:border-x-0 md:border-b-0 md:px-6"
>
```

The compare button becomes:

```tsx
className="min-h-11 rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-[var(--on-accent)] hover:bg-[var(--accent-hover)]"
```

- [ ] **Step 5: Run focused contracts and compare behavior tests**

Run from `next-src`:

```bash
node --test \
  tests/carbon-theme-contract.test.mjs \
  tests/compare-selection.test.mjs \
  tests/editorial-ui-contract.test.mjs \
  tests/task-first-ui-contract.test.mjs
npm run lint
```

Expected: contracts pass; compare selection, limit, removal focus, and mobile anatomy remain passing.

- [ ] **Step 6: Commit the decision surfaces**

```bash
git add \
  next-src/tests/carbon-theme-contract.test.mjs \
  next-src/tests/task-first-ui-contract.test.mjs \
  next-src/src/components/tools/ToolDecisionRow.tsx \
  next-src/src/components/tools/ToolDecisionList.tsx \
  next-src/src/components/compare/CompareTray.tsx
git commit -m "feat: add carbon decision and compare surfaces"
```

---

### Task 4: Theme Detail Evidence and the Carbon Decision Rail

**Files:**

- Modify: `next-src/tests/carbon-theme-contract.test.mjs`
- Modify: `next-src/tests/editorial-ui-contract.test.mjs:141-172`
- Modify: `next-src/tests/task-first-ui-contract.test.mjs:690-715`
- Modify: `next-src/src/components/tools/ToolDecisionSummary.tsx:27-63`
- Modify: `next-src/src/components/tools/ToolDetailClient.tsx:120-207`
- Modify: `next-src/src/components/tools/ToolEvidenceSections.tsx:29-126`
- Modify: `next-src/src/components/ratings/RatingWidget.tsx:45-78`

**Interfaces:**

- Consumes: the existing rating-state validator, optimistic refresh guard, compare/favorite behavior, and carbon scope.
- Produces: a `data-carbon-surface` sticky detail rail, signal-only errors, cyan ratings/favorites, and contrast-safe detail actions.

- [ ] **Step 1: Add failing detail and rating semantic contracts**

Append to `carbon-theme-contract.test.mjs`:

```js
test('uses a carbon detail rail and keeps ratings, favorites, and ordinary success out of signal orange', () => {
  const summary = read('src/components/tools/ToolDecisionSummary.tsx');
  const detail = read('src/components/tools/ToolDetailClient.tsx');
  const evidence = read('src/components/tools/ToolEvidenceSections.tsx');
  const rating = read('src/components/ratings/RatingWidget.tsx');

  assert.match(detail, /data-carbon-surface/);
  assert.match(detail, /carbon-tool-surface/);
  assert.match(detail, /border-\[var\(--signal\)\]/);
  assert.match(detail, /border-\[var\(--signal-ink\)\]/);
  assert.match(detail, /bg-\[var\(--signal-soft\)\]/);
  assert.match(summary, /fill-current text-\[var\(--accent\)\]/);
  assert.match(summary, /text-\[var\(--on-accent\)\]/);
  assert.doesNotMatch(summary, /--danger|text-white/);
  assert.doesNotMatch(evidence, /amber|--danger|--warning/);
  assert.doesNotMatch(rating, /amber|--danger|--warning|text-white/);
  assert.match(rating, /fill-\[var\(--accent\)\] text-\[var\(--accent\)\]/);
  assert.match(rating, /text-\[var\(--signal-ink\)\]/);
});
```

Keep the existing loading/error/verified-empty rating assertions; only add theme semantics around them.

- [ ] **Step 2: Run the detail contracts to verify they fail**

Run from `next-src`:

```bash
node --test --test-name-pattern="carbon detail rail|rating evidence|zero-review evidence|detail route resolves" \
  tests/carbon-theme-contract.test.mjs \
  tests/editorial-ui-contract.test.mjs \
  tests/task-first-ui-contract.test.mjs
```

Expected: FAIL on old danger/warning, amber stars, white primary foregrounds, and the non-carbon detail rail.

- [ ] **Step 3: Migrate the summary and detail error semantics**

Apply these exact semantic mappings without changing visible copy or handlers:

```tsx
// ToolDecisionSummary.tsx
text-[var(--accent)]        -> text-[var(--accent-ink)] // task/price text labels
text-white                  -> text-[var(--on-accent)]  // primary visit action
fill-current text-[var(--danger)] -> fill-current text-[var(--accent)] // favorite state

// ToolDetailClient.tsx, tool-data error
className="w-full border-l-4 border-[var(--signal)] bg-[var(--signal-soft)] p-5 text-[var(--signal-ink)]"

// ToolDetailClient.tsx, scene fallback warning
className="mt-2 border-l-4 border-[var(--signal)] bg-[var(--signal-soft)] p-4 text-sm text-[var(--signal-ink)]"
```

Retry buttons inside the two signal containers use `border-[var(--signal-ink)] text-[var(--signal-ink)]`; neutral retry controls use `line-strong`. Normal primary links use `text-[var(--on-accent)]`.

- [ ] **Step 4: Apply the scoped carbon theme to the sticky rail**

Replace only the rail's surface class and add its test hook:

```tsx
<aside
  data-carbon-surface
  className="carbon-tool-surface h-fit border border-[var(--line-strong)] bg-[var(--surface)] p-4 text-[var(--ink)] lg:sticky lg:top-[88px]"
>
```

Keep the four `dl` fields and their order unchanged. Use `text-[var(--on-accent)]` on the rail's visit button; its scoped value resolves to `tool-on-accent`.

- [ ] **Step 5: Move rating stars to cyan and errors to signal semantics**

Use the following mappings in `ToolEvidenceSections.tsx` and `RatingWidget.tsx`:

```tsx
// Filled stars in both files
'fill-[var(--accent)] text-[var(--accent)]'

// Selected rating tag
'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-ink)]'

// Unselected rating tag remains a visible control
'border-[var(--line-strong)] text-[var(--muted)] hover:bg-[var(--surface-hover)]'

// Rating submit error
<p role="alert" className="rounded-md border border-[var(--signal-ink)] bg-[var(--signal-soft)] px-3 py-2 text-center text-xs text-[var(--signal-ink)]">{error}</p>

// Submitted state text and primary submit foreground
'text-[var(--accent-ink)]'
'text-[var(--on-accent)]'
```

The remote-rating transport error in `ToolEvidenceSections.tsx` keeps its exact copy and `role="alert"`, but uses `border-[var(--signal-ink)] bg-[var(--signal-soft)] text-[var(--signal-ink)]`. Do not merge loading, error, verified-empty, or ready states.

- [ ] **Step 6: Run detail, rating, and full component contracts**

Run from `next-src`:

```bash
node --test \
  tests/carbon-theme-contract.test.mjs \
  tests/editorial-ui-contract.test.mjs \
  tests/task-first-ui-contract.test.mjs
npm run lint
```

Expected: all detail/rating contracts pass with the existing runtime payload validator and rating-state distinctions intact.

- [ ] **Step 7: Commit the detail theme**

```bash
git add \
  next-src/tests/carbon-theme-contract.test.mjs \
  next-src/tests/editorial-ui-contract.test.mjs \
  next-src/tests/task-first-ui-contract.test.mjs \
  next-src/src/components/tools/ToolDecisionSummary.tsx \
  next-src/src/components/tools/ToolDetailClient.tsx \
  next-src/src/components/tools/ToolEvidenceSections.tsx \
  next-src/src/components/ratings/RatingWidget.tsx
git commit -m "feat: theme detail evidence and decision rail"
```

---

### Task 5: Theme the Compare Page Without Reordering It

**Files:**

- Modify: `next-src/tests/carbon-theme-contract.test.mjs`
- Modify: `next-src/src/app/compare/page.tsx:41-129`

**Interfaces:**

- Consumes: current compare rows, add/remove/clear behavior, candidate dialog, related-tool cards, and carbon scope.
- Produces: carbon column headers marked by `data-carbon-surface`; ordinary data cells and recoverable actions stay neutral.

- [ ] **Step 1: Add a failing compare-page contract**

Append to `carbon-theme-contract.test.mjs`:

```js
test('uses carbon compare headers while keeping recoverable compare actions neutral', () => {
  const compare = read('src/app/compare/page.tsx');

  assert.match(compare, /data-carbon-surface/);
  assert.match(compare, /carbon-tool-surface/);
  assert.match(compare, /border-\[var\(--line-strong\)\]/);
  assert.match(compare, /text-\[var\(--on-accent\)\]/);
  assert.match(compare, /text-\[var\(--accent-ink\)\]/);
  assert.doesNotMatch(compare, /--danger|bg-red|border-red|text-red|text-white/);
  assert.match(compare, /onClick=\{clearAll\}[^>]+text-\[var\(--muted\)\]/);
});
```

- [ ] **Step 2: Run the focused compare test to verify it fails**

Run from `next-src`:

```bash
node --test --test-name-pattern="carbon compare headers|legacy tool surfaces" \
  tests/carbon-theme-contract.test.mjs \
  tests/task-first-ui-contract.test.mjs
```

Expected: FAIL on the old white foreground, danger-colored clear action, and missing carbon column headers.

- [ ] **Step 3: Apply carbon only to the selected-tool column headers**

Keep the grid tracks, minimum width, selected-tool order, comparison rows, pricing section, related tools, and dialog unchanged. Update each selected-tool header:

```tsx
<div
  key={tool.id}
  data-carbon-surface
  className="carbon-tool-surface relative flex min-h-[190px] flex-col items-center gap-2 rounded-lg border border-[var(--line-strong)] bg-[var(--surface)] p-5 text-center text-[var(--ink)]"
>
```

Within the scoped header, keep remove neutral, use `accent-ink` for the visit link, and allow all local variables to resolve through `.carbon-tool-surface`.

- [ ] **Step 4: Correct normal compare controls and text foregrounds**

Apply these mappings:

```tsx
// Empty compare primary link
text-white -> text-[var(--on-accent)]

// Header add button
border-[var(--line)] -> border-[var(--line-strong)]

// Recoverable clear action
className="min-h-11 rounded-md border border-[var(--line-strong)] px-3 text-sm text-[var(--muted)] hover:bg-[var(--surface-hover)]"

// Free/difference text in ordinary data cells
text-[var(--accent)] -> text-[var(--accent-ink)]
```

Do not add a heat map, new labels, or new fields.

- [ ] **Step 5: Run compare and theme contracts**

Run from `next-src`:

```bash
node --test \
  tests/carbon-theme-contract.test.mjs \
  tests/compare-selection.test.mjs \
  tests/task-first-ui-contract.test.mjs
npm run lint
```

Expected: compare contracts pass; add/remove/clear/limit behavior is unchanged.

- [ ] **Step 6: Commit the compare page**

```bash
git add next-src/tests/carbon-theme-contract.test.mjs next-src/src/app/compare/page.tsx
git commit -m "feat: theme compare workspace"
```

---

### Task 6: Finish Status Semantics and Remove Legacy Palette/Motion Escape Hatches

**Files:**

- Modify: `next-src/tests/carbon-theme-contract.test.mjs`
- Modify: `next-src/src/app/globals.css`
- Modify: `next-src/src/components/tools/ToolCard.tsx:22-137`
- Modify: `next-src/src/app/scenes/page.tsx:60-79`
- Modify: `next-src/src/app/scenes/[slug]/page.tsx:60-76`
- Modify: `next-src/src/app/leaderboard/page.tsx:42-91`
- Modify: `next-src/src/app/user/page.tsx:85-176`
- Modify: `next-src/src/components/auth/AuthModal.tsx:58-88`
- Modify: `next-src/src/components/common/ErrorBoundary.tsx:34-47`

**Interfaces:**

- Consumes: complete semantic palette and all migrated core decision surfaces.
- Produces: a full-source prohibition contract with no `danger`, `warning`, raw red/amber/green/cyan classes, white primary foregrounds, hover transforms, rotating icons, or old gray-green hex values.

- [ ] **Step 1: Add a failing full-source semantic scan**

Replace the existing `node:fs` import, then add the path imports and helper in `carbon-theme-contract.test.mjs`:

```js
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function collectSourceFiles(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const absolute = path.join(directory, entry);
    return statSync(absolute).isDirectory()
      ? collectSourceFiles(absolute)
      : /\.(css|ts|tsx)$/.test(entry) ? [absolute] : [];
  });
}
```

Append the scan:

```js
test('contains no legacy palette, raw status colors, or prohibited motion in application source', () => {
  const sourceRoot = fileURLToPath(new URL('../src/', import.meta.url));
  const files = collectSourceFiles(sourceRoot);
  const forbiddenHex = /#(?:f6f7f4|eef1ec|e8ede7|171a17|5f675f|858c85|dce1da|c8cfc6|176b4d|105b40|e4f0e9|b54747|9a6700|171917|202320|292d29|303530|f2f4ef|b2b9b0|858d84|373d36|4a5148|72b897|8cc8aa|203c30|e08080|d8ad58)\b/i;
  const rawPaletteClass = /\b(?:bg|border|text|fill|ring)-(?:red|amber|yellow|green|emerald|teal|cyan|sky|blue|purple|violet)-\d+\b/;
  const prohibitedEffect = /\bbg-gradient-|\b(?:from|via|to)-[a-z]+-\d+|repeating-linear-gradient|shadow-\[[^\]]*0_0|animate-spin|transition-transform|(?:group-)?hover:(?:-?translate|scale|rotate)/;

  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    assert.doesNotMatch(content, forbiddenHex, file);
    assert.doesNotMatch(content, rawPaletteClass, file);
    assert.doesNotMatch(content, /var\(--(?:danger|warning)\)|text-white|rounded-full/, file);
    assert.doesNotMatch(content, /rgba\(23,\s*26,\s*23/, file);
    assert.doesNotMatch(content, prohibitedEffect, file);
    assert.doesNotMatch(content, /tracking-\[-|letter-spacing:\s*-/, file);
  }
});
```

- [ ] **Step 2: Run the scan to verify it reports every remaining escape hatch**

Run from `next-src`:

```bash
node --test --test-name-pattern="contains no legacy palette" tests/carbon-theme-contract.test.mjs
```

Expected: FAIL on the temporary aliases, raw red/amber classes, `text-white`, scene hover translation, and auth spinner.

- [ ] **Step 3: Migrate non-risk statuses and routine actions**

Use these semantic mappings without changing copy or behavior:

```tsx
// ToolCard.tsx status map
const TAG_STYLES: Record<string, string> = {
  free: 'border-[var(--line)] bg-[var(--surface-subtle)] text-[var(--muted)]',
  hot: 'border-[var(--line)] bg-[var(--surface-subtle)] text-[var(--muted)]',
  vip: 'border-[var(--line)] bg-[var(--surface-subtle)] text-[var(--muted)]',
};

// Favorites in ToolCard and user page
'text-[var(--accent)] hover:bg-[var(--accent-soft)]'
'fill-current text-[var(--accent)]'

// Ordinary text links and selected tab labels
'text-[var(--accent-ink)] hover:text-[var(--accent-hover)]'

// Rating stars in user page
'fill-[var(--accent)] text-[var(--accent)]'

// Routine clear/sign-out/visit controls
'border border-[var(--line-strong)] text-[var(--muted)] hover:bg-[var(--surface-hover)]'
```

In `ToolCard.tsx`, change “查看详情” to `accent-ink` and its bordered “访问” control to `line-strong`. Keep every ordinary price label, including `free`, neutral with `line`, `surface-subtle`, and `muted`. In `leaderboard/page.tsx`, render “常用” with the same neutral tokens; active tab and top-rank text use `accent-ink`. In `user/page.tsx`, use `accent-ink` for active tabs, detail links, “再次对比”, and empty-state links; render the logged-in status with `ink` and its supporting text with `muted`. In `scenes/page.tsx`, use `accent-ink` for the tool-count link and remove both `transition-transform` and `group-hover:translate-x-0.5`. In `scenes/[slug]/page.tsx`, use `accent-ink` for text links.

- [ ] **Step 4: Migrate real warning/error states and static loading feedback**

Use these exact classes:

```tsx
// Auth service warning
className="mb-4 flex items-start gap-2 rounded-md border border-[var(--signal-ink)] bg-[var(--signal-soft)] p-3 text-xs text-[var(--signal-ink)]"

// Auth error
className="rounded-md border border-[var(--signal-ink)] bg-[var(--signal-soft)] px-3 py-2 text-xs text-[var(--signal-ink)]"

// Auth success and switch link
'bg-[var(--surface-subtle)] text-[var(--ink)]'
'text-[var(--accent-ink)] hover:text-[var(--accent-hover)]'

// ErrorBoundary frame/icon
'border border-[var(--signal-ink)] bg-[var(--signal-soft)]'
'text-[var(--signal-ink)]'

// Every remaining ordinary primary action
'text-[var(--on-accent)]'
```

Remove `animate-spin` from the auth loader and keep the loading state accessible without changing visible copy:

```tsx
{loading ? <><Loader2 className="h-4 w-4" aria-hidden="true" /><span className="sr-only">处理中</span></> : mode === 'login' ? '登录' : '注册'}
```

Use `cn` in the user settings paragraph so “云同步当前不可用” uses `signal-ink`, while normal logged-out copy remains `muted`. Keep logout itself neutral because it is reversible.

- [ ] **Step 5: Remove compatibility aliases and prove the source scan passes**

Delete these lines from both theme scopes in `globals.css`:

```css
--danger: var(--signal-ink);
--warning: var(--signal-ink);
```

Run from `next-src`:

```bash
node --test tests/carbon-theme-contract.test.mjs tests/editorial-ui-contract.test.mjs tests/task-first-ui-contract.test.mjs
rg -n --glob '*.tsx' --glob '*.ts' --glob '*.css' \
  'var\(--(danger|warning)\)|(?:bg|border|text|fill)-(red|amber|green|emerald|teal|cyan)-|text-white|animate-spin|transition-transform|group-hover:translate' \
  src
npm run lint
```

Expected: all contracts pass; `rg` prints no matches; lint exits 0.

- [ ] **Step 6: Commit the remaining semantic migration**

```bash
git add \
  next-src/tests/carbon-theme-contract.test.mjs \
  next-src/src/app/globals.css \
  next-src/src/components/tools/ToolCard.tsx \
  next-src/src/app/scenes/page.tsx \
  'next-src/src/app/scenes/[slug]/page.tsx' \
  next-src/src/app/leaderboard/page.tsx \
  next-src/src/app/user/page.tsx \
  next-src/src/components/auth/AuthModal.tsx \
  next-src/src/components/common/ErrorBoundary.tsx
git commit -m "feat: finish carbon console status semantics"
```

---

### Task 7: Add Rendered Theme QA, CI Coverage, and Final Evidence

**Files:**

- Create: `scripts/carbon-theme-ui-guard.mjs`
- Modify: `next-src/tests/carbon-theme-contract.test.mjs`
- Modify: `.github/workflows/deploy.yml:47-59,95-135`

**Interfaces:**

- Consumes: `data-carbon-surface`, `data-selected`, theme toggle labels, the current production build, and existing task-first browser behavior.
- Produces: `CARBON_THEME_URL` and `CARBON_QA_DIR` browser verification, optional `CARBON_QA_SHARP` composites, CI enforcement, and local screenshot evidence under `/tmp/carbon-console-qa`.

- [ ] **Step 1: Write a failing guard/CI contract**

Append to `carbon-theme-contract.test.mjs`:

```js
test('wires the carbon route, viewport, theme, focus, and screenshot guard into CI', () => {
  const guard = readRepo('scripts/carbon-theme-ui-guard.mjs');
  const workflow = readRepo('.github/workflows/deploy.yml');

  for (const route of ['/', '/tools?scene=research', '/tools/71', '/compare', '/scenes', '/scenes/research', '/leaderboard', '/user']) {
    assert.ok(guard.includes(route), route);
  }
  for (const viewport of ['1440, height: 900', '1280, height: 720', '768, height: 1024', '390, height: 844', '320, height: 700']) {
    assert.ok(guard.includes(viewport), viewport);
  }
  assert.match(guard, /data-carbon-surface/);
  assert.match(guard, /data-selected/);
  assert.match(guard, /outlineColor/);
  assert.match(guard, /CARBON_QA_DIR/);
  assert.match(guard, /page\.screenshot/);
  assert.match(workflow, /next-src\/tests\/carbon-theme-contract\.test\.mjs/);
  assert.match(workflow, /CARBON_THEME_URL=http:\/\/127\.0\.0\.1:4181 CARBON_QA_DIR=\/tmp\/carbon-console-qa node scripts\/carbon-theme-ui-guard\.mjs/);
});
```

- [ ] **Step 2: Run the contract to verify the missing guard fails**

Run from `next-src`:

```bash
node --test --test-name-pattern="wires the carbon route" tests/carbon-theme-contract.test.mjs
```

Expected: FAIL because `scripts/carbon-theme-ui-guard.mjs` does not exist and CI does not invoke it.

- [ ] **Step 3: Implement the rendered matrix guard**

Create `scripts/carbon-theme-ui-guard.mjs`:

```js
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const baseUrl = process.env.CARBON_THEME_URL || 'http://127.0.0.1:3101';
const qaDir = process.env.CARBON_QA_DIR || '/tmp/carbon-console-qa';
const failures = [];
const fail = (message) => failures.push(message);

const themes = {
  light: {
    '--page': '#f3f6f8',
    '--surface': '#ffffff',
    '--ink': '#081218',
    '--accent': '#007e99',
    toolBackground: 'rgb(16, 22, 26)',
    focus: 'rgb(0, 126, 153)',
  },
  dark: {
    '--page': '#080b0e',
    '--surface': '#10161a',
    '--ink': '#e8f7fb',
    '--accent': '#46d9f2',
    toolBackground: 'rgb(12, 18, 22)',
    focus: 'rgb(70, 217, 242)',
  },
};

const allScenarios = [
  { name: 'home', path: '/', hoverTask: true },
  { name: 'directory', path: '/tools?scene=research&price=free-tier&platform=web', selectTools: true, carbon: true },
  { name: 'detail', path: '/tools/71', carbon: true },
  { name: 'compare', path: '/tools?scene=research&price=free-tier&platform=web', selectTools: true, openCompare: true, carbon: true },
  { name: 'scenes', path: '/scenes' },
  { name: 'scene-detail', path: '/scenes/research' },
  { name: 'leaderboard', path: '/leaderboard' },
  { name: 'user', path: '/user' },
  { name: 'auth', path: '/user', openAuth: true },
];

const coreScenarioNames = new Set(['home', 'directory', 'detail', 'compare']);
const viewports = [
  { width: 1440, height: 900, allRoutes: true },
  { width: 1280, height: 720 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 320, height: 700 },
];

async function openScenario(page, scenario) {
  await page.goto(`${baseUrl}${scenario.path}`, { waitUntil: 'networkidle' });
  if (scenario.hoverTask) await page.getByRole('link', { name: /做调研/ }).hover();
  if (scenario.selectTools) {
    const rows = page.locator('[data-tool-decision-row]');
    await rows.first().waitFor();
    await rows.nth(0).getByRole('checkbox').check();
    await rows.nth(1).getByRole('checkbox').check();
  }
  if (scenario.openCompare) {
    await page.getByRole('button', { name: /比较 2 款/ }).click();
    await page.waitForURL((url) => url.pathname === '/compare');
  }
  if (scenario.openAuth) {
    await page.getByRole('button', { name: '登录', exact: true }).first().click();
    await page.getByRole('dialog').waitFor();
  }
}

async function setTheme(page, theme) {
  const dark = await page.locator('html.dark').count() > 0;
  if (theme === 'dark' && !dark) await page.getByRole('button', { name: '切换到暗色主题' }).click();
  if (theme === 'light' && dark) await page.getByRole('button', { name: '切换到亮色主题' }).click();
  await page.waitForFunction((expected) => document.documentElement.classList.contains('dark') === expected, theme === 'dark');
  await page.waitForTimeout(180);
}

async function assertTokens(page, theme, label) {
  const expected = themes[theme];
  const actual = await page.evaluate((names) => {
    const style = getComputedStyle(document.documentElement);
    return Object.fromEntries(names.map((name) => [name, style.getPropertyValue(name).trim().toLowerCase()]));
  }, Object.keys(expected).filter((name) => name.startsWith('--')));
  for (const [name, value] of Object.entries(actual)) {
    if (value !== expected[name]) fail(`${label}: ${name} is ${value}, expected ${expected[name]}`);
  }
}

async function assertNoOverflow(page, label) {
  const geometry = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  if (geometry.scrollWidth > geometry.clientWidth + 1) {
    fail(`${label}: horizontal overflow ${geometry.scrollWidth} > ${geometry.clientWidth}`);
  }
}

async function assertCarbonSurfaces(page, scenario, theme, label) {
  const surfaces = page.locator('[data-carbon-surface]');
  const count = await surfaces.count();
  if (scenario.carbon && count === 0) fail(`${label}: carbon surface missing`);
  if (!scenario.carbon && count !== 0) fail(`${label}: unexpected carbon surface`);
  for (let index = 0; index < count; index += 1) {
    const style = await surfaces.nth(index).evaluate((element) => {
      const computed = getComputedStyle(element);
      return {
        background: computed.backgroundColor,
        color: computed.color,
        border: computed.borderTopColor,
      };
    });
    if (style.background !== themes[theme].toolBackground) fail(`${label}: carbon background is ${style.background}`);
    if (style.color !== 'rgb(232, 247, 251)') fail(`${label}: carbon text is ${style.color}`);
    if (style.border !== 'rgb(88, 112, 123)') fail(`${label}: carbon keyline is ${style.border}`);
  }
}

async function assertSelectedRails(page, scenario, theme, label) {
  if (!scenario.selectTools || scenario.openCompare) return;
  const selectedRows = page.locator('[data-tool-decision-row][data-selected="true"]');
  if (await selectedRows.count() < 2) {
    fail(`${label}: selected rows are missing`);
    return;
  }
  const rail = await selectedRows.first().evaluate((element) => {
    const style = getComputedStyle(element, '::before');
    return { width: style.width, background: style.backgroundColor };
  });
  if (rail.width !== '3px') fail(`${label}: selected rail width is ${rail.width}`);
  if (rail.background !== themes[theme].focus) fail(`${label}: selected rail is ${rail.background}`);
}

async function focusByKeyboard(page, target, label) {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  for (let index = 0; index < 200; index += 1) {
    await page.keyboard.press('Tab');
    if (await target.evaluate((element) => document.activeElement === element)) return;
  }
  throw new Error(`${label}: keyboard could not reach focus target`);
}

async function assertFocusColors(page, scenario, theme, label) {
  const normalTarget = page.getByRole('button', { name: theme === 'dark' ? '切换到亮色主题' : '切换到暗色主题' });
  await focusByKeyboard(page, normalTarget, label);
  const normalOutline = await normalTarget.evaluate((element) => getComputedStyle(element).outlineColor);
  if (normalOutline !== themes[theme].focus) fail(`${label}: normal focus is ${normalOutline}`);
  if (!scenario.carbon) return;
  const carbonTarget = page.locator('[data-carbon-surface]').getByRole('button').first();
  if (await carbonTarget.count() === 0) return;
  await focusByKeyboard(page, carbonTarget, label);
  const carbonOutline = await carbonTarget.evaluate((element) => getComputedStyle(element).outlineColor);
  if (carbonOutline !== 'rgb(70, 217, 242)') fail(`${label}: carbon focus is ${carbonOutline}`);
}

async function assertThemeLayoutInvariant(page, label) {
  const measure = () => page.evaluate(() => {
    const main = document.querySelector('main')?.getBoundingClientRect();
    return {
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      mainLeft: Math.round(main?.left || 0),
      mainWidth: Math.round(main?.width || 0),
    };
  });
  const before = await measure();
  await page.getByRole('button', { name: '切换到暗色主题' }).click();
  const after = await measure();
  for (const key of Object.keys(before)) {
    if (Math.abs(before[key] - after[key]) > 1) fail(`${label}: ${key} shifts ${before[key]} -> ${after[key]}`);
  }
  await page.getByRole('button', { name: '切换到亮色主题' }).click();
  await page.waitForTimeout(180);
}

async function captureScenario(browser, viewport, scenario, theme) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
  const page = await context.newPage();
  const label = `${viewport.width}x${viewport.height} ${theme} ${scenario.name}`;
  const consoleIssues = [];
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) consoleIssues.push(message.text());
  });
  page.on('pageerror', (error) => consoleIssues.push(error.message));
  try {
    await openScenario(page, scenario);
    await setTheme(page, theme);
    await assertTokens(page, theme, label);
    await assertNoOverflow(page, label);
    await assertCarbonSurfaces(page, scenario, theme, label);
    await assertSelectedRails(page, scenario, theme, label);
    await assertFocusColors(page, scenario, theme, label);
    if (theme === 'light') await assertThemeLayoutInvariant(page, label);
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      window.scrollTo(0, 0);
    });
    await page.screenshot({
      path: path.join(qaDir, `${viewport.width}x${viewport.height}-${theme}-${scenario.name}.png`),
    });
  } catch (error) {
    fail(`${label}: ${error.message}`);
  } finally {
    if (consoleIssues.length) fail(`${label}: console issues: ${consoleIssues.slice(0, 5).join(' | ')}`);
    await context.close();
  }
}

async function composeEvidence() {
  if (!process.env.CARBON_QA_SHARP) return;
  const sharp = (await import(pathToFileURL(process.env.CARBON_QA_SHARP).href)).default;
  const referenceRoot = path.resolve('.superpowers/visual-references/task-first');
  const pairs = [
    ['home-desktop.png', '1440x900-light-home.png', 'composite-home.png'],
    ['directory-desktop.png', '1440x900-light-directory.png', 'composite-directory.png'],
    ['detail-desktop.png', '1440x900-light-detail.png', 'composite-detail.png'],
    ['directory-mobile.png', '390x844-light-directory.png', 'composite-directory-mobile.png'],
  ];
  for (const [referenceName, actualName, outputName] of pairs) {
    const reference = path.join(referenceRoot, referenceName);
    const actual = path.join(qaDir, actualName);
    if (!existsSync(reference) || !existsSync(actual)) continue;
    const referenceMeta = await sharp(reference).metadata();
    const actualMeta = await sharp(actual).metadata();
    const width = (referenceMeta.width || 0) + (actualMeta.width || 0);
    const height = Math.max(referenceMeta.height || 0, actualMeta.height || 0);
    await sharp({ create: { width, height, channels: 4, background: '#ffffff' } })
      .composite([
        { input: reference, left: 0, top: 0 },
        { input: actual, left: referenceMeta.width || 0, top: 0 },
      ])
      .png()
      .toFile(path.join(qaDir, outputName));
  }
}

async function main() {
  await mkdir(qaDir, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const viewport of viewports) {
      const scenarios = viewport.allRoutes ? allScenarios : allScenarios.filter((scenario) => coreScenarioNames.has(scenario.name));
      for (const theme of Object.keys(themes)) {
        for (const scenario of scenarios) await captureScenario(browser, viewport, scenario, theme);
      }
    }
  } finally {
    await browser.close();
  }
  await composeEvidence();
  if (failures.length) {
    console.error(failures.join('\n'));
    process.exitCode = 1;
    return;
  }
  console.log(`carbon theme UI guard passed; screenshots: ${qaDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

- [ ] **Step 4: Wire the new contract and guard into the existing CI lifecycle**

Add the source contract after `editorial-ui-contract.test.mjs` in `.github/workflows/deploy.yml`:

```yaml
            next-src/tests/carbon-theme-contract.test.mjs \
```

Run the browser guard against the same already-started production server immediately after the task-first guard:

```yaml
          TASK_FIRST_UI_URL=http://127.0.0.1:4181 node scripts/task-first-ui-guard.mjs
          CARBON_THEME_URL=http://127.0.0.1:4181 CARBON_QA_DIR=/tmp/carbon-console-qa node scripts/carbon-theme-ui-guard.mjs
```

- [ ] **Step 5: Run the guard contract and all source tests**

Run from `next-src`:

```bash
node --test \
  tests/task-decision.test.mjs \
  tests/tools-query-state.test.mjs \
  tests/compare-selection.test.mjs \
  tests/data-loading-contract.test.mjs \
  tests/search-suggestions.test.mjs \
  tests/editorial-ui-contract.test.mjs \
  tests/task-first-ui-contract.test.mjs \
  tests/carbon-theme-contract.test.mjs
npm run lint
npm run build
```

Expected: every source test passes, lint exits 0, and the production build exits 0.

- [ ] **Step 6: Start a production server and run API plus both browser guards**

Use an unused port; the commands below use `4193`. Keep the server in a PTY and stop it after all checks.

Run from `next-src`:

```bash
npm run start -- --hostname 127.0.0.1 --port 4193
```

Run from the repository root in a second shell:

```bash
export CODEX_NODE_MODULES="$(cd "$(dirname "$(command -v node)")/.." && pwd)/node_modules"
TEST_BASE_URL=http://127.0.0.1:4193 node --test next-src/tests/api-regressions.test.mjs
TASK_FIRST_UI_URL=http://127.0.0.1:4193 node scripts/task-first-ui-guard.mjs
CARBON_THEME_URL=http://127.0.0.1:4193 \
CARBON_QA_DIR=/tmp/carbon-console-qa \
CARBON_QA_SHARP="$CODEX_NODE_MODULES/sharp/lib/index.js" \
node scripts/carbon-theme-ui-guard.mjs
```

Expected: API regressions pass 5/5; both UI guards exit 0; `/tmp/carbon-console-qa` contains the light/dark route matrix and four composite PNGs. If `4193` is occupied, choose the next unused port and use it consistently in all three variables.

- [ ] **Step 7: Inspect combined layout/copy evidence and the unmatched theme states**

Open these composites with `view_image` so each approved reference and implementation appear in the same image:

```text
/tmp/carbon-console-qa/composite-home.png
/tmp/carbon-console-qa/composite-directory.png
/tmp/carbon-console-qa/composite-detail.png
/tmp/carbon-console-qa/composite-directory-mobile.png
```

Judge only layout, density, copy, field order, target sizing, overflow, and responsive behavior against the left reference. Judge color/material against the approved carbon spec. Then open these unmatched states directly:

```text
/tmp/carbon-console-qa/1280x720-dark-detail.png
/tmp/carbon-console-qa/1280x720-light-compare.png
/tmp/carbon-console-qa/390x844-dark-directory.png
/tmp/carbon-console-qa/320x700-light-directory.png
/tmp/carbon-console-qa/1440x900-light-auth.png
```

Expected: no overlap, clipping, page-level horizontal overflow, green/gray-green styling, layout shift, or obscured fixed content; carbon surfaces remain deep in both themes; orange appears only in actual risk states.

- [ ] **Step 8: Review the complete diff and commit verification infrastructure**

Run:

```bash
git diff --check
git status --short
git diff --stat HEAD~6
git diff --name-only HEAD~6 -- next-src/public/data next-src/src/stores next-src/src/app/api
```

Expected: the scoped data/store/API command prints nothing. Review the complete `HEAD~6` diff and confirm it contains no route, visible copy, JSON data, Zustand behavior, API, or field-order change. Keep `.superpowers/`, `design-qa.md`, and `/tmp/carbon-console-qa` out of Git.

Commit:

```bash
git add \
  scripts/carbon-theme-ui-guard.mjs \
  next-src/tests/carbon-theme-contract.test.mjs \
  .github/workflows/deploy.yml
git commit -m "test: verify carbon console theme"
```

---

## Completion Gate

Implementation is complete only when all of the following are true:

- The baseline review fixes and each theme task are separate commits.
- Source tests, lint, production build, API regressions, task-first guard, and carbon-theme guard all pass from fresh commands.
- The source scan reports no old gray-green hex, raw red/amber/green/cyan classes, danger/warning variables, white primary foregrounds, or prohibited motion.
- Light/dark root tokens and carbon-surface computed styles match the approved exact values.
- The screenshot matrix includes all listed desktop routes in both themes and the four core task routes at every required responsive viewport.
- Side-by-side evidence preserves the approved layout, density, copy, and field order while using the new palette.
- `.superpowers/`, `design-qa.md`, and `/tmp/carbon-console-qa` remain outside commits.
