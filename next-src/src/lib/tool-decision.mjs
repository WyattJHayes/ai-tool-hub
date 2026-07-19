const GENERIC_CAPABILITIES = new Set(['AI驱动', '高效便捷', '持续更新']);
const PLATFORM_VALUES = new Set(['web', 'local', 'cli', 'desktop']);

export const RELATED_CATEGORY_IDS_BY_SCENE = Object.freeze({
  ppt: ['office', 'design'],
  coding: ['code'],
  video: ['video'],
  drawing: ['painting', 'design'],
  copywriting: ['writing'],
  music: ['music'],
  research: ['search'],
  agent: ['agent'],
});

export function normalizeSceneLabel(name) {
  return String(name || '').trim().replace(/^我要/, '');
}

export function buildSceneToolIndex(scenes) {
  const index = new Map();
  for (const scene of scenes) {
    for (const toolId of scene.toolIds) {
      const current = index.get(toolId) || [];
      index.set(toolId, [...current, scene]);
    }
  }
  return index;
}

export function deriveToolTasks(tool, sceneIndex, categories) {
  const explicit = sceneIndex.get(tool.id) || [];
  if (explicit.length > 0) {
    return {
      source: 'scene-mapping',
      items: explicit.map((scene) => ({
        id: scene.id,
        label: normalizeSceneLabel(scene.name),
        source: 'scene',
      })),
    };
  }
  const names = new Map(categories.map((category) => [category.id, category.name]));
  return {
    source: 'category-fallback',
    items: (tool.categories || [tool.category]).map((id) => ({
      id,
      label: names.get(id) || id,
      source: 'category',
    })),
  };
}

export function deriveSceneTaskCell(tool, selectedScene, sceneIndex) {
  const explicit = sceneIndex.get(tool.id) || [];
  const mapped = explicit.some((scene) => scene.id === selectedScene.id);
  return {
    primary: { id: selectedScene.id, label: normalizeSceneLabel(selectedScene.name) },
    relation: mapped ? 'task-match' : 'category-related',
    additionalExplicitCount: explicit.filter((scene) => scene.id !== selectedScene.id).length,
  };
}

export function deriveCapabilities(tool) {
  const seen = new Set();
  const result = [];
  for (const value of tool.highlights || []) {
    const capability = String(value || '').trim();
    if (!capability || GENERIC_CAPABILITIES.has(capability) || seen.has(capability)) continue;
    seen.add(capability);
    result.push(capability);
  }
  return result;
}

export function deriveCapabilitySummary(tool) {
  const capabilities = deriveCapabilities(tool);
  return capabilities.length > 0 ? capabilities.slice(0, 2) : [String(tool.desc || '').trim()].filter(Boolean);
}

export function deriveToolOrigins(tool) {
  const tags = new Set(tool.toolTags || []);
  return [tags.has('国产') ? 'domestic' : null, tags.has('海外') ? 'overseas' : null].filter(Boolean);
}

export function deriveToolPlatforms(tool) {
  const result = [];
  for (const value of tool.platform || []) {
    if (PLATFORM_VALUES.has(value) && !result.includes(value)) result.push(value);
  }
  if ((tool.toolTags || []).includes('网页版') && !result.includes('web')) result.push('web');
  return result;
}

export function deriveAvailablePlatforms(tools) {
  const found = new Set(tools.flatMap(deriveToolPlatforms));
  return ['web', 'local', 'cli', 'desktop'].filter((value) => found.has(value));
}

export function deriveToolPrice(tool) {
  const plans = Array.isArray(tool.pricing) ? tool.pricing : [];
  const free = plans.some((plan) => plan.price === 0);
  const fullyFree = plans.length > 0 && plans.every((plan) => plan.price === 0);
  const paidOnly = plans.length > 0 && plans.every((plan) => plan.price > 0);
  const filters = [];
  if (free) filters.push('free-tier');
  if (fullyFree) filters.push('fully-free');
  if (paidOnly) filters.push('paid-only');
  const freePlan = plans.find((plan) => plan.price === 0);
  const highlighted = plans.find((plan) => plan.highlight);
  const summary = freePlan
    ? '免费'
    : highlighted
      ? `${highlighted.plan} ${highlighted.price > 0 ? `$${highlighted.price}` : ''}`.trim()
      : plans[0]?.plan || null;
  return { summary, valueTag: tool.valueTag || null, filters };
}

export function groupToolsForScene(tools, scene) {
  const explicitIds = new Set(scene.toolIds);
  const relatedCategories = new Set(RELATED_CATEGORY_IDS_BY_SCENE[scene.id] || []);
  return {
    taskMatches: tools.filter((tool) => explicitIds.has(tool.id)),
    relatedTools: tools.filter((tool) =>
      !explicitIds.has(tool.id) && (tool.categories || [tool.category]).some((id) => relatedCategories.has(id))
    ),
  };
}

export function createToolDecisionModel(tool, scenes, categories, selectedScene = null, existingIndex = null) {
  const sceneIndex = existingIndex || buildSceneToolIndex(scenes);
  const profile = deriveToolTasks(tool, sceneIndex, categories);
  return {
    tool,
    tasks: profile.items,
    taskCell: selectedScene ? deriveSceneTaskCell(tool, selectedScene, sceneIndex) : null,
    capabilities: deriveCapabilities(tool),
    capabilitySummary: deriveCapabilitySummary(tool),
    origin: deriveToolOrigins(tool)[0] || null,
    platforms: deriveToolPlatforms(tool),
    price: deriveToolPrice(tool),
  };
}

export function selectAlternativeTools(tool, tools, scenes, limit = 6) {
  const matchingScenes = scenes.filter((scene) => scene.toolIds.includes(tool.id));
  const explicitIds = new Set(matchingScenes.flatMap((scene) => scene.toolIds));
  const categories = new Set(tool.categories || [tool.category]);
  const explicit = tools.filter((candidate) => candidate.id !== tool.id && explicitIds.has(candidate.id));
  const related = tools.filter((candidate) =>
    candidate.id !== tool.id &&
    !explicitIds.has(candidate.id) &&
    (candidate.categories || [candidate.category]).some((id) => categories.has(id))
  );
  return [...explicit, ...related].slice(0, limit);
}
