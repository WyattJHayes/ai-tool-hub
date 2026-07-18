import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const HTML = pathToFileURL(path.join(ROOT, 'v4-preview.html')).href;
const OUT  = path.join(ROOT, 'v4-shots');
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.goto(HTML, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

await page.screenshot({ path: path.join(OUT, '00-full.png'), fullPage: true });
console.log('saved full');

const targets = [
  { name: '01-navbar',     sel: '.navbar' },
  { name: '02-hero',       sel: '#hero' },
  { name: '03-categories', sel: '#categories' },
  { name: '04-hot-tools',  sel: '#hot-tools' },
  { name: '05-stats',      sel: '#stats' },
  { name: '06-all-tools',  sel: '#all-tools' },
  { name: '07-footer',     sel: '#footer' },
];

for (const t of targets) {
  const el = await page.$(t.sel);
  if (!el) { console.log('MISSING', t.name, t.sel); continue; }
  await el.screenshot({ path: path.join(OUT, `${t.name}.png`) });
  console.log('saved', t.name);
}

await ctx.close();
const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
const mpage = await mctx.newPage();
await mpage.goto(HTML, { waitUntil: 'networkidle' });
await mpage.waitForTimeout(800);
await mpage.screenshot({ path: path.join(OUT, '08-mobile-full.png'), fullPage: true });
console.log('saved mobile');

await browser.close();
console.log('done');
