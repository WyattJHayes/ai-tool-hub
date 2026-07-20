import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const baseUrl = process.env.CARBON_THEME_URL || 'http://127.0.0.1:3101';
const qaDir = process.env.CARBON_QA_DIR || '/tmp/carbon-console-qa';
const failures = [];
const fail = (message) => failures.push(message);

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
  },
  dark: {
    '--page': '#080b0e',
    '--surface': '#10161a',
    '--ink': '#e8f7fb',
    '--accent': '#46d9f2',
    toolBackground: 'rgb(12, 18, 22)',
    focus: 'rgb(70, 217, 242)',
  },
};

const allScenarios = [
  { name: 'home', path: '/', hoverTask: true },
  { name: 'directory', path: '/tools?scene=research&price=free-tier&platform=web', selectTools: true, carbon: true },
  { name: 'detail', path: '/tools/71', carbon: true },
  { name: 'compare', path: '/tools?scene=research&price=free-tier&platform=web', selectTools: true, openCompare: true, carbon: true },
  { name: 'scenes', path: '/scenes' },
  { name: 'scene-detail', path: '/scenes/research' },
  { name: 'leaderboard', path: '/leaderboard' },
  { name: 'user', path: '/user' },
  { name: 'auth', path: '/user', openAuth: true },
];

const coreScenarioNames = new Set(['home', 'directory', 'detail', 'compare']);
const viewports = [
  { width: 1440, height: 900, allRoutes: true },
  { width: 1280, height: 720 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 320, height: 700 },
];

async function openScenario(page, scenario) {
  await page.goto(`${baseUrl}${scenario.path}`, { waitUntil: 'networkidle' });
  if (scenario.hoverTask) await page.getByRole('link', { name: /做调研/ }).hover();
  if (scenario.selectTools) {
    const rows = page.locator('[data-tool-decision-row]');
    await rows.first().waitFor();
    await rows.nth(0).getByRole('checkbox').check();
    await rows.nth(1).getByRole('checkbox').check();
  }
  if (scenario.openCompare) {
    await page.getByRole('button', { name: /比较 2 款/ }).click();
    await page.waitForURL((url) => url.pathname === '/compare');
  }
  if (scenario.openAuth) {
    await page.getByRole('button', { name: '登录', exact: true }).first().click();
    await page.getByRole('dialog').waitFor();
  }
}

async function setTheme(page, theme) {
  const dark = await page.locator('html.dark').count() > 0;
  if (theme === 'dark' && !dark) await page.getByRole('button', { name: '切换到暗色主题' }).click();
  if (theme === 'light' && dark) await page.getByRole('button', { name: '切换到亮色主题' }).click();
  await page.waitForFunction((expected) => document.documentElement.classList.contains('dark') === expected, theme === 'dark');
  await page.waitForTimeout(180);
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
  const count = await surfaces.count();
  if (scenario.carbon && count === 0) fail(`${label}: carbon surface missing`);
  if (!scenario.carbon && count !== 0) fail(`${label}: unexpected carbon surface`);
  for (let index = 0; index < count; index += 1) {
    const style = await surfaces.nth(index).evaluate((element) => {
      const computed = getComputedStyle(element);
      return {
        background: computed.backgroundColor,
        color: computed.color,
        border: computed.borderTopColor,
      };
    });
    if (style.background !== themes[theme].toolBackground) fail(`${label}: carbon background is ${style.background}`);
    if (style.color !== 'rgb(232, 247, 251)') fail(`${label}: carbon text is ${style.color}`);
    if (style.border !== 'rgb(88, 112, 123)') fail(`${label}: carbon keyline is ${style.border}`);
  }
}

async function assertSelectedRails(page, scenario, theme, label) {
  if (!scenario.selectTools || scenario.openCompare) return;
  const selectedRows = page.locator('[data-tool-decision-row][data-selected="true"]');
  if (await selectedRows.count() < 2) {
    fail(`${label}: selected rows are missing`);
    return;
  }
  const rail = await selectedRows.first().evaluate((element) => {
    const style = getComputedStyle(element, '::before');
    return { width: style.width, background: style.backgroundColor };
  });
  if (rail.width !== '3px') fail(`${label}: selected rail width is ${rail.width}`);
  if (rail.background !== themes[theme].focus) fail(`${label}: selected rail is ${rail.background}`);
}

async function focusByKeyboard(page, target, label) {
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

async function assertFocusColors(page, scenario, theme, label) {
  const normalTarget = page.getByRole('button', { name: theme === 'dark' ? '切换到亮色主题' : '切换到暗色主题' });
  await focusByKeyboard(page, normalTarget, label);
  const normalOutline = await normalTarget.evaluate((element) => getComputedStyle(element).outlineColor);
  if (normalOutline !== themes[theme].focus) fail(`${label}: normal focus is ${normalOutline}`);
  if (!scenario.carbon) return;
  const carbonTarget = page.locator('[data-carbon-surface]').getByRole('button').first();
  if (await carbonTarget.count() === 0) return;
  await focusByKeyboard(page, carbonTarget, label);
  const carbonOutline = await carbonTarget.evaluate((element) => getComputedStyle(element).outlineColor);
  if (carbonOutline !== 'rgb(70, 217, 242)') fail(`${label}: carbon focus is ${carbonOutline}`);
}

async function assertThemeLayoutInvariant(page, label) {
  const measure = () => page.evaluate(() => {
    const main = document.querySelector('main')?.getBoundingClientRect();
    return {
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      mainLeft: Math.round(main?.left || 0),
      mainWidth: Math.round(main?.width || 0),
    };
  });
  const before = await measure();
  await page.getByRole('button', { name: '切换到暗色主题' }).click();
  const after = await measure();
  for (const key of Object.keys(before)) {
    if (Math.abs(before[key] - after[key]) > 1) fail(`${label}: ${key} shifts ${before[key]} -> ${after[key]}`);
  }
  await page.getByRole('button', { name: '切换到亮色主题' }).click();
  await page.waitForTimeout(180);
}

async function captureScenario(browser, viewport, scenario, theme) {
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
    await setTheme(page, theme);
    await assertTokens(page, theme, label);
    await assertNoOverflow(page, label);
    await assertCarbonSurfaces(page, scenario, theme, label);
    await assertSelectedRails(page, scenario, theme, label);
    await assertFocusColors(page, scenario, theme, label);
    if (theme === 'light') await assertThemeLayoutInvariant(page, label);
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      document.documentElement.style.scrollBehavior = 'auto';
      window.scrollTo(0, 0);
    });
    await page.waitForFunction(() => window.scrollY === 0);
    await page.evaluate(() => document.documentElement.style.removeProperty('scroll-behavior'));
    await page.screenshot({
      path: path.join(qaDir, `${viewport.width}x${viewport.height}-${theme}-${scenario.name}.png`),
    });
  } catch (error) {
    fail(`${label}: ${error.message}`);
  } finally {
    if (consoleIssues.length) fail(`${label}: console issues: ${consoleIssues.slice(0, 5).join(' | ')}`);
    await context.close();
  }
}

async function composeEvidence() {
  if (!process.env.CARBON_QA_SHARP) return;
  const sharp = (await import(pathToFileURL(process.env.CARBON_QA_SHARP).href)).default;
  const referenceRoot = path.resolve('.superpowers/visual-references/task-first');
  const pairs = [
    ['home-desktop.png', '1440x900-light-home.png', 'composite-home.png'],
    ['directory-desktop.png', '1440x900-light-directory.png', 'composite-directory.png'],
    ['detail-desktop.png', '1440x900-light-detail.png', 'composite-detail.png'],
    ['directory-mobile.png', '390x844-light-directory.png', 'composite-directory-mobile.png'],
  ];
  for (const [referenceName, actualName, outputName] of pairs) {
    const reference = path.join(referenceRoot, referenceName);
    const actual = path.join(qaDir, actualName);
    if (!existsSync(reference) || !existsSync(actual)) continue;
    const referenceMeta = await sharp(reference).metadata();
    const actualMeta = await sharp(actual).metadata();
    const width = (referenceMeta.width || 0) + (actualMeta.width || 0);
    const height = Math.max(referenceMeta.height || 0, actualMeta.height || 0);
    await sharp({ create: { width, height, channels: 4, background: '#ffffff' } })
      .composite([
        { input: reference, left: 0, top: 0 },
        { input: actual, left: referenceMeta.width || 0, top: 0 },
      ])
      .png()
      .toFile(path.join(qaDir, outputName));
  }
}

async function main() {
  await mkdir(qaDir, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const viewport of viewports) {
      const scenarios = viewport.allRoutes ? allScenarios : allScenarios.filter((scenario) => coreScenarioNames.has(scenario.name));
      for (const theme of Object.keys(themes)) {
        for (const scenario of scenarios) await captureScenario(browser, viewport, scenario, theme);
      }
    }
  } finally {
    await browser.close();
  }
  await composeEvidence();
  if (failures.length) {
    console.error(failures.join('\n'));
    process.exitCode = 1;
    return;
  }
  console.log(`carbon theme UI guard passed; screenshots: ${qaDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
