# Precision Instrument Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the approved Precision Instrument Console theme with a dark first visit, pre-paint persisted-theme restoration, precise navigation/search states, instrumented homepage sections, and continuous task-first decision lists.

**Architecture:** Keep the existing semantic color system and task-first data flow. Add one dependency-free theme bootstrap module shared by the Zustand store and root layout, then express the console treatment through small global utilities and data attributes on existing components. Extend the existing source contracts and carbon browser guard instead of creating a second visual test system.

**Tech Stack:** Next.js 16 App Router, React 18, TypeScript/JavaScript modules, Tailwind CSS 3, Zustand 5 persistence, Geist, Lucide React, Node test runner, Playwright browser guard.

## Global Constraints

- Preserve all existing Chinese copy, tool/scene data, field order, URLs, APIs, search behavior, comparison behavior, and weekly recommendation selection.
- New users default to dark; persisted `light` or `dark` under `ai-tool-hub-user` wins before first paint.
- Use existing semantic values: dark page `#080B0E`, surface `#10161A`, subtle surface `#151E23`, line `#26343B`, strong line `#58707B`, ink `#E8F7FB`, cyan `#46D9F2`, and signal orange `#F28B3C`.
- Light mode keeps `#F3F6F8`, `#FFFFFF`, `#EAF0F3`, and `#007E99`; no gray-green or green-tinted neutral may return.
- Cyan is only for brand, focus, selection, links, and primary actions; orange is only for actual errors and critical risk.
- Do not add metrics, charts, terminal logs, activity feeds, marketing copy, gradients, glow, glass, background grids, scanlines, particles, 3D effects, scale, rotation, hover movement, or card nesting.
- Keep ordinary radii at 4px or 6px, transitions at 140ms `ease-out`, and interactive targets at least 44x44px.
- Preserve WCAG AA contrast, keyboard operation, `prefers-reduced-motion`, the existing responsive field order, and a 320px minimum width without horizontal overflow.
- Do not commit `.superpowers/`, `design-qa.md`, or generated evidence files. The ignored `.superpowers/sdd/progress.md` ledger may be appended for workflow recovery; do not modify other `.superpowers/` evidence. Do not modify tool JSON or Supabase configuration.

---

## File Map

**Create**

- `next-src/src/lib/theme-bootstrap.mjs`: owns the storage key, dark default, stored-theme resolution, and self-contained pre-paint script.
- `next-src/src/lib/theme-bootstrap.d.mts`: declares the bootstrap module's exact `Theme` contract for TypeScript consumers.

**Modify: theme initialization**

- `next-src/src/stores/useUserStore.ts:1-30,89-105`: consume the shared dark default and storage key without changing other persisted state.
- `next-src/src/app/layout.tsx:1-70`: execute the shared bootstrap in `<head>` before the application body renders.
- `next-src/tests/carbon-theme-contract.test.mjs:1-12,589-651`: unit-test storage resolution and the pre-paint script.

**Modify: shared console chrome**

- `next-src/src/app/globals.css:5-160`: add reusable navigation-rail and instrument-section utilities using current tokens.
- `next-src/src/components/layout/Navbar.tsx:37-95`: add explicit active semantics and the shared 2px rail.
- `next-src/src/components/layout/BottomNav.tsx:23-51`: add the mobile active rail without changing its geometry.
- `next-src/src/components/hero/SearchBar.tsx:156-267`: replace the filled focus ring with a 2px cyan outline and expose the shell to browser QA.

**Modify: homepage work surface**

- `next-src/src/app/page.tsx:37-60`: mark the primary, task, and weekly sections and keep the 1160px content width.
- `next-src/src/components/home/TaskEntryList.tsx:1-20`: expose task-grid/entry hooks and give hover, focus, and keylines the same state contract.
- `next-src/src/components/tools/ToolDecisionList.tsx:48-76`: expose the continuous list to browser QA.
- `next-src/src/components/tools/ToolDecisionRow.tsx:44-110`: remove compact mobile card framing while preserving the six-field desktop grid and detail action.
- `next-src/tests/task-first-ui-contract.test.mjs:51-161`: lock the approved homepage structure and continuous compact composition.

**Modify: browser acceptance**

- `scripts/carbon-theme-ui-guard.mjs:1-100,197-312,637-806,875-906`: verify the initial theme, console sections, responsive task columns, focus outline, continuous rows, and updated 320x844 viewport.
- `next-src/tests/carbon-theme-contract.test.mjs:954-1071`: require the new browser checks to stay in the capture path.

---

### Task 0: Capture the Exact Pre-Change Baseline

**Files:**

- Verify only: `next-src/src/app/page.tsx`, `next-src/src/app/globals.css`, and the current production build.
- Generated evidence: `/tmp/precision-console-baseline/*.png` (do not commit).

**Interfaces:**

- Consumes: the approved worktree before product-code edits and the existing carbon-theme browser guard.
- Produces: same-revision desktop/mobile screenshots for the final before/after comparison; no tracked changes.

- [ ] **Step 1: Prove the rendered source still matches production revision `eb432d`**

Run:

```bash
git diff --exit-code eb432d -- \
  next-src/src/app/page.tsx \
  next-src/src/app/globals.css \
  next-src/src/components/layout/Navbar.tsx \
  next-src/src/components/home/TaskEntryList.tsx \
  next-src/src/components/hero/SearchBar.tsx \
  next-src/src/components/tools/ToolDecisionRow.tsx
```

Expected: exit 0 with no diff. The approved spec and plan commits may differ from `eb432d`, but these product files must not.

- [ ] **Step 2: Build the unchanged production application**

Run:

```bash
npm --prefix next-src run build
```

Expected: Next.js production build succeeds.

- [ ] **Step 3: Start the unchanged build on port 4181**

Run in a persistent terminal from the repository root:

```bash
npm --prefix next-src run start -- --hostname 127.0.0.1 --port 4181
```

Expected: Next.js reports ready at `http://127.0.0.1:4181` and remains running for Step 4.

- [ ] **Step 4: Capture the current route/theme/viewport matrix**

Run from a second terminal:

```bash
CARBON_THEME_URL=http://127.0.0.1:4181 \
  CARBON_QA_DIR=/tmp/precision-console-baseline \
  node scripts/carbon-theme-ui-guard.mjs
```

Expected: the existing guard reports `50 screenshots` and exits 0.

- [ ] **Step 5: Inspect and retain the homepage baseline**

Open these exact files together in one workspace image-viewer call:

```text
/tmp/precision-console-baseline/1440x900-dark-home.png
/tmp/precision-console-baseline/1440x900-light-home.png
/tmp/precision-console-baseline/390x844-dark-home.png
/tmp/precision-console-baseline/390x844-light-home.png
```

Expected: all four are nonblank and show the unchanged production copy, 8 tasks, weekly list, and correct mobile navigation. Keep this directory until Task 5 completes.

- [ ] **Step 6: Stop the baseline server and confirm no tracked changes**

Stop the persistent server with `Ctrl+C`, then run:

```bash
git status --short
```

Expected: only pre-existing `.superpowers/` and `design-qa.md` are untracked; baseline evidence remains outside the repository.

---

### Task 1: Dark-First Theme Bootstrap

**Files:**

- Create: `next-src/src/lib/theme-bootstrap.mjs`
- Create: `next-src/src/lib/theme-bootstrap.d.mts`
- Modify: `next-src/src/stores/useUserStore.ts:1-30,89-105`
- Modify: `next-src/src/app/layout.tsx:1-70`
- Test: `next-src/tests/carbon-theme-contract.test.mjs:1-12,589-651`

**Interfaces:**

- Consumes: persisted Zustand JSON shaped as `{ state: { theme?: unknown } }` under `ai-tool-hub-user`.
- Produces: `Theme`, `DEFAULT_THEME`, `THEME_STORAGE_KEY`, `resolveStoredTheme(raw, fallback)`, and `THEME_BOOTSTRAP_SCRIPT` for the store, layout, tests, and browser guard.

- [ ] **Step 1: Add failing bootstrap contract tests**

Add the imports and helper below to `next-src/tests/carbon-theme-contract.test.mjs`:

```js
import vm from 'node:vm';

function runThemeBootstrap(script, raw, storageError = false) {
  const classNames = new Set();
  let requestedKey = null;
  const root = {
    classList: {
      contains: (name) => classNames.has(name),
      toggle: (name, enabled) => enabled ? classNames.add(name) : classNames.delete(name),
    },
    style: {},
  };
  vm.runInNewContext(script, {
    document: { documentElement: root },
    window: {
      localStorage: {
        getItem(key) {
          requestedKey = key;
          if (storageError) throw new Error('storage unavailable');
          return raw;
        },
      },
    },
  });
  return {
    colorScheme: root.style.colorScheme,
    dark: root.classList.contains('dark'),
    requestedKey,
  };
}
```

Add this async test after the existing metadata/radius/motion test. The explicit
`existsSync` assertion supplies the RED failure without turning a missing module
into a test-loader error:

```js
test('boots dark before paint while honoring a persisted theme', async () => {
  const layout = read('src/app/layout.tsx');
  const store = read('src/stores/useUserStore.ts');
  const moduleUrl = new URL('../src/lib/theme-bootstrap.mjs', import.meta.url);

  assert.equal(existsSync(moduleUrl), true, 'missing theme bootstrap module');
  const {
    DEFAULT_THEME,
    THEME_BOOTSTRAP_SCRIPT,
    THEME_STORAGE_KEY,
    resolveStoredTheme,
  } = await import(`${moduleUrl.href}?contract=${Date.now()}`);

  assert.equal(DEFAULT_THEME, 'dark');
  assert.equal(THEME_STORAGE_KEY, 'ai-tool-hub-user');
  assert.equal(resolveStoredTheme(null, DEFAULT_THEME), 'dark');
  assert.equal(resolveStoredTheme('{bad json', DEFAULT_THEME), 'dark');
  assert.equal(resolveStoredTheme(JSON.stringify({ state: { theme: 'light' } }), DEFAULT_THEME), 'light');
  assert.equal(resolveStoredTheme(JSON.stringify({ state: { theme: 'dark' } }), DEFAULT_THEME), 'dark');
  assert.equal(resolveStoredTheme(JSON.stringify({ state: { theme: 'green' } }), DEFAULT_THEME), 'dark');

  assert.deepEqual(runThemeBootstrap(THEME_BOOTSTRAP_SCRIPT, null), {
    colorScheme: 'dark',
    dark: true,
    requestedKey: 'ai-tool-hub-user',
  });
  assert.deepEqual(runThemeBootstrap(THEME_BOOTSTRAP_SCRIPT, JSON.stringify({ state: { theme: 'light' } })), {
    colorScheme: 'light',
    dark: false,
    requestedKey: 'ai-tool-hub-user',
  });
  assert.deepEqual(runThemeBootstrap(THEME_BOOTSTRAP_SCRIPT, null, true), {
    colorScheme: 'dark',
    dark: true,
    requestedKey: 'ai-tool-hub-user',
  });
  assert.match(store, /theme:\s*DEFAULT_THEME/);
  assert.match(store, /name:\s*THEME_STORAGE_KEY/);
  assert.match(store, /document\.documentElement\.style\.colorScheme = newTheme/);
  assert.match(layout, /id="theme-bootstrap"/);
  assert.match(layout, /dangerouslySetInnerHTML=\{\{ __html: THEME_BOOTSTRAP_SCRIPT \}\}/);
  assert.ok(layout.indexOf('id="theme-bootstrap"') < layout.indexOf('<body'));
});
```

- [ ] **Step 2: Run the focused test and confirm the missing module failure**

Run:

```bash
node --test --test-name-pattern="boots dark before paint" next-src/tests/carbon-theme-contract.test.mjs
```

Expected: FAIL with `AssertionError: missing theme bootstrap module`.

- [ ] **Step 3: Create the shared bootstrap module and declarations**

Create `next-src/src/lib/theme-bootstrap.mjs`:

```js
export const DEFAULT_THEME = 'dark';
export const THEME_STORAGE_KEY = 'ai-tool-hub-user';

export function resolveStoredTheme(raw, fallback) {
  try {
    const theme = raw ? JSON.parse(raw)?.state?.theme : null;
    return theme === 'light' || theme === 'dark' ? theme : fallback;
  } catch {
    return fallback;
  }
}

export const THEME_BOOTSTRAP_SCRIPT = `(() => {
  const resolveStoredTheme = ${resolveStoredTheme.toString()};
  let stored = null;
  try {
    stored = window.localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
  } catch {
    stored = null;
  }
  const theme = resolveStoredTheme(
    stored,
    ${JSON.stringify(DEFAULT_THEME)},
  );
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
})();`;
```

Create `next-src/src/lib/theme-bootstrap.d.mts`:

```ts
export type Theme = 'dark' | 'light';

export const DEFAULT_THEME: Theme;
export const THEME_STORAGE_KEY: 'ai-tool-hub-user';
export const THEME_BOOTSTRAP_SCRIPT: string;
export function resolveStoredTheme(raw: string | null, fallback: Theme): Theme;
```

- [ ] **Step 4: Wire the store and root layout to the shared contract**

In `next-src/src/stores/useUserStore.ts`, add:

```ts
import { DEFAULT_THEME, THEME_STORAGE_KEY } from '@/lib/theme-bootstrap.mjs';
```

Replace the default and persistence name with:

```ts
theme: DEFAULT_THEME,
```

```ts
name: THEME_STORAGE_KEY,
```

In `toggleTheme`, update both the class and the native color-scheme hint:

```ts
if (typeof document !== 'undefined') {
  document.documentElement.classList.toggle('dark', newTheme === 'dark');
  document.documentElement.style.colorScheme = newTheme;
}
```

In `next-src/src/app/layout.tsx`, add:

```ts
import { THEME_BOOTSTRAP_SCRIPT } from '@/lib/theme-bootstrap.mjs';
```

Insert this `<head>` immediately inside `<html>` and before `<body>`:

```tsx
<head>
  <script
    id="theme-bootstrap"
    dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }}
  />
</head>
```

- [ ] **Step 5: Run the bootstrap contract and lint**

Run:

```bash
node --test --test-name-pattern="boots dark before paint" next-src/tests/carbon-theme-contract.test.mjs
npm --prefix next-src run lint
```

Expected: the focused contract passes and ESLint exits 0.

- [ ] **Step 6: Commit the dark-first bootstrap**

```bash
git add \
  next-src/src/lib/theme-bootstrap.mjs \
  next-src/src/lib/theme-bootstrap.d.mts \
  next-src/src/stores/useUserStore.ts \
  next-src/src/app/layout.tsx \
  next-src/tests/carbon-theme-contract.test.mjs
git commit -m "feat: bootstrap the dark console theme"
```

---

### Task 2: Precision Navigation Rails and Search Focus

**Files:**

- Modify: `next-src/tests/carbon-theme-contract.test.mjs:608-651`
- Modify: `next-src/src/app/globals.css:84-160`
- Modify: `next-src/src/components/layout/Navbar.tsx:47-63`
- Modify: `next-src/src/components/layout/BottomNav.tsx:29-49`
- Modify: `next-src/src/components/hero/SearchBar.tsx:156-220`

**Interfaces:**

- Consumes: `--accent`, `--accent-soft`, `--line-strong`, and the existing `active` route booleans.
- Produces: `.instrument-nav-item`, `data-orientation`, `data-active`, `aria-current`, and `data-search-shell` for CSS and browser QA.

- [ ] **Step 1: Add the failing shared-chrome contract**

Add this test after the current contrast-safe chrome test:

```js
test('uses precision navigation rails and outline-only search focus', () => {
  const navbar = read('src/components/layout/Navbar.tsx');
  const bottomNav = read('src/components/layout/BottomNav.tsx');
  const search = read('src/components/hero/SearchBar.tsx');

  assert.match(css, /\.instrument-nav-item\[data-orientation='desktop'\]::after/);
  assert.match(css, /\.instrument-nav-item\[data-orientation='mobile'\]::after/);
  assert.match(css, /\.instrument-nav-item\[data-active='true'\]::after/);
  assert.match(navbar, /data-orientation="desktop"/);
  assert.match(navbar, /data-active=\{active \? 'true' : undefined\}/);
  assert.match(navbar, /aria-current=\{active \? 'page' : undefined\}/);
  assert.match(bottomNav, /data-orientation="mobile"/);
  assert.match(bottomNav, /data-active=\{active \? 'true' : undefined\}/);
  assert.match(search, /data-search-shell/);
  assert.match(search, /outline outline-2 outline-offset-2 outline-\[var\(--accent\)\]/);
  assert.doesNotMatch(search, /ring-2 ring-\[var\(--accent-soft\)\]/);
});
```

- [ ] **Step 2: Run the focused test and confirm the missing rail failure**

Run:

```bash
node --test --test-name-pattern="precision navigation rails" next-src/tests/carbon-theme-contract.test.mjs
```

Expected: FAIL because `.instrument-nav-item` and `data-search-shell` do not exist.

- [ ] **Step 3: Add the shared rail utility**

Add this block to `next-src/src/app/globals.css` before `@layer utilities`:

```css
.instrument-nav-item {
  position: relative;
}

.instrument-nav-item::after {
  position: absolute;
  height: 2px;
  background: transparent;
  content: '';
  pointer-events: none;
  transition: background-color var(--transition-duration) ease-out;
}

.instrument-nav-item[data-orientation='desktop']::after {
  right: 0;
  bottom: 0;
  left: 0;
}

.instrument-nav-item[data-orientation='mobile']::after {
  top: 0;
  right: 16px;
  left: 16px;
}

.instrument-nav-item[data-active='true']::after {
  background: var(--accent);
}
```

- [ ] **Step 4: Apply active semantics to both navigation surfaces**

On each desktop route link in `Navbar.tsx`, add:

```tsx
data-orientation="desktop"
data-active={active ? 'true' : undefined}
aria-current={active ? 'page' : undefined}
```

Add `instrument-nav-item` to its existing class list and remove the conditional child span:

```tsx
{active ? <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[var(--accent)]" /> : null}
```

On each route link in `BottomNav.tsx`, add:

```tsx
data-orientation="mobile"
data-active={active ? 'true' : undefined}
```

Add `instrument-nav-item` to the existing class list and keep the existing `aria-current`.

- [ ] **Step 5: Replace the search glow-like ring with an exact outline**

Add `data-search-shell` to the search wrapper in `SearchBar.tsx` and replace its focused class with:

```tsx
focused
  ? 'border-[var(--accent)] outline outline-2 outline-offset-2 outline-[var(--accent)]'
  : 'border-[var(--line-strong)] hover:border-[var(--muted-subtle)]'
```

Keep the existing height, submit action, suggestions, keyboard handlers, and 44px controls unchanged.

- [ ] **Step 6: Run the shared-chrome contracts and lint**

Run:

```bash
node --test --test-name-pattern="contrast-safe chrome|precision navigation rails" next-src/tests/carbon-theme-contract.test.mjs
npm --prefix next-src run lint
```

Expected: both focused contracts pass and ESLint exits 0.

- [ ] **Step 7: Commit the shared console chrome**

```bash
git add \
  next-src/tests/carbon-theme-contract.test.mjs \
  next-src/src/app/globals.css \
  next-src/src/components/layout/Navbar.tsx \
  next-src/src/components/layout/BottomNav.tsx \
  next-src/src/components/hero/SearchBar.tsx
git commit -m "feat: add precision console navigation states"
```

---

### Task 3: Instrumented Homepage and Continuous Decision List

**Files:**

- Modify: `next-src/tests/task-first-ui-contract.test.mjs:51-161`
- Modify: `next-src/tests/carbon-theme-contract.test.mjs:608-651`
- Modify: `next-src/src/app/globals.css:84-180`
- Modify: `next-src/src/app/page.tsx:37-60`
- Modify: `next-src/src/components/home/TaskEntryList.tsx:5-20`
- Modify: `next-src/src/components/tools/ToolDecisionList.tsx:48-76`
- Modify: `next-src/src/components/tools/ToolDecisionRow.tsx:44-110`

**Interfaces:**

- Consumes: the existing `SearchBar`, `TaskEntryList`, `ToolDecisionList`, six weekly models, responsive breakpoints, and semantic theme variables.
- Produces: `data-console-home`, three `data-instrument-section` values, `.instrument-section`, `data-task-entry-list`, `data-task-entry`, and `data-decision-list` for rendered QA.

- [ ] **Step 1: Lock the approved homepage composition with failing tests**

Add this test after `reference-locked discovery copy and compact composition stay normalized` in `task-first-ui-contract.test.mjs`:

```js
test('homepage uses instrument sections and one continuous task-first list', () => {
  const home = read('src/app/page.tsx');
  const tasks = read('src/components/home/TaskEntryList.tsx');
  const list = read('src/components/tools/ToolDecisionList.tsx');
  const row = read('src/components/tools/ToolDecisionRow.tsx');

  assert.match(home, /data-console-home/);
  assert.deepEqual(
    [...home.matchAll(/data-instrument-section="([^"]+)"/g)].map((match) => match[1]),
    ['primary', 'tasks', 'weekly'],
  );
  assert.match(home, /data-instrument-section="tasks" className="instrument-section border-t border-\[var\(--line\)\]"/);
  assert.match(home, /data-instrument-section="weekly" className="instrument-section border-t border-\[var\(--line\)\]"/);
  assert.match(tasks, /data-task-entry-list/);
  assert.match(tasks, /data-task-entry/);
  assert.match(tasks, /focus-visible:border-l-\[var\(--accent\)\]/);
  assert.match(list, /data-decision-list/);
  assert.doesNotMatch(row, /rounded-md border md:grid-cols/);
});
```

In the existing `compact decision rows restore the six-field desktop grid` test, replace the compact-class assertion with:

```js
assert.match(row, /: 'grid-cols-\[minmax\(0,1fr\)_44px\] md:grid-cols-\[44px_minmax\(120px,.9fr\)_minmax\(110px,.75fr\)_minmax\(180px,1.25fr\)_minmax\(88px,.6fr\)_44px\] lg:grid-cols-\[44px_minmax\(150px,1fr\)_minmax\(130px,.85fr\)_minmax\(220px,1.35fr\)_minmax\(100px,.65fr\)_44px\]'/);
```

Add these assertions to the precision-chrome test in `carbon-theme-contract.test.mjs`:

```js
assert.match(css, /\.instrument-section::before/);
assert.match(css, /\.instrument-section::after/);
assert.match(css, /@media \(min-width: 768px\)/);
assert.doesNotMatch(css, /repeating-(?:linear|radial)-gradient/);
```

- [ ] **Step 2: Run the focused homepage contracts and confirm failure**

Run:

```bash
node --test --test-name-pattern="instrument sections|compact decision rows|precision navigation rails" \
  next-src/tests/task-first-ui-contract.test.mjs \
  next-src/tests/carbon-theme-contract.test.mjs
```

Expected: FAIL because the section/data hooks and continuous compact row are absent.

- [ ] **Step 3: Add bounded instrument markers to the existing theme**

Add this block to `globals.css` after the navigation-rail utility:

```css
.instrument-section {
  position: relative;
}

@media (min-width: 768px) {
  .instrument-section::before,
  .instrument-section::after {
    position: absolute;
    top: -1px;
    width: 20px;
    height: 1px;
    background: var(--line-strong);
    content: '';
    pointer-events: none;
  }

  .instrument-section::before {
    left: max(16px, calc((100% - 1160px) / 2));
  }

  .instrument-section::after {
    right: max(16px, calc((100% - 1160px) / 2));
  }
}
```

This creates exactly two desktop boundary marks per instrumented section and no repeated background pattern.

- [ ] **Step 4: Mark the three homepage bands without changing copy or data flow**

Replace the return block in `page.tsx` with this structure while retaining the existing loading/error expressions verbatim:

```tsx
return (
  <main data-console-home className="min-h-screen bg-[var(--page)] text-[var(--ink)]">
    <section data-instrument-section="primary">
      <div className="mx-auto max-w-[1160px] px-4 py-9 sm:px-0 sm:pb-0 sm:pt-12">
        <div className="max-w-3xl">
          <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">按任务找到合适的 AI 工具</h1>
          <p className="mt-3 text-[var(--muted)]">先确定任务，再比较能力、价格和使用条件</p>
          <div className="mt-6"><SearchBar /></div>
        </div>
      </div>
    </section>
    <section data-instrument-section="tasks" className="instrument-section border-t border-[var(--line)]">
      <div className="mx-auto max-w-[1160px] px-4 py-9 sm:px-0 sm:py-12">
        <h2 className="mb-5 text-xl font-semibold sm:text-2xl">你要完成什么？</h2>
        {scenesLoading ? <div role="status" className="h-52 border-y border-[var(--line)]" /> : null}
        {scenesError ? <div role="alert" className="border-l-4 border-[var(--signal)] bg-[var(--signal-soft)] p-4 text-[var(--signal-ink)]"><p>{scenesError}</p><button type="button" onClick={retryScenes} className="mt-3 min-h-11 rounded-md border border-[var(--signal-ink)] px-4">重新加载</button></div> : null}
        {!scenesLoading && !scenesError ? <TaskEntryList scenes={scenes} /> : null}
      </div>
    </section>
    <section data-instrument-section="weekly" className="instrument-section border-t border-[var(--line)]">
      <div className="mx-auto max-w-[1160px] px-4 py-9 sm:px-0 sm:py-12">
        <h2 className="mb-5 text-xl font-semibold sm:text-2xl">本周值得试</h2>
        <ToolDecisionList groups={[{ id: 'weekly', items: weeklyTools }]} variant="compact" showCompare={false} isLoading={isLoading} error={error} onRetry={retryLoadData} />
      </div>
    </section>
  </main>
);
```

- [ ] **Step 5: Align task and recommendation states to the continuous surface**

Replace `TaskEntryList` with:

```tsx
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { Scene } from '@/types/tool';

export function TaskEntryList({ scenes }: { scenes: Scene[] }) {
  return (
    <div data-task-entry-list className="grid grid-cols-1 border-y border-[var(--line-strong)] sm:grid-cols-2 lg:grid-cols-4">
      {scenes.map((scene) => (
        <Link
          data-task-entry
          key={scene.id}
          href={`/tools?scene=${encodeURIComponent(scene.id)}`}
          className="group flex min-h-[104px] items-center justify-between gap-3 border-l-[3px] border-l-transparent border-b border-[var(--line)] px-5 py-4 hover:border-l-[var(--accent)] hover:bg-[var(--surface-hover)] focus-visible:border-l-[var(--accent)] focus-visible:bg-[var(--surface-hover)] sm:border-r lg:min-h-[90px]"
        >
          <span className="min-w-0"><strong className="block text-sm">{scene.name.replace(/^我要/, '')}</strong><span className="mt-1 block text-xs text-[var(--muted)]">{scene.description}</span></span>
          <ChevronRight className="h-4 w-4 shrink-0 text-[var(--muted-subtle)] group-hover:text-[var(--accent)]" aria-hidden="true" />
        </Link>
      ))}
    </div>
  );
}
```

In `ToolDecisionList.tsx`, change the outer wrapper to:

```tsx
<div data-decision-list>
```

In the compact branch of `ToolDecisionRow.tsx`, replace:

```tsx
'grid-cols-[minmax(0,1fr)_44px] rounded-md border md:grid-cols-[44px_minmax(120px,.9fr)_minmax(110px,.75fr)_minmax(180px,1.25fr)_minmax(88px,.6fr)_44px] md:rounded-none md:border-x-0 md:border-t-0 lg:grid-cols-[44px_minmax(150px,1fr)_minmax(130px,.85fr)_minmax(220px,1.35fr)_minmax(100px,.65fr)_44px]'
```

with:

```tsx
'grid-cols-[minmax(0,1fr)_44px] md:grid-cols-[44px_minmax(120px,.9fr)_minmax(110px,.75fr)_minmax(180px,1.25fr)_minmax(88px,.6fr)_44px] lg:grid-cols-[44px_minmax(150px,1fr)_minmax(130px,.85fr)_minmax(220px,1.35fr)_minmax(100px,.65fr)_44px]'
```

Keep the explicit 44px detail link as the row's navigation action; do not add nested or overlay links.

- [ ] **Step 6: Run homepage contracts, existing interaction tests, and lint**

Run:

```bash
node --test \
  next-src/tests/task-first-ui-contract.test.mjs \
  next-src/tests/search-suggestions.test.mjs \
  next-src/tests/carbon-theme-contract.test.mjs
npm --prefix next-src run lint
```

Expected: all listed tests pass and ESLint exits 0.

- [ ] **Step 7: Commit the instrumented homepage**

```bash
git add \
  next-src/tests/task-first-ui-contract.test.mjs \
  next-src/tests/carbon-theme-contract.test.mjs \
  next-src/src/app/globals.css \
  next-src/src/app/page.tsx \
  next-src/src/components/home/TaskEntryList.tsx \
  next-src/src/components/tools/ToolDecisionList.tsx \
  next-src/src/components/tools/ToolDecisionRow.tsx
git commit -m "feat: instrument the task-first homepage"
```

---

### Task 4: Browser Guard for Initial Theme and Instrument Geometry

**Files:**

- Modify: `next-src/tests/carbon-theme-contract.test.mjs:954-1071`
- Modify: `scripts/carbon-theme-ui-guard.mjs:1-100,197-312,637-806,875-906`

**Interfaces:**

- Consumes: `DEFAULT_THEME`, `THEME_STORAGE_KEY`, rendered data attributes from Tasks 2-3, and the existing 50-case capture plan.
- Produces: `assertInitialTheme(browser)` and `assertInstrumentConsole(page, scenario, theme, label)` in the existing CI browser lifecycle.

- [ ] **Step 1: Require the new browser checks with a failing contract**

In `wires the complete carbon route, state, geometry, focus, and evidence guard into CI`, update the expected viewport pairs to:

```js
assert.deepEqual(viewportPairs, [[1440, 900], [1280, 720], [768, 1024], [390, 844], [320, 844]]);
```

Add these function names to the existing function-presence loop:

```js
'assertInitialTheme',
'assertInstrumentConsole',
```

Add these capture/main assertions:

```js
assert.match(capture, /await assertInstrumentConsole\(/);
assert.match(main, /await assertInitialTheme\(browser\)/);
assert.match(functionBody('assertInstrumentConsole'), /gridTemplateColumns/);
assert.match(functionBody('assertInstrumentConsole'), /data-instrument-section/);
assert.match(functionBody('assertInstrumentConsole'), /data-search-shell/);
assert.match(functionBody('assertInitialTheme'), /THEME_STORAGE_KEY/);
assert.match(functionBody('assertInitialTheme'), /DEFAULT_THEME/);
```

- [ ] **Step 2: Run the guard contract and confirm failure**

Run:

```bash
node --test --test-name-pattern="wires the complete carbon" next-src/tests/carbon-theme-contract.test.mjs
```

Expected: FAIL because the viewport and two guard functions are not implemented.

- [ ] **Step 3: Add initial-theme verification to the browser guard**

Add this import to `scripts/carbon-theme-ui-guard.mjs`:

```js
import { DEFAULT_THEME, THEME_STORAGE_KEY } from '../next-src/src/lib/theme-bootstrap.mjs';
```

Add this function before `assertScenarioIdentity`:

```js
async function assertInitialTheme(browser) {
  const cases = [
    { name: 'new visitor', stored: null, expected: DEFAULT_THEME },
    { name: 'persisted light', stored: 'light', expected: 'light' },
    { name: 'persisted dark', stored: 'dark', expected: 'dark' },
  ];
  for (const entry of cases) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    if (entry.stored) {
      await context.addInitScript(({ key, theme }) => {
        try {
          localStorage.setItem(key, JSON.stringify({ state: { theme }, version: 0 }));
        } catch {
          // The script runs again after the target origin is created.
        }
      }, { key: THEME_STORAGE_KEY, theme: entry.stored });
    }
    const page = await context.newPage();
    try {
      const response = await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
      if (!response || !response.ok()) throw new Error(`${entry.name}: navigation failed`);
      const actual = await page.evaluate(() => ({
        colorScheme: document.documentElement.style.colorScheme,
        dark: document.documentElement.classList.contains('dark'),
      }));
      const expectedDark = entry.expected === 'dark';
      if (actual.dark !== expectedDark || actual.colorScheme !== entry.expected) {
        throw new Error(`${entry.name}: initial theme is ${JSON.stringify(actual)}, expected ${entry.expected}`);
      }
    } finally {
      await context.close();
    }
  }
}
```

Call it in `main()` immediately after Chromium launches and before `assertAuthoritativeRatingFlow(browser)`:

```js
await assertInitialTheme(browser);
```

- [ ] **Step 4: Add rendered console geometry verification**

Change the 320 viewport entry to:

```js
{ width: 320, height: 844 },
```

Add this function after `assertHomeHover`:

```js
async function assertInstrumentConsole(page, scenario, theme, label) {
  if (scenario.name !== 'home') return;
  await requireCount(page.locator('[data-instrument-section]'), 3, `${label} instrument sections`);
  await requireCount(page.locator('[data-task-entry]'), 8, `${label} task entries`);
  await requireCount(page.locator('[data-decision-list] [data-tool-decision-row]'), 6, `${label} weekly rows`);
  if (await page.getByRole('checkbox', { name: /对比/ }).count()) {
    fail(`${label}: homepage exposes compare checkboxes`);
  }

  const taskGrid = page.locator('[data-task-entry-list]');
  const columnCount = await taskGrid.evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length);
  const width = await page.evaluate(() => innerWidth);
  const expectedColumns = width >= 1024 ? 4 : width >= 640 ? 2 : 1;
  if (columnCount !== expectedColumns) fail(`${label}: task columns ${columnCount}, expected ${expectedColumns}`);

  const tasksSection = page.locator('[data-instrument-section="tasks"]');
  const marker = await tasksSection.evaluate((element) => {
    const style = getComputedStyle(element, '::before');
    return { background: style.backgroundColor, height: style.height, width: style.width };
  });
  if (width >= 768) {
    if (marker.width !== '20px' || marker.height !== '1px') fail(`${label}: marker geometry ${JSON.stringify(marker)}`);
  } else if (marker.width === '20px') {
    fail(`${label}: desktop marker is visible on mobile`);
  }

  const search = page.getByRole('combobox', { name: '搜索工具、任务或能力' });
  await search.focus();
  await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-search-shell]')).outlineWidth === '2px');
  const searchOutline = await page.locator('[data-search-shell]').evaluate((element) => {
    const style = getComputedStyle(element);
    return { color: style.outlineColor, offset: style.outlineOffset, width: style.outlineWidth };
  });
  if (searchOutline.color !== themes[theme].focus || searchOutline.offset !== '2px' || searchOutline.width !== '2px') {
    fail(`${label}: search outline ${JSON.stringify(searchOutline)}`);
  }

  const firstRowRadius = await page.locator('[data-decision-list] [data-tool-decision-row]').first()
    .evaluate((element) => getComputedStyle(element).borderRadius);
  if (firstRowRadius !== '0px') fail(`${label}: compact row radius is ${firstRowRadius}`);
}
```

Call it in `captureScenario()` after `assertHomeHover(...)` and before `assertScenarioIdentity(...)`:

```js
await assertInstrumentConsole(page, scenario, theme, label);
```

- [ ] **Step 5: Run the guard wiring contract**

Run:

```bash
node --test --test-name-pattern="wires the complete carbon" next-src/tests/carbon-theme-contract.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit the browser acceptance coverage**

```bash
git add \
  next-src/tests/carbon-theme-contract.test.mjs \
  scripts/carbon-theme-ui-guard.mjs
git commit -m "test: guard the precision console rendering"
```

---

### Task 5: Full Verification and Design QA

**Files:**

- Verify only: all files changed in Tasks 1-4.
- Generated evidence: `/tmp/precision-console-qa/*.png` (do not commit).

**Interfaces:**

- Consumes: the completed implementation, existing test suites, standalone Next.js build, task-first guard, and carbon-theme guard.
- Produces: passing source/build/browser evidence and a clean tracked worktree; no new product code.

- [ ] **Step 1: Run the complete Next.js source suite**

Run:

```bash
node --test \
  next-src/tests/task-decision.test.mjs \
  next-src/tests/tools-query-state.test.mjs \
  next-src/tests/compare-selection.test.mjs \
  next-src/tests/data-loading-contract.test.mjs \
  next-src/tests/search-suggestions.test.mjs \
  next-src/tests/editorial-ui-contract.test.mjs \
  next-src/tests/carbon-theme-contract.test.mjs \
  next-src/tests/task-first-ui-contract.test.mjs
```

Expected: every test passes with zero failures.

- [ ] **Step 2: Run lint, production build, and whitespace checks**

Run:

```bash
npm --prefix next-src run lint
npm --prefix next-src run build
git diff --check
```

Expected: ESLint exits 0, Next.js production build succeeds, and `git diff --check` prints nothing.

- [ ] **Step 3: Start the production build on port 4181**

Run in a persistent terminal from the repository root:

```bash
npm --prefix next-src run start -- --hostname 127.0.0.1 --port 4181
```

Expected: Next.js reports ready at `http://127.0.0.1:4181` and remains running for Steps 4-5.

- [ ] **Step 4: Run both production browser guards**

Run from a second terminal:

```bash
TASK_FIRST_UI_URL=http://127.0.0.1:4181 node scripts/task-first-ui-guard.mjs
CARBON_THEME_URL=http://127.0.0.1:4181 \
  CARBON_QA_DIR=/tmp/precision-console-qa \
  node scripts/carbon-theme-ui-guard.mjs
```

Expected: the task-first guard passes; the carbon guard reports `50 screenshots` and exits 0.

- [ ] **Step 5: Inspect the required visual evidence**

Open each baseline/final pair together in one workspace image-viewer call:

```text
/tmp/precision-console-baseline/1440x900-dark-home.png
/tmp/precision-console-qa/1440x900-dark-home.png
/tmp/precision-console-baseline/1440x900-light-home.png
/tmp/precision-console-qa/1440x900-light-home.png
/tmp/precision-console-baseline/390x844-dark-home.png
/tmp/precision-console-qa/390x844-dark-home.png
/tmp/precision-console-qa/320x844-dark-home.png
```

Expected: every image is nonblank; the final preserves the baseline title, search, 8 tasks, weekly content, and route structure; task columns are 4/1/1 at the final listed widths; text is not clipped; mobile bottom navigation does not overlap content; cyan rails and search outline are crisp; there is no gray-green, glow, gradient, background grid, nested card, or incoherent overlap.

- [ ] **Step 6: Stop the production server and verify repository scope**

Stop the persistent server with `Ctrl+C`, then run:

```bash
git status --short
git log --oneline -5
```

Expected: only pre-existing `.superpowers/` and `design-qa.md` remain untracked; the implementation is represented by four focused commits after the approved spec/plan commits; `/tmp/precision-console-qa` is not tracked.
