import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const helperUrl = new URL('../src/lib/tools-query-state.mjs', import.meta.url);
const toolsData = JSON.parse(readFileSync(new URL('../public/data/tools.json', import.meta.url), 'utf8'));
const sceneData = JSON.parse(readFileSync(new URL('../public/data/scenes.json', import.meta.url), 'utf8'));
const catalog = {
  sceneIds: new Set(sceneData.scenes.map((scene) => scene.id)),
  categoryIds: new Set(toolsData.categories.map((category) => category.id)),
  platforms: new Set(['web', 'local', 'cli', 'desktop']),
};

test('scene wins over category and invalid values are ignored', async () => {
  const { parseDirectoryQuery } = await import(helperUrl);
  const state = parseDirectoryQuery(new URLSearchParams('scene=research&category=writing&price=bad&origin=domestic,bad'), catalog);
  assert.equal(state.sceneId, 'research');
  assert.equal(state.categoryId, null);
  assert.equal(state.price, null);
  assert.deepEqual(state.origins, ['domestic']);
});

test('serialization is stable and omits defaults', async () => {
  const { parseDirectoryQuery, serializeDirectoryQuery } = await import(helperUrl);
  const state = parseDirectoryQuery(new URLSearchParams('q=%20Claude%20&platform=cli,web&sort=name-asc'), catalog);
  assert.equal(serializeDirectoryQuery(state), 'q=Claude&platform=web%2Ccli&sort=name-asc');
});

test('patching scene and category keeps them mutually exclusive', async () => {
  const { parseDirectoryQuery, patchDirectoryQuery, serializeDirectoryQuery } = await import(helperUrl);
  const empty = parseDirectoryQuery(new URLSearchParams(), catalog);
  const scene = patchDirectoryQuery(empty, { sceneId: 'research' });
  assert.equal(scene.categoryId, null);
  const category = patchDirectoryQuery(scene, { categoryId: 'writing' });
  assert.equal(category.sceneId, null);
  assert.equal(serializeDirectoryQuery(patchDirectoryQuery(empty, { searchTerm: '   ' })), '');
});

test('research groups preserve source order and search capabilities', async () => {
  const { parseDirectoryQuery, selectDirectoryGroups } = await import(helperUrl);
  const state = parseDirectoryQuery(new URLSearchParams('scene=research'), catalog);
  const groups = selectDirectoryGroups(toolsData.tools, sceneData.scenes, toolsData.categories, state, {});
  assert.deepEqual(groups[0].items.map((item) => item.tool.id), [71, 72, 94]);
  assert.deepEqual(groups[1].items.map((item) => item.tool.id), [2, 9, 73, 74, 80, 88, 90]);

  const searched = selectDirectoryGroups(
    toolsData.tools,
    sceneData.scenes,
    toolsData.categories,
    { ...state, searchTerm: '引用' },
    {}
  );
  assert.ok(searched.flatMap((group) => group.items).some((item) => item.tool.id === 71));

  const visibleTaskSearch = selectDirectoryGroups(
    toolsData.tools,
    sceneData.scenes,
    toolsData.categories,
    { ...state, searchTerm: '做调研' },
    {}
  );
  assert.ok(visibleTaskSearch[1].items.some((item) => item.tool.id === 2));
});

test('return paths remain same-origin and directory-only', async () => {
  const { buildToolDetailHref, sanitizeToolsReturnPath } = await import(helperUrl);
  assert.equal(sanitizeToolsReturnPath('/tools?scene=research'), '/tools?scene=research');
  assert.equal(sanitizeToolsReturnPath('/tools?scene=research&unknown=keep&price=bad'), '/tools?scene=research&unknown=keep&price=bad');
  assert.equal(sanitizeToolsReturnPath('https://example.com'), '/tools');
  assert.equal(buildToolDetailHref('71', '/tools?scene=research'), '/tools/71?from=%2Ftools%3Fscene%3Dresearch');
  assert.equal(
    buildToolDetailHref('71', '/tools?scene=research&unknown=keep&price=bad'),
    '/tools/71?from=%2Ftools%3Fscene%3Dresearch%26unknown%3Dkeep%26price%3Dbad'
  );
});
