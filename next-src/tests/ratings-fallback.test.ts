import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_FALLBACK_REVIEWS,
  countFallbackReviews,
  getToolReviews,
  storeAnonymousReview,
} from '../src/app/api/ratings/fallback-store';

/**
 * Contract tests for the anonymous (x-session-id) ratings fallback store [A2].
 * The store is a pure module so these run under plain node:test.
 */

test('stores anonymous reviews per tool and counts them globally', () => {
  storeAnonymousReview(1, 's1', { score: 5, tags: [], comment: '' });
  storeAnonymousReview(1, 's2', { score: 4, tags: [], comment: '' });
  storeAnonymousReview(2, 's1', { score: 3, tags: [], comment: '' });
  assert.equal(getToolReviews(1).length, 2);
  assert.equal(getToolReviews(2).length, 1);
  assert.ok(countFallbackReviews() >= 3);
});

test('re-rating the same tool and session overwrites instead of growing', () => {
  const before = countFallbackReviews();
  storeAnonymousReview(3, 'dup', { score: 5, tags: [], comment: '' });
  storeAnonymousReview(3, 'dup', { score: 2, tags: [], comment: '' });
  storeAnonymousReview(3, 'dup', { score: 1, tags: [], comment: '' });
  assert.equal(countFallbackReviews(), before + 1);
  assert.deepEqual(getToolReviews(3).at(-1), { score: 1, tags: [], comment: '' });
});

test('the global cap is a finite, sane bound', () => {
  assert.ok(Number.isInteger(MAX_FALLBACK_REVIEWS));
  assert.ok(MAX_FALLBACK_REVIEWS > 0 && MAX_FALLBACK_REVIEWS <= 100_000);
});

test('overflow FIFO-evicts the oldest entries and never exceeds the cap', () => {
  // Push past the cap with distinct sessions; Map insertion order defines age.
  for (let i = 0; i < MAX_FALLBACK_REVIEWS + 50; i++) {
    storeAnonymousReview(900 + (i % 3), `overflow-${i}`, { score: 5, tags: [], comment: '' });
  }
  assert.equal(countFallbackReviews(), MAX_FALLBACK_REVIEWS);
  // The most recent entries survived; the very first was evicted.
  assert.ok(getToolReviews(900).some((r) => r.score === 5));
});
