import assert from 'node:assert/strict';
import test from 'node:test';
import { createOptimizeRoute } from '../../src/app/api/resume/optimize/route';
import { ResumeApiError } from '../../src/server/resume/errors';

const silentLogger = { info: () => undefined, warn: () => undefined, error: () => undefined };

function optimizeRequest(): Request {
  return new Request('https://weihub.cloud/api/resume/optimize', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'idempotency-key': 'key-1' },
    body: JSON.stringify({ level: 'light', resumeText: 'Wei Jiahao, engineer.', jdText: '' }),
  });
}

test('rejects a throttled optimize request without reserving quota', async () => {
  let reserveCalls = 0;
  const route = createOptimizeRoute({
    authenticate: async () => ({ id: 'user-1', email: null }),
    reserve: async () => {
      reserveCalls += 1;
      throw new Error('reserve must not run for a throttled request');
    },
    settle: async () => undefined,
    compensate: async () => undefined,
    // eslint-disable-next-line require-yield
    streamResumeOptimization: async function* () {
      throw new Error('upstream must not be called for a throttled request');
    },
    enforceRateLimit: () => {
      throw new ResumeApiError('RATE_LIMITED', 429, undefined, 42);
    },
    logger: silentLogger,
  });

  const response = await route(optimizeRequest());

  assert.equal(response.status, 429);
  assert.equal(response.headers.get('Retry-After'), '42');
  assert.equal(reserveCalls, 0);

  const body = await response.json();
  assert.equal(body.error.code, 'RATE_LIMITED');
  assert.equal(typeof body.error.requestId, 'string');
});

test('enforces the limit only after authentication succeeds', async () => {
  const order: string[] = [];
  const route = createOptimizeRoute({
    authenticate: async () => {
      order.push('authenticate');
      throw new ResumeApiError('AUTH_REQUIRED', 401);
    },
    reserve: async () => { throw new Error('unreachable'); },
    settle: async () => undefined,
    compensate: async () => undefined,
    // eslint-disable-next-line require-yield
    streamResumeOptimization: async function* () { throw new Error('unreachable'); },
    enforceRateLimit: () => { order.push('enforceRateLimit'); },
    logger: silentLogger,
  });

  const response = await route(optimizeRequest());

  assert.equal(response.status, 401);
  // An unauthenticated caller must not consume limiter memory.
  assert.deepEqual(order, ['authenticate']);
  assert.equal(response.headers.get('Retry-After'), null);
});
