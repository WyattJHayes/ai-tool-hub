import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

async function loadToolsDataModule() {
  const source = read('src/lib/tools-data.ts').replace(
    "import { deriveToolPrice } from '@/lib/tool-decision.mjs';",
    "const deriveToolPrice = () => ({ summary: '' });",
  );
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
}

function deferred() {
  let resolve;
  const promise = new Promise((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

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

test('scene cache ignores a pre-retry request that resolves after the retry', async () => {
  const { clearScenesDataCache, getScenesData } = await loadToolsDataModule();
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = () => {
    const request = deferred();
    requests.push(request);
    return request.promise;
  };

  try {
    const first = getScenesData();
    clearScenesDataCache();
    const retry = getScenesData();
    const freshData = { scenes: [{ id: 'retry' }] };
    const staleData = { scenes: [{ id: 'stale' }] };

    requests[1].resolve({ ok: true, json: async () => freshData });
    await retry;
    requests[0].resolve({ ok: true, json: async () => staleData });
    await first;

    assert.deepEqual(await getScenesData(), freshData);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
