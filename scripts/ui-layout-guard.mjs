import { chromium } from 'playwright';

const url = process.env.UI_GUARD_URL || 'http://127.0.0.1:3001/';
const failures = [];

function fail(message) {
  failures.push(message);
}

async function getLayout(page) {
  return page.evaluate(() => {
    const box = selector => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return {
        display: style.display,
        height: Math.round(rect.height),
        position: style.position,
        top: Math.round(rect.top),
        visible: rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden',
        width: Math.round(rect.width),
        y: Math.round(rect.y),
      };
    };

    const visibleText = [...document.querySelectorAll('body *')]
      .filter(el => {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return rect.bottom > 0 && rect.top < innerHeight && rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      })
      .map(el => el.textContent.trim().replace(/\s+/g, ' '))
      .filter(Boolean)
      .slice(0, 30);

    return {
      boxes: {
        canvas: box('#particleCanvas'),
        categoryFilter: box('#categoryFilter'),
        hero: box('.hero'),
        main: box('main'),
        nav: box('nav'),
        search: box('#mainSearch'),
        suggestions: box('#searchSuggestions'),
      },
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      visibleText,
    };
  });
}

function checkFirstViewport(layout, label) {
  const { boxes } = layout;
  if (!boxes.nav || boxes.nav.top > 16) fail(`${label}: nav starts below first viewport top (${boxes.nav?.top})`);
  if (!boxes.hero || boxes.hero.top > 120) fail(`${label}: hero starts too low (${boxes.hero?.top})`);
  if (!layout.visibleText.some(text => /AI Tool Hub|发现最佳|搜索/.test(text))) {
    fail(`${label}: first viewport has no meaningful product text`);
  }
  if (!boxes.canvas || boxes.canvas.position !== 'fixed') fail(`${label}: particle canvas is not fixed`);
  if (label === 'desktop' && boxes.hero && boxes.hero.y + boxes.hero.height > layout.viewport.height) {
    fail(`${label}: hero consumes the full first viewport (${boxes.hero.y + boxes.hero.height} > ${layout.viewport.height})`);
  }
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const consoleIssues = [];
  page.on('console', msg => {
    if (['error', 'warning'].includes(msg.type())) consoleIssues.push(msg.text());
  });

  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(500);
  const desktop = await getLayout(page);
  checkFirstViewport(desktop, 'desktop');

  const search = page.locator('#mainSearch');
  await search.fill('ChatGPT');
  await page.waitForTimeout(300);
  const searchLayout = await getLayout(page);
  const statsBottom = await page.locator('.hero-stats').evaluate(el => Math.round(el.getBoundingClientRect().bottom));
  const suggestionsTop = await page.locator('#searchSuggestions').evaluate(el => Math.round(el.getBoundingClientRect().top));
  if (suggestionsTop < statsBottom) fail(`desktop search: suggestions overlap hero stats (${suggestionsTop} < ${statsBottom})`);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(500);
  const mobile = await getLayout(page);
  checkFirstViewport(mobile, 'mobile');
  if (mobile.horizontalOverflow) fail(`mobile: horizontal overflow (${mobile.scrollWidth} > ${mobile.viewport.width})`);

  if (consoleIssues.length > 0) fail(`console issues: ${consoleIssues.slice(0, 3).join(' | ')}`);

  await browser.close();

  if (failures.length > 0) {
    console.error(failures.join('\n'));
    process.exit(1);
  }

  console.log('ui layout guard passed');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
