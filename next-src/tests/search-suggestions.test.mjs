import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const helperUrl = new URL('../src/lib/search-suggestions.mjs', import.meta.url);
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

async function loadSearchTools(tools) {
  const source = read('src/app/api/search/route.ts')
    .replace("import { NextRequest, NextResponse } from 'next/server';", 'class NextResponse { static json(value) { return value; } }')
    .replace("import { readFileSync } from 'fs';", '')
    .replace("import { join } from 'path';", '')
    .replace('let toolsCache: SearchTool[] = [];', `let toolsCache: SearchTool[] = ${JSON.stringify(tools)};`)
    .replace('function searchTools(', 'export function searchTools(');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
}

const tools = [
  {
    id: 1,
    name: 'ChatGPT',
    desc: 'ChatGPT 对话与写作助手',
    toolTags: ['chatgpt', '海外'],
  },
  {
    id: 2,
    name: 'ChatGPT Prompt Helper',
    desc: '整理提示词',
    toolTags: ['写作'],
  },
  {
    id: 3,
    name: 'Claude',
    desc: '长文本分析',
    toolTags: ['海外'],
  },
];

test('returns every matching tool once even when multiple fields match', async () => {
  const { getSearchSuggestions } = await import(helperUrl);

  const suggestions = getSearchSuggestions(tools, 'chatgpt');

  assert.deepEqual(suggestions.map((tool) => tool.id), [1, 2]);
});

test('returns no suggestions for blank input and respects the result limit', async () => {
  const { getSearchSuggestions } = await import(helperUrl);

  assert.deepEqual(getSearchSuggestions(tools, '   '), []);
  assert.deepEqual(getSearchSuggestions(tools, '海外', 1).map((tool) => tool.id), [1]);
});

test('finds the canonical resume entry for both resume terms', async () => {
  const { getSearchSuggestions } = await import(helperUrl);
  const data = JSON.parse(read('public/data/tools.json'));

  for (const query of ['简历', '简历优化']) {
    assert.deepEqual(getSearchSuggestions(data.tools, query).map((tool) => tool.id).includes(95), true);
  }
});

test('filters search results by textual relevance before applying the hot ranking bonus', async () => {
  const { searchTools } = await loadSearchTools([
    { id: 9, name: '简历优化', desc: '本地编辑', category: 'office', categories: ['office'], tags: ['free'], toolTags: ['无需登录'] },
    { id: 1, name: '热门绘图', desc: '生成图片', category: 'painting', categories: ['painting'], tags: ['vip'], toolTags: ['海外'], status: 'hot' },
  ]);

  assert.deepEqual(searchTools('简历').map((tool) => tool.id), [9]);
});

test('searches every textual field and resolves equal scores by ascending ID', async () => {
  const { searchTools } = await loadSearchTools([
    { id: 20, name: '名称', desc: '说明', category: 'resume', categories: [], tags: [], toolTags: [] },
    { id: 18, name: '分类', desc: '说明', category: 'office', categories: ['resume'], tags: [], toolTags: [] },
    { id: 16, name: '标签', desc: '说明', category: 'office', categories: [], tags: ['resume'], toolTags: [] },
    { id: 14, name: '工具标签', desc: '说明', category: 'office', categories: [], tags: [], toolTags: ['resume'] },
    { id: 12, name: '价值标签', desc: '说明', category: 'office', categories: [], tags: [], toolTags: [], valueTag: 'resume' },
  ]);

  assert.deepEqual(searchTools('resume').map((tool) => tool.id), [12, 14, 16, 18, 20]);
});
