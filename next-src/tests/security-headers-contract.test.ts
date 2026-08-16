import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * Security-header contract tests for next.config.mjs.
 *
 * [VULN-4] The emitted Content-Security-Policy currently ships
 * `script-src 'unsafe-eval'` in every environment and whitelists
 * `https://api.openai.com` in connect-src even though nothing in the app
 * calls OpenAI. 'unsafe-eval' is only required by Next.js in development;
 * a production build must not relax the script CSP, and the dead
 * connect-src entry widens the exfiltration surface for no benefit.
 *
 * `knownBug` tests encode the DESIRED post-fix behavior: green while the bug
 * is present, automatically red once fixed (then promote to plain test()).
 */
async function runKnownBug(name: string, fn: () => Promise<void>): Promise<void> {
  let bugFixed = false;
  try {
    await fn();
    bugFixed = true;
  } catch {
    // Bug still present — expected red, kept green by design.
  }
  if (bugFixed) {
    throw new Error(
      `KNOWN BUG FIXED: promote this test — replace knownBug() with test() and keep the inner assertions (${name})`,
    );
  }
}

// Register a known-bug test (top-level await is unavailable under tsx/CJS).
function knownBug(name: string, fn: () => Promise<void>): void {
  test(name, () => runKnownBug(name, fn));
}

(process.env as { NODE_ENV?: string }).NODE_ENV = 'production';

interface HeaderEntry {
  key: string;
  value: string;
}

interface HeaderRule {
  source: string;
  headers: HeaderEntry[];
}

interface NextConfigShape {
  headers?: () => Promise<HeaderRule[]>;
}

let configPromise: Promise<NextConfigShape> | undefined;
function loadNextConfig(): Promise<NextConfigShape> {
  configPromise ??= import('../next.config.mjs').then((m) => m.default as NextConfigShape);
  return configPromise;
}

async function emittedHeaders(): Promise<Record<string, string>> {
  const nextConfig = await loadNextConfig();
  assert.equal(typeof nextConfig.headers, 'function', 'next.config.mjs must export headers()');
  const entries = await nextConfig.headers!();
  const all = entries.find((entry) => entry.source === '/(.*)');
  assert.ok(all, 'headers() must define the catch-all /(.*) source');
  const map: Record<string, string> = {};
  for (const header of all.headers) map[header.key] = header.value;
  return map;
}

function directive(csp: string, name: string): string {
  const match = new RegExp(`${name}[^;]*`).exec(csp);
  return match ? match[0] : '';
}

test('emits a Content-Security-Policy for every route', async () => {
  const headers = await emittedHeaders();
  assert.ok(headers['Content-Security-Policy']);
});

test('CSP forbids framing and plugins', async () => {
  const headers = await emittedHeaders();
  const csp = headers['Content-Security-Policy'];
  assert.match(csp, /frame-src 'none'/);
  assert.match(csp, /object-src 'none'/);
});

test('anti-clickjacking and nosniff headers stay locked down', async () => {
  const headers = await emittedHeaders();
  assert.equal(headers['X-Frame-Options'], 'DENY');
  assert.equal(headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(headers['Referrer-Policy'], 'strict-origin-when-cross-origin');
});

test('script-src is restricted to self and the Sentry CDN', async () => {
  const headers = await emittedHeaders();
  const scriptSrc = directive(headers['Content-Security-Policy'], 'script-src');
  assert.match(scriptSrc, /'self'/);
  assert.ok(!/https?:\/\/(?!browser\.sentry-cdn\.com)/.test(scriptSrc));
});

test('connect-src contains no origins outside self/Sentry/Supabase (+ known-dead OpenAI)', async () => {
  const headers = await emittedHeaders();
  const connectSrc = directive(headers['Content-Security-Policy'], 'connect-src');
  const hosts = connectSrc.match(/[a-z]+:\/\/[^\s;]+/g) ?? [];
  assert.ok(hosts.length > 0, 'connect-src must list at least one origin');
  for (const host of hosts) {
    assert.match(
      host,
      /^(https:\/\/sentry\.io|https:\/\/\*\.sentry\.io|https:\/\/\*\.supabase\.co|wss:\/\/\*\.supabase\.co|https:\/\/api\.openai\.com)$/,
      `unexpected connect-src origin: ${host}`,
    );
  }
});

// ---------------------------------------------------------------------------
// [VULN-4] Known bugs — expected red until next.config.mjs is fixed.
// ---------------------------------------------------------------------------

test("[VULN-4] production CSP must not contain script-src 'unsafe-eval'", async () => {
  const headers = await emittedHeaders();
  const scriptSrc = directive(headers['Content-Security-Policy'], 'script-src');
  assert.ok(!scriptSrc.includes("'unsafe-eval'"), `script-src still allows eval: ${scriptSrc}`);
});

test('[VULN-4] connect-src must not whitelist the dead api.openai.com origin', async () => {
  const headers = await emittedHeaders();
  const connectSrc = directive(headers['Content-Security-Policy'], 'connect-src');
  assert.ok(!connectSrc.includes('https://api.openai.com'), `dead origin still whitelisted: ${connectSrc}`);
});
