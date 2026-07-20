import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const readRepo = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const css = read('src/app/globals.css');

function cssBlock(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\n\\}`));
  assert.ok(match, `missing CSS block ${selector}`);
  return match[1];
}

function token(block, name) {
  const match = block.match(new RegExp(`--${name}:\\s*([^;]+);`));
  assert.ok(match, `missing token --${name}`);
  return match[1].trim().toLowerCase();
}

function luminance(hex) {
  const channels = hex.match(/[0-9a-f]{2}/gi).map((value) => Number.parseInt(value, 16) / 255);
  const linear = channels.map((value) => value <= 0.04045
    ? value / 12.92
    : ((value + 0.055) / 1.055) ** 2.4);
  return (0.2126 * linear[0]) + (0.7152 * linear[1]) + (0.0722 * linear[2]);
}

function contrast(foreground, background) {
  const values = [luminance(foreground), luminance(background)].sort((left, right) => right - left);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test('defines the approved light, dark, signal, and carbon tool tokens', () => {
  const light = cssBlock(':root');
  const dark = cssBlock('.dark');
  const carbon = cssBlock('.carbon-tool-surface');

  assert.deepEqual({
    page: token(light, 'page'),
    surface: token(light, 'surface'),
    ink: token(light, 'ink'),
    mutedSubtle: token(light, 'muted-subtle'),
    lineStrong: token(light, 'line-strong'),
    accent: token(light, 'accent'),
    accentInk: token(light, 'accent-ink'),
    onAccent: token(light, 'on-accent'),
    signal: token(light, 'signal'),
    signalInk: token(light, 'signal-ink'),
    toolSurface: token(light, 'tool-surface'),
    toolAccent: token(light, 'tool-accent'),
    toolOnAccent: token(light, 'tool-on-accent'),
    toolSignalInk: token(light, 'tool-signal-ink'),
  }, {
    page: '#f3f6f8',
    surface: '#ffffff',
    ink: '#081218',
    mutedSubtle: '#5f717b',
    lineStrong: '#6f838d',
    accent: '#007e99',
    accentInk: '#005b70',
    onAccent: '#ffffff',
    signal: '#f28b3c',
    signalInk: '#8a3900',
    toolSurface: '#10161a',
    toolAccent: '#46d9f2',
    toolOnAccent: '#081218',
    toolSignalInk: '#ffb57d',
  });
  assert.deepEqual({
    page: token(dark, 'page'),
    surface: token(dark, 'surface'),
    ink: token(dark, 'ink'),
    mutedSubtle: token(dark, 'muted-subtle'),
    lineStrong: token(dark, 'line-strong'),
    accent: token(dark, 'accent'),
    accentInk: token(dark, 'accent-ink'),
    onAccent: token(dark, 'on-accent'),
    signal: token(dark, 'signal'),
    signalInk: token(dark, 'signal-ink'),
    toolSurface: token(dark, 'tool-surface'),
  }, {
    page: '#080b0e',
    surface: '#10161a',
    ink: '#e8f7fb',
    mutedSubtle: '#7f949e',
    lineStrong: '#58707b',
    accent: '#46d9f2',
    accentInk: '#8aeaf9',
    onAccent: '#081218',
    signal: '#f28b3c',
    signalInk: '#ffb57d',
    toolSurface: '#0c1216',
  });
  for (const mapping of [
    ['surface', 'tool-surface'],
    ['ink', 'tool-ink'],
    ['muted', 'tool-muted'],
    ['line-strong', 'tool-line'],
    ['accent', 'tool-accent'],
    ['on-accent', 'tool-on-accent'],
    ['signal', 'tool-signal'],
    ['signal-ink', 'tool-signal-ink'],
    ['signal-soft', 'tool-signal-soft'],
  ]) {
    assert.match(carbon, new RegExp(`--${mapping[0]}:\\s*var\\(--${mapping[1]}\\)`));
  }
});

test('keeps every required text and control color pair above its WCAG threshold', () => {
  const light = cssBlock(':root');
  const dark = cssBlock('.dark');
  const checks = [
    [token(light, 'muted-subtle'), token(light, 'page'), 4.5],
    [token(light, 'accent-ink'), token(light, 'page'), 4.5],
    [token(light, 'line-strong'), token(light, 'surface'), 3],
    [token(light, 'on-accent'), token(light, 'accent'), 4.5],
    [token(light, 'signal-ink'), token(light, 'signal-soft'), 4.5],
    [token(light, 'tool-ink'), token(light, 'tool-surface'), 4.5],
    [token(light, 'tool-muted'), token(light, 'tool-surface'), 4.5],
    [token(light, 'tool-line'), token(light, 'tool-surface'), 3],
    [token(light, 'tool-on-accent'), token(light, 'tool-accent'), 4.5],
    [token(light, 'tool-signal-ink'), token(light, 'tool-signal-soft'), 4.5],
    [token(dark, 'muted-subtle'), token(dark, 'surface'), 4.5],
    [token(dark, 'accent-ink'), token(dark, 'surface'), 4.5],
    [token(dark, 'line-strong'), token(dark, 'surface'), 3],
    [token(dark, 'on-accent'), token(dark, 'accent'), 4.5],
    [token(dark, 'signal-ink'), token(dark, 'signal-soft'), 4.5],
    [token(light, 'tool-ink'), token(dark, 'tool-surface'), 4.5],
    [token(light, 'tool-line'), token(dark, 'tool-surface'), 3],
  ];
  for (const [foreground, background, minimum] of checks) {
    assert.ok(contrast(foreground, background) >= minimum, `${foreground} on ${background}`);
  }
});

test('maps browser metadata, radii, and default motion to the approved system', () => {
  const layout = read('src/app/layout.tsx');
  const manifest = JSON.parse(read('public/manifest.json'));
  const tailwind = read('tailwind.config.ts');

  assert.match(layout, /media: '\(prefers-color-scheme: light\)', color: '#F3F6F8'/);
  assert.match(layout, /media: '\(prefers-color-scheme: dark\)', color: '#080B0E'/);
  assert.equal(manifest.background_color, '#F3F6F8');
  assert.equal(manifest.theme_color, '#F3F6F8');
  assert.match(css, /--radius:\s*6px/);
  assert.match(css, /--radius-sm:\s*4px/);
  assert.doesNotMatch(css, /border-radius:\s*8px/);
  assert.match(css, /--transition-duration:\s*140ms/);
  assert.match(css, /transition-property:\s*color, background-color, border-color, outline-color/);
  assert.match(tailwind, /lg:\s*'var\(--radius\)'/);
  assert.match(tailwind, /DEFAULT:\s*'140ms'/);
  assert.match(tailwind, /DEFAULT:\s*'ease-out'/);
});

test('uses contrast-safe chrome, primary actions, active rails, and control borders', () => {
  const navbar = read('src/components/layout/Navbar.tsx');
  const bottomNav = read('src/components/layout/BottomNav.tsx');
  const search = read('src/components/hero/SearchBar.tsx');
  const tasks = read('src/components/home/TaskEntryList.tsx');
  const home = read('src/app/page.tsx');
  const context = read('src/components/tools/TaskContextBar.tsx');
  const filters = read('src/components/tools/FilterFields.tsx');
  const drawer = read('src/components/tools/MobileFilterDrawer.tsx');

  assert.match(navbar, /active \? 'text-\[var\(--accent-ink\)\]'/);
  assert.match(bottomNav, /active \? 'text-\[var\(--accent-ink\)\]'/);
  assert.match(search, /text-\[var\(--on-accent\)\]/);
  assert.doesNotMatch(search, /rgba\(23,26,23/);
  assert.match(search, /border-l-\[3px\] border-l-transparent/);
  assert.match(search, /flex min-h-12 w-full items-center border-l-\[3px\] border-l-transparent/);
  assert.match(search, /border-l-\[var\(--accent\)\]/);
  assert.match(tasks, /border-l-\[3px\] border-l-transparent/);
  assert.match(tasks, /hover:border-l-\[var\(--accent\)\]/);
  assert.match(home, /border-\[var\(--signal\)\]/);
  assert.match(home, /bg-\[var\(--signal-soft\)\]/);
  assert.equal((context.match(/border-\[var\(--line-strong\)\]/g) || []).length, 4);
  assert.match(filters, /accent-\[var\(--accent\)\]/);
  assert.match(filters, /border-\[var\(--line-strong\)\]/);
  assert.match(drawer, /border-l border-\[var\(--line-strong\)\]/);
});

test('uses stable selected rails and a scoped carbon compare tray', () => {
  const row = read('src/components/tools/ToolDecisionRow.tsx');
  const list = read('src/components/tools/ToolDecisionList.tsx');
  const tray = read('src/components/compare/CompareTray.tsx');

  assert.match(row, /data-selected=\{selected \? 'true' : undefined\}/);
  assert.match(row, /before:w-\[3px\]/);
  assert.match(row, /before:bg-transparent/);
  assert.match(row, /selected && 'bg-\[var\(--accent-soft\)\] before:bg-\[var\(--accent\)\]'/);
  assert.match(row, /text-\[var\(--accent-ink\)\]/);
  assert.match(list, /border-\[var\(--signal\)\]/);
  assert.match(list, /bg-\[var\(--signal-soft\)\]/);
  assert.match(tray, /data-carbon-surface/);
  assert.match(tray, /carbon-tool-surface/);
  assert.match(tray, /border-\[var\(--line-strong\)\]/);
  assert.match(tray, /text-\[var\(--on-accent\)\]/);
});

test('uses a carbon detail rail and keeps ratings, favorites, and ordinary success out of signal orange', () => {
  const summary = read('src/components/tools/ToolDecisionSummary.tsx');
  const detail = read('src/components/tools/ToolDetailClient.tsx');
  const evidence = read('src/components/tools/ToolEvidenceSections.tsx');
  const rating = read('src/components/ratings/RatingWidget.tsx');

  assert.match(detail, /data-carbon-surface/);
  assert.match(detail, /carbon-tool-surface/);
  assert.match(detail, /border-\[var\(--signal\)\]/);
  assert.match(detail, /border-\[var\(--signal-ink\)\]/);
  assert.match(detail, /bg-\[var\(--signal-soft\)\]/);
  assert.match(summary, /fill-current text-\[var\(--accent\)\]/);
  assert.match(summary, /text-\[var\(--on-accent\)\]/);
  assert.doesNotMatch(summary, /--danger|text-white/);
  assert.doesNotMatch(evidence, /amber|--danger|--warning/);
  assert.doesNotMatch(rating, /amber|--danger|--warning|text-white/);
  assert.match(rating, /fill-\[var\(--accent\)\] text-\[var\(--accent\)\]/);
  assert.match(rating, /text-\[var\(--signal-ink\)\]/);
});
