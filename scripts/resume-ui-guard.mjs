import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { prepareQaDir } from './carbon-qa-path.mjs';

const baseUrl = process.env.RESUME_UI_URL || 'http://127.0.0.1:4181';
const qaDir = await prepareQaDir(process.env.RESUME_QA_DIR || '/tmp/resume-ui-qa');
const mockPort = Number(process.env.RESUME_MOCK_PORT || 4192);
const serverLog = process.env.RESUME_SERVER_LOG || '';
const privateSentinel = 'RESUME-PRIVATE-SENTINEL-11';
const jdSentinel = 'JD-PRIVATE-SENTINEL-11';
const aiSentinel = 'AI-PRIVATE-SENTINEL-11';
const fixtureMarkers = {
  txt: 'TXT-PRIVATE-SENTINEL-11',
  html: 'HTML-PRIVATE-SENTINEL-11',
  md: 'MARKDOWN-PRIVATE-SENTINEL-11',
  pdf: 'PDF-PRIVATE-SENTINEL-11',
  docx: 'DOCX-PRIVATE-SENTINEL-11',
};
const allowedPrivateStorageKey = 'weihub-resume-v1';
const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const nextRequire = createRequire(path.join(rootDir, 'next-src/package.json'));
const { jsPDF } = nextRequire('jspdf');
const JSZip = nextRequire('jszip');
const sharp = nextRequire('sharp');
const { createCanvas } = nextRequire('@napi-rs/canvas');
const pdfJsModule = import(pathToFileURL(nextRequire.resolve('pdfjs-dist/legacy/build/pdf.mjs')).href);

const viewports = [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
  { width: 320, height: 844 },
];
const themes = ['light', 'dark'];
const privateValues = [privateSentinel, jdSentinel, aiSentinel, ...Object.values(fixtureMarkers)];
const responseDiagnostics = [];
const requestDiagnostics = [];
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
  window.__resumeQaEvidence = { captureFailures: [], pending: 0, responses: [] };
  window.fetch = async function qaFetch(...args) {
    try {
      const response = await nativeFetch.apply(this, args);
      const url = response.url;
      const pathname = new URL(url).pathname;
      const finiteAccountResponse = /\/api\/resume\/(?:quota|plans|orders|payment)/.test(pathname);
      if ((pathname.startsWith('/api/') && response.status >= 400) || finiteAccountResponse) {
        window.__resumeQaEvidence.pending += 1;
        void response.clone().text()
          .then((body) => window.__resumeQaEvidence.responses.push({
            body,
            channel: response.status >= 400 ? 'api-error-response' : 'quota-order-response',
            status: response.status,
            url,
          }))
          .catch(() => window.__resumeQaEvidence.captureFailures.push({ status: response.status, url }))
          .finally(() => { window.__resumeQaEvidence.pending -= 1; });
      }
      return response;
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
  const resumeText = (marker) => `${marker}\nqa@example.test\n\nExperience\nAcme | Engineer | 2023 - Present\nBuilt local-first tools.\n\nEducation\nExample University | Computer Science | Bachelor | 2018 - 2022\n\nSkills\nTypeScript, Playwright`;
  const fixtures = {
    txt: { kind: 'TXT', marker: fixtureMarkers.txt, path: path.join(fixtureDir, 'resume-private.txt') },
    html: { kind: 'HTML', marker: fixtureMarkers.html, path: path.join(fixtureDir, 'resume-private.html') },
    md: { kind: 'Markdown', marker: fixtureMarkers.md, path: path.join(fixtureDir, 'resume-private.md') },
    pdf: { kind: 'PDF', marker: fixtureMarkers.pdf, path: path.join(fixtureDir, 'resume-private.pdf') },
    docx: { kind: 'DOCX', marker: fixtureMarkers.docx, path: path.join(fixtureDir, 'resume-private.docx') },
  };
  await writeFile(fixtures.txt.path, resumeText(fixtures.txt.marker));
  await writeFile(fixtures.html.path, `<main>\n${fixtures.html.marker}\nqa@example.test\n<h2>Experience</h2>\nAcme | Engineer | 2023 - Present\nBuilt local-first tools.\n<h2>Education</h2>\nExample University | Computer Science | Bachelor | 2018 - 2022\n<h2>Skills</h2>\nTypeScript, Playwright\n</main>`);
  await writeFile(fixtures.md.path, `# ${fixtures.md.marker}\n\nqa@example.test\n\n## Experience\nAcme | Engineer | 2023 - Present\nBuilt local-first tools.\n\n## Education\nExample University | Computer Science | Bachelor | 2018 - 2022\n\n## Skills\nTypeScript, Playwright`);

  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  pdf.text(fixtures.pdf.marker, 48, 72);
  await writeFile(fixtures.pdf.path, Buffer.from(pdf.output('arraybuffer')));

  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.folder('_rels').file('.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.folder('word').file('document.xml', `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${fixtures.docx.marker}</w:t></w:r></w:p><w:p><w:r><w:t>qa@example.test</w:t></w:r></w:p><w:p><w:r><w:t>Skills</w:t></w:r></w:p><w:p><w:r><w:t>TypeScript, Playwright</w:t></w:r></w:p></w:body></w:document>`);
  await writeFile(fixtures.docx.path, await zip.generateAsync({ type: 'nodebuffer' }));
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

function privateDiagnosticId(value) {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 12);
}

function redactPrivateText(value) {
  let redacted = String(value);
  for (const privateValue of privateValues) {
    redacted = redacted.replaceAll(privateValue, `[redacted:${privateDiagnosticId(privateValue)}]`);
  }
  return redacted;
}

function safeJson(value) {
  return redactPrivateText(JSON.stringify(value));
}

function assertPrivateFree(channel, value, { url = '', status = 0 } = {}) {
  if (!containsPrivateText(value)) return;
  const safeUrl = redactPrivateText(url || '-');
  throw new Error(`privacy violation channel=${channel} url=${safeUrl} status=${status || '-'} id=${privateDiagnosticId(value)}`);
}

function createEvidence() {
  return {
    captureFailures: [],
    consoleEntries: [],
    orderRequests: [],
    responseBodies: [],
    storageSnapshots: [],
    telemetryRequests: [],
  };
}

function attachEvidence(page, evidence) {
  page.on('console', (message) => {
    const entry = {
      channel: `console:${message.type()}`,
      text: message.text(),
      url: message.location().url || '',
    };
    evidence.consoleEntries.push(entry);
  });
  page.on('request', (request) => {
    const url = request.url();
    const pathname = new URL(url).pathname;
    if (pathname.startsWith('/api/resume/')) requestDiagnostics.push({ method: request.method(), url });
    if (/\/api\/resume\/(?:orders|payment)/.test(pathname)) evidence.orderRequests.push(url);
    if (/sentry|analytics|telemetry|collect/i.test(url)) {
      evidence.telemetryRequests.push({ body: request.postData() || '', url });
    }
  });
  page.on('response', (response) => {
    const url = response.url();
    const pathname = new URL(url).pathname;
    const status = response.status();
    if (pathname.startsWith('/api/resume/')) responseDiagnostics.push({ url, status });
  });
}

async function flushEvidence(page, evidence) {
  await page.waitForFunction(() => !window.__resumeQaEvidence || window.__resumeQaEvidence.pending === 0);
  const captured = await page.evaluate(() => {
    if (!window.__resumeQaEvidence) return { captureFailures: [], responses: [] };
    return {
      captureFailures: window.__resumeQaEvidence.captureFailures.splice(0),
      responses: window.__resumeQaEvidence.responses.splice(0),
    };
  });
  evidence.responseBodies.push(...captured.responses);
  evidence.captureFailures.push(...captured.captureFailures.map((entry) => ({
    channel: 'response-body-capture',
    id: privateDiagnosticId(`${entry.status}:${entry.url}`),
    status: entry.status,
    url: redactPrivateText(entry.url),
  })));
}

async function captureStorage(page, evidence, label) {
  const entries = await page.evaluate(() => Object.fromEntries(
    Object.keys(localStorage).map((key) => [key, localStorage.getItem(key)]),
  ));
  evidence.storageSnapshots.push({ entries, label });
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
    const undersized = visible.filter((item) => (
      ['BUTTON', 'A', 'INPUT', 'TEXTAREA', 'SELECT'].includes(item.tag)
      && (item.width < 44 || item.height < 44)
    ));
    return { overlaps: overlaps.slice(0, 5), undersized: undersized.slice(0, 5) };
  });
  assert.deepEqual(result.overlaps, [], `${label}: visible controls overlap: ${safeJson(result.overlaps)}`);
  assert.deepEqual(result.undersized, [], `${label}: controls below 44px: ${safeJson(result.undersized)}`);
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

function focusVisualSignature(style) {
  return [
    style.outlineColor,
    style.outlineOffset,
    style.outlineStyle,
    style.outlineWidth,
    style.boxShadow,
    style.borderColor,
    style.backgroundColor,
  ].join('|');
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

  await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
  let focus = null;
  for (let attempt = 0; attempt < 40 && !focus; attempt += 1) {
    await page.keyboard.press('Tab');
    focus = await page.evaluate(() => {
      const element = document.activeElement;
      if (!(element instanceof HTMLElement) || !element.closest('.resume-page')) return null;
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      const signature = () => {
        const style = getComputedStyle(element);
        return {
          backgroundColor: style.backgroundColor,
          borderColor: style.borderColor,
          boxShadow: style.boxShadow,
          outlineColor: style.outlineColor,
          outlineOffset: style.outlineOffset,
          outlineStyle: style.outlineStyle,
          outlineWidth: style.outlineWidth,
        };
      };
      const focused = signature();
      element.blur();
      const blurred = signature();
      element.focus();
      return { blurred, focused, tag: element.tagName, visible: true };
    });
  }
  assert.ok(focus?.visible, `${label}: keyboard focus did not reach a visible resume control`);
  assert.notEqual(
    focusVisualSignature(focus.focused),
    focusVisualSignature(focus.blurred),
    `${label}: focused control has no visual change from its blurred state`,
  );
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

async function importFixture(page, fixture) {
  await page.getByRole('button', { name: '导入', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '导入简历' });
  await dialog.waitFor();
  await dialog.locator('input[type="file"]').setInputFiles(fixture.path);
  await dialog.getByText(path.basename(fixture.path), { exact: true }).waitFor({ timeout: 15_000 });
  await dialog.getByRole('button', { name: '替换', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
}

async function assertDocumentMarker(page, marker, label) {
  await page.waitForFunction(
    ({ key, expected }) => (
      [...document.querySelectorAll('input')].some((input) => input.value.includes(expected))
      && (document.querySelector('[data-resume-page]')?.textContent || '').includes(expected)
      && (localStorage.getItem(key) || '').includes(expected)
    ),
    { expected: marker, key: allowedPrivateStorageKey },
  );
  const editorContainsMarker = (await page.getByLabel('姓名', { exact: true }).inputValue()).includes(marker);
  const previewContainsMarker = await page.locator('[data-resume-page]').evaluate(
    (element, expected) => (element.textContent || '').includes(expected),
    marker,
  );
  const storageContainsMarker = await page.evaluate(
    ({ key, expected }) => (localStorage.getItem(key) || '').includes(expected),
    { expected: marker, key: allowedPrivateStorageKey },
  );
  assert.equal(editorContainsMarker, true, `${label}: editor did not contain expected imported content`);
  assert.equal(previewContainsMarker, true, `${label}: workspace preview did not contain expected imported content`);
  assert.equal(storageContainsMarker, true, `${label}: imported content was not persisted`);
}

async function exerciseCommittedImports(page, fixtures) {
  for (const fixture of Object.values(fixtures)) {
    await importFixture(page, fixture);
    try {
      await page.waitForFunction(
        ({ key, marker }) => (localStorage.getItem(key) || '').includes(marker),
        { key: allowedPrivateStorageKey, marker: fixture.marker },
      );
    } catch (error) {
      const state = await page.evaluate(
        ({ key, marker }) => ({
          editor: [...document.querySelectorAll('input')].some((input) => input.value.includes(marker)),
          preview: (document.querySelector('[data-resume-page]')?.textContent || '').includes(marker),
          storage: (localStorage.getItem(key) || '').includes(marker),
        }),
        { key: allowedPrivateStorageKey, marker: fixture.marker },
      );
      throw new Error(`${fixture.kind} import persistence timeout state=${safeJson(state)} id=${privateDiagnosticId(fixture.marker)}`, { cause: error });
    }
    await assertDocumentMarker(page, fixture.marker, `${fixture.kind} import`);

    await page.getByRole('button', { name: '撤销导入', exact: true }).click();
    await page.waitForFunction(
      ({ key, marker }) => (localStorage.getItem(key) || '').includes(marker),
      { key: allowedPrivateStorageKey, marker: privateSentinel },
    );
    await assertDocumentMarker(page, privateSentinel, `${fixture.kind} undo`);
    await page.reload({ waitUntil: 'networkidle' });
    await assertDocumentMarker(page, privateSentinel, `${fixture.kind} restored persistence`);
  }
}

async function grayscaleSample(input) {
  return sharp(input)
    .flatten({ background: '#ffffff' })
    .resize(180, 255, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer();
}

function inkProfile(sample, width, height) {
  const rows = Array.from({ length: height }, () => 0);
  const columns = Array.from({ length: width }, () => 0);
  let count = 0;
  for (let index = 0; index < sample.length; index += 1) {
    if (sample[index] >= 245) continue;
    const row = Math.floor(index / width);
    const column = index % width;
    rows[row] += 1;
    columns[column] += 1;
    count += 1;
  }
  return { columns, count, rows };
}

function normalizedProfileDifference(left, right, scale) {
  return left.reduce((total, value, index) => total + Math.abs(value - right[index]) / scale, 0) / left.length;
}

async function renderDownloadedPdf(pdfPath, sourcePngPath) {
  const pdfBytes = await readFile(pdfPath);
  assert.equal(pdfBytes.length > 1_000 && pdfBytes.subarray(0, 4).toString() === '%PDF', true, 'generated PDF is blank or invalid');
  const pdfjs = await pdfJsModule;
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(pdfBytes), disableWorker: true });
  try {
    const document = await loadingTask.promise;
    assert.equal(document.numPages, 1, 'generated PDF must contain exactly one A4 page');
    const pdfPage = await document.getPage(1);
    const pointWidth = Math.abs(pdfPage.view[2] - pdfPage.view[0]);
    const pointHeight = Math.abs(pdfPage.view[3] - pdfPage.view[1]);
    assert.equal(Math.abs(pointWidth - 595.28) < 1 && Math.abs(pointHeight - 841.89) < 1, true, 'generated PDF page is not A4');

    const viewport = pdfPage.getViewport({ scale: 2 });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    await pdfPage.render({ canvas, viewport, background: 'rgb(255,255,255)' }).promise;
    const renderedPng = canvas.toBuffer('image/png');
    const renderedPath = path.join(qaDir, 'resume-export-page.png');
    await writeFile(renderedPath, renderedPng);

    const stats = await sharp(renderedPng).stats();
    assert.equal(stats.channels.slice(0, 3).some((channel) => channel.min !== channel.max), true, 'rendered PDF page has no pixel variation');

    const [sourceSample, renderedSample] = await Promise.all([
      grayscaleSample(sourcePngPath),
      grayscaleSample(renderedPng),
    ]);
    const sourceInk = inkProfile(sourceSample, 180, 255);
    const renderedInk = inkProfile(renderedSample, 180, 255);
    assert.equal(sourceInk.count > 0 && renderedInk.count > 0, true, 'source or rendered PDF content is blank');
    const inkRatio = renderedInk.count / sourceInk.count;
    const rowDifference = normalizedProfileDifference(sourceInk.rows, renderedInk.rows, 180);
    const columnDifference = normalizedProfileDifference(sourceInk.columns, renderedInk.columns, 255);
    assert.equal(inkRatio >= 0.65 && inkRatio <= 1.45, true, `rendered PDF content density diverged from source (${inkRatio.toFixed(3)})`);
    assert.equal(rowDifference <= 0.08 && columnDifference <= 0.08, true, `rendered PDF layout diverged from source (rows=${rowDifference.toFixed(3)}, columns=${columnDifference.toFixed(3)})`);
  } finally {
    await loadingTask.destroy();
  }
}

async function waitForReview(page, evidence) {
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
    throw new Error(`AI review did not open: ${safeJson({
      ...state,
      requests: requestDiagnostics.slice(-5),
      responses: responseDiagnostics.slice(-5),
      console: evidence.consoleEntries.slice(-5).map((entry) => ({
        channel: entry.channel,
        id: privateDiagnosticId(entry.text),
        url: redactPrivateText(entry.url),
      })),
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
  assert.equal((await page.getByLabel('姓名', { exact: true }).inputValue()) === privateSentinel, true, 'anonymous edit was not restored after refresh');

  await exerciseCommittedImports(page, fixtures);

  const sourcePngPath = path.join(qaDir, 'resume-export-source.png');
  await page.locator('[data-resume-page]').screenshot({ path: sourcePngPath });
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PDF', exact: true }).click();
  const download = await downloadPromise;
  const pdfPath = path.join(qaDir, 'resume-export.pdf');
  await download.saveAs(pdfPath);
  await renderDownloadedPdf(pdfPath, sourcePngPath);
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
  await waitForReview(page, evidence);
  await authDialog.waitFor({ state: 'hidden' });

  await page.getByRole('button', { name: '全部接受', exact: true }).click();
  await page.getByRole('button', { name: '撤销 AI 修改', exact: true }).click();
  await waitForReview(page, evidence);
  await page.getByRole('button', { name: '关闭修改审阅', exact: true }).click();

  for (const level of ['中度优化', '深度优化']) {
    await page.getByRole('button', { name: new RegExp(level) }).click();
    await waitForReview(page, evidence);
    await page.getByRole('button', { name: '关闭修改审阅', exact: true }).click();
  }

  await page.getByRole('button', { name: /AI 解析当前简历/ }).click();
  await waitForReview(page, evidence);
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
    return { url: response.url, status: response.status };
  })), ['/api/resume/quota', '/api/resume/plans']);
  assert.equal(accountResponses.every((response) => response.status >= 200), true, 'quota or plan inspection did not return a response');
}

async function exercisePrivateApiFailures(page) {
  const failures = await page.evaluate(async (cases) => Promise.all(cases.map(async ([requestPath, body]) => {
    const response = await fetch(requestPath, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { path: requestPath, status: response.status };
  })), [
    ['/api/resume/parse', { text: privateSentinel }],
    ['/api/resume/analyze-jd', { jdText: jdSentinel }],
    ['/api/resume/optimize', { level: 'light', resumeText: privateSentinel, jdText: jdSentinel }],
  ]);
  assert.equal(failures.every((response) => response.status >= 400), true, 'private API failure probes unexpectedly succeeded');
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

async function assertViewport(browser, viewport, theme, evidence) {
  const label = `${viewport.width}x${viewport.height}-${theme}`;
  const context = await browser.newContext({
    viewport,
    colorScheme: theme,
    reducedMotion: 'reduce',
    bypassCSP: true,
  });
  await context.addInitScript(storageSeed, { theme, document: seedResumeDocument() });
  await context.addInitScript(installFetchDiagnostics);
  const page = await context.newPage();
  attachEvidence(page, evidence);
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
      await page.waitForFunction(
        (marker) => (document.querySelector('[data-resume-page]')?.textContent || '').includes(marker),
        `${privateSentinel}-MOBILE`,
      );
      await assertA4Pixels(page, `${label} A4`);
      const edit = page.getByRole('button', { name: '编辑', exact: true });
      await edit.press('Enter');
      assert.equal((await name.inputValue()) === `${privateSentinel}-MOBILE`, true, `${label}: mobile switching lost content`);
      await assertLastEditorActionVisible(page, label);
    } else {
      await assertA4Pixels(page, `${label} A4`);
    }
    await page.evaluate(() => scrollTo(0, 0));
    await assertVisibleControlGeometry(page, label);
    await assertAccessibility(page, label);
    await page.screenshot({ path: path.join(qaDir, `${label}.png`), fullPage: false });
  } finally {
    await captureStorage(page, evidence, label).catch((error) => evidence.captureFailures.push({
      channel: 'storage-capture',
      id: privateDiagnosticId(error instanceof Error ? error.stack : error),
      status: 0,
      url: redactPrivateText(page.url()),
    }));
    await flushEvidence(page, evidence);
    await context.close();
  }
}

async function assertPrivacy(evidence) {
  assert.deepEqual(evidence.captureFailures, [], `evidence capture failed: ${safeJson(evidence.captureFailures)}`);
  for (const entry of evidence.consoleEntries) {
    assertPrivateFree(entry.channel, entry.text, entry);
  }
  for (const entry of evidence.telemetryRequests) {
    assertPrivateFree('telemetry-request', `${entry.url}\n${entry.body}`, entry);
  }
  for (const entry of evidence.responseBodies) {
    assertPrivateFree(entry.channel, entry.body, entry);
  }
  for (const snapshot of evidence.storageSnapshots) {
    for (const [key, value] of Object.entries(snapshot.entries)) {
      if (key !== allowedPrivateStorageKey) {
        assertPrivateFree(`local-storage:${snapshot.label}:${key}`, value);
      }
    }
  }
  for (const pathname of ['/api/resume/parse', '/api/resume/analyze-jd', '/api/resume/optimize']) {
    assert.equal(
      evidence.responseBodies.some((entry) => new URL(entry.url).pathname === pathname && entry.status >= 400),
      true,
      `missing captured error response for ${pathname}`,
    );
  }
  assert.equal(
    evidence.responseBodies.some((entry) => new URL(entry.url).pathname === '/api/resume/optimize' && entry.status === 429),
    true,
    'missing captured exhausted-quota response',
  );
  if (serverLog) {
    const log = await readFile(serverLog, 'utf8').catch(() => '');
    assertPrivateFree('next-server-log', log);
  }
}

const fixtures = await createFixtures();
const externalServer = await startExternalMock();
const browser = await chromium.launch({ headless: true });
let exitCode = 0;

try {
  const evidence = createEvidence();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', bypassCSP: true });
  const page = await context.newPage();
  await page.addInitScript(installFetchDiagnostics);
  attachEvidence(page, evidence);
  await routeBrowserSupabase(page);

  try {
    await exerciseAnonymousFlow(page, fixtures);
    await exerciseAuthAiAndPayment(page, evidence);
    await exercisePrivateApiFailures(page);
    await flushEvidence(page, evidence);
    await exerciseNavigationAndSearch(page);
  } finally {
    await captureStorage(page, evidence, 'primary-flow').catch((error) => evidence.captureFailures.push({
      channel: 'storage-capture',
      id: privateDiagnosticId(error instanceof Error ? error.stack : error),
      status: 0,
      url: redactPrivateText(page.url()),
    }));
    await flushEvidence(page, evidence);
    await context.close();
  }

  for (const viewport of viewports) {
    for (const theme of themes) await assertViewport(browser, viewport, theme, evidence);
  }
  await assertPrivacy(evidence);
  console.log(`resume UI guard passed; evidence: ${qaDir}`);
} catch (error) {
  exitCode = 1;
  console.error(redactPrivateText(error instanceof Error ? error.stack : error));
} finally {
  await browser.close();
  await new Promise((resolve) => externalServer.close(resolve));
}

process.exitCode = exitCode;
