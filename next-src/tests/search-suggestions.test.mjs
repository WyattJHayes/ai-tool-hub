import test from 'node:test';
import assert from 'node:assert/strict';

const helperUrl = new URL('../src/lib/search-suggestions.mjs', import.meta.url);

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
