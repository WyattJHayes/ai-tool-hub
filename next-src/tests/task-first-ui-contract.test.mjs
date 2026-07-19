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

test('compact decision rows restore the six-field desktop grid', () => {
  const row = read('src/components/tools/ToolDecisionRow.tsx');
  assert.match(row, /: 'grid-cols-\[minmax\(0,1fr\)_44px\] rounded-md border md:grid-cols-\[44px_minmax\(120px,.9fr\)_minmax\(110px,.75fr\)_minmax\(180px,1.25fr\)_minmax\(88px,.6fr\)_44px\] md:rounded-none md:border-x-0 md:border-t-0 lg:grid-cols-\[44px_minmax\(150px,1fr\)_minmax\(130px,.85fr\)_minmax\(220px,1.35fr\)_minmax\(100px,.65fr\)_44px\]'/);
  assert.match(row, /col-start-2 row-start-1 md:col-start-1 md:row-start-1/);
  assert.match(row, /col-start-1 row-start-1 md:col-start-2 md:row-start-1/);
  assert.match(row, /col-span-2 md:col-span-1 md:col-start-3 md:row-start-1/);
  assert.match(row, /col-span-2 md:col-span-1 md:col-start-4 md:row-start-1/);
  assert.match(row, /col-span-1 md:col-start-5 md:row-start-1/);
  assert.match(row, /col-start-2 md:col-start-6 md:row-start-1/);
});

test('the decision list owns loading, retry, empty, and live limit feedback', () => {
  const list = read('src/components/tools/ToolDecisionList.tsx');
  assert.match(list, /role="status"/);
  assert.match(list, /aria-live="polite"/);
  assert.match(list, /清除筛选/);
  assert.match(list, /重新加载/);
  assert.doesNotMatch(list, /ToolCard/);
});

test('untitled decision groups do not reference a missing heading', () => {
  const list = read('src/components/tools/ToolDecisionList.tsx');
  assert.doesNotMatch(list, /aria-labelledby=\{`group-\$\{group\.id\}`\}/);
  assert.match(list, /aria-labelledby=\{group\.title \? `group-\$\{group\.id\}` : undefined\}/);
});

test('superseded components still exist until their route replacement tasks', () => {
  assert.equal(existsSync(new URL('../src/components/tools/ToolGrid.tsx', import.meta.url)), true);
});

test('homepage tasks use canonical scene ids and search preserves the query', () => {
  const entries = read('src/components/home/TaskEntryList.tsx');
  const search = read('src/components/hero/SearchBar.tsx');
  assert.match(entries, /`\/tools\?scene=\$\{encodeURIComponent\(scene\.id\)\}`/);
  assert.match(search, /params\.set\('q', term\)/);
});

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
  assert.match(bar, /data-directory-controls/);
  assert.match(bar, /grid-cols-\[minmax\(0,1fr\)_minmax\(0,1fr\)_minmax\(0,1fr\)\]/);
  assert.match(bar, /max-w-full/);
});
