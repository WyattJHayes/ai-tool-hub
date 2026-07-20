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
