import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';

const runtimeRequire = createRequire(import.meta.url);

const read = (relativePath) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');

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
    return runtimeRequire(id);
  };
  const execute = new Function('require', 'module', 'exports', outputText);
  execute(requireMock, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}

async function withDom(run) {
  const dom = new JSDOM('<!doctype html><html><body><main></main><div id="root"></div></body></html>', {
    pretendToBeVisual: true,
  });
  const savedGlobals = new Map();
  const globals = {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    Node: dom.window.Node,
    Event: dom.window.Event,
    MouseEvent: dom.window.MouseEvent,
    requestAnimationFrame: (callback) => {
      callback(0);
      return 0;
    },
    cancelAnimationFrame: () => {},
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  for (const [key, value] of Object.entries(globals)) {
    savedGlobals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }

  const { createRoot } = await import('react-dom/client');
  const root = createRoot(dom.window.document.getElementById('root'));
  try {
    await run({ dom, root, container: dom.window.document.getElementById('root') });
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of savedGlobals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
}

function createCompareStore(selectedTools) {
  let selected = selectedTools;
  const listeners = new Set();
  const notify = () => listeners.forEach((listener) => listener((version) => version + 1));
  return {
    useCompareStore: () => {
      const [, setVersion] = React.useState(0);
      React.useEffect(() => {
        listeners.add(setVersion);
        return () => listeners.delete(setVersion);
      }, []);
      return {
        selectedTools: selected,
        removeTool: (toolId) => {
          selected = selected.filter((tool) => tool.id !== toolId);
          notify();
        },
        clearAll: () => {
          selected = [];
          notify();
        },
      };
    },
  };
}

function createEvidenceModel() {
  return {
    tool: {
      id: 42,
      name: 'Evidence Tool',
      tags: ['research'],
      toolTags: [],
    },
    capabilities: [],
  };
}

const runtimeComponentMocks = {
  'lucide-react': {
    Calendar: () => React.createElement('svg'),
    Check: () => React.createElement('svg'),
    Star: () => React.createElement('svg'),
    X: () => React.createElement('svg'),
  },
  '@/components/ratings/RatingWidget': {
    RatingWidget: ({ toolId, currentRating, onRated }) => React.createElement(
      'button',
      {
        type: 'button',
        'data-rating-widget': toolId,
        'data-current-rating': currentRating,
        'data-on-rated': typeof onRated,
      },
      '评分控件',
    ),
  },
  '@/lib/utils': { cn: (...classes) => classes.filter(Boolean).join(' ') },
  'next/navigation': { usePathname: () => '/', useRouter: () => ({ push: () => {} }) },
  '@/hooks/useFixedSurfaceGeometry': { useFixedSurfaceGeometry: () => {} },
};

const inertComponentMocks = {
  'next/link': { default: () => null },
  'next/navigation': { usePathname: () => '/', useRouter: () => ({}) },
  'lucide-react': {},
  react: {
    useEffect: () => {},
    useMemo: (factory) => factory(),
    useRef: (value) => ({ current: value }),
    useState: (value) => [value, () => {}],
  },
  '@/hooks/useFixedSurfaceGeometry': { useFixedSurfaceGeometry: () => {} },
  '@/hooks/useSceneData': { useSceneData: () => ({}) },
  '@/lib/api': {},
  '@/lib/tool-decision.mjs': {},
  '@/lib/tools-query-state.mjs': {},
  '@/lib/tools-data': {},
  '@/stores/useCompareStore': { useCompareStore: () => ({}) },
  '@/stores/useToolStore': { useToolStore: () => ({}) },
  '@/stores/useUserStore': { useUserStore: () => ({}) },
  './ToolDecisionList': {},
  './ToolDecisionSummary': {},
  './ToolEvidenceSections': {},
  'react/jsx-runtime': { jsx: () => null, jsxs: () => null, Fragment: Symbol('Fragment') },
};

test('uses the carbon console color system without animated grid decoration', () => {
  const css = read('src/app/globals.css');

  assert.match(css, /--page:\s*#f3f6f8/i);
  assert.match(css, /--accent:\s*#007e99/i);
  assert.match(css, /\.dark[\s\S]*--page:\s*#080b0e/i);
  assert.match(css, /\.dark[\s\S]*--accent:\s*#46d9f2/i);
  assert.doesNotMatch(css, /gridMove|repeating-linear-gradient|--neon-purple/i);
});

test('ships a light default viewport and quiet directory navigation', () => {
  const layout = read('src/app/layout.tsx');
  const navbar = read('src/components/layout/Navbar.tsx');
  const footer = read('src/components/layout/Footer.tsx');

  assert.match(layout, /media: '\(prefers-color-scheme: light\)', color: '#F3F6F8'/);
  assert.match(layout, /media: '\(prefers-color-scheme: dark\)', color: '#080B0E'/);
  assert.doesNotMatch(layout, /className="dark"|bg-gray-950|text-white/);
  assert.match(navbar, /label: '工具'/);
  assert.match(navbar, /label: '场景'/);
  assert.match(navbar, /label: '排行'/);
  assert.doesNotMatch(navbar, /bg-gradient|backdrop-blur|rounded-full/);
  assert.match(layout, /data-scroll-behavior="smooth"/);
  assert.match(footer, /backgroundImage: "url\('\/beian-icon\.png'\)"/);
  assert.doesNotMatch(footer, /next\/image/);
  assert.doesNotMatch(layout, /发现最佳/);
});

test('ships the public-security filing icon referenced by the footer as a valid PNG', () => {
  const iconPath = new URL('../public/beian-icon.png', import.meta.url);

  assert.equal(existsSync(iconPath), true, 'footer filing icon must exist in public assets');

  const icon = readFileSync(iconPath);
  assert.ok(icon.length > 0, 'footer filing icon must not be empty');
  assert.deepEqual(
    icon.subarray(0, 8),
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    'footer filing icon must have a PNG signature',
  );
});

test('loads local Geist without changing the neutral token system', () => {
  const layout = read('src/app/layout.tsx');
  const css = read('src/app/globals.css');

  assert.match(layout, /localFont/);
  assert.match(layout, /GeistVF\.woff/);
  assert.match(layout, /className=\{geistSans\.variable\}/);
  assert.match(css, /--font: var\(--font-geist\)/);
  assert.match(css, /letter-spacing: 0/);
});

test('puts canonical task entry before deterministic weekly decision rows', () => {
  const home = read('src/app/page.tsx');

  assert.match(home, /按任务找到合适的 AI 工具/);
  assert.match(home, /<TaskEntryList scenes=\{scenes\}/);
  assert.match(home, /id: 'weekly'/);
  assert.match(home, /<ToolDecisionList/);
  assert.doesNotMatch(home, /const scenes: Scene\[\]/);
  assert.doesNotMatch(home, /<ToolCard/);
  assert.doesNotMatch(home, /数据概览/);
  assert.ok(home.indexOf('<TaskEntryList') < home.indexOf('本周值得试'));
});

test('keeps the homepage scene retry control touch accessible', () => {
  const home = read('src/app/page.tsx');

  assert.match(home, /onClick=\{retryScenes\} className="[^"]*min-h-11[^"]*px-4[^"]*">重新加载/);
});

test('uses aligned decision rows and quiet URL-driven controls', () => {
  const row = read('src/components/tools/ToolDecisionRow.tsx');
  const context = read('src/components/tools/TaskContextBar.tsx');
  const filters = read('src/components/tools/FilterFields.tsx');
  const search = read('src/components/hero/SearchBar.tsx');

  assert.doesNotMatch(row, /rotateX|scan_2s|backdrop-blur|bg-gradient|rounded-2xl/);
  assert.match(row, /data-field="tool"/);
  assert.match(row, /data-field="task"/);
  assert.match(row, /data-field="capabilities"/);
  assert.match(row, /data-field="price"/);
  assert.match(context, /sceneId/);
  assert.match(context, /categoryId/);
  assert.match(filters, /<fieldset/);
  assert.doesNotMatch(context, /rounded-full|bg-gradient/);
  assert.doesNotMatch(search, /backdrop-blur|rounded-2xl|shadow-\[0_0/);
  assert.match(search, /params\.set\('q', term\)/);
});

test('decision-row metadata uses the contrast-compliant muted token', () => {
  const row = read('src/components/tools/ToolDecisionRow.tsx');

  assert.doesNotMatch(row, /text-\[var\(--muted-subtle\)\]/);
  assert.match(row, /text-xs text-\[var\(--muted\)\]/);
});

test('rating payload validator distinguishes malformed payloads from verified empty data', async () => {
  const loaded = await loadTypeScriptModule('src/components/tools/ToolDetailClient.tsx', inertComponentMocks);

  assert.equal(typeof loaded.isRatingData, 'function', 'detail ratings need a runtime payload validator');
  assert.equal(loaded.isRatingData({ avg_rating: 0, rating_count: 0, reviews: [] }), true);
  assert.equal(loaded.isRatingData({ error: 'unavailable' }), false);
  assert.equal(loaded.isRatingData({ avg_rating: 0, rating_count: 0, reviews: null }), false);
  assert.equal(loaded.isRatingData({ avg_rating: 6, rating_count: 1, reviews: [] }), false);
  assert.equal(loaded.isRatingData({
    avg_rating: 0,
    rating_count: 0,
    reviews: [{ score: 5, tags: [], comment: '' }],
  }), false);
});

test('rating evidence renders accessible loading, error, empty, and populated states', async () => {
  const { ToolEvidenceSections } = await loadTypeScriptModule(
    'src/components/tools/ToolEvidenceSections.tsx',
    runtimeComponentMocks,
  );
  const onRated = () => {};
  const renderEvidence = (root, ratingState) => act(async () => {
    root.render(React.createElement(ToolEvidenceSections, {
      model: createEvidenceModel(),
      currentRating: 3,
      ratingState,
      onRated,
    }));
  });

  await withDom(async ({ root, container }) => {
    await renderEvidence(root, { status: 'loading' });
    assert.equal(container.querySelector('[role="status"]')?.textContent, '正在加载评分…');
    assert.equal(container.querySelector('[data-rating-widget]'), null);

    await renderEvidence(root, { status: 'error' });
    assert.equal(container.querySelector('[role="alert"]')?.textContent, '评分暂时无法加载，当前无法确认评价状态。');
    assert.match(container.querySelector('[role="alert"]')?.className, /border-\[var\(--signal-ink\)\]/);
    assert.match(container.querySelector('[role="alert"]')?.className, /bg-\[var\(--signal-soft\)\]/);
    assert.match(container.querySelector('[role="alert"]')?.className, /text-\[var\(--signal-ink\)\]/);
    assert.equal(container.querySelector('[data-rating-widget]'), null);

    await renderEvidence(root, {
      status: 'ready',
      data: { avg_rating: 0, rating_count: 0, reviews: [] },
    });
    assert.equal(container.querySelector('summary')?.textContent?.replace(/\s+/g, ''), '暂无评分还没有用户评价提交评价');
    assert.equal(container.querySelector('[data-rating-widget]')?.getAttribute('data-current-rating'), '3');
    assert.equal(container.querySelector('[data-rating-widget]')?.getAttribute('data-on-rated'), 'function');

    await renderEvidence(root, {
      status: 'ready',
      data: {
        avg_rating: 4,
        rating_count: 1,
        reviews: [{ score: 5, tags: ['上手快'], comment: '好用' }],
      },
    });
    assert.equal(container.querySelector('details'), null);
    assert.match(container.textContent, /4\.0/);
    assert.match(container.textContent, /1 条评价/);
    assert.match(container.textContent, /5 \/ 5 分/);
    assert.match(container.textContent, /上手快/);
    assert.match(container.textContent, /好用/);
    assert.equal(container.querySelector('[data-rating-widget]')?.getAttribute('data-on-rated'), 'function');
  });
});

test('compare tray removal moves focus and announces the removed tool', async () => {
  const loaded = await loadTypeScriptModule('src/components/compare/CompareTray.tsx', inertComponentMocks);

  assert.equal(typeof loaded.getNextRemovalToolId, 'function', 'compare removal needs a deterministic focus target');
  const selected = [{ id: 1 }, { id: 2 }, { id: 3 }];
  assert.equal(loaded.getNextRemovalToolId(selected, 2), 3);
  assert.equal(loaded.getNextRemovalToolId(selected, 3), 2);
  assert.equal(loaded.getNextRemovalToolId(selected.slice(0, 2), 1), null);

  const compareStore = createCompareStore([
    { id: 1, name: 'Alpha' },
    { id: 2, name: 'Beta' },
    { id: 3, name: 'Gamma' },
  ]);
  const { default: CompareTray } = await loadTypeScriptModule('src/components/compare/CompareTray.tsx', {
    ...runtimeComponentMocks,
    '@/stores/useCompareStore': compareStore,
  });

  await withDom(async ({ dom, root, container }) => {
    await act(async () => root.render(React.createElement(CompareTray)));
    const removeBeta = container.querySelector('[aria-label="移除 Beta"]');
    assert.ok(removeBeta);
    await act(async () => removeBeta.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })));

    assert.equal(dom.window.document.activeElement?.getAttribute('aria-label'), '移除 Gamma');
    assert.equal(container.querySelector('[aria-live="polite"]')?.textContent, '已移除 Beta');
    assert.equal(container.querySelector('[aria-label="移除 Beta"]'), null);
  });
});

test('compare tray focuses main when removal hides the tray', async () => {
  const compareStore = createCompareStore([
    { id: 1, name: 'Alpha' },
    { id: 2, name: 'Beta' },
  ]);
  const { default: CompareTray } = await loadTypeScriptModule('src/components/compare/CompareTray.tsx', {
    ...runtimeComponentMocks,
    '@/stores/useCompareStore': compareStore,
  });

  await withDom(async ({ dom, root, container }) => {
    await act(async () => root.render(React.createElement(CompareTray)));
    const removeBeta = container.querySelector('[aria-label="移除 Beta"]');
    assert.ok(removeBeta);
    await act(async () => removeBeta.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })));

    assert.equal(dom.window.document.activeElement, dom.window.document.querySelector('main'));
    assert.equal(container.querySelector('[aria-live="polite"]')?.textContent, '已移除 Beta');
    assert.equal(container.querySelector('[data-compare-tray]'), null);
  });
});

test('keeps tool detail and scene routes in the same editorial system', () => {
  const secondaryRoutes = [
    'src/app/tools/[slug]/page.tsx',
    'src/app/scenes/page.tsx',
    'src/app/scenes/[slug]/page.tsx',
  ];
  const forbidden = /bg-gray-950|bg-gradient|backdrop-blur|text-white\/|border-white\/|rounded-2xl|violet|purple|cyan/i;

  for (const route of secondaryRoutes) {
    assert.doesNotMatch(read(route), forbidden, route);
  }
});

test('keeps account, ranking, comparison, and modal surfaces neutral', () => {
  const remainingSurfaces = [
    'src/app/leaderboard/page.tsx',
    'src/app/user/page.tsx',
    'src/app/compare/page.tsx',
    'src/components/auth/AuthModal.tsx',
    'src/components/ratings/RatingWidget.tsx',
  ];
  const forbidden = /bg-gray-9|bg-gradient|backdrop-blur|text-white\/|border-white\/|rounded-2xl|violet|purple|cyan/i;

  for (const surface of remainingSurfaces) {
    assert.doesNotMatch(read(surface), forbidden, surface);
  }
});

test('does not retain dormant particle effects or legacy error styling', () => {
  const particlePath = new URL('../src/components/effects/ParticleBackground.tsx', import.meta.url);
  const errorBoundary = read('src/components/common/ErrorBoundary.tsx');

  assert.equal(existsSync(particlePath), false);
  assert.doesNotMatch(errorBoundary, /rounded-2xl|text-white\/|border-red-500\/|bg-white\//);
});
