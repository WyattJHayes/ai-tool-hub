import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (relativePath) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');

test('uses the neutral editorial color system without animated grid decoration', () => {
  const css = read('src/app/globals.css');

  assert.match(css, /--page:\s*#f6f7f4/i);
  assert.match(css, /--accent:\s*#176b4d/i);
  assert.doesNotMatch(css, /gridMove|repeating-linear-gradient|--neon-purple/i);
});

test('ships a light default viewport and quiet directory navigation', () => {
  const layout = read('src/app/layout.tsx');
  const navbar = read('src/components/layout/Navbar.tsx');

  assert.match(layout, /themeColor:\s*'#f6f7f4'/);
  assert.doesNotMatch(layout, /className="dark"|bg-gray-950|text-white/);
  assert.match(navbar, /label: '工具'/);
  assert.match(navbar, /label: '场景'/);
  assert.match(navbar, /label: '排行'/);
  assert.doesNotMatch(navbar, /bg-gradient|backdrop-blur|rounded-full/);
});

test('puts task search and real curated tools ahead of scene browsing', () => {
  const home = read('src/app/page.tsx');

  assert.match(home, /按任务找到合适的 AI 工具/);
  assert.match(home, /本周值得试/);
  assert.match(home, /<ToolCard key=\{tool\.id\} tool=\{tool\}/);
  assert.match(home, /按任务浏览/);
  assert.doesNotMatch(home, /数据概览|totalCategories|favorites/);
});

test('uses flat comparison-oriented tool cards and tab-like filters', () => {
  const card = read('src/components/tools/ToolCard.tsx');
  const categories = read('src/components/tools/CategoryFilter.tsx');
  const search = read('src/components/hero/SearchBar.tsx');

  assert.doesNotMatch(card, /rotateX|scan_2s|backdrop-blur|bg-gradient|rounded-2xl/);
  assert.match(card, /tool\.updateTime/);
  assert.match(card, /tool\.platforms/);
  assert.match(card, /aria-label=\{isFavorite \? `取消收藏/);
  assert.doesNotMatch(categories, /rounded-full|bg-gradient|shadow-\[/);
  assert.match(categories, /border-b-2/);
  assert.doesNotMatch(search, /backdrop-blur|rounded-2xl|shadow-\[0_0/);
  assert.match(search, /usePathname/);
  assert.match(search, /router\.push\('\/tools'\)/);
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
