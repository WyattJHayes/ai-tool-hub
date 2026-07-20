import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const readRepo = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const css = read('src/app/globals.css');
const sourceExtension = /\.(?:css|cjs|cts|js|jsx|mdx|mjs|mts|ts|tsx)$/;
const forbiddenHex = /#(?:f6f7f4|eef1ec|e8ede7|171a17|5f675f|858c85|dce1da|c8cfc6|176b4d|105b40|e4f0e9|b54747|9a6700|171917|202320|292d29|303530|f2f4ef|b2b9b0|858d84|373d36|4a5148|72b897|8cc8aa|203c30|e08080|d8ad58)\b/i;
const rawPaletteClass = /(?<![A-Za-z0-9_-])(?:bg|border|text|fill|stroke|ring|outline|divide|decoration|from|via|to)-(?:red|amber|yellow|green|emerald|teal|cyan|sky|blue|purple|violet)-\d+(?:\/\d+)?(?![A-Za-z0-9_/-])/;
const aliasDefinition = /(?<![A-Za-z0-9_-])--(?:danger|warning)\s*:/;
const aliasUse = /var\(\s*--(?:danger|warning)\s*(?:,|\))/;
const whiteForegroundClass = /(?<![A-Za-z0-9_-])text-white(?:\/\d+)?(?![A-Za-z0-9_/-])/;
const gradientEffect = /(?:repeating-)?(?:linear|radial|conic)-gradient\s*\(|(?<![A-Za-z0-9_-])bg-(?:gradient|linear|radial|conic)(?:-[A-Za-z0-9_[\]./%-]+)?(?![A-Za-z0-9_-])/;
const spinningAnimation = /(?<![A-Za-z0-9_-])animate-spin(?![A-Za-z0-9_-])/;
const transformTransition = /(?<![A-Za-z0-9_-])transition-transform(?![A-Za-z0-9_-])/;
const scaleOrRotate = /(?<![A-Za-z0-9_-])-?(?:scale(?:-[xy])?|rotate(?:-[xyz])?)-(?:\[[^\]]+\]|\d+(?:\.\d+)?(?:\/\d+)?)(?![A-Za-z0-9_-])/;
const cssScaleOrRotate = /transform\s*:[^;}\n]*(?:rotate(?:x|y|z|3d)?|scale(?:x|y|z|3d)?)\s*\(|(?<![A-Za-z0-9_-])(?:rotate|scale)\s*:/i;
const arbitraryTransform = /(?<![A-Za-z0-9_-])transform-\[[^\]]*(?:rotate(?:x|y|z|3d)?|scale(?:x|y|z|3d)?)\s*\([^\]]*\)[^\]]*\](?![A-Za-z0-9_-])/i;
const variantTranslate = /(?<![A-Za-z0-9_-])(?:[^\s"'`]+:)+-?translate-[xy]-(?:\[[^\]]+\]|\d+(?:\.\d+)?(?:\/\d+)?|full|px)(?![A-Za-z0-9_-])/;
const largeRadiusClass = /(?<![A-Za-z0-9_-])rounded(?:-[trblse]{1,2})?-(?:xl|2xl|3xl|full)(?![A-Za-z0-9_-])/;
const arbitraryRadiusClass = /(?<![A-Za-z0-9_-])rounded(?:-[trblse]{1,2})?-\[([^\]]+)\](?![A-Za-z0-9_-])/g;
const approvedArbitraryRadius = /^(\d*\.?\d+)(px|rem)$/;
const negativeTracking = /(?<![A-Za-z0-9_-])tracking-(?:tight|tighter)(?![A-Za-z0-9_-])|(?<![A-Za-z0-9_-])tracking-\[\s*-|letter-spacing\s*:\s*-/;

function hasProhibitedRadius(content) {
  if (largeRadiusClass.test(content)) return true;
  return [...content.matchAll(arbitraryRadiusClass)].some((match) => {
    const approved = match[1].trim().match(approvedArbitraryRadius);
    if (!approved) return true;
    const value = Number.parseFloat(approved[1]);
    const pixels = approved[2] === 'rem' ? value * 16 : value;
    return pixels > 6;
  });
}

function getStyleContexts(content, file) {
  const extension = path.extname(file).toLowerCase();
  if (extension === '.css') return [content];

  const inlineStyles = [...content.matchAll(/style\s*=\s*\{\{([\s\S]*?)\}\}/g)].map((match) => match[1]);
  if (extension === '.jsx' || extension === '.tsx') return inlineStyles;
  if (extension !== '.mdx') return [];

  const styleTags = [...content.matchAll(/<style(?:\s[^>]*)?>([\s\S]*?)<\/style\s*>/gi)].map((match) => match[1]);
  return [...styleTags, ...inlineStyles];
}

function maskFunctionContents(value) {
  let depth = 0;
  return [...value].map((character) => {
    if (character === '(') {
      depth += 1;
      return ' ';
    }
    if (character === ')') {
      depth = Math.max(0, depth - 1);
      return ' ';
    }
    return depth > 0 ? ' ' : character;
  }).join('');
}

function hasCenteredShadowOffsets(value) {
  const normalized = maskFunctionContents(value.replaceAll('_', ' '));
  return normalized.split(',').some((shadow) => {
    const lengths = shadow.trim().split(/\s+/).filter((token) => /^-?(?:\d*\.)?\d+(?:px|rem|em)?$/.test(token));
    return lengths.length >= 2
      && /^-?0(?:\.0+)?(?:px|rem|em)?$/.test(lengths[0])
      && /^-?0(?:\.0+)?(?:px|rem|em)?$/.test(lengths[1]);
  });
}

function collectFunctionArguments(content, name) {
  const argumentsList = [];
  const startPattern = new RegExp(`${name}\\s*\\(`, 'gi');
  let match;
  while ((match = startPattern.exec(content)) !== null) {
    let depth = 1;
    let index = startPattern.lastIndex;
    const start = index;
    while (index < content.length && depth > 0) {
      if (content[index] === '(') depth += 1;
      if (content[index] === ')') depth -= 1;
      index += 1;
    }
    if (depth === 0) argumentsList.push(content.slice(start, index - 1));
    startPattern.lastIndex = index;
  }
  return argumentsList;
}

function hasProhibitedGlow(content, file) {
  const arbitraryShadows = [...content.matchAll(/(?<![A-Za-z0-9_-])(?:shadow|text-shadow|drop-shadow)-\[([^\]]+)\]/gi)];
  if (arbitraryShadows.some((match) => hasCenteredShadowOffsets(match[1]))) return true;

  return getStyleContexts(content, file).some((context) => {
    const declarations = [...context.matchAll(/(?:box-shadow|text-shadow)\s*:\s*([^;}\n]+)/gi)];
    return declarations.some((match) => hasCenteredShadowOffsets(match[1]))
      || collectFunctionArguments(context, 'drop-shadow').some(hasCenteredShadowOffsets);
  });
}

function hasProhibitedCssMotion(content, file) {
  return getStyleContexts(content, file).some((context) => cssScaleOrRotate.test(context));
}

const sourceRules = [
  ['legacy hex', (content) => forbiddenHex.test(content)],
  ['raw palette class', (content) => rawPaletteClass.test(content)],
  ['legacy alias', (content) => aliasDefinition.test(content) || aliasUse.test(content)],
  ['white foreground', (content) => whiteForegroundClass.test(content)],
  ['prohibited radius', (content) => hasProhibitedRadius(content)],
  ['legacy rgba', (content) => /rgba\(23,\s*26,\s*23(?!\d)/.test(content)],
  ['gradient', (content) => gradientEffect.test(content)],
  ['glow', (content, file) => hasProhibitedGlow(content, file)],
  ['prohibited motion', (content, file) => spinningAnimation.test(content)
    || transformTransition.test(content)
    || scaleOrRotate.test(content)
    || arbitraryTransform.test(content)
    || variantTranslate.test(content)
    || hasProhibitedCssMotion(content, file)],
  ['negative tracking', (content) => negativeTracking.test(content)],
];

function findSourceViolation(content, file) {
  return sourceRules.find(([, matches]) => matches(content, file))?.[0];
}

function collectSourceFiles(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const absolute = path.join(directory, entry);
    return statSync(absolute).isDirectory()
      ? collectSourceFiles(absolute)
      : sourceExtension.test(entry) ? [absolute] : [];
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

test('source scanner collects existing JavaScript modules and recognizes MDX source', () => {
  const sourceRoot = fileURLToPath(new URL('../src/', import.meta.url));
  const modules = collectSourceFiles(sourceRoot)
    .filter((file) => file.endsWith('.mjs'))
    .map((file) => path.basename(file))
    .sort();

  for (const knownModule of [
    'compare-selection.mjs',
    'search-suggestions.mjs',
    'tool-decision.mjs',
    'tools-query-state.mjs',
  ]) {
    assert.ok(modules.includes(knownModule), knownModule);
  }
  assert.equal(sourceExtension.test('content.mdx'), true);
});

test('source scanner rejects reviewed palette, effect, motion, radius, and tracking escapes', async (t) => {
  const cases = [
    ['danger alias definition', '--danger: #b54747;'],
    ['warning alias definition', '--warning : var(--signal-ink);'],
    ['danger alias use', 'color: var( --danger );'],
    ['stroke palette utility', 'stroke-red-500'],
    ['outline palette utility', 'outline-amber-400'],
    ['divide palette utility', 'divide-green-300'],
    ['decoration palette utility', 'decoration-cyan-400'],
    ['gradient stop palette utility', 'hover:from-purple-500/50'],
    ['ordinary linear gradient', 'background: linear-gradient(90deg, #000, #fff);'],
    ['repeating radial gradient', 'background: repeating-radial-gradient(circle, #000, #fff);'],
    ['conic gradient', 'background: conic-gradient(from 45deg, #000, #fff);'],
    ['arbitrary Tailwind gradient', 'bg-[linear-gradient(90deg,#000,#fff)]'],
    ['box shadow glow', 'box-shadow: 0 0 12px rgb(0 0 0 / 20%);', 'fixture.css'],
    ['text shadow glow', 'text-shadow: 0px 0rem 4px #000;', 'fixture.css'],
    ['arbitrary Tailwind glow', 'shadow-[0_0_12px_rgba(0,0,0,0.2)]'],
    ['color-first box shadow glow', 'box-shadow: #fff 0 0 12px;', 'fixture.css'],
    ['color-first text shadow glow', 'text-shadow: #fff 0 0 12px;', 'fixture.css'],
    ['color-first arbitrary Tailwind glow', 'shadow-[#fff_0_0_12px]'],
    ['color-first arbitrary Tailwind text glow', 'text-shadow-[#fff_0_0_12px]'],
    ['rgb color-first CSS glow', 'box-shadow: rgb(255 255 255) 0 0 12px;', 'fixture.css'],
    ['variable color-first CSS glow', 'text-shadow: var(--glow) 0 0 12px;', 'fixture.css'],
    ['later comma-separated CSS glow', 'box-shadow: 0 1px 2px #000, #fff 0 0 12px;', 'fixture.css'],
    ['arbitrary Tailwind drop shadow glow', 'drop-shadow-[0_0_12px_#fff]'],
    ['CSS filter drop shadow glow', 'filter: drop-shadow(0 0 12px #fff);', 'fixture.css'],
    ['unprefixed scale utility', 'scale-95'],
    ['responsive scale utility', 'md:scale-x-105'],
    ['group rotate utility', 'group-hover:-rotate-3'],
    ['data scale utility', 'data-[state=open]:scale-100'],
    ['CSS transform rotate function', 'transform: rotate(3deg);', 'fixture.css'],
    ['CSS transform rotateX function', 'transform: rotateX(3deg);', 'fixture.css'],
    ['CSS transform rotateY function', 'transform: rotateY(3deg);', 'fixture.css'],
    ['CSS transform rotateZ function', 'transform: rotateZ(3deg);', 'fixture.css'],
    ['CSS transform rotate3d function', 'transform: ROTATE3D(1, 0, 0, 3deg);', 'fixture.css'],
    ['CSS transform scale function', 'transform: scale(1.05);', 'fixture.css'],
    ['CSS transform scaleX function', 'transform: scaleX(1.05);', 'fixture.css'],
    ['CSS transform scaleY function', 'transform: scaleY(1.05);', 'fixture.css'],
    ['CSS transform scaleZ function', 'transform: scaleZ(1.05);', 'fixture.css'],
    ['CSS transform scale3d function', 'transform: SCALE3D(1.05, 1, 1);', 'fixture.css'],
    ['standalone CSS rotate property', 'rotate: 3deg;', 'fixture.css'],
    ['standalone CSS scale property', 'scale: 1.05;', 'fixture.css'],
    ['inline style scale property', 'style={{ scale: 1.1 }}', 'fixture.tsx'],
    ['active translate utility', 'active:translate-x-1'],
    ['focus translate utility', 'focus:-translate-y-1'],
    ['group data translate utility', 'group-data-[state=open]:translate-x-1'],
    ['arbitrary hover translate utility', '[&:hover]:translate-x-1'],
    ['disabled translate utility', 'disabled:translate-x-1'],
    ['checked translate utility', 'checked:-translate-y-1'],
    ['arbitrary selector translate utility', '[&[data-state=open]]:translate-x-1'],
    ['arbitrary transform rotate utility', 'transform-[rotate(3deg)]'],
    ['arbitrary transform rotateX utility', 'transform-[rotateX(3deg)]'],
    ['arbitrary transform rotateY utility', 'transform-[rotateY(3deg)]'],
    ['arbitrary transform rotateZ utility', 'transform-[rotateZ(3deg)]'],
    ['arbitrary transform rotate3d utility', 'transform-[ROTATE3D(1,0,0,3deg)]'],
    ['arbitrary transform scale utility', 'transform-[scale(1.05)]'],
    ['arbitrary transform scaleX utility', 'transform-[scaleX(1.05)]'],
    ['arbitrary transform scaleY utility', 'transform-[scaleY(1.05)]'],
    ['arbitrary transform scaleZ utility', 'transform-[scaleZ(1.05)]'],
    ['arbitrary transform scale3d utility', 'transform-[SCALE3D(1.05,1,1)]'],
    ['MDX style tag transform function', '<style>.card { transform: rotateX(3deg); }</style>', 'fixture.mdx'],
    ['MDX attributed style tag property', '<style type="text/css">.card { scale: 1.1; }</style>', 'fixture.mdx'],
    ['MDX inline style transform function', '<div style={{ transform: \'scaleZ(1.1)\' }} />', 'fixture.mdx'],
    ['MDX inline style property', '<div style={{ rotate: \'3deg\' }} />', 'fixture.mdx'],
    ['large radius utility', 'rounded-xl'],
    ['directional large radius utility', 'md:rounded-t-2xl'],
    ['full radius utility', 'rounded-full'],
    ['arbitrary pixel radius above limit', 'rounded-[7px]'],
    ['arbitrary rem radius above limit', 'rounded-[0.5rem]'],
    ['percentage arbitrary radius', 'rounded-[50%]'],
    ['em arbitrary radius', 'rounded-[1em]'],
    ['point arbitrary radius', 'rounded-[8pt]'],
    ['calculated arbitrary radius', 'rounded-[calc(6px+1px)]'],
    ['variable arbitrary radius', 'rounded-[var(--large-radius)]'],
    ['tight tracking utility', 'tracking-tight'],
    ['tighter tracking utility', 'sm:tracking-tighter'],
    ['negative arbitrary tracking', 'tracking-[-0.01em]'],
    ['negative CSS tracking', 'letter-spacing: -0.01em;'],
  ];

  for (const [name, source, file = 'fixture.tsx'] of cases) {
    await t.test(name, () => assert.ok(findSourceViolation(source, file), source));
  }
});

test('source scanner allows precise identifiers, approved radii, and static positioning', async (t) => {
  const cases = [
    ['white prefix identifier', 'text-whitespace'],
    ['spin prefix identifier', 'animate-spinach'],
    ['palette prefix identifier', 'text-red-500ish'],
    ['approved large token radius', 'rounded-lg'],
    ['approved arbitrary pixel radius', 'rounded-[6px]'],
    ['approved arbitrary rem radius', 'rounded-[0.375rem]'],
    ['static positioning translate', '-translate-y-1/2'],
    ['static positive translate', 'translate-x-1'],
    ['non-glow shadow', 'box-shadow: 0 1px 2px rgb(0 0 0 / 20%);', 'fixture.css'],
    ['nonnegative tracking', 'letter-spacing: 0; tracking-wide'],
    ['similar custom property', '--dangerous: 1; color: var(--warning-label);'],
    ['similar transform identifiers', 'rotate-icon scale-factor transition-transformation'],
    ['ordinary scale object key', 'const options = { scale: 2 };', 'fixture.ts'],
    ['MDX prose with scale label', 'Enterprise scale: built for teams', 'fixture.mdx'],
    ['MDX ordinary scale expression', '{ scale: 2 }', 'fixture.mdx'],
  ];

  for (const [name, source, file = 'fixture.tsx'] of cases) {
    await t.test(name, () => assert.equal(findSourceViolation(source, file), undefined, source));
  }
});

test('contains no legacy palette, raw status colors, or prohibited motion in application source', () => {
  const sourceRoot = fileURLToPath(new URL('../src/', import.meta.url));
  const files = collectSourceFiles(sourceRoot);

  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    const violation = findSourceViolation(content, file);
    assert.equal(violation, undefined, `${file}: ${violation}`);
  }
});

test('wires the complete carbon route, state, geometry, focus, and evidence guard into CI', () => {
  const guard = readRepo('scripts/carbon-theme-ui-guard.mjs');
  const workflow = readRepo('.github/workflows/deploy.yml');

  const scenariosBlock = guard.match(/const allScenarios = \[([\s\S]*?)\n\];/)?.[1];
  const viewportsBlock = guard.match(/const viewports = \[([\s\S]*?)\n\];/)?.[1];
  assert.ok(scenariosBlock, 'missing structural scenario array');
  assert.ok(viewportsBlock, 'missing structural viewport array');

  const scenarioNames = [...scenariosBlock.matchAll(/name: '([^']+)'/g)].map((match) => match[1]);
  assert.deepEqual(scenarioNames, ['home', 'directory', 'detail', 'compare', 'scenes', 'scene-detail', 'leaderboard', 'user', 'auth']);
  for (const entry of [
    "name: 'home', path: '/'",
    "name: 'directory', path: '/tools?scene=research&price=free-tier&platform=web'",
    "name: 'detail', path: '/tools/71'",
    "name: 'compare', path: '/tools?scene=research&price=free-tier&platform=web'",
    "name: 'scenes', path: '/scenes'",
    "name: 'scene-detail', path: '/scenes/research'",
    "name: 'leaderboard', path: '/leaderboard'",
    "name: 'user', path: '/user'",
    "name: 'auth', path: '/user'",
  ]) assert.match(scenariosBlock, new RegExp(entry.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

  const viewportPairs = [...viewportsBlock.matchAll(/width: (\d+), height: (\d+)/g)]
    .map((match) => [Number(match[1]), Number(match[2])]);
  assert.deepEqual(viewportPairs, [[1440, 900], [1280, 720], [768, 1024], [390, 844], [320, 700]]);
  assert.equal((scenarioNames.length * 2) + (4 * 4 * 2), 50);
  assert.match(guard, /capturePlan\.length !== 50/);

  const functionBody = (name) => {
    const match = guard.match(new RegExp(`(?:async )?function ${name}\\([^)]*\\) \\{([\\s\\S]*?)\\n\\}`));
    assert.ok(match, `missing function ${name}`);
    return match[1];
  };
  const capture = functionBody('captureScenario');
  const main = functionBody('main');
  for (const call of [
    'openScenario',
    'assertScenarioIdentity',
    'setTheme',
    'assertHomeHover',
    'assertTokens',
    'assertNoOverflow',
    'assertCarbonSurfaces',
    'assertSelectedRails',
    'assertResponsiveGeometry',
    'assertFocusColors',
    'assertThemeLayoutInvariant',
    'prepareScreenshot',
  ]) assert.match(capture, new RegExp(`await ${call}\\(`), `${call} is not in the capture path`);
  assert.match(capture, /page\.screenshot\(\{[\s\S]*?fullPage: false/);

  for (const name of [
    'assertScenarioIdentity',
    'assertHomeHover',
    'assertResponsiveGeometry',
    'assertCarbonSurfaces',
    'assertSelectedRails',
    'assertFocusColors',
    'assertThemeLayoutInvariant',
    'prepareScreenshot',
    'auditEvidence',
  ]) functionBody(name);
  assert.match(functionBody('assertScenarioIdentity'), /404|not-found|nextjs-portal/);
  assert.match(functionBody('assertScenarioIdentity'), /searchParams/);
  assert.match(functionBody('assertHomeHover'), /backgroundColor/);
  assert.match(functionBody('assertResponsiveGeometry'), /assertTargetSize/);
  assert.match(functionBody('assertResponsiveGeometry'), /assertContainerGeometry/);
  assert.match(functionBody('assertResponsiveGeometry'), /assertFixedSurfaceGeometry/);
  assert.match(functionBody('assertTargetSize'), /44/);
  assert.match(functionBody('assertContainerGeometry'), /overlap/i);
  assert.match(functionBody('assertFixedSurfaceGeometry'), /overlap/i);
  assert.match(functionBody('assertSelectedRails'), /toggle/i);
  assert.match(functionBody('assertSelectedRails'), /left/);
  assert.match(functionBody('assertFocusColors'), /assertOutline/);
  assert.match(functionBody('assertOutline'), /outlineStyle/);
  assert.match(functionBody('assertOutline'), /outlineWidth/);

  assert.match(main, /await rm\(qaDir, \{ recursive: true, force: true \}\)/);
  assert.match(main, /await composeEvidence\(sharp\)/);
  assert.match(main, /await auditEvidence\(sharp\)/);
  assert.match(functionBody('auditEvidence'), /expectedScreenshotNames/);
  assert.match(functionBody('auditEvidence'), /metadata\(\)/);
  assert.match(functionBody('composeEvidence'), /throw new Error|fail\(/);

  const lifecycle = workflow.match(/- name: Run Next\.js task-first UI guard([\s\S]*?)(?=\n      - name:)/)?.[1];
  assert.ok(lifecycle, 'missing shared production UI guard lifecycle');
  const lifecycleOrder = [
    'cleanup() {',
    'trap cleanup EXIT INT TERM',
    'next start --hostname 127.0.0.1 --port 4181',
    'curl --fail --silent http://127.0.0.1:4181/',
    'TASK_FIRST_UI_URL=http://127.0.0.1:4181 node scripts/task-first-ui-guard.mjs',
    'CARBON_THEME_URL=http://127.0.0.1:4181 CARBON_QA_DIR=/tmp/carbon-console-qa node scripts/carbon-theme-ui-guard.mjs',
    'kill "$next_pid"',
    'wait "$next_pid"',
    'trap - EXIT INT TERM',
  ];
  let previousIndex = -1;
  for (const fragment of lifecycleOrder) {
    const index = lifecycle.indexOf(fragment, previousIndex + 1);
    assert.ok(index > previousIndex, `${fragment} missing or out of order`);
    previousIndex = index;
  }
  assert.match(workflow, /next-src\/tests\/editorial-ui-contract\.test\.mjs \\\n\s+next-src\/tests\/carbon-theme-contract\.test\.mjs/);
});
