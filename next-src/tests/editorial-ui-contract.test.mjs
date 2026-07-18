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
