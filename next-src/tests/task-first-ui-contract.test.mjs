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

test('untitled decision groups do not reference a missing heading', () => {
  const list = read('src/components/tools/ToolDecisionList.tsx');
  assert.doesNotMatch(list, /aria-labelledby=\{`group-\$\{group\.id\}`\}/);
  assert.match(list, /aria-labelledby=\{group\.title \? `group-\$\{group\.id\}` : undefined\}/);
});

test('superseded components still exist until their route replacement tasks', () => {
  assert.equal(existsSync(new URL('../src/components/tools/ToolGrid.tsx', import.meta.url)), true);
});
