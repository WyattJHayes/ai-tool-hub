import test from 'node:test';
import assert from 'node:assert/strict';

const baseUrl = process.env.TEST_BASE_URL;
if (!baseUrl) throw new Error('TEST_BASE_URL is required');

async function post(path, body, sessionId) {
  const headers = { 'Content-Type': 'application/json' };
  if (sessionId) headers['x-session-id'] = sessionId;
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

test('anonymous mutations require an explicit browser session', async () => {
  const response = await post('/api/favorites', { tool_id: 61, action: 'add' });
  assert.equal(response.status, 400);
});

test('favorite mutations reject unsupported actions', async () => {
  const response = await post('/api/favorites', { tool_id: 61, action: 'replace' }, 'validation-session');
  assert.equal(response.status, 400);
});

test('anonymous favorites remain isolated by browser session', async () => {
  const first = await post('/api/favorites', { tool_id: 61, action: 'add' }, 'favorite-session-a');
  assert.equal(first.status, 200);

  const second = await fetch(`${baseUrl}/api/favorites`, {
    headers: { 'x-session-id': 'favorite-session-b' },
  });
  assert.deepEqual((await second.json()).favorites, []);
});

test('repeated anonymous ratings replace the prior rating instead of inflating the count', async () => {
  const sessionId = 'rating-session-a';
  const first = await post('/api/ratings', { tool_id: 61, score: 5 }, sessionId);
  assert.equal(first.status, 200);
  assert.deepEqual(await first.json(), { ok: true, avg_rating: 5, rating_count: 1 });

  const repeated = await post('/api/ratings', { tool_id: 61, score: 1 }, sessionId);
  assert.equal(repeated.status, 200);
  assert.deepEqual(await repeated.json(), { ok: true, avg_rating: 1, rating_count: 1 });

  const response = await fetch(`${baseUrl}/api/ratings?tool_id=61`);
  const body = await response.json();
  assert.equal(body.rating_count, 1);
  assert.equal(body.avg_rating, 1);
});

test('CSP allows Supabase HTTP and realtime connections', async () => {
  const response = await fetch(`${baseUrl}/`);
  const csp = response.headers.get('content-security-policy') || '';
  assert.match(csp, /https:\/\/\*\.supabase\.co/);
  assert.match(csp, /wss:\/\/\*\.supabase\.co/);
});
