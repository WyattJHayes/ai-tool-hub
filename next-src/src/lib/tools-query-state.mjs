import {
  buildSceneToolIndex,
  createToolDecisionModel,
  groupToolsForScene,
} from './tool-decision.mjs';

const PRICE_VALUES = ['free-tier', 'fully-free', 'paid-only'];
const ORIGIN_VALUES = ['domestic', 'overseas'];
const PLATFORM_VALUES = ['web', 'local', 'cli', 'desktop'];
const SORT_VALUES = ['default', 'hot', 'free-first', 'domestic', 'name-asc', 'name-desc', 'popular'];

function parseCsv(value, allowed) {
  const found = new Set(String(value || '').split(',').map((item) => item.trim()).filter((item) => allowed.includes(item)));
  return allowed.filter((item) => found.has(item));
}

export function parseDirectoryQuery(params, catalog) {
  const rawScene = String(params.get('scene') || '').trim();
  const sceneId = catalog.sceneIds.has(rawScene) ? rawScene : null;
  const rawCategory = String(params.get('category') || '').trim();
  const categoryId = !sceneId && catalog.categoryIds.has(rawCategory) ? rawCategory : null;
  const rawPrice = String(params.get('price') || '').trim();
  const price = PRICE_VALUES.includes(rawPrice) ? rawPrice : null;
  const rawSort = String(params.get('sort') || '').trim();
  return {
    sceneId,
    searchTerm: String(params.get('q') || '').trim(),
    categoryId,
    price,
    origins: parseCsv(params.get('origin'), ORIGIN_VALUES),
    platforms: parseCsv(params.get('platform'), PLATFORM_VALUES.filter((value) => catalog.platforms.has(value))),
    sort: SORT_VALUES.includes(rawSort) ? rawSort : 'default',
  };
}

export function patchDirectoryQuery(state, patch) {
  const next = { ...state, ...patch };
  if (Object.hasOwn(patch, 'searchTerm')) next.searchTerm = String(patch.searchTerm || '').trim();
  if (Object.hasOwn(patch, 'sceneId') && patch.sceneId) next.categoryId = null;
  if (Object.hasOwn(patch, 'categoryId') && patch.categoryId) next.sceneId = null;
  return next;
}

export function serializeDirectoryQuery(state) {
  const params = new URLSearchParams();
  const searchTerm = String(state.searchTerm || '').trim();
  if (state.sceneId) params.set('scene', state.sceneId);
  if (searchTerm) params.set('q', searchTerm);
  if (state.categoryId) params.set('category', state.categoryId);
  if (state.price) params.set('price', state.price);
  if (state.origins.length) params.set('origin', ORIGIN_VALUES.filter((value) => state.origins.includes(value)).join(','));
  if (state.platforms.length) params.set('platform', PLATFORM_VALUES.filter((value) => state.platforms.includes(value)).join(','));
  if (state.sort !== 'default') params.set('sort', state.sort);
  return params.toString();
}

function matchesSearch(model, term) {
  const query = term.toLocaleLowerCase('zh-CN');
  if (!query) return true;
  return [
    model.tool.name,
    model.tool.desc,
    ...model.capabilities,
    ...model.tasks.map((task) => task.label),
    model.taskCell?.primary.label || '',
    ...(model.tool.toolTags || []),
  ].some((value) => String(value).toLocaleLowerCase('zh-CN').includes(query));
}

function filterModels(models, state) {
  return models.filter((model) =>
    matchesSearch(model, state.searchTerm) &&
    (!state.categoryId || (model.tool.categories || [model.tool.category]).includes(state.categoryId)) &&
    (!state.price || model.price.filters.includes(state.price)) &&
    (!state.origins.length || (model.origin && state.origins.includes(model.origin))) &&
    (!state.platforms.length || model.platforms.some((value) => state.platforms.includes(value)))
  );
}

function sortModels(models, sort, clickStats) {
  const sourceIndex = new Map(models.map((model, index) => [model.tool.id, index]));
  return [...models].sort((left, right) => {
    if (sort === 'hot') return Number(right.tool.status === 'hot') - Number(left.tool.status === 'hot') || sourceIndex.get(left.tool.id) - sourceIndex.get(right.tool.id);
    if (sort === 'free-first') return Number(!left.price.filters.includes('free-tier')) - Number(!right.price.filters.includes('free-tier')) || sourceIndex.get(left.tool.id) - sourceIndex.get(right.tool.id);
    if (sort === 'domestic') return Number(left.origin !== 'domestic') - Number(right.origin !== 'domestic') || sourceIndex.get(left.tool.id) - sourceIndex.get(right.tool.id);
    if (sort === 'name-asc') return left.tool.name.localeCompare(right.tool.name, 'zh');
    if (sort === 'name-desc') return right.tool.name.localeCompare(left.tool.name, 'zh');
    if (sort === 'popular') return (clickStats[String(right.tool.id)] || 0) - (clickStats[String(left.tool.id)] || 0) || sourceIndex.get(left.tool.id) - sourceIndex.get(right.tool.id);
    return sourceIndex.get(left.tool.id) - sourceIndex.get(right.tool.id);
  });
}

export function selectDirectoryGroups(tools, scenes, categories, state, clickStats) {
  const selectedScene = scenes.find((scene) => scene.id === state.sceneId) || null;
  const sceneIndex = buildSceneToolIndex(scenes);
  const makeModels = (source) => filterModels(
    source.map((tool) => createToolDecisionModel(tool, scenes, categories, selectedScene, sceneIndex)),
    state
  );
  if (!selectedScene) {
    return [{ id: 'all', items: sortModels(makeModels(tools), state.sort, clickStats) }];
  }
  const grouped = groupToolsForScene(tools, selectedScene);
  return [
    { id: 'matched', title: '任务匹配', items: sortModels(makeModels(grouped.taskMatches), state.sort, clickStats) },
    { id: 'related', title: '同类工具', items: sortModels(makeModels(grouped.relatedTools), state.sort, clickStats) },
  ];
}

export function sanitizeToolsReturnPath(value) {
  return value === '/tools' || String(value || '').startsWith('/tools?') ? String(value) : '/tools';
}

export function buildToolDetailHref(slug, from) {
  return `/tools/${encodeURIComponent(slug)}?from=${encodeURIComponent(sanitizeToolsReturnPath(from))}`;
}
