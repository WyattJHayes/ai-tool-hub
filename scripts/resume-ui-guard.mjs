import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { prepareQaDir } from './carbon-qa-path.mjs';

const baseUrl = process.env.RESUME_UI_URL || 'http://127.0.0.1:4181';
const qaDir = await prepareQaDir(process.env.RESUME_QA_DIR || '/tmp/resume-ui-qa');
const mockPort = Number(process.env.RESUME_MOCK_PORT || 4192);
const serverLog = process.env.RESUME_SERVER_LOG || '';
const privateSentinel = 'RESUME-PRIVATE-SENTINEL-11';
const jdSentinel = 'JD-PRIVATE-SENTINEL-11';
const aiSentinel = 'AI-PRIVATE-SENTINEL-11';
const allowedPrivateStorageKey = 'weihub-resume-v1';
const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const nextRequire = createRequire(path.join(rootDir, 'next-src/package.json'));
const { jsPDF } = nextRequire('jspdf');
const JSZip = nextRequire('jszip');
const sharp = nextRequire('sharp');

const viewports = [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
  { width: 320, height: 844 },
];
const themes = ['light', 'dark'];
const privateValues = [privateSentinel, jdSentinel, aiSentinel];
const responseDiagnostics = [];
const requestDiagnostics = [];
const consoleDiagnostics = [];
const externalMockState = {
  exhausted: false,
  quotaRemaining: 12,
  reservation: 0,
};

function jsonResponse(response, status, value, extraHeaders = {}) {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    'access-control-allow-origin': '*',
    'content-length': Buffer.byteLength(body),
    'content-type': 'application/json',
    ...extraHeaders,
  });
  response.end(body);
}

async function requestBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}

function userData(message, label) {
  const marker = `${label} (untrusted quoted data):\n`;
  const offset = message.indexOf(marker);
  if (offset < 0) return '';
  const line = message.slice(offset + marker.length).split('\n', 1)[0];
  try {
    return JSON.parse(line);
  } catch {
    return '';
  }
}

function fallbackDocument() {
  return {
    schemaVersion: 1,
    id: 'qa-resume-id',
    name: 'QA Resume',
    templateId: 'precision',
    profile: {
      id: 'qa-profile-id',
      fullName: 'QA Candidate',
      phone: '',
      email: '',
      location: '',
      title: 'Engineer',
    },
    target: 'Software Engineer',
    summary: 'Local resume summary',
    experience: [],
    projects: [],
    education: [],
    skills: ['TypeScript'],
    certificates: [],
    updatedAt: '2026-07-22T00:00:00.000Z',
  };
}

function sourceDocument(message) {
  try {
    return JSON.parse(userData(message, 'Resume'));
  } catch {
    return fallbackDocument();
  }
}

function completionFor(body) {
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const prompt = messages.map((message) => String(message?.content || '')).join('\n');
  if (prompt.includes('job-description analysis')) {
    return {
      jobTitle: 'QA Engineer',
      requiredSkills: ['TypeScript'],
      preferredSkills: ['Playwright'],
      experienceYears: 3,
      education: 'Bachelor',
      responsibilities: ['Ship reliable interfaces'],
      keywords: ['testing', 'accessibility'],
      industry: 'Software',
      companyType: 'Product',
      matchDifficulty: 'medium',
    };
  }

  const document = sourceDocument(prompt);
  const level = ['light', 'medium', 'deep'].find((entry) => prompt.includes(`level ${entry}`));
  if (!level) {
    return {
      ...document,
      summary: `${document.summary || 'Local resume summary'} [parsed]`,
      updatedAt: '2026-07-22T00:00:00.000Z',
    };
  }

  return {
    level,
    optimizedData: {
      ...document,
      summary: `${document.summary || 'Local resume summary'} [${level} optimized]`,
      updatedAt: '2026-07-22T00:00:00.000Z',
    },
    score: level === 'light' ? 82 : level === 'medium' ? 88 : 93,
    suggestions: [`${level} suggestion`, aiSentinel],
    jdMatch: level === 'light' ? 80 : 90,
    atsScore: level === 'deep' ? 94 : 86,
    brandPosition: 'Reliable product engineer',
    starApplications: 1,
    keywordsOptimized: 2,
    keywordsAdded: ['testing'],
    quantifiedItems: ['impact'],
    changes: [`${level} summary`],
  };
}

async function handleExternalMock(request, response) {
  const url = new URL(request.url || '/', `http://127.0.0.1:${mockPort}`);
  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    });
    response.end();
    return;
  }
  if (url.pathname === '/auth/v1/user') {
    jsonResponse(response, 200, { user: authSession().user });
    return;
  }
  if (url.pathname.endsWith('/rpc/reserve_resume_quota')) {
    await requestBody(request);
    if (externalMockState.exhausted) {
      jsonResponse(response, 400, { message: 'RESUME_QUOTA_EXHAUSTED' });
      return;
    }
    externalMockState.reservation += 1;
    externalMockState.quotaRemaining = Math.max(0, externalMockState.quotaRemaining - 1);
    jsonResponse(response, 200, [{
      ledger_id: `22222222-2222-4222-8222-${String(externalMockState.reservation).padStart(12, '0')}`,
      plan: 'free',
      remaining: externalMockState.quotaRemaining,
      total: 20,
      reset_at: '2026-07-22T16:00:00.000Z',
    }]);
    return;
  }
  if (url.pathname.endsWith('/rpc/settle_resume_quota') || url.pathname.endsWith('/rpc/compensate_resume_quota')) {
    await requestBody(request);
    jsonResponse(response, 200, { status: 'settled' });
    return;
  }
  if (url.pathname.endsWith('/resume_quota_accounts')) {
    jsonResponse(response, 200, [], { 'content-range': '*/0' });
    return;
  }
  if (url.pathname === '/chat/completions') {
    const body = await requestBody(request);
    const completion = completionFor(body);
    if (body.stream === true) {
      const content = JSON.stringify(completion);
      const streamBody = `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\ndata: [DONE]\n\n`;
      response.writeHead(200, {
        'cache-control': 'no-cache',
        'content-type': 'text/event-stream; charset=utf-8',
      });
      response.end(streamBody);
    } else {
      jsonResponse(response, 200, { choices: [{ message: { content: JSON.stringify(completion) } }] });
    }
    return;
  }
  jsonResponse(response, 404, { error: 'mock route not found' });
}

async function startExternalMock() {
  const server = createServer((request, response) => {
    void handleExternalMock(request, response).catch(() => jsonResponse(response, 500, { error: 'mock failure' }));
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(mockPort, '127.0.0.1', resolve);
  });
  return server;
}

function authSession() {
  const now = Math.floor(Date.now() / 1000);
  const user = {
    id: '11111111-1111-4111-8111-111111111111',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'qa@example.test',
    email_confirmed_at: '2026-07-22T00:00:00.000Z',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {},
    created_at: '2026-07-22T00:00:00.000Z',
  };
  return {
    access_token: 'qa-access-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: 'qa-refresh-token',
    user,
  };
}

async function routeBrowserSupabase(page) {
  await page.route(`http://127.0.0.1:${mockPort}/**`, async (route) => {
    const url = new URL(route.request().url());
    const headers = {
      'access-control-allow-origin': baseUrl,
      'access-control-allow-credentials': 'true',
      'content-type': 'application/json',
    };
    if (url.pathname.endsWith('/token')) {
      await route.fulfill({ status: 200, headers, body: JSON.stringify(authSession()) });
      return;
    }
    if (url.pathname.endsWith('/user')) {
      await route.fulfill({ status: 200, headers, body: JSON.stringify({ user: authSession().user }) });
      return;
    }
    if (url.pathname.includes('/rest/v1/')) {
      await route.fulfill({ status: 200, headers, body: '[]' });
      return;
    }
    await route.fulfill({ status: 200, headers, body: '{}' });
  });
}

function installFetchDiagnostics() {
  const nativeFetch = window.fetch;
  window.fetch = async function qaFetch(...args) {
    try {
      return await nativeFetch.apply(this, args);
    } catch (error) {
      console.error('QA fetch failed before a response', String(args[0]), error instanceof Error ? error.stack : String(error));
      throw error;
    }
  };
  window.addEventListener('unhandledrejection', (event) => {
    console.error('QA unhandled rejection', event.reason instanceof Error ? event.reason.stack : String(event.reason));
  });
}

async function createFixtures() {
  const fixtureDir = await prepareQaDir(path.join(qaDir, 'fixtures'));
  const resumeText = `${privateSentinel}\nqa@example.test\n\nExperience\nAcme | Engineer | 2023 - Present\nBuilt local-first tools.\n\nEducation\nExample University | Computer Science | Bachelor | 2018 - 2022\n\nSkills\nTypeScript, Playwright`;
  const fixtures = {
    txt: path.join(fixtureDir, 'resume-private.txt'),
    html: path.join(fixtureDir, 'resume-private.html'),
    md: path.join(fixtureDir, 'resume-private.md'),
    pdf: path.join(fixtureDir, 'resume-private.pdf'),
    docx: path.join(fixtureDir, 'resume-private.docx'),
  };
  await writeFile(fixtures.txt, resumeText);
  await writeFile(fixtures.html, `<main><h1>${privateSentinel}</h1><p>qa@example.test</p><h2>Skills</h2><p>TypeScript, Playwright</p></main>`);
  await writeFile(fixtures.md, `# ${privateSentinel}\n\nqa@example.test\n\n## Skills\nTypeScript, Playwright`);

  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  pdf.text(privateSentinel, 48, 72);
  pdf.text('qa@example.test', 48, 96);
  pdf.text('Skills', 48, 132);
  pdf.text('TypeScript, Playwright', 48, 156);
  await writeFile(fixtures.pdf, Buffer.from(pdf.output('arraybuffer')));

  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.folder('_rels').file('.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.folder('word').file('document.xml', `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${privateSentinel}</w:t></w:r></w:p><w:p><w:r><w:t>qa@example.test</w:t></w:r></w:p><w:p><w:r><w:t>Skills</w:t></w:r></w:p><w:p><w:r><w:t>TypeScript, Playwright</w:t></w:r></w:p></w:body></w:document>`);
  await writeFile(fixtures.docx, await zip.generateAsync({ type: 'nodebuffer' }));
  return fixtures;
}

function seedResumeDocument() {
  return {
    ...fallbackDocument(),
    name: 'QA Private Resume',
    profile: { ...fallbackDocument().profile, fullName: privateSentinel },
    summary: privateSentinel,
  };
}

function storageSeed({ theme, document = seedResumeDocument() }) {
  localStorage.setItem('ai-tool-hub-user', JSON.stringify({ state: { theme }, version: 0 }));
  localStorage.setItem('weihub-resume-v1', JSON.stringify({ state: { document }, version: 0 }));
}

function containsPrivateText(value) {
  return privateValues.some((sentinel) => String(value).includes(sentinel));
}

async function assertPageIdentity(page, label) {
  assert.ok(['/resume', '/resume/'].includes(new URL(page.url()).pathname), `${label}: wrong route`);
  assert.match(await page.title(), /AI 简历优化/, `${label}: wrong title`);
  const identity = await page.evaluate(() => ({
    bodyLength: document.body.innerText.trim().length,
    hasMain: document.querySelectorAll('main').length,
    overlay: document.querySelectorAll('nextjs-portal').length,
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: innerWidth,
  }));
  assert.ok(identity.bodyLength > 100, `${label}: blank page`);
  assert.equal(identity.hasMain, 1, `${label}: missing unique main landmark`);
  assert.equal(identity.overlay, 0, `${label}: framework overlay present`);
  assert.ok(identity.scrollWidth <= identity.viewportWidth, `${label}: horizontal overflow ${identity.scrollWidth} > ${identity.viewportWidth}`);
}

async function assertVisibleControlGeometry(page, label) {
  const result = await page.evaluate(() => {
    const selector = '.resume-page button, .resume-page a, .resume-page input, .resume-page textarea, .resume-page select';
    const visible = [...document.querySelectorAll(selector)].flatMap((element, index) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      if (style.display === 'none' || style.visibility === 'hidden' || rect.width <= 0 || rect.height <= 0) return [];
      if (rect.bottom <= 0 || rect.top >= innerHeight || rect.right <= 0 || rect.left >= innerWidth) return [];
      return [{
        index,
        tag: element.tagName,
        name: element.getAttribute('aria-label') || element.textContent?.trim().slice(0, 40) || element.getAttribute('name') || '',
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      }];
    });
    const overlaps = [];
    for (let left = 0; left < visible.length; left += 1) {
      for (let right = left + 1; right < visible.length; right += 1) {
        const a = visible[left];
        const b = visible[right];
        const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (x > 1 && y > 1) overlaps.push([a.name, b.name]);
      }
    }
    const undersized = visible.filter((item) => ['BUTTON', 'A'].includes(item.tag) && (item.width < 44 || item.height < 44));
    return { overlaps: overlaps.slice(0, 5), undersized: undersized.slice(0, 5) };
  });
  assert.deepEqual(result.overlaps, [], `${label}: visible controls overlap: ${JSON.stringify(result.overlaps)}`);
  assert.deepEqual(result.undersized, [], `${label}: controls below 44px: ${JSON.stringify(result.undersized)}`);
}

async function assertA4Pixels(page, label) {
  const paper = page.locator('[data-resume-page]');
  assert.equal(await paper.count(), 1, `${label}: missing A4 page`);
  const png = await paper.screenshot();
  const stats = await sharp(png).stats();
  const channels = stats.channels.slice(0, 3);
  assert.ok(png.length > 2_000, `${label}: A4 screenshot is unexpectedly small`);
  assert.ok(channels.some((channel) => channel.min !== channel.max), `${label}: A4 has no nonzero pixel variation`);
}

async function assertAccessibility(page, label) {
  const result = await page.evaluate(() => {
    const controls = [...document.querySelectorAll('.resume-page input, .resume-page textarea, .resume-page select')]
      .filter((element) => getComputedStyle(element).display !== 'none' && element.getClientRects().length)
      .map((element) => {
        const id = element.id;
        const explicit = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent?.trim() : '';
        return element.getAttribute('aria-label') || explicit || element.closest('label')?.textContent?.trim() || '';
      });
    const dialogNames = [...document.querySelectorAll('[role="dialog"]')].map((dialog) => {
      const labelledBy = dialog.getAttribute('aria-labelledby');
      return dialog.getAttribute('aria-label') || (labelledBy ? document.getElementById(labelledBy)?.textContent?.trim() : '');
    });
    return { controls, dialogNames };
  });
  assert.ok(result.controls.every(Boolean), `${label}: unnamed form control`);
  assert.equal(new Set(result.controls).size, result.controls.length, `${label}: duplicate visible form labels`);
  assert.ok(result.dialogNames.every(Boolean), `${label}: unnamed dialog`);

  await page.locator('body').press('Tab');
  const focus = await page.evaluate(() => {
    const element = document.activeElement;
    if (!(element instanceof HTMLElement)) return null;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return {
      tag: element.tagName,
      visible: rect.width > 0 && rect.height > 0,
      indicator: style.outlineStyle !== 'none' || style.boxShadow !== 'none' || style.borderColor !== 'rgba(0, 0, 0, 0)',
    };
  });
  assert.ok(focus?.visible && focus.indicator, `${label}: keyboard focus is not visibly rendered`);
}

async function assertLastEditorActionVisible(page, label) {
  const actions = page.locator('.resume-editor button, .resume-editor input, .resume-editor textarea');
  const count = await actions.count();
  assert.ok(count > 0, `${label}: editor actions missing`);
  const last = actions.nth(count - 1);
  await last.scrollIntoViewIfNeeded();
  const geometry = await last.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const fixed = [...document.querySelectorAll('.resume-mobile-action, nav[aria-label="移动端导航"]')]
      .filter((candidate) => getComputedStyle(candidate).position === 'fixed' && getComputedStyle(candidate).display !== 'none')
      .map((candidate) => candidate.getBoundingClientRect().top);
    return { bottom: rect.bottom, fixedTop: fixed.length ? Math.min(...fixed) : innerHeight };
  });
  assert.ok(geometry.bottom <= geometry.fixedTop + 1, `${label}: fixed UI covers the last editor action`);
}

async function importFixture(page, fixturePath, commit = false) {
  await page.getByRole('button', { name: '导入', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '导入简历' });
  await dialog.waitFor();
  await dialog.locator('input[type="file"]').setInputFiles(fixturePath);
  await dialog.getByText(path.basename(fixturePath), { exact: true }).waitFor({ timeout: 15_000 });
  if (commit) {
    await dialog.getByRole('button', { name: '替换', exact: true }).click();
    await page.getByText('简历已导入', { exact: true }).waitFor();
  } else {
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
  }
}

async function waitForReview(page) {
  try {
    await page.getByText('修改审阅', { exact: true }).waitFor({ timeout: 20_000 });
  } catch (error) {
    const state = await page.evaluate(() => ({
      progress: document.querySelector('.resume-ai-progress')?.textContent?.trim(),
      errors: [...document.querySelectorAll('.resume-inline-error')].map((element) => element.textContent?.trim()),
      authenticated: !document.querySelector('[role="dialog"]#auth-title'),
      authStorage: Object.fromEntries(Object.keys(localStorage)
        .filter((key) => key.startsWith('sb-'))
        .map((key) => [key, Boolean(localStorage.getItem(key))])),
    }));
    throw new Error(`AI review did not open: ${JSON.stringify({
      ...state,
      requests: requestDiagnostics.slice(-5),
      responses: responseDiagnostics.slice(-5),
      console: consoleDiagnostics.slice(-5),
    })}`, { cause: error });
  }
}

async function exerciseAnonymousFlow(page, fixtures) {
  await page.goto(`${baseUrl}/resume/`, { waitUntil: 'networkidle' });
  await assertPageIdentity(page, 'anonymous resume');
  await page.getByLabel('姓名', { exact: true }).fill(privateSentinel);
  await page.getByLabel('总结', { exact: true }).fill(privateSentinel);
  await page.getByLabel('简历名称', { exact: true }).fill('Private QA Resume');
  await page.getByText('已保存', { exact: true }).waitFor();
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.getByLabel('姓名', { exact: true }).inputValue(), privateSentinel, 'anonymous edit was not restored after refresh');

  await importFixture(page, fixtures.txt, true);
  await page.getByRole('button', { name: '撤销导入', exact: true }).click();
  assert.equal(await page.getByLabel('姓名', { exact: true }).inputValue(), privateSentinel, 'import undo did not restore the anonymous edit');
  for (const fixture of [fixtures.html, fixtures.md, fixtures.pdf, fixtures.docx]) {
    await importFixture(page, fixture);
  }

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PDF', exact: true }).click();
  const download = await downloadPromise;
  const pdfPath = path.join(qaDir, 'resume-export.pdf');
  await download.saveAs(pdfPath);
  const pdfBytes = await readFile(pdfPath);
  assert.ok(pdfBytes.length > 1_000 && pdfBytes.subarray(0, 4).toString() === '%PDF', 'generated PDF is blank or invalid');
  await assertA4Pixels(page, 'anonymous PDF preview');
}

async function exerciseAuthAiAndPayment(page, evidence) {
  await page.getByLabel('职位描述（JD）', { exact: true }).fill(`${jdSentinel} TypeScript Playwright`);
  await page.getByRole('button', { name: /轻度优化/ }).click();
  let authDialog = page.getByRole('dialog', { name: '登录' });
  await authDialog.waitFor();
  await authDialog.getByText('登录后继续本次 AI 操作', { exact: true }).waitFor();
  await page.keyboard.press('Escape');
  await authDialog.waitFor({ state: 'hidden' });

  await page.getByRole('button', { name: /轻度优化/ }).click();
  authDialog = page.getByRole('dialog', { name: '登录' });
  await authDialog.waitFor();
  await authDialog.getByLabel('邮箱', { exact: true }).fill('qa@example.test');
  await authDialog.getByLabel('密码', { exact: true }).fill('qa-password-11');
  await authDialog.getByRole('button', { name: '登录', exact: true }).click();
  await waitForReview(page);
  await authDialog.waitFor({ state: 'hidden' });

  await page.getByRole('button', { name: '全部接受', exact: true }).click();
  await page.getByRole('button', { name: '撤销 AI 修改', exact: true }).click();
  await waitForReview(page);
  await page.getByRole('button', { name: '关闭修改审阅', exact: true }).click();

  for (const level of ['中度优化', '深度优化']) {
    await page.getByRole('button', { name: new RegExp(level) }).click();
    await waitForReview(page);
    await page.getByRole('button', { name: '关闭修改审阅', exact: true }).click();
  }

  await page.getByRole('button', { name: /AI 解析当前简历/ }).click();
  await waitForReview(page);
  await page.getByRole('button', { name: '关闭修改审阅', exact: true }).click();
  await page.getByRole('button', { name: /分析 JD/ }).click();
  await page.getByText(/已识别岗位：QA Engineer/).waitFor({ timeout: 20_000 });

  externalMockState.exhausted = true;
  await page.getByRole('button', { name: /轻度优化/ }).click();
  await page.getByText('当前额度不足，请查看配额。', { exact: true }).waitFor({ timeout: 20_000 });

  const quotaButton = page.getByRole('button', { name: /查看配额/ });
  await quotaButton.click();
  const drawer = page.getByRole('dialog', { name: '配额与会员' });
  await drawer.waitFor();
  await drawer.getByText('支付渠道尚未通过生产校验，购买暂不可用。', { exact: true }).waitFor();
  assert.equal(await drawer.getByRole('radio', { name: /基础会员/ }).isDisabled(), true, 'Basic purchase must stay disabled');
  assert.equal(await drawer.getByRole('radio', { name: /永久 VIP/ }).isDisabled(), true, 'VIP purchase must stay disabled');
  assert.equal(await drawer.getByRole('button', { name: '确认购买', exact: true }).isDisabled(), true, 'purchase confirmation must stay disabled');
  await page.keyboard.press('Escape');
  await drawer.waitFor({ state: 'hidden' });
  assert.equal(evidence.orderRequests.length, 0, `disabled payment unexpectedly requested ${evidence.orderRequests.join(', ')}`);
  const accountResponses = await page.evaluate(async (paths) => Promise.all(paths.map(async (requestPath) => {
    const response = await fetch(requestPath);
    return { url: response.url, status: response.status, body: await response.text() };
  })), ['/api/resume/quota', '/api/resume/plans']);
  for (const response of accountResponses) {
    evidence.quotaOrderBodies.push(response);
    if (response.status >= 400) evidence.apiErrorBodies.push(response);
  }
}

async function exerciseNavigationAndSearch(page) {
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '按任务找到合适的 AI 工具', exact: true }).waitFor();
  assert.ok(await page.locator('a[href="/resume"], a[href="/resume/"]').count() >= 1, 'resume navigation entry is missing');
  await page.waitForFunction(() => {
    const form = document.querySelector('form[role="search"]');
    return form ? Object.keys(form).some((key) => key.startsWith('__reactProps$')) : false;
  });
  const search = page.getByRole('combobox', { name: '搜索工具、任务或能力', exact: true });
  await search.fill('简历');
  await Promise.all([
    page.waitForURL((url) => url.pathname === '/tools' && url.searchParams.get('q') === '简历'),
    search.press('Enter'),
  ]);
  const directorySearch = page.getByRole('combobox', { name: '搜索工具、任务或能力', exact: true });
  assert.equal(await directorySearch.inputValue(), '简历', 'search term was not preserved on the tools page');
  await page.locator('main').getByText('1 款工具', { exact: true }).waitFor();

  for (const legacy of ['/tools/resume-optimizer', '/tools/resume-optimizer/']) {
    await page.goto(`${baseUrl}${legacy}`, { waitUntil: 'domcontentloaded' });
    await page.locator('.resume-page').waitFor();
    assert.ok(['/resume', '/resume/'].includes(new URL(page.url()).pathname), `${legacy} did not redirect to /resume/`);
  }
}

async function assertViewport(browser, viewport, theme) {
  const label = `${viewport.width}x${viewport.height}-${theme}`;
  const context = await browser.newContext({
    viewport,
    colorScheme: theme,
    reducedMotion: 'reduce',
    bypassCSP: true,
  });
  await context.addInitScript(storageSeed, { theme, document: seedResumeDocument() });
  const page = await context.newPage();
  await routeBrowserSupabase(page);
  try {
    await page.goto(`${baseUrl}/resume/`, { waitUntil: 'networkidle' });
    await assertPageIdentity(page, label);
    const root = await page.evaluate(() => ({
      dark: document.documentElement.classList.contains('dark'),
      scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
      animationDuration: getComputedStyle(document.querySelector('.resume-page')).animationDuration,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    }));
    assert.equal(root.dark, theme === 'dark', `${label}: theme mismatch`);
    assert.equal(root.scrollBehavior, 'auto', `${label}: reduced motion did not disable smooth scrolling`);
    assert.equal(root.reducedMotion, true, `${label}: prefers-reduced-motion is not active`);
    assert.ok(Number.parseFloat(root.animationDuration) <= 0.00001, `${label}: reduced-motion duration is ${root.animationDuration}`);

    if (viewport.width < 768) {
      const name = page.getByLabel('姓名', { exact: true });
      await name.fill(`${privateSentinel}-MOBILE`);
      const preview = page.getByRole('button', { name: '预览', exact: true });
      await preview.press('Enter');
      await page.getByText(`${privateSentinel}-MOBILE`, { exact: true }).waitFor();
      await assertA4Pixels(page, `${label} A4`);
      const edit = page.getByRole('button', { name: '编辑', exact: true });
      await edit.press('Enter');
      assert.equal(await name.inputValue(), `${privateSentinel}-MOBILE`, `${label}: mobile switching lost content`);
      await assertLastEditorActionVisible(page, label);
    } else {
      await assertA4Pixels(page, `${label} A4`);
    }
    await page.evaluate(() => scrollTo(0, 0));
    await assertVisibleControlGeometry(page, label);
    await assertAccessibility(page, label);
    await page.screenshot({ path: path.join(qaDir, `${label}.png`), fullPage: false });
  } finally {
    await context.close();
  }
}

async function assertPrivacy(page, evidence) {
  for (const issue of evidence.consoleIssues) {
    assert.equal(containsPrivateText(issue), false, `console leaked private text: ${issue}`);
  }
  for (const entry of evidence.apiErrorBodies) {
    assert.equal(containsPrivateText(entry.body), false, `${entry.url} response leaked private text`);
  }
  for (const entry of evidence.telemetryRequests) {
    assert.equal(containsPrivateText(`${entry.url}\n${entry.body}`), false, `${entry.url} telemetry leaked private text`);
  }
  for (const entry of evidence.quotaOrderBodies) {
    assert.equal(containsPrivateText(entry.body), false, `${entry.url} quota/order response leaked private text`);
  }
  const storage = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map((key) => [key, localStorage.getItem(key)])));
  for (const [key, value] of Object.entries(storage)) {
    if (key !== allowedPrivateStorageKey) {
      assert.equal(containsPrivateText(value), false, `localStorage key ${key} leaked private text`);
    }
  }
  if (serverLog) {
    const log = await readFile(serverLog, 'utf8').catch(() => '');
    assert.equal(containsPrivateText(log), false, 'Next server log leaked private text');
  }
}

const fixtures = await createFixtures();
const externalServer = await startExternalMock();
const browser = await chromium.launch({ headless: true });
let exitCode = 0;

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', bypassCSP: true });
  const page = await context.newPage();
  await page.addInitScript(installFetchDiagnostics);
  await routeBrowserSupabase(page);
  const evidence = {
    apiErrorBodies: [],
    consoleIssues: [],
    orderRequests: [],
    quotaOrderBodies: [],
    telemetryRequests: [],
  };
  page.on('console', (message) => {
    if (!['error', 'warning'].includes(message.type())) return;
    consoleDiagnostics.push({ type: message.type(), text: message.text(), url: message.location().url || '' });
    const location = message.location().url || '';
    if (location.includes('/api/resume/plans')) return;
    evidence.consoleIssues.push(message.text());
  });
  page.on('request', (request) => {
    const url = request.url();
    const pathname = new URL(url).pathname;
    if (pathname.startsWith('/api/resume/')) requestDiagnostics.push({ method: request.method(), url });
    if (/\/api\/resume\/(?:orders|payment)/.test(pathname)) evidence.orderRequests.push(url);
    if (/sentry|analytics|telemetry|collect/i.test(url)) {
      evidence.telemetryRequests.push({ url, body: request.postData() || '' });
    }
  });
  page.on('response', (response) => {
    const url = response.url();
    const pathname = new URL(url).pathname;
    if (!pathname.startsWith('/api/')) return;
    if (pathname.startsWith('/api/resume/')) responseDiagnostics.push({ url, status: response.status() });
  });

  try {
    await exerciseAnonymousFlow(page, fixtures);
    await exerciseAuthAiAndPayment(page, evidence);
    await assertPrivacy(page, evidence);
    await exerciseNavigationAndSearch(page);
  } finally {
    await context.close();
  }

  for (const viewport of viewports) {
    for (const theme of themes) await assertViewport(browser, viewport, theme);
  }
  console.log(`resume UI guard passed; evidence: ${qaDir}`);
} catch (error) {
  exitCode = 1;
  console.error(error instanceof Error ? error.stack : error);
} finally {
  await browser.close();
  await new Promise((resolve) => externalServer.close(resolve));
}

process.exitCode = exitCode;
