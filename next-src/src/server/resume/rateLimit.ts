import 'server-only';

import { ResumeApiError } from './errors';

/**
 * Per-user request throttling for the resume AI routes.
 *
 * State lives in the process because production runs a single standalone Node
 * container. Restarting the container resets every window; the SQL quota ledger
 * remains the durable spend limit.
 */

export type ResumeRateLimitAction = 'optimize' | 'parse' | 'analyze-jd' | 'quota';

export interface ResumeRateLimitRule {
  limit: number;
  windowMs: number;
}

/** Budgets reflect upstream token cost, not billing plan. VIP is never exempt. */
export const RESUME_RATE_LIMITS: Record<ResumeRateLimitAction, ResumeRateLimitRule> = {
  optimize: { limit: 5, windowMs: 60_000 },
  parse: { limit: 10, windowMs: 60_000 },
  'analyze-jd': { limit: 10, windowMs: 60_000 },
  quota: { limit: 60, windowMs: 60_000 },
};

/** Bounds worst-case memory when many distinct users are active. */
const MAX_TRACKED_KEYS = 10_000;

export interface ResumeRateLimiter {
  /** Throws ResumeApiError('RATE_LIMITED', 429) when the window is full. */
  check(action: ResumeRateLimitAction, userId: string): void;
  size(): number;
}

export interface ResumeRateLimiterOptions {
  now?: () => number;
  rules?: Record<ResumeRateLimitAction, ResumeRateLimitRule>;
  maxTrackedKeys?: number;
}

export function createResumeRateLimiter(options: ResumeRateLimiterOptions = {}): ResumeRateLimiter {
  const now = options.now ?? (() => Date.now());
  const rules = options.rules ?? RESUME_RATE_LIMITS;
  const maxTrackedKeys = options.maxTrackedKeys ?? MAX_TRACKED_KEYS;
  const hits = new Map<string, number[]>();

  const prune = (current: number) => {
    for (const [key, timestamps] of hits) {
      const action = key.slice(0, key.indexOf(':')) as ResumeRateLimitAction;
      const windowMs = rules[action]?.windowMs ?? 0;
      if (timestamps.length === 0 || current - timestamps[timestamps.length - 1] >= windowMs) {
        hits.delete(key);
      }
    }
  };

  return {
    check(action, userId) {
      const rule = rules[action];
      if (!rule) return;
      const current = now();
      const key = `${action}:${userId}`;

      const retained = (hits.get(key) ?? []).filter(stamp => current - stamp < rule.windowMs);
      if (retained.length >= rule.limit) {
        hits.set(key, retained);
        const retryAfterMs = rule.windowMs - (current - retained[0]);
        throw new ResumeApiError(
          'RATE_LIMITED',
          429,
          undefined,
          Math.max(1, Math.ceil(retryAfterMs / 1000)),
        );
      }

      retained.push(current);
      hits.set(key, retained);

      if (hits.size > maxTrackedKeys) prune(current);
    },
    size() {
      return hits.size;
    },
  };
}

let productionLimiter: ResumeRateLimiter | undefined;

export function getResumeRateLimiter(): ResumeRateLimiter {
  productionLimiter ??= createResumeRateLimiter();
  return productionLimiter;
}

export function enforceResumeRateLimit(action: ResumeRateLimitAction, userId: string): void {
  getResumeRateLimiter().check(action, userId);
}
