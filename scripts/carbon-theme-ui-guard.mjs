import { existsSync } from 'node:fs';
import { readFile, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { DEFAULT_THEME, THEME_STORAGE_KEY } from '../next-src/src/lib/theme-bootstrap.mjs';
import { prepareQaDir } from './carbon-qa-path.mjs';

const baseUrl = process.env.CARBON_THEME_URL || 'http://127.0.0.1:3101';

const failures = [];
const fail = (message) => failures.push(message);
const intendedTools = ['Perplexity AI', '秘塔AI搜索'];

function normalizeHex(value) {
  const shorthand = value.match(/^#([0-9a-f]{3}|[0-9a-f]{4})$/i);
  return shorthand ? `#${[...shorthand[1]].map((digit) => digit.repeat(2)).join('')}` : value;
}

const themes = {
  light: {
    '--page': '#f3f6f8',
    '--surface': '#ffffff',
    '--ink': '#081218',
    '--accent': '#007e99',
    toolBackground: 'rgb(16, 22, 26)',
    focus: 'rgb(0, 126, 153)',
    hover: 'rgb(226, 235, 239)',
  },
  dark: {
    '--page': '#080b0e',
    '--surface': '#10161a',
    '--ink': '#e8f7fb',
    '--accent': '#46d9f2',
    toolBackground: 'rgb(12, 18, 22)',
    focus: 'rgb(70, 217, 242)',
    hover: 'rgb(26, 39, 45)',
  },
};

const allScenarios = [
  { name: 'home', path: '/', expectedPath: '/' },
  { name: 'directory', path: '/tools?scene=research&price=free-tier&platform=web', expectedPath: '/tools', selectTools: true },
  { name: 'detail', path: '/tools/71', expectedPath: '/tools/71' },
  { name: 'compare', path: '/tools?scene=research&price=free-tier&platform=web', expectedPath: '/compare', selectTools: true, openCompare: true },
  { name: 'scenes', path: '/scenes', expectedPath: '/scenes' },
  { name: 'scene-detail', path: '/scenes/research', expectedPath: '/scenes/research' },
  { name: 'leaderboard', path: '/leaderboard', expectedPath: '/leaderboard' },
  { name: 'user', path: '/user', expectedPath: '/user' },
  { name: 'auth', path: '/user', expectedPath: '/user', openAuth: true },
];

const coreScenarioNames = new Set(['home', 'directory', 'detail', 'compare']);
const viewports = [
  { width: 1440, height: 900, allRoutes: true },
  { width: 1280, height: 720 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 320, height: 844 },
];

const evidencePairs = [
  ['home-desktop.png', '1440x900-light-home.png', 'composite-home.png'],
  ['directory-desktop.png', '1440x900-light-directory.png', 'composite-directory.png'],
  ['detail-desktop.png', '1440x900-light-detail.png', 'composite-detail.png'],
  ['directory-mobile.png', '390x844-light-directory.png', 'composite-directory-mobile.png'],
];

function buildCapturePlan() {
  return viewports.flatMap((viewport) => {
    const scenarios = viewport.allRoutes
      ? allScenarios
      : allScenarios.filter((scenario) => coreScenarioNames.has(scenario.name));
    return Object.keys(themes).flatMap((theme) => scenarios.map((scenario) => ({ viewport, scenario, theme })));
  });
}

const capturePlan = buildCapturePlan();
if (capturePlan.length !== 50) throw new Error(`carbon capture plan is ${capturePlan.length}, expected 50`);
const screenshotName = ({ viewport, scenario, theme }) => `${viewport.width}x${viewport.height}-${theme}-${scenario.name}.png`;
const expectedScreenshotNames = capturePlan.map(screenshotName).sort();
const knownGeneratedNames = [
  ...expectedScreenshotNames,
  ...evidencePairs.map((pair) => pair[2]),
];

async function cleanupGeneratedEvidence(qaDir) {
  for (const name of knownGeneratedNames) {
    await rm(path.join(qaDir, name), { force: true });
  }
}

async function requireCount(locator, expected, label) {
  const count = await locator.count();
  if (count !== expected) throw new Error(`${label}: found ${count}, expected ${expected}`);
}

async function selectedToolNames(page) {
  return page.locator('[data-tool-decision-row][data-selected="true"] [data-field="tool"] strong').allTextContents();
}

async function selectedTrayNames(page) {
  return page.locator('[data-compare-selected-tools] > span > span').allTextContents();
}

async function assertIntendedSelections(page, label) {
  const names = await selectedToolNames(page);
  if (JSON.stringify(names) !== JSON.stringify(intendedTools)) {
    throw new Error(`${label}: selected tools are ${JSON.stringify(names)}, expected ${JSON.stringify(intendedTools)}`);
  }
}

async function openScenario(page, scenario) {
  const response = await page.goto(`${baseUrl}${scenario.path}`, { waitUntil: 'networkidle' });
  if (!response || !response.ok()) throw new Error(`navigation failed for ${scenario.path}: ${response?.status() || 'no response'}`);

  if (scenario.selectTools) {
    await page.locator('[data-tool-decision-row]').first().waitFor();
    for (const name of intendedTools) {
      const checkbox = page.getByRole('checkbox', { name: `加入对比 ${name}`, exact: true });
      await requireCount(checkbox, 1, `selection control for ${name}`);
      await checkbox.check();
    }
    await assertIntendedSelections(page, 'scenario setup');
  }
  if (scenario.openCompare) {
    const compare = page.getByRole('button', { name: '比较 2 款', exact: true });
    await requireCount(compare, 1, 'compare action');
    await compare.click();
    await page.waitForURL((url) => url.pathname === '/compare');
  }
  if (scenario.openAuth) {
    const login = page.getByRole('button', { name: '登录', exact: true }).first();
    await login.click();
    const dialog = page.getByRole('dialog', { name: '登录' });
    await requireCount(dialog, 1, 'login dialog');
    await dialog.waitFor();
    await requireCount(dialog.getByText('云同步服务当前不可用，仍可继续使用本地收藏和评分。', { exact: true }), 1, 'auth risk state');
  }
}

async function assertAuthoritativeRatingFlow(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const consoleIssues = [];
  let getRequests = 0;
  let postRequests = 0;
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) consoleIssues.push(message.text());
  });
  page.on('pageerror', (error) => consoleIssues.push(error.message));
  await page.route('**/api/ratings?*', async (route) => {
    getRequests += 1;
    if (getRequests === 1) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ avg_rating: 0, rating_count: 0, reviews: [] }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'refresh unavailable' }),
    });
  });
  await page.route('**/api/ratings', async (route) => {
    postRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, avg_rating: 4.25, rating_count: 8 }),
    });
  });

  try {
    const response = await page.goto(`${baseUrl}/tools/71`, { waitUntil: 'networkidle' });
    if (!response || !response.ok()) throw new Error(`rating flow navigation failed: ${response?.status() || 'no response'}`);
    const disclosure = page.locator('summary').filter({ hasText: '提交评价' });
    await requireCount(disclosure, 1, 'verified-empty rating disclosure');
    await disclosure.click();
    await page.getByRole('button', { name: '5 星', exact: true }).click();
    await page.getByRole('button', { name: '提交评价', exact: true }).click();
    await page.getByText('感谢评价', { exact: true }).waitFor();
    await page.getByText('4.3', { exact: true }).waitFor();
    await page.getByText('8 条评价', { exact: true }).waitFor();
    await page.waitForTimeout(50);
    if (getRequests !== 2 || postRequests !== 1) {
      throw new Error(`rating flow requests GET=${getRequests} POST=${postRequests}, expected GET=2 POST=1`);
    }
    if (consoleIssues.length) throw new Error(`rating flow console issues: ${consoleIssues.slice(0, 5).join(' | ')}`);
  } finally {
    await context.close();
  }
}

async function assertInitialTheme(browser) {
  const cases = [
    { name: 'new visitor', stored: null, expected: DEFAULT_THEME },
    { name: 'persisted light', stored: 'light', expected: 'light' },
    { name: 'persisted dark', stored: 'dark', expected: 'dark' },
  ];
  for (const entry of cases) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    if (entry.stored) {
      await context.addInitScript(({ key, theme }) => {
        try {
          localStorage.setItem(key, JSON.stringify({ state: { theme }, version: 0 }));
        } catch {
          // The script runs again after the target origin is created.
        }
      }, { key: THEME_STORAGE_KEY, theme: entry.stored });
    }
    const page = await context.newPage();
    try {
      const response = await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
      if (!response || !response.ok()) throw new Error(`${entry.name}: navigation failed`);
      const actual = await page.evaluate(() => ({
        colorScheme: document.documentElement.style.colorScheme,
        dark: document.documentElement.classList.contains('dark'),
      }));
      const expectedDark = entry.expected === 'dark';
      if (actual.dark !== expectedDark || actual.colorScheme !== entry.expected) {
        throw new Error(`${entry.name}: initial theme is ${JSON.stringify(actual)}, expected ${entry.expected}`);
      }
    } finally {
      await context.close();
    }
  }
}

async function assertScenarioIdentity(page, scenario, label) {
  const url = new URL(page.url());
  if (url.pathname !== scenario.expectedPath) {
    throw new Error(`${label}: pathname is ${url.pathname}, expected ${scenario.expectedPath}`);
  }
  const bodyText = await page.locator('body').innerText();
  for (const forbidden of ['This page could not be found', 'Application error', 'Internal Server Error', '出了点问题', '页面加载失败', '工具未找到']) {
    if (bodyText.includes(forbidden)) throw new Error(`${label}: rendered failure state ${forbidden}`);
  }
  if (await page.locator('nextjs-portal').count()) throw new Error(`${label}: nextjs-portal framework overlay is present`);

  if (scenario.name === 'home') {
    await requireCount(page.getByRole('heading', { level: 1, name: '按任务找到合适的 AI 工具' }), 1, `${label} home heading`);
    await requireCount(page.getByRole('heading', { level: 2, name: '你要完成什么？' }), 1, `${label} task heading`);
    await requireCount(page.getByRole('heading', { level: 2, name: '本周值得试' }), 1, `${label} weekly heading`);
  } else if (scenario.name === 'directory') {
    if (url.searchParams.toString() !== 'scene=research&price=free-tier&platform=web') {
      throw new Error(`${label}: searchParams are ${url.searchParams.toString()}`);
    }
    await requireCount(page.getByRole('heading', { level: 1, name: '工具目录' }), 1, `${label} directory heading`);
    const task = page.getByRole('combobox', { name: '选择任务' });
    if (await task.inputValue() !== 'research') throw new Error(`${label}: research task is not active`);
    const activeFilters = await page.locator('input').evaluateAll((inputs) => ({
      price: inputs.filter((input) => input.closest('label')?.textContent?.trim() === '有免费额度').map((input) => input.checked),
      web: inputs.filter((input) => input.closest('label')?.textContent?.trim() === '网页版').map((input) => input.checked),
    }));
    if (!activeFilters.price.length || activeFilters.price.some((checked) => !checked)) throw new Error(`${label}: free-tier filter is not active`);
    if (!activeFilters.web.length || activeFilters.web.some((checked) => !checked)) throw new Error(`${label}: web filter is not active`);
    await assertIntendedSelections(page, label);
    const trayNames = await selectedTrayNames(page);
    if (JSON.stringify(trayNames) !== JSON.stringify(intendedTools)) {
      throw new Error(`${label}: compare tray names are ${JSON.stringify(trayNames)}, expected ${JSON.stringify(intendedTools)}`);
    }
  } else if (scenario.name === 'detail') {
    await requireCount(page.getByRole('heading', { level: 1, name: 'Perplexity AI' }), 1, `${label} detail identity`);
    await requireCount(page.getByRole('heading', { level: 2, name: '决策摘要' }), 1, `${label} detail summary`);
  } else if (scenario.name === 'compare') {
    await requireCount(page.getByRole('heading', { level: 1, name: /工具对比/ }), 1, `${label} compare heading`);
    const headers = await page.locator('[data-carbon-surface] h2').allTextContents();
    if (JSON.stringify(headers) !== JSON.stringify(intendedTools)) {
      throw new Error(`${label}: compare headers are ${JSON.stringify(headers)}, expected ${JSON.stringify(intendedTools)}`);
    }
  } else if (scenario.name === 'scenes') {
    await requireCount(page.getByRole('heading', { level: 1, name: '按任务浏览' }), 1, `${label} scenes heading`);
  } else if (scenario.name === 'scene-detail') {
    await requireCount(page.getByRole('heading', { level: 1, name: '搜索调研' }), 1, `${label} scene detail heading`);
    await requireCount(page.getByRole('link', { name: '返回场景列表' }), 1, `${label} scene return action`);
  } else if (scenario.name === 'leaderboard') {
    await requireCount(page.getByRole('heading', { level: 1, name: '排行榜' }), 1, `${label} leaderboard heading`);
    await requireCount(page.getByRole('tablist', { name: '排行榜类型' }), 1, `${label} leaderboard tabs`);
  } else if (scenario.name === 'user' || scenario.name === 'auth') {
    await requireCount(page.getByRole('heading', { level: 1, name: '我的工具箱' }), 1, `${label} user heading`);
    if (scenario.name === 'auth') {
      const dialog = page.getByRole('dialog', { name: '登录' });
      await requireCount(dialog, 1, `${label} auth dialog`);
      await requireCount(dialog.getByText('云同步服务当前不可用，仍可继续使用本地收藏和评分。', { exact: true }), 1, `${label} auth risk state`);
      await requireCount(dialog.getByRole('textbox', { name: '邮箱' }), 1, `${label} auth email`);
      await requireCount(dialog.getByLabel('密码'), 1, `${label} auth password`);
    } else if (await page.getByRole('dialog').count()) {
      throw new Error(`${label}: unexpected dialog on user state`);
    }
  }
}

async function setTheme(page, theme) {
  const dark = await page.locator('html.dark').count() > 0;
  if (theme === 'dark' && !dark) await page.getByRole('button', { name: '切换到暗色主题' }).click();
  if (theme === 'light' && dark) await page.getByRole('button', { name: '切换到亮色主题' }).click();
  await page.waitForFunction((expected) => document.documentElement.classList.contains('dark') === expected, theme === 'dark');
  await page.waitForTimeout(180);
}

async function assertHomeHover(page, scenario, theme, label) {
  if (scenario.name !== 'home') return;
  const task = page.getByRole('link', { name: /做调研/ });
  await requireCount(task, 1, `${label} research task`);
  await task.hover();
  await page.waitForTimeout(180);
  const hover = await task.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      backgroundColor: style.backgroundColor,
      borderLeftColor: style.borderLeftColor,
      borderLeftWidth: style.borderLeftWidth,
      borderLeftStyle: style.borderLeftStyle,
    };
  });
  if (hover.backgroundColor !== themes[theme].hover
    || hover.borderLeftColor !== themes[theme].focus
    || hover.borderLeftWidth !== '3px'
    || hover.borderLeftStyle === 'none') {
    fail(`${label}: research hover geometry/colors are ${JSON.stringify(hover)}`);
  }
}

async function assertInstrumentConsole(page, scenario, theme, label) {
  if (scenario.name !== 'home') return;
  await requireCount(page.locator('[data-instrument-section]'), 3, `${label} instrument sections`);
  await requireCount(page.locator('[data-task-entry]'), 8, `${label} task entries`);
  await requireCount(page.locator('[data-decision-list] [data-tool-decision-row]'), 6, `${label} weekly rows`);
  if (await page.getByRole('checkbox', { name: /对比/ }).count()) {
    fail(`${label}: homepage exposes compare checkboxes`);
  }

  const taskGrid = page.locator('[data-task-entry-list]');
  const columnCount = await taskGrid.evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length);
  const width = await page.evaluate(() => innerWidth);
  const expectedColumns = width >= 1024 ? 4 : width >= 640 ? 2 : 1;
  if (columnCount !== expectedColumns) fail(`${label}: task columns ${columnCount}, expected ${expectedColumns}`);

  const tasksSection = page.locator('[data-instrument-section="tasks"]');
  const marker = await tasksSection.evaluate((element) => {
    const style = getComputedStyle(element, '::before');
    return { background: style.backgroundColor, height: style.height, width: style.width };
  });
  if (width >= 768) {
    if (marker.width !== '20px' || marker.height !== '1px') fail(`${label}: marker geometry ${JSON.stringify(marker)}`);
  } else if (marker.width === '20px') {
    fail(`${label}: desktop marker is visible on mobile`);
  }

  const search = page.getByRole('combobox', { name: '搜索工具、任务或能力' });
  await search.focus();
  await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-search-shell]')).outlineWidth === '2px');
  const searchOutline = await page.locator('[data-search-shell]').evaluate((element) => {
    const style = getComputedStyle(element);
    return { color: style.outlineColor, offset: style.outlineOffset, width: style.outlineWidth };
  });
  if (searchOutline.color !== themes[theme].focus || searchOutline.offset !== '2px' || searchOutline.width !== '2px') {
    fail(`${label}: search outline ${JSON.stringify(searchOutline)}`);
  }

  const firstRowRadius = await page.locator('[data-decision-list] [data-tool-decision-row]').first()
    .evaluate((element) => getComputedStyle(element).borderRadius);
  if (firstRowRadius !== '0px') fail(`${label}: compact row radius is ${firstRowRadius}`);
}

async function assertTokens(page, theme, label) {
  const expected = themes[theme];
  const actual = await page.evaluate((names) => {
    const style = getComputedStyle(document.documentElement);
    return Object.fromEntries(names.map((name) => [name, style.getPropertyValue(name).trim().toLowerCase()]));
  }, Object.keys(expected).filter((name) => name.startsWith('--')));
  for (const [name, value] of Object.entries(actual)) {
    if (normalizeHex(value) !== normalizeHex(expected[name])) fail(`${label}: ${name} is ${value}, expected ${expected[name]}`);
  }
}

async function assertNoOverflow(page, label) {
  const geometry = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  if (geometry.scrollWidth > geometry.clientWidth + 1) {
    fail(`${label}: horizontal overflow ${geometry.scrollWidth} > ${geometry.clientWidth}`);
  }
}

async function assertCarbonSurfaces(page, scenario, theme, label) {
  const surfaces = page.locator('[data-carbon-surface]');
  const expectedCount = { directory: 1, detail: 1, compare: 2 }[scenario.name] || 0;
  const count = await surfaces.count();
  if (count !== expectedCount) fail(`${label}: carbon surface count is ${count}, expected ${expectedCount}`);
  if (scenario.name === 'directory' && (await page.locator('[data-compare-tray][data-carbon-surface]').count()) !== 1) {
    fail(`${label}: directory carbon surface is not the unique compare tray`);
  }
  if (scenario.name === 'detail') {
    const summaries = surfaces.filter({ has: page.getByRole('heading', { level: 2, name: '决策摘要' }) });
    if ((await summaries.count()) !== 1) fail(`${label}: detail carbon summary is not unique`);
  }
  if (scenario.name === 'compare') {
    const headers = await surfaces.locator('h2').allTextContents();
    if (JSON.stringify(headers) !== JSON.stringify(intendedTools)) fail(`${label}: carbon headers are ${JSON.stringify(headers)}`);
  }
  for (let index = 0; index < count; index += 1) {
    const style = await surfaces.nth(index).evaluate((element) => {
      const computed = getComputedStyle(element);
      return { background: computed.backgroundColor, color: computed.color, border: computed.borderTopColor };
    });
    if (style.background !== themes[theme].toolBackground) fail(`${label}: carbon ${index} background is ${style.background}`);
    if (style.color !== 'rgb(232, 247, 251)') fail(`${label}: carbon ${index} text is ${style.color}`);
    if (style.border !== 'rgb(88, 112, 123)') fail(`${label}: carbon ${index} keyline is ${style.border}`);
  }
}

async function measureRail(row) {
  return row.evaluate((element) => {
    const rowStyle = getComputedStyle(element);
    const style = getComputedStyle(element, '::before');
    const rect = element.getBoundingClientRect();
    return {
      row: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      rowPosition: rowStyle.position,
      rail: {
        position: style.position,
        left: style.left,
        top: style.top,
        bottom: style.bottom,
        width: style.width,
        background: style.backgroundColor,
      },
    };
  });
}

function assertStableRect(before, after, label) {
  for (const key of ['left', 'top', 'width', 'height']) {
    if (Math.abs(before[key] - after[key]) > 1) fail(`${label}: ${key} changed ${before[key]} -> ${after[key]}`);
  }
}

async function assertSelectedRails(page, scenario, theme, label) {
  if (scenario.name !== 'directory') return;
  const selectedRows = page.locator('[data-tool-decision-row][data-selected="true"]');
  if ((await selectedRows.count()) !== 2) throw new Error(`${label}: selected row count is not exactly two`);
  for (let index = 0; index < 2; index += 1) {
    const measurement = await measureRail(selectedRows.nth(index));
    if (measurement.rowPosition !== 'relative'
      || measurement.rail.position !== 'absolute'
      || measurement.rail.left !== '0px'
      || measurement.rail.top !== '0px'
      || measurement.rail.bottom !== '0px'
      || measurement.rail.width !== '3px'
      || measurement.rail.background !== themes[theme].focus) {
      fail(`${label}: selected rail ${index} geometry is ${JSON.stringify(measurement)}`);
    }
  }

  const row = page.locator('[data-tool-decision-row]').filter({ hasText: intendedTools[0] }).first();
  const checkbox = row.locator('input[type="checkbox"]');
  const beforeToggle = await measureRail(row);
  await checkbox.uncheck();
  await page.waitForTimeout(180);
  const afterToggle = await measureRail(row);
  if ((await page.locator('[data-tool-decision-row][data-selected="true"]').count()) !== 1) fail(`${label}: selection toggle did not remove exactly one row`);
  await checkbox.check();
  await page.waitForTimeout(180);
  const afterRestore = await measureRail(row);

  const secondRow = page.locator('[data-tool-decision-row]').filter({ hasText: intendedTools[1] }).first();
  const secondCheckbox = secondRow.locator('input[type="checkbox"]');
  await secondCheckbox.uncheck();
  await page.waitForTimeout(180);
  await secondCheckbox.check();
  await page.waitForTimeout(180);
  await assertIntendedSelections(page, `${label} selection restore`);
  const trayNames = await selectedTrayNames(page);
  if (JSON.stringify(trayNames) !== JSON.stringify(intendedTools)) fail(`${label}: selection toggle order restored as ${JSON.stringify(trayNames)}`);
  assertStableRect(beforeToggle.row, afterToggle.row, `${label} row during toggle`);
  assertStableRect(beforeToggle.row, afterRestore.row, `${label} row after toggle restore`);
  if (afterToggle.rail.width !== '3px' || afterToggle.rail.left !== '0px') fail(`${label}: rail inset changed during toggle`);
  if (afterRestore.rail.background !== themes[theme].focus) fail(`${label}: rail color did not restore after toggle`);
}

async function focusByKeyboard(page, target, label) {
  await requireCount(target, 1, `${label} focus target`);
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  for (let index = 0; index < 200; index += 1) {
    await page.keyboard.press('Tab');
    if (await target.evaluate((element) => document.activeElement === element)) {
      await page.waitForTimeout(180);
      return;
    }
  }
  throw new Error(`${label}: keyboard could not reach focus target`);
}

async function assertOutline(target, expectedColor, label) {
  const outline = await target.evaluate((element) => {
    const style = getComputedStyle(element);
    return { outlineColor: style.outlineColor, outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
  });
  if (outline.outlineStyle === 'none'
    || Number.parseFloat(outline.outlineWidth) < 2
    || outline.outlineColor !== expectedColor) {
    fail(`${label}: outline is ${JSON.stringify(outline)}, expected >=2px solid ${expectedColor}`);
  }
}

async function assertFocusColors(page, scenario, theme, label) {
  const normalTarget = page.getByRole('button', { name: theme === 'dark' ? '切换到亮色主题' : '切换到暗色主题' });
  await focusByKeyboard(page, normalTarget, `${label} normal`);
  await assertOutline(normalTarget, themes[theme].focus, `${label} normal focus`);

  let carbonTarget = null;
  if (scenario.name === 'directory') carbonTarget = page.locator('[data-compare-tray]').getByRole('button', { name: '比较 2 款' });
  if (scenario.name === 'detail') carbonTarget = page.locator('[data-carbon-surface]').getByRole('link', { name: '访问官网' });
  if (scenario.name === 'compare') carbonTarget = page.locator('[data-carbon-surface]').first().getByRole('button', { name: '移除 Perplexity AI' });
  if (carbonTarget) {
    await focusByKeyboard(page, carbonTarget, `${label} carbon`);
    await assertOutline(carbonTarget, 'rgb(70, 217, 242)', `${label} carbon focus`);
  }
}

async function assertTargetSize(locator, label, closestLabel = false) {
  await requireCount(locator, 1, label);
  const geometry = await locator.evaluate((element, useLabel) => {
    const target = useLabel ? element.closest('label') : element;
    const rect = target?.getBoundingClientRect();
    return rect ? { width: rect.width, height: rect.height } : null;
  }, closestLabel);
  if (!geometry || geometry.width < 44 || geometry.height < 44) {
    fail(`${label}: target is ${geometry ? `${geometry.width.toFixed(1)}x${geometry.height.toFixed(1)}` : 'missing'}, expected at least 44x44`);
  }
}

async function assertContainerGeometry(locator, label, allowOverlap = false) {
  await requireCount(locator, 1, label);
  const result = await locator.evaluate((element, skipOverlap) => {
    const parent = element.getBoundingClientRect();
    const children = Array.from(element.children)
      .filter((child) => {
        const style = getComputedStyle(child);
        return style.display !== 'none' && style.visibility !== 'hidden' && child.getBoundingClientRect().width > 0;
      })
      .map((child, index) => {
        const rect = child.getBoundingClientRect();
        return { index, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
      });
    const clipped = children.filter((child) => child.left < parent.left - 1
      || child.right > parent.right + 1
      || child.top < parent.top - 1
      || child.bottom > parent.bottom + 1);
    const overlap = [];
    if (!skipOverlap) {
      for (let left = 0; left < children.length; left += 1) {
        for (let right = left + 1; right < children.length; right += 1) {
          const a = children[left];
          const b = children[right];
          if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1
            && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1) overlap.push([a.index, b.index]);
        }
      }
    }
    return { clipped, overlap, scrollWidth: element.scrollWidth, clientWidth: element.clientWidth };
  }, allowOverlap);
  if (result.clipped.length || result.overlap.length || result.scrollWidth > result.clientWidth + 1) {
    fail(`${label}: internal clipping/overlap ${JSON.stringify(result)}`);
  }
}

async function assertFourToolCompareTrayGeometry(page, label) {
  await assertIntendedSelections(page, `${label} initial four-tool check`);
  const initialTrayNames = await selectedTrayNames(page);
  if (JSON.stringify(initialTrayNames) !== JSON.stringify(intendedTools)) {
    throw new Error(`${label}: initial tray order is ${JSON.stringify(initialTrayNames)}`);
  }

  const addedNames = [];
  for (let index = 0; index < 2; index += 1) {
    const checkbox = page.getByRole('checkbox', { name: /^加入对比 / }).first();
    await requireCount(checkbox, 1, `${label} additional selection ${index + 1}`);
    const accessibleName = await checkbox.getAttribute('aria-label');
    const name = accessibleName?.replace(/^加入对比 /, '');
    if (!name) throw new Error(`${label}: additional selection ${index + 1} has no tool name`);
    addedNames.push(name);
    await checkbox.check();
  }

  const expectedOrder = [...intendedTools, ...addedNames];
  const selectedNames = await selectedTrayNames(page);
  if (JSON.stringify(selectedNames) !== JSON.stringify(expectedOrder)) {
    throw new Error(`${label}: four-tool tray order is ${JSON.stringify(selectedNames)}, expected ${JSON.stringify(expectedOrder)}`);
  }
  const rail = page.locator('[data-compare-selected-tools]');
  const geometry = await rail.evaluate((element) => {
    const children = Array.from(element.children).map((child, index) => ({
      index,
      left: child.offsetLeft,
      right: child.offsetLeft + child.offsetWidth,
      top: child.offsetTop,
      bottom: child.offsetTop + child.offsetHeight,
    }));
    const overlap = [];
    for (let left = 0; left < children.length; left += 1) {
      for (let right = left + 1; right < children.length; right += 1) {
        const a = children[left];
        const b = children[right];
        if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1
          && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1) overlap.push([a.index, b.index]);
      }
    }
    const railRect = element.getBoundingClientRect();
    const tray = element.closest('[data-compare-tray]');
    const compare = Array.from(tray?.querySelectorAll('button') || [])
      .find((button) => button.textContent?.trim() === '比较 4 款');
    const compareRect = compare?.getBoundingClientRect();
    const actionOverlap = compareRect
      ? Math.min(railRect.right, compareRect.right) - Math.max(railRect.left, compareRect.left) > 1
        && Math.min(railRect.bottom, compareRect.bottom) - Math.max(railRect.top, compareRect.top) > 1
      : true;
    return {
      actionOverlap,
      clientWidth: element.clientWidth,
      overlap,
      overflowX: getComputedStyle(element).overflowX,
      scrollWidth: element.scrollWidth,
    };
  });
  if (geometry.scrollWidth <= geometry.clientWidth + 1 || geometry.overflowX !== 'auto') {
    throw new Error(`${label}: four-tool rail is not horizontally scrollable ${JSON.stringify(geometry)}`);
  }
  if (geometry.overlap.length || geometry.actionOverlap) {
    throw new Error(`${label}: four-tool rail overlap ${JSON.stringify(geometry)}`);
  }

  const removeTargets = rail.getByRole('button', { name: /^移除 / });
  if (await removeTargets.count() !== 4) throw new Error(`${label}: four-tool rail does not expose four remove targets`);
  for (let index = 0; index < 4; index += 1) {
    const target = removeTargets.nth(index);
    await assertTargetSize(target, `${label} remove target ${index + 1}`);
    await target.scrollIntoViewIfNeeded();
    const reachable = await target.evaluate((button) => {
      const viewport = button.closest('[data-compare-selected-tools]')?.getBoundingClientRect();
      const rect = button.getBoundingClientRect();
      return Boolean(viewport)
        && rect.left >= viewport.left - 1
        && rect.right <= viewport.right + 1
        && rect.top >= viewport.top - 1
        && rect.bottom <= viewport.bottom + 1;
    });
    if (!reachable) throw new Error(`${label}: remove target ${index + 1} is clipped after scrolling`);
  }

  for (const name of [...addedNames].reverse()) {
    await page.getByRole('button', { name: `移除 ${name}`, exact: true }).click();
  }
  await rail.evaluate((element) => { element.scrollLeft = 0; });
  await assertIntendedSelections(page, `${label} restored four-tool check`);
  const restoredTrayNames = await selectedTrayNames(page);
  if (JSON.stringify(restoredTrayNames) !== JSON.stringify(intendedTools)) {
    throw new Error(`${label}: restored tray order is ${JSON.stringify(restoredTrayNames)}, expected ${JSON.stringify(intendedTools)}`);
  }
}

async function assertFixedSurfaceGeometry(page, scenario, label) {
  const fixed = await page.evaluate(() => {
    const rectOf = (selector) => {
      const element = document.querySelector(selector);
      if (!element || getComputedStyle(element).display === 'none') return null;
      const rect = element.getBoundingClientRect();
      return rect.height ? { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, height: rect.height } : null;
    };
    const root = getComputedStyle(document.documentElement);
    const spacer = document.querySelector('[data-compare-tray]')?.previousElementSibling?.getBoundingClientRect();
    return {
      nav: rectOf('[data-mobile-bottom-nav]'),
      tray: rectOf('[data-compare-tray]'),
      viewportHeight: innerHeight,
      spacerHeight: spacer?.height || 0,
      requiredClearance: Number.parseFloat(root.getPropertyValue('--mobile-nav-block-size'))
        + Number.parseFloat(root.getPropertyValue('--compare-tray-block-size')),
    };
  });
  if (fixed.nav && Math.abs(fixed.nav.bottom - fixed.viewportHeight) > 1) fail(`${label}: mobile nav bottom is ${fixed.nav.bottom}, viewport is ${fixed.viewportHeight}`);
  if (fixed.tray) {
    const expectedBottom = fixed.nav ? fixed.nav.top : fixed.viewportHeight;
    if (Math.abs(fixed.tray.bottom - expectedBottom) > 1) fail(`${label}: compare tray bottom ${fixed.tray.bottom} does not meet ${expectedBottom}`);
    const overlap = fixed.nav && Math.min(fixed.tray.bottom, fixed.nav.bottom) - Math.max(fixed.tray.top, fixed.nav.top);
    if (overlap && overlap > 1) fail(`${label}: compare tray/mobile nav overlap by ${overlap}px`);
    if (fixed.spacerHeight + 1 < fixed.requiredClearance) fail(`${label}: fixed clearance ${fixed.spacerHeight} < ${fixed.requiredClearance}`);
  }

  if (scenario.name === 'directory') {
    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = 'auto';
      window.scrollTo(0, document.documentElement.scrollHeight);
    });
    await page.waitForFunction(() => Math.abs(scrollY - Math.max(0, document.documentElement.scrollHeight - innerHeight)) <= 1);
    const obstruction = await page.evaluate(() => {
      const row = Array.from(document.querySelectorAll('[data-tool-decision-row]')).at(-1)?.getBoundingClientRect();
      const tray = document.querySelector('[data-compare-tray]')?.getBoundingClientRect();
      return row && tray ? { rowBottom: row.bottom, trayTop: tray.top } : null;
    });
    if (!obstruction) fail(`${label}: missing row/tray obstruction geometry`);
    else if (obstruction.rowBottom > obstruction.trayTop + 1) fail(`${label}: tray obscures last row ${JSON.stringify(obstruction)}`);
    await page.evaluate(() => document.documentElement.style.removeProperty('scroll-behavior'));
  }
}

async function assertResponsiveGeometry(page, scenario, theme, label) {
  const themeTarget = page.getByRole('button', { name: theme === 'dark' ? '切换到亮色主题' : '切换到暗色主题' });
  await assertTargetSize(themeTarget, `${label} theme target`);

  if (scenario.name === 'home') {
    await assertTargetSize(page.getByRole('button', { name: '提交搜索', exact: true }), `${label} search target`);
    await assertTargetSize(page.getByRole('link', { name: /做调研/ }), `${label} research target`);
  } else if (scenario.name === 'directory') {
    await assertTargetSize(page.getByRole('combobox', { name: '选择任务' }), `${label} task select`);
    await assertTargetSize(page.getByRole('combobox', { name: '工具排序' }), `${label} sort select`);
    await assertTargetSize(page.getByRole('checkbox', { name: '取消对比 Perplexity AI' }), `${label} selection target`, true);
    await assertTargetSize(page.getByRole('link', { name: '查看 Perplexity AI 详情' }), `${label} detail target`);
    await assertTargetSize(page.locator('[data-compare-tray]').getByRole('button', { name: '比较 2 款' }), `${label} compare target`);
    const filter = page.getByRole('button', { name: /^筛选/ });
    if (await filter.isVisible()) await assertTargetSize(filter, `${label} mobile filter target`);
    await assertContainerGeometry(page.locator('[data-directory-controls]'), `${label} directory controls`);
    await assertContainerGeometry(page.locator('[data-tool-decision-row]').first(), `${label} first decision row`);
    if (await page.evaluate(() => innerWidth === 320)) await assertFourToolCompareTrayGeometry(page, label);
  } else if (scenario.name === 'detail') {
    await assertTargetSize(page.getByRole('link', { name: '访问官网' }).first(), `${label} official target`);
    await assertTargetSize(page.getByRole('button', { name: '加入比较' }).first(), `${label} detail compare target`);
    await assertContainerGeometry(page.locator('[data-carbon-surface]'), `${label} detail summary geometry`);
  } else if (scenario.name === 'compare') {
    await assertTargetSize(page.getByRole('button', { name: '移除 Perplexity AI' }), `${label} compare remove target`);
    await assertTargetSize(page.getByRole('button', { name: '添加工具' }), `${label} add target`);
    await assertContainerGeometry(page.locator('[data-carbon-surface]').first(), `${label} compare header geometry`);
  } else if (scenario.name === 'scenes') {
    await assertTargetSize(page.getByRole('link').filter({ hasText: '制作 PPT' }).first(), `${label} scene target`);
  } else if (scenario.name === 'scene-detail') {
    await assertTargetSize(page.getByRole('link', { name: '返回场景列表' }), `${label} scene return target`);
  } else if (scenario.name === 'leaderboard') {
    await assertTargetSize(page.getByRole('tab', { name: '热度排行' }), `${label} leaderboard tab`);
  } else if (scenario.name === 'user') {
    await assertTargetSize(page.getByRole('button', { name: '登录', exact: true }), `${label} user login target`);
  } else if (scenario.name === 'auth') {
    const dialog = page.getByRole('dialog', { name: '登录' });
    await assertTargetSize(dialog.getByRole('button', { name: '关闭登录窗口' }), `${label} auth close target`);
    await assertTargetSize(dialog.getByRole('textbox', { name: '邮箱' }), `${label} auth email target`);
    await assertTargetSize(dialog.getByLabel('密码'), `${label} auth password target`);
    await assertTargetSize(dialog.getByRole('button', { name: '登录', exact: true }), `${label} auth submit target`);
    await assertContainerGeometry(dialog, `${label} auth dialog geometry`, true);
  }

  const bottomNav = page.getByRole('navigation', { name: '移动端导航' });
  if (await bottomNav.isVisible()) await assertTargetSize(bottomNav.getByRole('link', { name: '工具' }), `${label} bottom nav target`);
  await assertFixedSurfaceGeometry(page, scenario, label);
}

function layoutSelectorsFor(scenario) {
  const shared = ['nav[aria-label="主导航"]', 'main', 'main h1'];
  const specific = {
    home: ['main section', 'a[href="/tools?scene=research"]', '[data-tool-decision-row]'],
    directory: ['[data-directory-controls]', '[data-tool-decision-row]', '[data-compare-tray]'],
    detail: ['[data-carbon-surface]', '[data-tool-decision-row]'],
    compare: ['[data-carbon-surface]', 'main section'],
    scenes: ['main section', 'main section a'],
    'scene-detail': ['main header', 'main section'],
    leaderboard: ['[role="tablist"]', 'main > div'],
    user: ['[role="tablist"]', 'main section'],
    auth: ['[role="dialog"]', '[role="dialog"] form'],
  }[scenario.name];
  return [...shared, ...specific];
}

async function measureLayout(page, scenario) {
  return page.evaluate((selectors) => {
    const values = {
      document: {
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
      },
    };
    for (const selector of selectors) {
      Array.from(document.querySelectorAll(selector)).forEach((element, index) => {
        const rect = element.getBoundingClientRect();
        values[`${selector}:${index}`] = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
      });
    }
    Array.from(document.querySelectorAll('[data-tool-decision-row][data-selected="true"]')).forEach((element, index) => {
      const style = getComputedStyle(element, '::before');
      values[`selected-rail:${index}`] = {
        left: Number.parseFloat(style.left),
        top: Number.parseFloat(style.top),
        width: Number.parseFloat(style.width),
        bottom: Number.parseFloat(style.bottom),
      };
    });
    return values;
  }, layoutSelectorsFor(scenario));
}

function compareLayouts(before, after, label) {
  if (JSON.stringify(Object.keys(before)) !== JSON.stringify(Object.keys(after))) {
    fail(`${label}: layout keys changed ${JSON.stringify(Object.keys(before))} -> ${JSON.stringify(Object.keys(after))}`);
    return;
  }
  for (const [component, beforeRect] of Object.entries(before)) {
    const afterRect = after[component];
    for (const [key, value] of Object.entries(beforeRect)) {
      if (Math.abs(value - afterRect[key]) > 1) fail(`${label}: ${component}.${key} shifts ${value} -> ${afterRect[key]}`);
    }
  }
}

async function assertThemeLayoutInvariant(page, scenario, label) {
  await prepareScreenshot(page);
  await assertHomeHover(page, scenario, 'light', `${label} light layout`);
  const before = await measureLayout(page, scenario);
  await page.getByRole('button', { name: '切换到暗色主题' }).click();
  await page.waitForFunction(() => document.documentElement.classList.contains('dark'));
  await page.waitForTimeout(180);
  await assertHomeHover(page, scenario, 'dark', `${label} dark layout`);
  const dark = await measureLayout(page, scenario);
  compareLayouts(before, dark, `${label} light/dark layout`);

  await page.getByRole('button', { name: '切换到亮色主题' }).click();
  await page.waitForFunction(() => !document.documentElement.classList.contains('dark'));
  await page.waitForTimeout(180);
  await assertHomeHover(page, scenario, 'light', `${label} restored layout`);
  const restored = await measureLayout(page, scenario);
  compareLayouts(before, restored, `${label} restored layout`);
}

async function prepareScreenshot(page) {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    document.documentElement.style.scrollBehavior = 'auto';
    window.scrollTo(0, 0);
  });
  await page.waitForFunction(() => window.scrollY === 0);
  await page.evaluate(() => document.documentElement.style.removeProperty('scroll-behavior'));
}

async function captureScenario(browser, viewport, scenario, theme, qaDir) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
  const page = await context.newPage();
  const label = `${viewport.width}x${viewport.height} ${theme} ${scenario.name}`;
  const consoleIssues = [];
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) consoleIssues.push(message.text());
  });
  page.on('pageerror', (error) => consoleIssues.push(error.message));
  try {
    await openScenario(page, scenario);
    await assertScenarioIdentity(page, scenario, `${label} setup`);
    await setTheme(page, theme);
    await assertHomeHover(page, scenario, theme, `${label} themed`);
    await assertInstrumentConsole(page, scenario, theme, label);
    await assertScenarioIdentity(page, scenario, `${label} themed identity`);
    await assertTokens(page, theme, label);
    await assertNoOverflow(page, label);
    await assertCarbonSurfaces(page, scenario, theme, label);
    await assertSelectedRails(page, scenario, theme, label);
    await assertResponsiveGeometry(page, scenario, theme, label);
    await assertFocusColors(page, scenario, theme, label);
    if (theme === 'light') await assertThemeLayoutInvariant(page, scenario, label);
    await assertScenarioIdentity(page, scenario, `${label} final identity`);
    await prepareScreenshot(page);
    await assertScenarioIdentity(page, scenario, `${label} screenshot identity`);
    await assertHomeHover(page, scenario, theme, `${label} screenshot`);
    await page.screenshot({
      path: path.join(qaDir, screenshotName({ viewport, scenario, theme })),
      fullPage: false,
    });
  } catch (error) {
    fail(`${label}: ${error.message}`);
  } finally {
    if (consoleIssues.length) fail(`${label}: console issues: ${consoleIssues.slice(0, 5).join(' | ')}`);
    await context.close();
  }
}

async function loadSharp() {
  if (!process.env.CARBON_QA_SHARP) return null;
  return (await import(pathToFileURL(process.env.CARBON_QA_SHARP).href)).default;
}

async function composeEvidence(sharp, qaDir) {
  if (!sharp) return;
  const referenceRoot = path.resolve('.superpowers/visual-references/task-first');
  for (const [referenceName, actualName, outputName] of evidencePairs) {
    const reference = path.join(referenceRoot, referenceName);
    const actual = path.join(qaDir, actualName);
    if (!existsSync(reference)) throw new Error(`missing reference ${reference}`);
    if (!existsSync(actual)) throw new Error(`missing actual ${actual}`);
    const referenceMeta = await sharp(reference).metadata();
    const actualMeta = await sharp(actual).metadata();
    const width = (referenceMeta.width || 0) + (actualMeta.width || 0);
    const height = Math.max(referenceMeta.height || 0, actualMeta.height || 0);
    if (!width || !height) throw new Error(`invalid evidence metadata for ${outputName}`);
    await sharp({ create: { width, height, channels: 4, background: '#ffffff' } })
      .composite([
        { input: reference, left: 0, top: 0 },
        { input: actual, left: referenceMeta.width || 0, top: 0 },
      ])
      .png()
      .toFile(path.join(qaDir, outputName));
  }
}

async function readPngDimensions(file) {
  const data = await readFile(file);
  if (data.length < 24 || data.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error(`${file} is not a valid PNG`);
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

async function auditEvidence(sharp, qaDir) {
  const expectedCompositeNames = sharp ? evidencePairs.map((pair) => pair[2]).sort() : [];
  const expectedNames = [...expectedScreenshotNames, ...expectedCompositeNames].sort();
  const actualNames = (await readdir(qaDir)).filter((name) => name.endsWith('.png')).sort();
  if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) {
    throw new Error(`QA filename audit failed: actual=${JSON.stringify(actualNames)} expected=${JSON.stringify(expectedNames)}`);
  }
  for (const entry of capturePlan) {
    const name = screenshotName(entry);
    const dimensions = await readPngDimensions(path.join(qaDir, name));
    if (dimensions.width !== entry.viewport.width || dimensions.height !== entry.viewport.height) {
      throw new Error(`${name} is ${dimensions.width}x${dimensions.height}, expected ${entry.viewport.width}x${entry.viewport.height}`);
    }
    if (sharp) {
      const metadata = await sharp(path.join(qaDir, name)).metadata();
      if (metadata.width !== entry.viewport.width || metadata.height !== entry.viewport.height) throw new Error(`${name} Sharp metadata mismatch`);
    }
  }
  if (sharp) {
    const referenceRoot = path.resolve('.superpowers/visual-references/task-first');
    for (const [referenceName, actualName, outputName] of evidencePairs) {
      const referenceMeta = await sharp(path.join(referenceRoot, referenceName)).metadata();
      const actualMeta = await sharp(path.join(qaDir, actualName)).metadata();
      const compositeMeta = await sharp(path.join(qaDir, outputName)).metadata();
      const expectedWidth = (referenceMeta.width || 0) + (actualMeta.width || 0);
      const expectedHeight = Math.max(referenceMeta.height || 0, actualMeta.height || 0);
      if (compositeMeta.width !== expectedWidth || compositeMeta.height !== expectedHeight) {
        throw new Error(`${outputName} is ${compositeMeta.width}x${compositeMeta.height}, expected ${expectedWidth}x${expectedHeight}`);
      }
    }
  }
}

async function main() {
  const qaDir = await prepareQaDir(process.env.CARBON_QA_DIR || '/tmp/carbon-console-qa');
  await cleanupGeneratedEvidence(qaDir);
  const sharp = await loadSharp();
  const browser = await chromium.launch();
  try {
    await assertInitialTheme(browser);
    await assertAuthoritativeRatingFlow(browser);
    for (let index = 0; index < capturePlan.length; index += 1) {
      const { viewport, scenario, theme } = capturePlan[index];
      console.log(`[carbon ${index + 1}/${capturePlan.length}] ${viewport.width}x${viewport.height} ${theme} ${scenario.name}`);
      await captureScenario(browser, viewport, scenario, theme, qaDir);
    }
  } finally {
    await browser.close();
  }
  try {
    await composeEvidence(sharp, qaDir);
    await auditEvidence(sharp, qaDir);
  } catch (error) {
    fail(`evidence audit: ${error.message}`);
  }
  if (failures.length) {
    console.error(failures.join('\n'));
    process.exitCode = 1;
    return;
  }
  console.log(`carbon theme UI guard passed; 50 screenshots${sharp ? ' + 4 composites' : ''}: ${qaDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
