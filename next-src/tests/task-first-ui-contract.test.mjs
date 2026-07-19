import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

async function loadTypeScriptModule(path, mocks) {
  const ts = await import('typescript');
  const { outputText } = ts.transpileModule(read(path), {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const loadedModule = { exports: {} };
  const requireMock = (id) => {
    if (Object.hasOwn(mocks, id)) return mocks[id];
    throw new Error(`Unexpected test module import: ${id}`);
  };
  const execute = new Function('require', 'module', 'exports', outputText);
  execute(requireMock, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}

function findElements(node, predicate, found = []) {
  if (Array.isArray(node)) {
    node.forEach((item) => findElements(item, predicate, found));
    return found;
  }
  if (!node || typeof node !== 'object') return found;
  if (predicate(node)) found.push(node);
  findElements(node.props?.children, predicate, found);
  return found;
}

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

test('superseded directory components are removed with the route replacement', () => {
  for (const relativePath of [
    '../src/components/tools/CategoryFilter.tsx',
    '../src/components/tools/SortBar.tsx',
    '../src/components/tools/ToolGrid.tsx',
  ]) {
    assert.equal(existsSync(new URL(relativePath, import.meta.url)), false, relativePath);
  }
});

test('tools route wraps search-param client logic in Suspense', () => {
  const page = read('src/app/tools/page.tsx');
  const client = read('src/components/tools/ToolsBrowseClient.tsx');
  assert.match(page, /<Suspense fallback=\{<ToolsPageSkeleton/);
  assert.match(page, /<ToolsBrowseClient/);
  assert.match(client, /selectDirectoryGroups/);
  assert.match(client, /useToolDirectoryQuery/);
  assert.doesNotMatch(client, /filteredTools|selectedCategory|setSort|setSearchTerm/);
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
  assert.match(hook, /routerRef\.current\.replace/);
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

test('catalog hydration at the same URL preserves the scene on the first patch', async () => {
  const queryState = await import(new URL('../src/lib/tools-query-state.mjs', import.meta.url));
  const replaceCalls = [];
  const refs = [];
  let refIndex = 0;
  const searchParams = new URLSearchParams('scene=research');
  const hookModule = await loadTypeScriptModule('src/hooks/useToolDirectoryQuery.ts', {
    react: {
      useCallback: (callback) => callback,
      useEffect: (effect) => effect(),
      useMemo: (factory) => factory(),
      useRef: (value) => {
        const index = refIndex;
        refIndex += 1;
        refs[index] ||= { current: value };
        return refs[index];
      },
    },
    'next/navigation': {
      usePathname: () => '/tools',
      useRouter: () => ({ replace: (...args) => replaceCalls.push(args) }),
      useSearchParams: () => searchParams,
    },
    '@/lib/tools-query-state.mjs': queryState,
  });
  const renderHook = (catalog) => {
    refIndex = 0;
    return hookModule.useToolDirectoryQuery(catalog);
  };

  renderHook({ sceneIds: new Set(), categoryIds: new Set(), platforms: new Set() });
  const hydrated = renderHook({ sceneIds: new Set(['research']), categoryIds: new Set(), platforms: new Set() });
  hydrated.update({ price: 'free-tier' });

  assert.equal(replaceCalls.length, 1);
  assert.equal(replaceCalls[0][0], '/tools?scene=research&price=free-tier');
});

test('catalog hydration merges newly valid URL state with a pending patch', async () => {
  const queryState = await import(new URL('../src/lib/tools-query-state.mjs', import.meta.url));
  const replaceCalls = [];
  const refs = [];
  let refIndex = 0;
  const searchParams = new URLSearchParams('scene=research');
  const hookModule = await loadTypeScriptModule('src/hooks/useToolDirectoryQuery.ts', {
    react: {
      useCallback: (callback) => callback,
      useEffect: (effect) => effect(),
      useMemo: (factory) => factory(),
      useRef: (value) => {
        const index = refIndex;
        refIndex += 1;
        refs[index] ||= { current: value };
        return refs[index];
      },
    },
    'next/navigation': {
      usePathname: () => '/tools',
      useRouter: () => ({ replace: (...args) => replaceCalls.push(args) }),
      useSearchParams: () => searchParams,
    },
    '@/lib/tools-query-state.mjs': queryState,
  });
  const renderHook = (catalog) => {
    refIndex = 0;
    return hookModule.useToolDirectoryQuery(catalog);
  };

  const pending = renderHook({ sceneIds: new Set(), categoryIds: new Set(), platforms: new Set() });
  pending.update({ price: 'free-tier' });
  const hydrated = renderHook({ sceneIds: new Set(['research']), categoryIds: new Set(), platforms: new Set() });
  hydrated.update({ searchTerm: 'claude' });

  assert.equal(replaceCalls.length, 3);
  assert.equal(replaceCalls[2][0], '/tools?scene=research&q=claude&price=free-tier');
});

test('catalog hydration corrects a pending target without another user action', async () => {
  const queryState = await import(new URL('../src/lib/tools-query-state.mjs', import.meta.url));
  const replaceCalls = [];
  const refs = [];
  let refIndex = 0;
  let searchParams = new URLSearchParams('scene=research');
  const hookModule = await loadTypeScriptModule('src/hooks/useToolDirectoryQuery.ts', {
    react: {
      useCallback: (callback) => callback,
      useEffect: (effect) => effect(),
      useMemo: (factory) => factory(),
      useRef: (value) => {
        const index = refIndex;
        refIndex += 1;
        refs[index] ||= { current: value };
        return refs[index];
      },
    },
    'next/navigation': {
      usePathname: () => '/tools',
      useRouter: () => ({ replace: (...args) => replaceCalls.push(args) }),
      useSearchParams: () => searchParams,
    },
    '@/lib/tools-query-state.mjs': queryState,
  });
  const emptyCatalog = { sceneIds: new Set(), categoryIds: new Set(), platforms: new Set() };
  const hydratedCatalog = { sceneIds: new Set(['research']), categoryIds: new Set(), platforms: new Set() };
  const renderHook = (catalog) => {
    refIndex = 0;
    return hookModule.useToolDirectoryQuery(catalog);
  };

  const pending = renderHook(emptyCatalog);
  pending.update({ price: 'free-tier' });
  renderHook(hydratedCatalog);

  assert.deepEqual(replaceCalls.map(([path]) => path), [
    '/tools?price=free-tier',
    '/tools?scene=research&price=free-tier',
  ]);

  searchParams = new URLSearchParams('price=free-tier');
  renderHook(hydratedCatalog);
  assert.equal(replaceCalls.at(-1)[0], '/tools?scene=research&price=free-tier');

  searchParams = new URLSearchParams('scene=research&price=free-tier');
  const committed = renderHook(hydratedCatalog);
  const callsAtCommit = replaceCalls.length;
  const stable = renderHook(hydratedCatalog);

  assert.equal(committed.state.sceneId, 'research');
  assert.equal(committed.state.price, 'free-tier');
  assert.equal(stable.state.sceneId, 'research');
  assert.equal(replaceCalls.length, callsAtCommit);
});

test('directory retry targets failed sources without a duplicate catalog load', async () => {
  let toolRetryCalls = 0;
  let sceneRetryCalls = 0;
  let loadDataCalls = 0;
  let effects = [];
  let refIndex = 0;
  const refs = [];
  const patches = [];
  const directoryState = {
    sceneId: 'research',
    searchTerm: '',
    categoryId: null,
    price: null,
    origins: [],
    platforms: [],
    sort: 'default',
  };
  const toolState = {
    tools: [],
    categories: [],
    clickStats: {},
    isLoading: false,
    error: null,
    dataLoaded: true,
    loadData: () => { loadDataCalls += 1; },
    retryLoadData: () => {
      toolRetryCalls += 1;
      toolState.dataLoaded = false;
      toolState.isLoading = true;
      toolState.error = null;
    },
  };
  const sceneState = {
    scenes: [],
    isLoading: false,
    error: 'scene failed',
    retry: () => { sceneRetryCalls += 1; },
  };
  const ToolDecisionList = () => null;
  const controllerModule = await loadTypeScriptModule('src/components/tools/ToolsBrowseClient.tsx', {
    react: {
      useEffect: (effect) => effects.push(effect),
      useMemo: (factory) => factory(),
      useRef: (value) => {
        const index = refIndex;
        refIndex += 1;
        refs[index] ||= { current: value };
        return refs[index];
      },
      useState: (value) => [value, () => {}],
    },
    '@/hooks/useToolDirectoryQuery': {
      useToolDirectoryQuery: () => ({
        state: directoryState,
        update: (patch) => patches.push(patch),
        currentPath: '/tools?scene=research',
      }),
    },
    '@/hooks/useSceneData': { useSceneData: () => sceneState },
    '@/lib/tool-decision.mjs': { deriveAvailablePlatforms: () => [] },
    '@/lib/tools-query-state.mjs': { selectDirectoryGroups: () => [] },
    '@/stores/useToolStore': { useToolStore: () => toolState },
    './FilterRail': { FilterRail: () => null },
    './MobileFilterDrawer': { MobileFilterDrawer: () => null },
    './TaskContextBar': { TaskContextBar: () => null },
    './ToolDecisionList': { ToolDecisionList },
    'react/jsx-runtime': {
      jsx: (type, props) => ({ type, props }),
      jsxs: (type, props) => ({ type, props }),
    },
  });
  const renderController = () => {
    effects = [];
    refIndex = 0;
    return controllerModule.ToolsBrowseClient();
  };
  const getList = (tree) => findElements(tree, (element) => element.type === ToolDecisionList)[0];

  getList(renderController()).props.onRetry();

  sceneState.error = null;
  toolState.dataLoaded = false;
  toolState.isLoading = false;
  toolState.error = 'tools failed';
  getList(renderController()).props.onRetry();

  renderController();
  effects.forEach((effect) => effect());

  toolState.dataLoaded = true;
  toolState.isLoading = false;
  directoryState.searchTerm = 'no matches';
  getList(renderController()).props.onClear();
  assert.deepEqual({
    sceneRetryCalls,
    toolRetryCalls,
    loadDataCalls,
    emptyPatch: patches.at(-1),
  }, {
    sceneRetryCalls: 1,
    toolRetryCalls: 1,
    loadDataCalls: 0,
    emptyPatch: {
      searchTerm: '',
      categoryId: null,
      price: null,
      origins: [],
      platforms: [],
    },
  });
});

test('rapid directory patches compose against the latest intended query state', async () => {
  const queryState = await import(new URL('../src/lib/tools-query-state.mjs', import.meta.url));
  const replaceCalls = [];
  const refs = [];
  let refIndex = 0;
  let searchParams = new URLSearchParams();
  const hookModule = await loadTypeScriptModule('src/hooks/useToolDirectoryQuery.ts', {
    react: {
      useCallback: (callback) => callback,
      useEffect: (effect) => effect(),
      useMemo: (factory) => factory(),
      useRef: (value) => {
        const index = refIndex;
        refIndex += 1;
        refs[index] ||= { current: value };
        return refs[index];
      },
    },
    'next/navigation': {
      usePathname: () => '/tools',
      useRouter: () => ({ replace: (...args) => replaceCalls.push(args) }),
      useSearchParams: () => searchParams,
    },
    '@/lib/tools-query-state.mjs': queryState,
  });
  const renderHook = () => {
    refIndex = 0;
    return hookModule.useToolDirectoryQuery({ sceneIds: new Set(), categoryIds: new Set(), platforms: new Set() });
  };
  const { update } = renderHook();

  update({ price: 'free-tier' });
  searchParams = new URLSearchParams('price=free-tier');
  renderHook();
  update({ searchTerm: 'claude' });

  assert.equal(replaceCalls.length, 2);
  assert.equal(replaceCalls[1][0], '/tools?q=claude&price=free-tier');
});

test('rapid origin checkbox changes compose through the latest query state', async () => {
  const queryState = await import(new URL('../src/lib/tools-query-state.mjs', import.meta.url));
  const replaceCalls = [];
  const refs = [];
  let refIndex = 0;
  const hookModule = await loadTypeScriptModule('src/hooks/useToolDirectoryQuery.ts', {
    react: {
      useCallback: (callback) => callback,
      useEffect: (effect) => effect(),
      useMemo: (factory) => factory(),
      useRef: (value) => {
        const index = refIndex;
        refIndex += 1;
        refs[index] ||= { current: value };
        return refs[index];
      },
    },
    'next/navigation': {
      usePathname: () => '/tools',
      useRouter: () => ({ replace: (...args) => replaceCalls.push(args) }),
      useSearchParams: () => new URLSearchParams(),
    },
    '@/lib/tools-query-state.mjs': queryState,
  });
  const catalog = { sceneIds: new Set(), categoryIds: new Set(), platforms: new Set() };
  const { state, update } = hookModule.useToolDirectoryQuery(catalog);
  const filterModule = await loadTypeScriptModule('src/components/tools/FilterFields.tsx', {
    'react/jsx-runtime': {
      jsx: (type, props) => ({ type, props }),
      jsxs: (type, props) => ({ type, props }),
    },
  });
  const fields = filterModule.FilterFields({
    state,
    platformOptions: [],
    radioGroupName: 'price-test',
    onPatch: update,
    onClear: () => {},
  });
  const originInputs = findElements(fields, (element) => element.type === 'input' && element.props.type === 'checkbox');

  assert.equal(originInputs.length, 2);
  originInputs[0].props.onChange();
  originInputs[1].props.onChange();

  assert.equal(replaceCalls.length, 2);
  assert.equal(replaceCalls[1][0], '/tools?origin=domestic%2Coverseas');
});

test('mobile filter dialog closes when the desktop breakpoint activates', async () => {
  let changeListener;
  let removedListener;
  const mediaQuery = {
    matches: false,
    addEventListener: (type, listener) => {
      assert.equal(type, 'change');
      changeListener = listener;
    },
    removeEventListener: (type, listener) => {
      assert.equal(type, 'change');
      removedListener = listener;
    },
  };
  const dialog = {
    open: true,
    closeCalls: 0,
    close() {
      this.closeCalls += 1;
      this.open = false;
    },
    showModal() {
      this.open = true;
    },
  };
  const cleanups = [];
  const originalWindow = globalThis.window;
  globalThis.window = { matchMedia: () => mediaQuery };
  try {
    const drawerModule = await loadTypeScriptModule('src/components/tools/MobileFilterDrawer.tsx', {
      react: {
        useEffect: (effect) => cleanups.push(effect()),
        useRef: () => ({ current: dialog }),
      },
      'lucide-react': { X: () => null },
      './FilterFields': { FilterFields: () => null },
      'react/jsx-runtime': {
        jsx: (type, props) => ({ type, props }),
        jsxs: (type, props) => ({ type, props }),
      },
    });
    drawerModule.MobileFilterDrawer({
      open: true,
      onClose: () => {},
      categories: [],
      state: { sceneId: null, categoryId: null, price: null, origins: [], platforms: [] },
      platformOptions: [],
      onPatch: () => {},
      onClear: () => {},
    });

    assert.equal(typeof changeListener, 'function');
    changeListener({ matches: true });
    assert.equal(dialog.closeCalls, 1);
    cleanups.forEach((cleanup) => cleanup?.());
    assert.equal(removedListener, changeListener);
  } finally {
    globalThis.window = originalWindow;
  }
});

test('mobile filter dialog is named by its heading', () => {
  const drawer = read('src/components/tools/MobileFilterDrawer.tsx');
  assert.match(drawer, /<dialog[^>]+aria-labelledby="mobile-filter-title"/);
  assert.match(drawer, /<h2 id="mobile-filter-title"/);
});

test('root layout mounts one compare tray and no alternate shell duplicates it', () => {
  const layout = read('src/app/layout.tsx');
  const shell = read('src/components/layout/PageShell.tsx');
  const tray = read('src/components/compare/CompareTray.tsx');
  assert.equal((layout.match(/<CompareTray/g) || []).length, 1);
  assert.doesNotMatch(shell, /CompareTray|CompareBar/);
  assert.match(tray, /pathname === '\/compare'/);
  assert.match(tray, /data-compare-tray/);
  assert.match(tray, /useFixedSurfaceGeometry/);
  assert.match(tray, /mobile-nav-block-size/);
  assert.match(tray, /compare-tray-block-size/);
  assert.match(read('src/components/layout/BottomNav.tsx'), /data-mobile-bottom-nav/);
  assert.match(read('src/components/layout/BottomNav.tsx'), /safe-area-inset-bottom/);
});

test('mobile compare tray preserves the accepted inset anatomy and visible selected names', () => {
  const tray = read('src/components/compare/CompareTray.tsx');
  assert.match(tray, /fixed inset-x-2/);
  assert.match(tray, /rounded-md border border-\[var\(--line\)\]/);
  assert.match(tray, /md:inset-x-0/);
  assert.match(tray, /data-compare-selected-tools/);
  assert.match(tray, /className="truncate"/);
  assert.doesNotMatch(tray, /mt-1 hidden gap-2 overflow-x-auto sm:flex/);
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

test('zero-review evidence exposes a compact accessible rating disclosure', () => {
  const evidence = read('src/components/tools/ToolEvidenceSections.tsx');
  assert.match(evidence, /ratingData\.rating_count === 0/);
  assert.match(evidence, /暂无评分/);
  assert.match(evidence, /还没有用户评价/);
  assert.match(evidence, /提交评价/);
  assert.match(evidence, /<details/);
  assert.match(evidence, /<summary className="[^"]*min-h-11/);
  assert.match(evidence, /<RatingWidget/);
});
