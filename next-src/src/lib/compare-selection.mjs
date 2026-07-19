export const MAX_COMPARE_TOOLS = 4;

export function tryAddCompareTool(selectedTools, tool) {
  if (selectedTools.some((selected) => selected.id === tool.id)) {
    return { selectedTools, outcome: 'already-selected' };
  }
  if (selectedTools.length >= MAX_COMPARE_TOOLS) {
    return { selectedTools, outcome: 'limit-reached' };
  }
  return { selectedTools: [...selectedTools, tool], outcome: 'added' };
}

export function getCompareAvailability(selectedTools, toolId) {
  if (selectedTools.some((tool) => tool.id === toolId)) return 'selected';
  return selectedTools.length >= MAX_COMPARE_TOOLS ? 'limit-reached' : 'available';
}
