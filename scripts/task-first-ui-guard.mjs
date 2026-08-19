import { chromium } from 'playwright';

const baseUrl = process.env.TASK_FIRST_UI_URL || 'http://127.0.0.1:3101';
const failures = [];
const fail = (message) => failures.push(message);

function isInducedResource500(message, expectedPaths) {
  const resourceUrl = message.location().url;
  return message.type() === 'error'
    && /Failed to load resource: the server responded with a status of 500/.test(message.text())
    && expectedPaths.some((path) => resourceUrl.endsWith(path));
}

function monitorPage(page, label, options = {}) {
  const consoleIssues = [];
  const pageErrors = [];
  page.on('console', (message) => {
    if (!['error', 'warning'].includes(message.type())) return;
    if (options.allowConsoleIssue?.(message)) return;
    consoleIssues.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  return {
    assertClean() {
      if (consoleIssues.length) fail(`${label}: console issues: ${consoleIssues.slice(0, 5).join(' | ')}`);
      if (pageErrors.length) fail(`${label}: page errors: ${pageErrors.slice(0, 5).join(' | ')}`);
    },
  };
}

async function withIsolatedPage(browser, contextOptions, label, run, diagnosticOptions = {}) {
  const context = await browser.newContext(contextOptions);
  let diagnostics;
  try {
    const page = await context.newPage();
    diagnostics = monitorPage(page, label, diagnosticOptions);
    return await run(page);
  } finally {
    diagnostics?.assertClean();
    await context.close();
  }
}

async function assertTargetSize(locator, label, useClosestLabel = false) {
  const geometry = await locator.evaluate((element, closestLabel) => {
    const target = closestLabel ? element.closest('label') : element;
    if (!target) return null;
    const rect = target.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  }, useClosestLabel);
  if (!geometry) {
    fail(`${label}: interactive target is missing`);
    return;
  }
  if (geometry.width < 44 || geometry.height < 44) {
    fail(`${label}: interactive target is ${Math.round(geometry.width)}x${Math.round(geometry.height)}, expected at least 44x44`);
  }
}

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

async function assertThemeToggle(page, label) {
  const readTheme = async () => {
    const attr = await page.locator('html').getAttribute('data-theme');
    return attr ?? (await page.locator('html.dark').count() === 1 ? 'dark' : 'light');
  };
  const initialTheme = await readTheme();

  // A single trigger opens the theme picker; options apply immediately.
  const trigger = page.getByRole('button', { name: '选择主题', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: '选择主题' });
  if (await dialog.count() !== 1) fail(`${label}: theme picker did not open`);

  const targetName = initialTheme === 'dark' ? '亮色' : '暗色';
  await dialog.getByRole('button', { name: targetName, exact: true }).click();
  await page.waitForTimeout(250);
  const after = await readTheme();
  if (after === initialTheme) {
    fail(`${label}: theme did not change`);
    return;
  }

  await trigger.click();
  await page.getByRole('dialog', { name: '选择主题' }).getByRole('button', { name: initialTheme === 'dark' ? '暗色' : '亮色', exact: true }).click();
  await page.waitForTimeout(250);
  if (await readTheme() !== initialTheme) fail(`${label}: theme was not restored`);
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
  await assertThemeToggle(page, 'keyboard theme');
}

async function assertCompareLimit(browser) {
  await withIsolatedPage(browser, { viewport: { width: 1280, height: 720 } }, 'compare limit', async (page) => {
    await page.goto(`${baseUrl}/tools?scene=research`, { waitUntil: 'networkidle' });
    const checks = page.locator('[data-tool-decision-row]').getByRole('checkbox');
    for (let index = 0; index < 4; index += 1) await checks.nth(index).check();
    await checks.nth(4).focus();
    await page.keyboard.press('Space');
    if (await checks.nth(4).isChecked()) fail('compare limit: fifth tool was selected');
    const announcement = page.locator('[aria-live="polite"]').filter({ hasText: '最多比较 4 款工具' });
    if (await announcement.count() === 0) fail('compare limit: aria-live explanation missing');
  });
}

async function assertToolsRecovery(browser) {
  let failRequests = true;
  let apiRequests = 0;
  let staticRequests = 0;
  await withIsolatedPage(
    browser,
    { viewport: { width: 1280, height: 720 } },
    'tools recovery',
    async (page) => {
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
    },
    {
      allowConsoleIssue: (message) => failRequests
        && isInducedResource500(message, ['/api/tools', '/data/tools.json']),
    }
  );
}

async function assertSceneRecovery(browser) {
  let failScene = true;
  let sceneRequests = 0;
  await withIsolatedPage(
    browser,
    { viewport: { width: 1280, height: 720 } },
    'scene recovery',
    async (page) => {
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
    },
    {
      allowConsoleIssue: (message) => failScene
        && isInducedResource500(message, ['/data/scenes.json']),
    }
  );
}

async function assertUrlStateAndEmptyHistory(browser) {
  await withIsolatedPage(browser, { viewport: { width: 1280, height: 720 } }, 'URL state', async (page) => {
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
  });
}

async function assertDetailNotFound(browser) {
  await withIsolatedPage(browser, { viewport: { width: 1280, height: 720 } }, 'detail not found', async (page) => {
    await page.goto(`${baseUrl}/tools/999999`, { waitUntil: 'networkidle' });
    if (await page.getByRole('heading', { name: '工具未找到' }).count() !== 1) fail('detail: not-found state missing');
    if (await page.getByRole('link', { name: '返回工具目录' }).count() !== 1) fail('detail: not-found return link missing');
  });
}

async function assertRawReturnPath(browser) {
  await withIsolatedPage(browser, { viewport: { width: 1280, height: 720 } }, 'raw return path', async (page) => {
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
  });
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
      const actual = new Set(names);
      return names.length > 0
        && names.length === expected.length
        && actual.size === expected.length
        && names.includes(primary)
        && expected.every((name) => actual.has(name));
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
  const actual = new Set(names);
  if (names.length !== expectedNames.length || actual.size !== expected.size) {
    fail(`${label}: rendered ${names.length} rows for ${expectedNames.length} expected semantic matches`);
  }
  expectedNames.forEach((name) => {
    if (!actual.has(name)) fail(`${label}: expected semantic match is missing (${name})`);
  });
  names.forEach((name, index) => {
    if (!expected.has(name)) fail(`${label}: row ${index + 1} is not a semantic match for ${query} (${name})`);
  });
}

async function assertSearchInteractions(browser) {
  await withIsolatedPage(browser, { viewport: { width: 1280, height: 720 } }, 'search interactions', async (page) => {
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
    const deployedTools = await page.evaluate(async () => {
      const response = await fetch('/data/tools.json');
      if (!response.ok) throw new Error(`catalog request failed with ${response.status}`);
      const payload = await response.json();
      return payload.tools;
    });
    const homeSearch = page.getByRole('combobox', { name: /搜索工具/ });
    await homeSearch.fill('ChatGPT');
    const submitSearch = page.getByRole('button', { name: '提交搜索' });
    await assertTargetSize(submitSearch, 'homepage explicit search submit');
    await submitSearch.click();
    await page.waitForURL((url) => url.pathname === '/tools' && url.searchParams.get('q') === 'ChatGPT');
    await assertAllVisibleRowsMatch(page, deployedTools, 'ChatGPT', 'ChatGPT', 'homepage submit');
    await page.getByRole('link', { name: 'AI Tool Hub', exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/');
    await homeSearch.focus();
    await homeSearch.press('ArrowDown');
    const activeHistoryId = await homeSearch.getAttribute('aria-activedescendant');
    if (!activeHistoryId) fail('homepage history: ArrowDown did not expose an active option');
    const historyOptionId = await page.getByRole('option', { name: '再次搜索 ChatGPT' }).getAttribute('id');
    if (activeHistoryId !== historyOptionId) {
      fail('homepage history: active descendant does not identify the history option');
    }
    await homeSearch.press('ArrowUp');
    if (await homeSearch.getAttribute('aria-activedescendant') !== activeHistoryId) fail('homepage history: ArrowUp did not cycle through history options');
    await homeSearch.press('Enter');
    await page.waitForURL((url) => url.pathname === '/tools' && url.searchParams.get('q') === 'ChatGPT');
    await assertAllVisibleRowsMatch(page, deployedTools, 'ChatGPT', 'ChatGPT', 'homepage history');
    await page.getByRole('link', { name: 'AI Tool Hub', exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/');
    await page.waitForLoadState('networkidle');
    await homeSearch.fill('Perplexity');
    await homeSearch.press('ArrowDown');
    const activeSuggestionId = await homeSearch.getAttribute('aria-activedescendant');
    if (!activeSuggestionId) fail('homepage suggestion: ArrowDown did not expose an active option');
    await homeSearch.press('Escape');
    if (await homeSearch.getAttribute('aria-expanded') !== 'false') fail('homepage suggestion: Escape did not dismiss the popup');
    if (await homeSearch.inputValue() !== 'Perplexity') fail('homepage suggestion: Escape cleared the arbitrary search draft');
    if (await homeSearch.getAttribute('aria-activedescendant')) fail('homepage suggestion: Escape retained an active descendant');
    await homeSearch.press('ArrowDown');
    await homeSearch.press('Enter');
    await page.waitForURL((url) => url.pathname === '/tools' && url.searchParams.get('q') === 'Perplexity AI');
    await assertAllVisibleRowsMatch(page, deployedTools, 'Perplexity AI', 'Perplexity AI', 'homepage keyboard suggestion');
    await page.getByRole('link', { name: 'AI Tool Hub', exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/');
    await homeSearch.fill('Perplexity AI');
    await page.getByRole('option', { name: '搜索 Perplexity AI' }).click();
    await page.waitForURL((url) => url.pathname === '/tools' && url.searchParams.get('q') === 'Perplexity AI');
    await assertAllVisibleRowsMatch(page, deployedTools, 'Perplexity AI', 'Perplexity AI', 'homepage suggestion');
    await page.getByRole('link', { name: 'AI Tool Hub', exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/');
    await homeSearch.fill('__arbitrary_term__');
    await submitSearch.click();
    await page.waitForURL((url) => url.pathname === '/tools' && url.searchParams.get('q') === '__arbitrary_term__');
    const directorySearch = page.getByRole('combobox', { name: /搜索工具/ });
    await directorySearch.fill('ChatGPT');
    await page.waitForURL((url) => url.pathname === '/tools' && url.searchParams.get('q') === 'ChatGPT');
    await assertAllVisibleRowsMatch(page, deployedTools, 'ChatGPT', 'ChatGPT', 'directory typing');
    const typedCount = await page.locator('[data-tool-decision-row]').count();
    await page.getByRole('button', { name: '清除搜索' }).click();
    await page.waitForURL((url) => url.pathname === '/tools' && !url.searchParams.has('q'));
    await page.waitForFunction((previousCount) => document.querySelectorAll('[data-tool-decision-row]').length > previousCount, typedCount);
    if (await page.locator('[data-tool-decision-row]').count() <= typedCount) fail('directory clear: results did not expand after clearing the query');
  });
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
    const viewportLabel = `${viewport.width}x${viewport.height}`;
    await withIsolatedPage(browser, { viewport }, viewportLabel, async (page) => {
      await page.goto(`${baseUrl}/tools?scene=research`, { waitUntil: 'networkidle' });
      await assertNoOverflow(page, viewportLabel);
      if (viewport.width === 320) await assertControlRowGeometry(page, '320px directory controls');
      const rows = page.locator('[data-tool-decision-row]');
      const firstCheckbox = rows.nth(0).getByRole('checkbox');
      await assertTargetSize(firstCheckbox, `${viewportLabel} compare target`, true);
      await assertTargetSize(rows.nth(0).getByRole('link', { name: /查看 .* 详情/ }), `${viewportLabel} detail target`);
      await firstCheckbox.check();
      await rows.nth(1).getByRole('checkbox').check();
      const tray = page.locator('[data-compare-tray]');
      if (await tray.count() !== 1) fail(`${viewportLabel}: compare tray missing`);
      await page.waitForFunction(() => {
        const rootStyle = getComputedStyle(document.documentElement);
        const traySize = Number.parseFloat(rootStyle.getPropertyValue('--compare-tray-block-size'));
        const nav = document.querySelector('nav[aria-label="移动端导航"]');
        const visibleNav = nav && getComputedStyle(nav).display !== 'none' && nav.getBoundingClientRect().height > 0;
        const navSize = Number.parseFloat(rootStyle.getPropertyValue('--mobile-nav-block-size'));
        return traySize > 0 && (!visibleNav || navSize > 0);
      });
      await assertTargetSize(tray.getByRole('button', { name: /比较 2 款/ }), `${viewportLabel} tray compare action`);
      const clearance = await page.evaluate(() => {
        const rootStyle = getComputedStyle(document.documentElement);
        const trayElement = document.querySelector('[data-compare-tray]');
        const spacer = trayElement?.previousElementSibling?.getBoundingClientRect();
        return {
          required: Number.parseFloat(rootStyle.getPropertyValue('--compare-tray-block-size'))
            + Number.parseFloat(rootStyle.getPropertyValue('--mobile-nav-block-size')),
          spacerHeight: spacer?.height || 0,
        };
      });
      if (clearance.spacerHeight + 1 < clearance.required) fail(`${viewportLabel}: compare clearance spacer is too short`);
      await assertNoOverflow(page, `${viewportLabel} with tray`);
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForFunction(() => {
        const maxScroll = Math.max(0, document.documentElement.scrollHeight - innerHeight);
        return Math.abs(scrollY - maxScroll) <= 1;
      });
      const obstruction = await page.evaluate(() => {
        const lastRow = Array.from(document.querySelectorAll('[data-tool-decision-row]')).at(-1)?.getBoundingClientRect();
        const trayElement = document.querySelector('[data-compare-tray]')?.getBoundingClientRect();
        return lastRow && trayElement ? { lastBottom: Math.round(lastRow.bottom), trayTop: Math.round(trayElement.top) } : null;
      });
      if (obstruction && obstruction.lastBottom > obstruction.trayTop) fail(`${viewportLabel}: compare tray obscures the last row`);
      await assertTrayGeometry(page, viewportLabel);
      const taskSelect = page.getByRole('combobox', { name: '选择任务' });
      const sortSelect = page.getByRole('combobox', { name: '工具排序' });
      await assertTargetSize(taskSelect, `${viewportLabel} task select`);
      await assertTargetSize(sortSelect, `${viewportLabel} sort select`);
      const bottomNavTarget = page.getByRole('navigation', { name: '移动端导航' }).getByRole('link', { name: '工具' });
      if (await bottomNavTarget.isVisible()) await assertTargetSize(bottomNavTarget, `${viewportLabel} bottom nav target`);
      await taskSelect.focus();
      await page.keyboard.press('Tab');
      if (!await page.evaluate(() => ['BUTTON', 'INPUT', 'SELECT', 'A'].includes(document.activeElement?.tagName || ''))) fail(`${viewportLabel}: task control lost keyboard focus`);
      await sortSelect.focus();
      if (!await page.evaluate(() => document.activeElement?.getAttribute('aria-label') === '工具排序')) fail(`${viewportLabel}: sort control is not keyboard focusable`);
      if (viewport.width < 1024) {
        const filterButton = page.getByRole('button', { name: /^筛选/ });
        await assertTargetSize(filterButton, `${viewportLabel} filter button`);
        await filterButton.focus();
        await page.keyboard.press('Enter');
        if (!await page.getByRole('dialog').isVisible()) fail(`${viewportLabel}: filter drawer did not open from keyboard`);
        await page.keyboard.press('Escape');
        if (await page.getByRole('dialog').isVisible()) fail(`${viewportLabel}: filter drawer did not close with Escape`);
        if (!await filterButton.evaluate((element) => document.activeElement === element)) fail(`${viewportLabel}: filter drawer did not restore keyboard focus`);
      }
      await assertThemeToggle(page, `${viewportLabel} theme`);
    });
  }
}

async function main() {
  let browser;
  try {
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const diagnostics = monitorPage(page, 'primary flow');
    try {
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
    } finally {
      diagnostics.assertClean();
    }
  } finally {
    await browser?.close();
  }
  if (failures.length) {
    console.error(failures.join('\n'));
    process.exitCode = 1;
    return;
  }
  console.log('task-first UI guard passed');
}

main().catch((error) => {
  if (failures.length) console.error(failures.join('\n'));
  console.error(error);
  process.exitCode = 1;
});
