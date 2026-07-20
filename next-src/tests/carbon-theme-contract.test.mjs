import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const readRepo = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const css = read('src/app/globals.css');

function collectSourceFiles(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const absolute = path.join(directory, entry);
    return statSync(absolute).isDirectory()
      ? collectSourceFiles(absolute)
      : /\.(css|ts|tsx)$/.test(entry) ? [absolute] : [];
  });
}

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

test('uses carbon compare headers while keeping recoverable compare actions neutral', () => {
  const compare = read('src/app/compare/page.tsx');
  const header = compare.match(/selectedTools\.map\(\(tool\) => \(\s*(<div key=\{tool\.id\}[\s\S]*?<\/div>)\s*\)\)/)?.[1];
  const dataCell = compare.match(/values\.map\(\(value, index\) => (<div key=\{`\$\{row\.key\}-\$\{index\}`\}[\s\S]*?<\/div>)\)\}/)?.[1];
  const clearAction = compare.match(/<button type="button" onClick=\{clearAll\} className="([^"]*)">清除全部<\/button>/)?.[1];
  const removeAction = header?.match(/<button type="button" onClick=\{\(\) => removeTool\(tool\.id\)\} className="([^"]*)"/)?.[1];
  const carbonSurface = cssBlock('.carbon-tool-surface');

  assert.ok(header, 'missing selected-tool header block');
  assert.match(header, /<div key=\{tool\.id\} data-carbon-surface className="carbon-tool-surface[^\"]*border-\[var\(--line-strong\)\][^\"]*text-\[var\(--ink\)\][^\"]*">/);
  assert.match(carbonSurface, /--ink:\s*var\(--tool-ink\)/);
  assert.match(carbonSurface, /--on-accent:\s*var\(--tool-on-accent\)/);
  assert.doesNotMatch(header, /--danger|bg-red|border-red|text-red|text-white/);

  assert.ok(removeAction, 'missing selected-tool remove action');
  assert.match(removeAction, /h-11 w-11/);
  assert.match(removeAction, /text-\[var\(--muted\)\]/);
  assert.match(removeAction, /hover:bg-\[var\(--surface-subtle\)\]/);
  assert.doesNotMatch(removeAction, /--(?:danger|signal)|(?:bg|border|text|ring|fill)-(?:red|amber|orange|signal)|\b(?:amber|orange|signal)\b|text-white/);

  assert.ok(dataCell, 'missing ordinary comparison data-cell block');
  assert.match(dataCell, /bg-\[var\(--surface\)\]/);
  assert.match(dataCell, /text-\[var\(--accent-ink\)\]/);
  assert.doesNotMatch(dataCell, /data-carbon-surface|carbon-tool-surface/);

  assert.ok(clearAction, 'missing recoverable clear action');
  assert.match(clearAction, /min-h-11/);
  assert.match(clearAction, /border-\[var\(--line-strong\)\]/);
  assert.match(clearAction, /text-\[var\(--muted\)\]/);
  assert.match(clearAction, /hover:bg-\[var\(--surface-hover\)\]/);
  assert.doesNotMatch(clearAction, /--(?:danger|signal)|(?:bg|border|text|ring|fill)-(?:red|amber|orange|signal)|\b(?:amber|orange|signal)\b|text-white/);
});

test('contains no legacy palette, raw status colors, or prohibited motion in application source', () => {
  const sourceRoot = fileURLToPath(new URL('../src/', import.meta.url));
  const files = collectSourceFiles(sourceRoot);
  const forbiddenHex = /#(?:f6f7f4|eef1ec|e8ede7|171a17|5f675f|858c85|dce1da|c8cfc6|176b4d|105b40|e4f0e9|b54747|9a6700|171917|202320|292d29|303530|f2f4ef|b2b9b0|858d84|373d36|4a5148|72b897|8cc8aa|203c30|e08080|d8ad58)\b/i;
  const rawPaletteClass = /\b(?:bg|border|text|fill|ring)-(?:red|amber|yellow|green|emerald|teal|cyan|sky|blue|purple|violet)-\d+\b/;
  const prohibitedEffect = /\bbg-gradient-|\b(?:from|via|to)-[a-z]+-\d+|repeating-linear-gradient|shadow-\[[^\]]*0_0|animate-spin|transition-transform|(?:group-)?hover:(?:-?translate|scale|rotate)/;

  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    assert.doesNotMatch(content, forbiddenHex, file);
    assert.doesNotMatch(content, rawPaletteClass, file);
    assert.doesNotMatch(content, /var\(--(?:danger|warning)\)|text-white|rounded-full/, file);
    assert.doesNotMatch(content, /rgba\(23,\s*26,\s*23/, file);
    assert.doesNotMatch(content, prohibitedEffect, file);
    assert.doesNotMatch(content, /tracking-\[-|letter-spacing:\s*-/, file);
  }
});
