import { chromium } from 'playwright';

const baseUrl = process.env.TASK_FIRST_UI_URL || 'http://127.0.0.1:3101';
const failures = [];
const fail = (message) => failures.push(message);

async function assertNoOverflow(page, label) {
  const layout = await page.evaluate(() => ({
    viewportWidth: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  if (layout.scrollWidth > layout.viewportWidth) fail(`${label}: horizontal overflow ${layout.scrollWidth} > ${layout.viewportWidth}`);
}

async function assertTrayGeometry(page, label) {
  const geometry = await page.evaluate(() => {
    const trayElement = document.querySelector('[data-compare-tray]');
    const navElement = document.querySelector('nav[aria-label="移动端导航"]');
    if (!trayElement || !navElement || getComputedStyle(navElement).display === 'none') return null;
    const tray = trayElement.getBoundingClientRect();
    const nav = navElement.getBoundingClientRect();
    if (nav.height === 0) return null;
    return {
      trayBottom: Math.round(tray.bottom),
      navTop: Math.round(nav.top),
      navBottom: Math.round(nav.bottom),
      viewportBottom: Math.round(innerHeight),
    };
  });
  if (geometry && Math.abs(geometry.trayBottom - geometry.navTop) > 1) fail(`${label}: compare tray is not flush above the measured mobile nav`);
  if (geometry && Math.abs(geometry.navBottom - geometry.viewportBottom) > 1) fail(`${label}: mobile nav does not reach the safe-area viewport edge`);
}

async function assertControlRowGeometry(page, label) {
  const geometry = await page.locator('[data-directory-controls]').evaluate((element) => {
    const row = element.getBoundingClientRect();
    const children = Array.from(element.children).map((child) => child.getBoundingClientRect());
    return {
      rowLeft: Math.round(row.left),
      rowRight: Math.round(row.right),
      viewportWidth: innerWidth,
      childOverflow: children.some((child) => child.left < row.left - 1 || child.right > row.right + 1),
    };
  });
  if (geometry.rowLeft < -1 || geometry.rowRight > geometry.viewportWidth + 1 || geometry.childOverflow) {
    fail(`${label}: three-column controls overflow their container`);
  }
}

async function runFlow(page) {
  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
  await page.getByRole('link', { name: /做调研/ }).click();
  await page.waitForURL(/\/tools\?scene=research/);
  const price = page.getByRole('radio', { name: '有免费额度' });
  await price.click();
  await page.waitForURL(/scene=research.*price=free-tier/);
  if (!await price.isChecked()) fail('directory: price filter did not become checked');
  await page.reload({ waitUntil: 'networkidle' });
  if (!await price.isChecked()) fail('directory: price filter was not restored after refresh');
  const rows = page.locator('[data-tool-decision-row]');
  if (await rows.count() < 5) fail('directory: fewer than five decision rows');
  await rows.nth(0).getByRole('checkbox').check();
  await rows.nth(1).getByRole('checkbox').check();
  await page.getByRole('link', { name: /查看 .* 详情/ }).first().click();
  await page.waitForURL(/\/tools\/[^/?]+/);
  await page.goBack({ waitUntil: 'networkidle' });
  await page.waitForURL(/scene=research.*price=free-tier/);
  if (!await price.isChecked()) fail('directory: price filter was not restored by browser Back');
  if (await page.locator('[data-compare-tray]').count() !== 1) fail('directory: compare tray missing after browser Back');
  await page.getByRole('link', { name: /查看 .* 详情/ }).first().click();
  await page.waitForURL(/\/tools\/[^/?]+/);
  await page.getByRole('link', { name: /返回工具目录/ }).click();
  await page.waitForURL(/scene=research.*price=free-tier/);
  if (await page.locator('[data-compare-tray]').count() !== 1) fail('directory: compare tray missing after SPA detail return');
  await assertNoOverflow(page, 'desktop directory');
  await page.getByRole('button', { name: /比较 2 款/ }).click();
  await page.waitForURL(/\/compare/);
  if (await page.locator('[data-compare-tray]').count() !== 0) fail('compare: global tray must be hidden');
}

async function assertKeyboardAndTheme(page) {
  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
  const search = page.getByRole('combobox', { name: /搜索工具/ });
  await search.focus();
  await page.keyboard.press('Tab');
  const focusTag = await page.evaluate(() => document.activeElement?.tagName || '');
  if (!['A', 'BUTTON', 'INPUT', 'SELECT'].includes(focusTag)) fail(`keyboard: unexpected focus target ${focusTag}`);
  await page.getByRole('button', { name: '切换到暗色主题' }).click();
  if (!await page.locator('html.dark').count()) fail('theme: dark class was not applied');
  await page.getByRole('button', { name: '切换到亮色主题' }).click();
}

async function assertCompareLimit(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/tools?scene=research`, { waitUntil: 'networkidle' });
  const checks = page.locator('[data-tool-decision-row]').getByRole('checkbox');
  for (let index = 0; index < 4; index += 1) await checks.nth(index).check();
  await checks.nth(4).focus();
  await page.keyboard.press('Space');
  if (await checks.nth(4).isChecked()) fail('compare limit: fifth tool was selected');
  const announcement = page.locator('[aria-live="polite"]').filter({ hasText: '最多比较 4 款工具' });
  if (await announcement.count() === 0) fail('compare limit: aria-live explanation missing');
  await context.close();
}

async function assertToolsRecovery(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  let failRequests = true;
  let apiRequests = 0;
  let staticRequests = 0;
  await page.route('**/api/tools', (route) => {
    apiRequests += 1;
    return failRequests ? route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }) : route.continue();
  });
  await page.route('**/data/tools.json', (route) => {
    staticRequests += 1;
    return failRequests ? route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }) : route.continue();
  });
  await page.goto(`${baseUrl}/tools`, { waitUntil: 'networkidle' });
  const alert = page.getByRole('alert').filter({ hasText: '工具数据暂时无法加载' });
  if (await alert.count() !== 1) {
    fail('data failure: retryable inline error missing');
  }
  const retry = page.getByRole('button', { name: '重新加载' });
  if (await retry.count() === 0) fail('data failure: retry action missing');
  failRequests = false;
  await retry.click();
  await page.locator('[data-tool-decision-row]').first().waitFor();
  if (await alert.isVisible()) fail('data failure: alert remained after retry');
  if (apiRequests < 2 || staticRequests < 1) fail(`data failure: retry did not exercise the failed loaders (api=${apiRequests}, static=${staticRequests})`);
  await context.close();
}

async function assertSceneRecovery(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  let failScene = true;
  let sceneRequests = 0;
  await page.route('**/data/scenes.json', (route) => {
    sceneRequests += 1;
    return failScene ? route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }) : route.continue();
  });
  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
  const alert = page.getByRole('alert').filter({ hasText: '任务数据暂时无法加载' });
  if (await alert.count() !== 1) fail('scene failure: retryable inline error missing');
  failScene = false;
  await alert.getByRole('button', { name: '重新加载' }).click();
  await page.getByRole('link', { name: /做调研/ }).waitFor();
  if (await alert.isVisible()) fail('scene failure: alert remained after retry');
  if (sceneRequests < 2) fail(`scene failure: retry did not issue a second scene request (${sceneRequests})`);
  await context.close();
}

async function assertUrlStateAndEmptyHistory(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const stateUrl = `${baseUrl}/tools?scene=research&q=${encodeURIComponent('引用')}&price=free-tier&origin=overseas&platform=web&sort=name-asc`;
  await page.goto(stateUrl, { waitUntil: 'networkidle' });
  const search = page.getByRole('combobox', { name: /搜索工具/ });
  if (await search.inputValue() !== '引用') fail('URL state: search query was not restored');
  if (await page.getByRole('combobox', { name: '选择任务' }).inputValue() !== 'research') fail('URL state: scene was not restored');
  if (!await page.getByRole('radio', { name: '有免费额度' }).isChecked()) fail('URL state: price was not restored');
  if (!await page.getByRole('checkbox', { name: '海外' }).isChecked()) fail('URL state: origin was not restored');
  if (!await page.getByRole('checkbox', { name: '网页版' }).isChecked()) fail('URL state: platform was not restored');
  if (await page.getByRole('combobox', { name: '工具排序' }).inputValue() !== 'name-asc') fail('URL state: sort was not restored');
  await page.reload({ waitUntil: 'networkidle' });
  if (await search.inputValue() !== '引用') fail('URL state: search query was lost after reload');

  const emptyUrl = `${baseUrl}/tools?scene=research&q=__no_such_tool__`;
  await page.goto(emptyUrl, { waitUntil: 'networkidle' });
  if (await page.getByText('没有符合这些条件的工具').count() !== 1) fail('empty state: expected message missing');
  await page.goBack({ waitUntil: 'networkidle' });
  if (await search.inputValue() !== '引用') fail('URL state: browser Back did not restore the search query');
  await page.goForward({ waitUntil: 'networkidle' });
  if (await page.getByText('没有符合这些条件的工具').count() !== 1) fail('URL state: browser Forward did not restore the empty result');
  await context.close();
}

async function assertDetailNotFound(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/tools/999999`, { waitUntil: 'networkidle' });
  if (await page.getByRole('heading', { name: '工具未找到' }).count() !== 1) fail('detail: not-found state missing');
  if (await page.getByRole('link', { name: '返回工具目录' }).count() !== 1) fail('detail: not-found return link missing');
  await context.close();
}

async function assertRawReturnPath(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const rawPath = '/tools?scene=research&unknown=keep&price=bad';
  await page.goto(`${baseUrl}${rawPath}`, { waitUntil: 'networkidle' });
  await page.getByRole('link', { name: /查看 .* 详情/ }).first().click();
  await page.waitForURL((url) => url.searchParams.get('from') === rawPath);
  await page.getByRole('link', { name: '返回工具目录' }).click();
  await page.waitForURL((url) => `${url.pathname}${url.search}` === rawPath);
  await page.getByRole('combobox', { name: '选择任务' }).selectOption('coding');
  await page.waitForURL((url) => url.pathname === '/tools' && url.searchParams.get('scene') === 'coding');
  const canonical = new URL(page.url());
  if (canonical.searchParams.has('unknown') || canonical.searchParams.has('price')) {
    fail(`raw return path: control mutation did not canonicalize invalid values (${canonical.search})`);
  }
  await context.close();
}

function expectedSearchNames(tools, query) {
  const needle = query.toLocaleLowerCase('zh-CN');
  return tools
    .filter((tool) => [tool.name, tool.desc, ...(tool.toolTags || [])]
      .some((value) => String(value).toLocaleLowerCase('zh-CN').includes(needle)))
    .map((tool) => tool.name);
}

async function assertAllVisibleRowsMatch(page, tools, query, primaryName, label) {
  const expectedNames = expectedSearchNames(tools, query);
  if (expectedNames.length === 0) {
    fail(`${label}: deployed catalog has no matches for ${query}`);
    return;
  }
  try {
    await page.waitForFunction(({ expected, primary }) => {
      const rows = Array.from(document.querySelectorAll('[data-tool-decision-row]'));
      const names = rows.map((row) => row.querySelector('[data-field="tool"] strong')?.textContent?.trim() || '');
      return names.length > 0 && names.includes(primary) && names.every((name) => expected.includes(name));
    }, { expected: expectedNames, primary: primaryName });
  } catch {
    fail(`${label}: decision rows did not settle to semantic matches for ${query}`);
  }
  const names = await page.locator('[data-tool-decision-row]').evaluateAll((rows) => rows
    .map((row) => row.querySelector('[data-field="tool"] strong')?.textContent?.trim() || ''));
  if (names.length === 0) {
    fail(`${label}: query produced no decision rows`);
    return;
  }
  if (!names.includes(primaryName)) fail(`${label}: primary result ${primaryName} is missing`);
  const expected = new Set(expectedNames);
  names.forEach((name, index) => {
    if (!expected.has(name)) fail(`${label}: row ${index + 1} is not a semantic match for ${query} (${name})`);
  });
}

async function assertSearchInteractions(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
  const deployedTools = await page.evaluate(async () => {
    const response = await fetch('/data/tools.json');
    if (!response.ok) throw new Error(`catalog request failed with ${response.status}`);
    const payload = await response.json();
    return payload.tools;
  });
  const homeSearch = page.getByRole('combobox', { name: /搜索工具/ });
  await homeSearch.fill('ChatGPT');
  await homeSearch.press('Enter');
  await page.waitForURL((url) => url.pathname === '/tools' && url.searchParams.get('q') === 'ChatGPT');
  await assertAllVisibleRowsMatch(page, deployedTools, 'ChatGPT', 'ChatGPT', 'homepage submit');
  await page.getByRole('link', { name: 'AI Tool Hub', exact: true }).click();
  await page.waitForURL((url) => url.pathname === '/');
  await homeSearch.focus();
  await page.getByRole('button', { name: '再次搜索 ChatGPT' }).click();
  await page.waitForURL((url) => url.pathname === '/tools' && url.searchParams.get('q') === 'ChatGPT');
  await assertAllVisibleRowsMatch(page, deployedTools, 'ChatGPT', 'ChatGPT', 'homepage history');
  await page.getByRole('link', { name: 'AI Tool Hub', exact: true }).click();
  await page.waitForURL((url) => url.pathname === '/');
  await page.waitForLoadState('networkidle');
  await homeSearch.fill('Perplexity');
  await page.getByRole('option', { name: '搜索 Perplexity AI' }).click();
  await page.waitForURL((url) => url.pathname === '/tools' && url.searchParams.get('q') === 'Perplexity AI');
  await assertAllVisibleRowsMatch(page, deployedTools, 'Perplexity AI', 'Perplexity AI', 'homepage suggestion');
  const directorySearch = page.getByRole('combobox', { name: /搜索工具/ });
  await directorySearch.fill('ChatGPT');
  await page.waitForURL((url) => url.pathname === '/tools' && url.searchParams.get('q') === 'ChatGPT');
  await assertAllVisibleRowsMatch(page, deployedTools, 'ChatGPT', 'ChatGPT', 'directory typing');
  const typedCount = await page.locator('[data-tool-decision-row]').count();
  await page.getByRole('button', { name: '清除搜索' }).click();
  await page.waitForURL((url) => url.pathname === '/tools' && !url.searchParams.has('q'));
  if (await page.locator('[data-tool-decision-row]').count() <= typedCount) fail('directory clear: results did not expand after clearing the query');
  await context.close();
}

async function assertResponsiveGeometry(browser) {
  const viewports = [
    { width: 1280, height: 720 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
    { width: 320, height: 844 },
  ];
  for (const viewport of viewports) {
    // Isolate storage and selected tools so every viewport repeats the same workflow.
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/tools?scene=research`, { waitUntil: 'networkidle' });
    await assertNoOverflow(page, `${viewport.width}x${viewport.height}`);
    if (viewport.width === 320) await assertControlRowGeometry(page, '320px directory controls');
    const rows = page.locator('[data-tool-decision-row]');
    await rows.nth(0).getByRole('checkbox').check();
    await rows.nth(1).getByRole('checkbox').check();
    if (await page.locator('[data-compare-tray]').count() !== 1) fail(`${viewport.width}x${viewport.height}: compare tray missing`);
    await page.waitForFunction(() => {
      const rootStyle = getComputedStyle(document.documentElement);
      const traySize = Number.parseFloat(rootStyle.getPropertyValue('--compare-tray-block-size'));
      const nav = document.querySelector('nav[aria-label="移动端导航"]');
      const visibleNav = nav && getComputedStyle(nav).display !== 'none' && nav.getBoundingClientRect().height > 0;
      const navSize = Number.parseFloat(rootStyle.getPropertyValue('--mobile-nav-block-size'));
      return traySize > 0 && (!visibleNav || navSize > 0);
    });
    const clearance = await page.evaluate(() => {
      const rootStyle = getComputedStyle(document.documentElement);
      const tray = document.querySelector('[data-compare-tray]');
      const spacer = tray?.previousElementSibling?.getBoundingClientRect();
      return {
        required: Number.parseFloat(rootStyle.getPropertyValue('--compare-tray-block-size'))
          + Number.parseFloat(rootStyle.getPropertyValue('--mobile-nav-block-size')),
        spacerHeight: spacer?.height || 0,
      };
    });
    if (clearance.spacerHeight + 1 < clearance.required) fail(`${viewport.width}x${viewport.height}: compare clearance spacer is too short`);
    await assertNoOverflow(page, `${viewport.width}x${viewport.height} with tray`);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForFunction(() => {
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - innerHeight);
      return Math.abs(scrollY - maxScroll) <= 1;
    });
    const obstruction = await page.evaluate(() => {
      const lastRow = Array.from(document.querySelectorAll('[data-tool-decision-row]')).at(-1)?.getBoundingClientRect();
      const tray = document.querySelector('[data-compare-tray]')?.getBoundingClientRect();
      return lastRow && tray ? { lastBottom: Math.round(lastRow.bottom), trayTop: Math.round(tray.top) } : null;
    });
    if (obstruction && obstruction.lastBottom > obstruction.trayTop) fail(`${viewport.width}x${viewport.height}: compare tray obscures the last row`);
    await assertTrayGeometry(page, `${viewport.width}x${viewport.height}`);
    const taskSelect = page.getByRole('combobox', { name: '选择任务' });
    await taskSelect.focus();
    await page.keyboard.press('Tab');
    if (!await page.evaluate(() => ['BUTTON', 'INPUT', 'SELECT', 'A'].includes(document.activeElement?.tagName || ''))) fail(`${viewport.width}x${viewport.height}: task control lost keyboard focus`);
    const sortSelect = page.getByRole('combobox', { name: '工具排序' });
    await sortSelect.focus();
    if (!await page.evaluate(() => document.activeElement?.getAttribute('aria-label') === '工具排序')) fail(`${viewport.width}x${viewport.height}: sort control is not keyboard focusable`);
    if (viewport.width < 1024) {
      const filterButton = page.getByRole('button', { name: /^筛选/ });
      await filterButton.focus();
      await page.keyboard.press('Enter');
      if (!await page.getByRole('dialog').isVisible()) fail(`${viewport.width}x${viewport.height}: filter drawer did not open from keyboard`);
      await page.keyboard.press('Escape');
      if (await page.getByRole('dialog').isVisible()) fail(`${viewport.width}x${viewport.height}: filter drawer did not close with Escape`);
      if (!await filterButton.evaluate((element) => document.activeElement === element)) fail(`${viewport.width}x${viewport.height}: filter drawer did not restore keyboard focus`);
    }
    await page.getByRole('button', { name: '切换到暗色主题' }).click();
    if (!await page.locator('html.dark').count()) fail(`${viewport.width}x${viewport.height}: dark theme missing`);
    await page.getByRole('button', { name: '切换到亮色主题' }).click();
    if (await page.locator('html.dark').count()) fail(`${viewport.width}x${viewport.height}: light theme was not restored`);
    await context.close();
  }
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleIssues = [];
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) consoleIssues.push(message.text());
  });

  await runFlow(page);
  await assertKeyboardAndTheme(page);
  await assertResponsiveGeometry(browser);
  await assertCompareLimit(browser);
  await assertToolsRecovery(browser);
  await assertSceneRecovery(browser);
  await assertUrlStateAndEmptyHistory(browser);
  await assertDetailNotFound(browser);
  await assertRawReturnPath(browser);
  await assertSearchInteractions(browser);

  if (consoleIssues.length) fail(`console issues: ${consoleIssues.slice(0, 5).join(' | ')}`);
  await browser.close();
  if (failures.length) {
    console.error(failures.join('\n'));
    process.exit(1);
  }
  console.log('task-first UI guard passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
