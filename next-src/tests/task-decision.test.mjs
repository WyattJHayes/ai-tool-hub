import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const helperUrl = new URL('../src/lib/tool-decision.mjs', import.meta.url);
const toolsData = JSON.parse(readFileSync(new URL('../public/data/tools.json', import.meta.url), 'utf8'));
const sceneData = JSON.parse(readFileSync(new URL('../public/data/scenes.json', import.meta.url), 'utf8'));
const byId = new Map(toolsData.tools.map((tool) => [tool.id, tool]));

test('derives explicit tasks in scene-file order and category fallback', async () => {
  const { buildSceneToolIndex, deriveToolTasks } = await import(helperUrl);
  const index = buildSceneToolIndex(sceneData.scenes);
  assert.deepEqual(
    deriveToolTasks(byId.get(2), index, toolsData.categories).items.map((task) => task.label),
    ['做PPT', '写文案']
  );
  assert.deepEqual(
    deriveToolTasks(byId.get(7), index, toolsData.categories).items.map((task) => task.label),
    ['AI写作', 'AI代码']
  );
});

test('uses selected scene as the primary task and identifies its source', async () => {
  const { buildSceneToolIndex, deriveSceneTaskCell } = await import(helperUrl);
  const index = buildSceneToolIndex(sceneData.scenes);
  const research = sceneData.scenes.find((scene) => scene.id === 'research');
  assert.deepEqual(deriveSceneTaskCell(byId.get(71), research, index), {
    primary: { id: 'research', label: '做调研' },
    relation: 'task-match',
    additionalExplicitCount: 0,
  });
  assert.equal(deriveSceneTaskCell(byId.get(2), research, index).relation, 'category-related');
});

test('filters generic capabilities and falls back to the real description', async () => {
  const { deriveCapabilities, deriveCapabilitySummary } = await import(helperUrl);
  const generic = byId.get(73);
  assert.deepEqual(deriveCapabilities(generic), []);
  assert.deepEqual(deriveCapabilitySummary(generic), [generic.desc]);
  assert.deepEqual(deriveCapabilitySummary(byId.get(2)), ['GPT-4o多模态', 'DALL·E 3绘图']);
});

test('derives platform, origin, and price predicates from canonical fields', async () => {
  const { deriveToolOrigins, deriveToolPlatforms, deriveToolPrice } = await import(helperUrl);
  assert.deepEqual(deriveToolPlatforms(byId.get(2)), ['web']);
  assert.deepEqual(deriveToolPlatforms(byId.get(67)), ['web', 'local']);
  assert.deepEqual(deriveToolOrigins(byId.get(2)), ['overseas']);
  assert.deepEqual(deriveToolPrice(byId.get(9)).filters, ['free-tier', 'fully-free']);
  assert.equal(deriveToolPrice(byId.get(9)).summary, '免费');
  assert.deepEqual(deriveToolPrice(byId.get(11)).filters, ['paid-only']);
  assert.equal(deriveToolPrice(byId.get(11)).summary, 'Basic $10');
  assert.deepEqual(deriveToolPrice({}).filters, []);
  assert.deepEqual(deriveToolPrice({ pricing: [] }).filters, []);
  assert.deepEqual(deriveToolPrice({ pricing: [{ price: 0 }, { price: 10 }] }).filters, ['free-tier']);
  assert.deepEqual(deriveToolPrice({ pricing: [{ price: -1 }, { price: 0 }] }).filters, ['free-tier']);
  assert.deepEqual(deriveToolPrice({ pricing: [{ price: -1 }, { price: 10 }] }).filters, []);
});

test('price summaries distinguish fully free, mixed free tiers, and paid-only plans', async () => {
  const { deriveToolPrice } = await import(helperUrl);
  assert.equal(deriveToolPrice({ pricing: [{ plan: 'Free', price: 0 }] }).summary, '免费');
  assert.equal(
    deriveToolPrice({ pricing: [{ plan: 'Free', price: 0 }, { plan: 'Pro', price: 20, highlight: true }] }).summary,
    '有免费额度'
  );
  assert.equal(deriveToolPrice({ pricing: [{ plan: 'Basic', price: 10, highlight: true }] }).summary, 'Basic $10');
});

test('all real tools produce nonempty tasks and capability summaries', async () => {
  const { buildSceneToolIndex, deriveCapabilitySummary, deriveToolTasks } = await import(helperUrl);
  const index = buildSceneToolIndex(sceneData.scenes);
  for (const tool of toolsData.tools) {
    assert.ok(deriveToolTasks(tool, index, toolsData.categories).items.length > 0, tool.name);
    assert.ok(deriveCapabilitySummary(tool).length > 0, tool.name);
  }
});

test('alternatives preserve explicit and category fallback order with stable limits', async () => {
  const { selectAlternativeTools } = await import(helperUrl);
  const current = { id: 1, category: 'search', categories: [] };
  const tools = [
    { id: 4, category: 'search', categories: [] },
    { id: 3, category: 'writing', categories: ['writing'] },
    { id: 6, category: 'video', categories: ['video'] },
    { id: 2, category: 'code', categories: ['code'] },
    { id: 5, category: 'search', categories: ['search'] },
    current,
  ];
  const scenes = [
    { id: 'research', toolIds: [1, 2] },
    { id: 'citations', toolIds: [1, 3] },
  ];

  assert.deepEqual(selectAlternativeTools(current, tools, scenes).map((tool) => tool.id), [3, 2, 4, 5]);
  assert.deepEqual(selectAlternativeTools(current, tools, scenes, 3).map((tool) => tool.id), [3, 2, 4]);
  assert.equal(selectAlternativeTools(current, tools, scenes).some((tool) => tool.id === current.id), false);
});
