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
