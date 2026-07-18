/**
 * Return unique tool suggestions in source order.
 *
 * @template {{ id: number, name: string, desc: string, toolTags?: string[] }} T
 * @param {T[]} tools
 * @param {string} query
 * @param {number} [limit]
 * @returns {T[]}
 */
export function getSearchSuggestions(tools, query, limit = 6) {
  const term = query.trim().toLocaleLowerCase('zh-CN');
  if (!term) return [];

  const seen = new Set();
  const suggestions = [];

  for (const tool of tools) {
    if (seen.has(tool.id)) continue;

    const matches =
      tool.name.toLocaleLowerCase('zh-CN').includes(term) ||
      tool.desc.toLocaleLowerCase('zh-CN').includes(term) ||
      tool.toolTags?.some((tag) => tag.toLocaleLowerCase('zh-CN').includes(term));

    if (!matches) continue;

    seen.add(tool.id);
    suggestions.push(tool);
    if (suggestions.length === limit) break;
  }

  return suggestions;
}
