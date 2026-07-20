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

async function loadSceneHookModule() {
  const source = read('src/hooks/useSceneData.ts')
    .replace(
      /import \{[^}]+\} from 'react';/,
      `const useCallback = (...args) => globalThis.__sceneHookReact.useCallback(...args);
const useEffect = (...args) => globalThis.__sceneHookReact.useEffect(...args);
const useRef = (...args) => globalThis.__sceneHookReact.useRef(...args);
const useState = (...args) => globalThis.__sceneHookReact.useState(...args);`,
    )
    .replace(
      "import { clearScenesDataCache, getScenesData } from '@/lib/tools-data';",
      `const clearScenesDataCache = (...args) => globalThis.__sceneHookData.clearScenesDataCache(...args);
const getScenesData = (...args) => globalThis.__sceneHookData.getScenesData(...args);`,
    );
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
}

async function loadToolStoreModule() {
  const source = read('src/stores/useToolStore.ts')
    .replace(
      "import { create } from 'zustand';",
      `const create = (initializer) => {
  let state;
  const get = () => state;
  const set = (update) => {
    const next = typeof update === 'function' ? update(state) : update;
    state = { ...state, ...next };
  };
  const store = () => state;
  state = initializer(set, get);
  store.getState = get;
  return store;
};`,
    )
    .replace(
      "import { trackClick } from '@/lib/api';",
      'const trackClick = () => Promise.resolve();',
    );
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
}

function createHookHarness(hook) {
  const state = [];
  const refs = [];
  const effects = [];
  let cursor = 0;
  let result;

  globalThis.__sceneHookReact = {
    useState(initialValue) {
      const index = cursor++;
      if (!(index in state)) state[index] = initialValue;
      return [state[index], (value) => {
        state[index] = typeof value === 'function' ? value(state[index]) : value;
      }];
    },
    useRef(initialValue) {
      const index = cursor++;
      if (!refs[index]) refs[index] = { current: initialValue };
      return refs[index];
    },
    useCallback(callback) {
      cursor++;
      return callback;
    },
    useEffect(callback, dependencies) {
      const index = cursor++;
      const previous = effects[index];
      const changed = !previous || dependencies.some((value, dependencyIndex) => value !== previous.dependencies[dependencyIndex]);
      effects[index] = { callback, dependencies, changed, cleanup: previous?.cleanup };
    },
  };

  return {
    render() {
      cursor = 0;
      result = hook();
      return result;
    },
    runEffects() {
      for (const effect of effects) {
        if (!effect || !effect.changed) continue;
        effect.cleanup?.();
        effect.cleanup = effect.callback();
        effect.changed = false;
      }
    },
  };
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

test('catalog retry keeps its success when the superseded load later fails', async () => {
  const { useToolStore } = await loadToolStoreModule();
  const originalFetch = globalThis.fetch;
  const firstCatalogRequest = deferred();
  const freshData = {
    tools: [{ id: 2, name: 'fresh' }],
    categories: [{ id: 'fresh' }],
  };
  let catalogRequestCount = 0;

  globalThis.fetch = (url) => {
    if (url === '/api/tools') {
      catalogRequestCount += 1;
      if (catalogRequestCount === 1) return firstCatalogRequest.promise;
      return Promise.resolve({ ok: true, json: async () => freshData });
    }
    if (url === '/data/tools.json') {
      return Promise.resolve({ ok: false });
    }
    return Promise.resolve({ ok: true, json: async () => ({ clicks: {} }) });
  };

  try {
    const firstLoad = useToolStore.getState().loadData();
    const retry = useToolStore.getState().retryLoadData();
    await retry;

    firstCatalogRequest.resolve({ ok: false });
    await firstLoad;

    const state = useToolStore.getState();
    assert.equal(state.error, null);
    assert.equal(state.dataLoaded, true);
    assert.equal(state.isLoading, false);
    assert.deepEqual(state.tools, freshData.tools);
    assert.deepEqual(state.categories, freshData.categories);
  } finally {
    globalThis.fetch = originalFetch;
  }
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

test('scene hook ignores a pre-retry rejection when the retry succeeds', async () => {
  const { useSceneData } = await loadSceneHookModule();
  const originalReact = globalThis.__sceneHookReact;
  const originalData = globalThis.__sceneHookData;
  const first = deferred();
  const retry = deferred();
  let call = 0;
  globalThis.__sceneHookData = {
    clearScenesDataCache() {},
    getScenesData() {
      call += 1;
      return call === 1 ? first.promise : retry.promise;
    },
  };

  try {
    const harness = createHookHarness(useSceneData);
    let state = harness.render();
    harness.runEffects();
    state.retry();

    first.promise.catch(() => {});
    first.resolve(Promise.reject(new Error('stale failure')));
    await new Promise((resolve) => setImmediate(resolve));
    state = harness.render();
    harness.runEffects();

    const freshScenes = [{ id: 'retry' }];
    retry.resolve({ scenes: freshScenes });
    await new Promise((resolve) => setImmediate(resolve));
    state = harness.render();

    assert.equal(state.error, null);
    assert.deepEqual(state.scenes, freshScenes);
  } finally {
    globalThis.__sceneHookReact = originalReact;
    globalThis.__sceneHookData = originalData;
  }
});
