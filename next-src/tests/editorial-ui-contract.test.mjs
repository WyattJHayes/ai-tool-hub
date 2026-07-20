import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

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
    throw new Error(`Unexpected test module import: ${id}`);
  };
  const execute = new Function('require', 'module', 'exports', outputText);
  execute(requireMock, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}

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

test('uses the neutral editorial color system without animated grid decoration', () => {
  const css = read('src/app/globals.css');

  assert.match(css, /--page:\s*#f6f7f4/i);
  assert.match(css, /--accent:\s*#176b4d/i);
  assert.doesNotMatch(css, /gridMove|repeating-linear-gradient|--neon-purple/i);
});

test('ships a light default viewport and quiet directory navigation', () => {
  const layout = read('src/app/layout.tsx');
  const navbar = read('src/components/layout/Navbar.tsx');
  const footer = read('src/components/layout/Footer.tsx');

  assert.match(layout, /themeColor:\s*'#f6f7f4'/);
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

test('rating evidence distinguishes loading, transport failure, and verified empty data', async () => {
  const client = read('src/components/tools/ToolDetailClient.tsx');
  const evidence = read('src/components/tools/ToolEvidenceSections.tsx');
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
  assert.match(client, /status: 'loading'/);
  assert.match(client, /status: 'error'/);
  assert.match(client, /if \(!response\.ok\) throw new Error/);
  assert.match(evidence, /ratingState\.status === 'loading'/);
  assert.match(evidence, /role="status"/);
  assert.match(evidence, /ratingState\.status === 'error'/);
  assert.match(evidence, /role="alert"/);
  assert.match(evidence, /const ratingData = ratingState\.status === 'ready'/);
  assert.match(evidence, /ratingState\.status === 'ready' && ratingData !== null && ratingData\.rating_count === 0/);
});

test('compare-tray removal has deterministic focus, live feedback, and a mobile touch target', async () => {
  const tray = read('src/components/compare/CompareTray.tsx');
  const loaded = await loadTypeScriptModule('src/components/compare/CompareTray.tsx', inertComponentMocks);

  assert.equal(typeof loaded.getNextRemovalToolId, 'function', 'compare removal needs a deterministic focus target');
  const selected = [{ id: 1 }, { id: 2 }, { id: 3 }];
  assert.equal(loaded.getNextRemovalToolId(selected, 2), 3);
  assert.equal(loaded.getNextRemovalToolId(selected, 3), 2);
  assert.equal(loaded.getNextRemovalToolId(selected.slice(0, 2), 1), null);
  assert.match(tray, /aria-live="polite"/);
  assert.match(tray, /className="flex h-11 w-11/);
  assert.match(tray, /removeButtonRefs/);
  assert.match(tray, /requestAnimationFrame/);
  assert.match(tray, /querySelector<HTMLElement>\('main'\)/);
  assert.match(tray, /focus\(\{ preventScroll: true \}\)/);
  assert.match(tray, /ref=\{compareButtonRef\}[^>]*onClick=\{\(\) => router\.push\('\/compare'\)\}/);
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
