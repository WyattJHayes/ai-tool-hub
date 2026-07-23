import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildCustomRoute } from 'next/dist/lib/build-custom-route.js';
import nextConfig from '../next.config.mjs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('publishes one anonymous canonical resume optimizer entry with effective plan facts', () => {
  const data = JSON.parse(read('public/data/tools.json'));
  const entries = data.tools.filter((tool) => tool.id === 95);

  assert.equal(entries.length, 1);

  const [entry] = entries;
  assert.equal(entry.name, '简历优化');
  assert.equal(entry.url, '/resume/');
  assert.equal(entry.requires_login, false);
  assert.ok(entry.categories.includes('office'));
  assert.ok(entry.toolTags.includes('无需登录'));
  assert.ok(entry.toolTags.includes('简历'));
  assert.ok(entry.highlights.length > 0);
  assert.equal(entry.valueTag, '免费本地编辑');
  assert.deepEqual(entry.pricing, [
    { plan: 'Free', price: 0, unit: '', quota: '本地编辑、导入、预览与 PDF 导出', highlight: true },
    { plan: 'Basic', price: 9.9, unit: 'CNY', quota: 'AI 优化 10 次', highlight: false },
    { plan: '永久 VIP', price: 99, unit: 'CNY', quota: 'AI 优化不限次', highlight: false },
  ]);
});

test('keeps resume navigation active and preserves the five-column mobile geometry', () => {
  const navbar = read('src/components/layout/Navbar.tsx');
  const bottomNav = read('src/components/layout/BottomNav.tsx');

  assert.match(navbar, /href:\s*['"]\/resume\/['"],\s*label:\s*['"]简历优化['"]/);
  assert.match(navbar, /const activeHref = item\.href\.replace\(/);
  assert.match(navbar, /pathname === activeHref \|\| pathname\.startsWith\(`\$\{activeHref\}\//);
  assert.match(bottomNav, /FileText/);
  assert.match(bottomNav, /label:\s*['"]简历['"],\s*href:\s*['"]\/resume\/['"]/);
  assert.match(bottomNav, /const activeHref = item\.href\.replace\(/);
  assert.match(bottomNav, /pathname === activeHref \|\| pathname\.startsWith\(`\$\{activeHref\}\//);
  assert.match(bottomNav, /h-\[calc\(64px\+env\(safe-area-inset-bottom,0px\)\)\]/);
  assert.match(bottomNav, /grid-cols-5/);
});

test('compiles both legacy resume optimizer redirects as permanent Next 308 routes', async () => {
  const redirects = await nextConfig.redirects();

  for (const source of ['/tools/resume-optimizer', '/tools/resume-optimizer/']) {
    const redirect = redirects.find((route) => route.source === source);
    assert.ok(redirect, `missing redirect for ${source}`);

    const compiled = buildCustomRoute('redirect', redirect, []);
    assert.equal(compiled.destination, '/resume/');
    assert.equal(compiled.statusCode, 308);
  }
});
