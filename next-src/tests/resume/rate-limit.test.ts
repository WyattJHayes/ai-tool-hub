import assert from 'node:assert/strict';
import test from 'node:test';
import { ResumeApiError, toResumeErrorHeaders } from '../../src/server/resume/errors';
import {
  createResumeRateLimiter,
  RESUME_RATE_LIMITS,
  type ResumeRateLimitAction,
} from '../../src/server/resume/rateLimit';

function fixedClock(start = 1_000_000) {
  let current = start;
  return {
    now: () => current,
    advance: (ms: number) => { current += ms; },
  };
}

test('allows requests up to the per-action limit and rejects the next one', () => {
  const clock = fixedClock();
  const limiter = createResumeRateLimiter({ now: clock.now });

  for (let index = 0; index < RESUME_RATE_LIMITS.optimize.limit; index += 1) {
    limiter.check('optimize', 'user-1');
  }

  assert.throws(
    () => limiter.check('optimize', 'user-1'),
    (error: unknown) => error instanceof ResumeApiError
      && error.code === 'RATE_LIMITED'
      && error.status === 429,
  );
});

test('frees capacity as the sliding window advances past old hits', () => {
  const clock = fixedClock();
  const limiter = createResumeRateLimiter({ now: clock.now });
  const { limit, windowMs } = RESUME_RATE_LIMITS.optimize;

  for (let index = 0; index < limit; index += 1) limiter.check('optimize', 'user-1');
  assert.throws(() => limiter.check('optimize', 'user-1'), ResumeApiError);

  // One millisecond short of the window: the oldest hit still counts.
  clock.advance(windowMs - 1);
  assert.throws(() => limiter.check('optimize', 'user-1'), ResumeApiError);

  clock.advance(1);
  limiter.check('optimize', 'user-1');
});

test('tracks each user and each action independently', () => {
  const clock = fixedClock();
  const limiter = createResumeRateLimiter({ now: clock.now });

  for (let index = 0; index < RESUME_RATE_LIMITS.optimize.limit; index += 1) {
    limiter.check('optimize', 'user-1');
  }

  // A different user is unaffected by user-1 exhausting its budget.
  limiter.check('optimize', 'user-2');
  // So is a different action for the same user.
  limiter.check('parse', 'user-1');
});

test('reports a Retry-After header derived from the oldest retained hit', () => {
  const clock = fixedClock();
  const limiter = createResumeRateLimiter({ now: clock.now });
  const { limit, windowMs } = RESUME_RATE_LIMITS.optimize;

  for (let index = 0; index < limit; index += 1) limiter.check('optimize', 'user-1');
  clock.advance(20_000);

  try {
    limiter.check('optimize', 'user-1');
    assert.fail('expected the limiter to reject');
  } catch (error) {
    assert.ok(error instanceof ResumeApiError);
    assert.equal(error.retryAfterSeconds, Math.ceil((windowMs - 20_000) / 1000));
    assert.deepEqual(toResumeErrorHeaders(error), { 'Retry-After': '40' });
  }
});

test('omits Retry-After for errors that are not throttling', () => {
  assert.deepEqual(toResumeErrorHeaders(new ResumeApiError('REQUEST_INVALID', 400)), {});
});

test('reclaims memory for keys whose windows have fully expired', () => {
  const clock = fixedClock();
  const limiter = createResumeRateLimiter({ now: clock.now, maxTrackedKeys: 4 });

  for (let index = 0; index < 4; index += 1) limiter.check('optimize', `user-${index}`);
  assert.equal(limiter.size(), 4);

  // Past the window, the next admission prunes every stale key before inserting.
  clock.advance(RESUME_RATE_LIMITS.optimize.windowMs + 1);
  for (let index = 4; index < 9; index += 1) limiter.check('optimize', `user-${index}`);

  assert.ok(limiter.size() <= 5, `expected pruning to bound growth, saw ${limiter.size()}`);
});

test('applies the documented budget to every resume action', () => {
  const actions: ResumeRateLimitAction[] = ['optimize', 'parse', 'analyze-jd', 'quota'];

  for (const action of actions) {
    const clock = fixedClock();
    const limiter = createResumeRateLimiter({ now: clock.now });
    const { limit } = RESUME_RATE_LIMITS[action];

    for (let index = 0; index < limit; index += 1) limiter.check(action, 'user-1');
    assert.throws(() => limiter.check(action, 'user-1'), ResumeApiError, `${action} should throttle`);
  }
});

test('throttles unlimited VIP identities, because the budget guards upstream cost', () => {
  const clock = fixedClock();
  const limiter = createResumeRateLimiter({ now: clock.now });

  // The limiter only ever sees a user id; plan is not an input, so VIP cannot opt out.
  for (let index = 0; index < RESUME_RATE_LIMITS.optimize.limit; index += 1) {
    limiter.check('optimize', 'vip-user');
  }

  assert.throws(() => limiter.check('optimize', 'vip-user'), ResumeApiError);
});
