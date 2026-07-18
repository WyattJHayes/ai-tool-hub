/**
 * @jest-environment node
 *
 * QuotaService tests — verifies registration, password hashing,
 * quota checking, usage incrementing, and the async write queue.
 */

import { jest } from '@jest/globals';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Set env before config module resolves
process.env.JWT_SECRET = 'test-jwt-secret-for-unit-tests';
process.env.DAILY_QUOTA = '5';

const { QuotaService } = await import('../services/quota.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Synchronous helper for tests that don't check disk state. */
function withTempService(fn) {
    const tmpDir = mkdtempSync(join(tmpdir(), 'quota-test-'));
    const dataPath = join(tmpDir, 'quota.json');
    const service = new QuotaService(dataPath);
    try {
        fn(service, dataPath, tmpDir);
    } finally {
        rmSync(tmpDir, { recursive: true, force: true });
    }
}

/** Async helper that flushes writes before cleanup. */
async function withTempServiceAsync(fn) {
    const tmpDir = mkdtempSync(join(tmpdir(), 'quota-test-'));
    const dataPath = join(tmpDir, 'quota.json');
    const service = new QuotaService(dataPath);
    try {
        await fn(service, dataPath, tmpDir);
    } finally {
        rmSync(tmpDir, { recursive: true, force: true });
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('QuotaService', () => {
    describe('register', () => {
        test('should register a new user', () => {
            withTempService((svc) => {
                const result = svc.register('test@example.com', 'password123');
                expect(result.user).toBeDefined();
                expect(result.user.email).toBe('test@example.com');
                expect(result.user.id).toBeTruthy();
            });
        });

        test('should reject duplicate email', () => {
            withTempService((svc) => {
                svc.register('dup@example.com', 'password123');
                const result = svc.register('dup@example.com', 'password123');
                expect(result.error).toBe('该邮箱已注册');
            });
        });

        test('should persist user data to disk', async () => {
            await withTempServiceAsync(async (svc, dataPath) => {
                svc.register('persist@test.com', 'secret456');
                await svc.flush();

                const saved = JSON.parse(readFileSync(dataPath, 'utf8'));
                expect(saved.users).toHaveLength(1);
                expect(saved.users[0].email).toBe('persist@test.com');
            });
        });
    });

    describe('verifyPassword', () => {
        test('should verify correct password', () => {
            withTempService((svc) => {
                svc.register('auth@test.com', 'mypassword');
                const user = svc.verifyPassword('auth@test.com', 'mypassword');
                expect(user).not.toBeNull();
                expect(user.email).toBe('auth@test.com');
            });
        });

        test('should reject wrong password', () => {
            withTempService((svc) => {
                svc.register('auth@test.com', 'correctpw');
                const user = svc.verifyPassword('auth@test.com', 'wrongpw');
                expect(user).toBeNull();
            });
        });

        test('should return null for unknown email', () => {
            withTempService((svc) => {
                const user = svc.verifyPassword('nobody@test.com', 'pw');
                expect(user).toBeNull();
            });
        });
    });

    describe('getUserById', () => {
        test('should return user without password field', () => {
            withTempService((svc) => {
                const result = svc.register('safe@test.com', 'pw123456');
                const user = svc.getUserById(result.user.id);
                expect(user).not.toBeNull();
                expect(user.email).toBe('safe@test.com');
                expect(user.password).toBeUndefined();
            });
        });

        test('should return null for unknown id', () => {
            withTempService((svc) => {
                expect(svc.getUserById('nonexistent')).toBeNull();
            });
        });
    });

    describe('checkQuota', () => {
        test('should start at zero usage', () => {
            withTempService((svc) => {
                const result = svc.register('quota@test.com', 'pw123456');
                const quota = svc.checkQuota(result.user.id);
                expect(quota.used).toBe(0);
                expect(quota.remaining).toBe(5);
                expect(quota.total).toBe(5);
                expect(quota.resetAt).toBeTruthy();
            });
        });

        test('should reflect incremented usage', () => {
            withTempService((svc) => {
                const result = svc.register('quota@test.com', 'pw123456');
                svc.incrementUsage(result.user.id);
                const quota = svc.checkQuota(result.user.id);
                expect(quota.used).toBe(1);
                expect(quota.remaining).toBe(4);
            });
        });

        test('should cap remaining at zero', () => {
            withTempService((svc) => {
                const result = svc.register('quota@test.com', 'pw123456');
                for (let i = 0; i < 10; i++) {
                    svc.incrementUsage(result.user.id);
                }
                const quota = svc.checkQuota(result.user.id);
                expect(quota.used).toBe(10);
                expect(quota.remaining).toBe(0);
            });
        });
    });

    describe('incrementUsage', () => {
        test('should persist incremented quota to disk', async () => {
            await withTempServiceAsync(async (svc, dataPath) => {
                const result = svc.register('inc@test.com', 'pw123456');
                svc.incrementUsage(result.user.id);
                svc.incrementUsage(result.user.id);
                await svc.flush();

                const saved = JSON.parse(readFileSync(dataPath, 'utf8'));
                const today = svc._todayKey();
                const key = `${result.user.id}_${today}`;
                expect(saved.usage[key]).toBe(2);
            });
        });
    });

    describe('write queue (race condition prevention)', () => {
        test('should handle concurrent increments without data loss', async () => {
            await withTempServiceAsync(async (svc) => {
                const result = svc.register('race@test.com', 'pw123456');
                const userId = result.user.id;

                // Simulate concurrent increments (no await between them)
                svc.incrementUsage(userId);
                svc.incrementUsage(userId);
                svc.incrementUsage(userId);
                svc.incrementUsage(userId);
                svc.incrementUsage(userId);

                await svc.flush();

                // All 5 should be counted (in-memory)
                const quota = svc.checkQuota(userId);
                expect(quota.used).toBe(5);
                expect(quota.remaining).toBe(0);
            });
        });

        test('should not block concurrent reads during writes', () => {
            withTempService((svc) => {
                const result = svc.register('read@test.com', 'pw123456');

                // Fire off writes
                svc.incrementUsage(result.user.id);
                svc.incrementUsage(result.user.id);

                // Reads should still return immediately (non-blocking)
                expect(svc.checkQuota(result.user.id).used).toBe(2);
            });
        });
    });

    describe('quota reservation', () => {
        test('allows exactly the configured number of reservations', () => {
            withTempService((svc) => {
                const { user } = svc.register('reserve@test.com', 'pw123456');

                const results = Array.from({ length: 6 }, () => svc.tryConsumeQuota(user.id));

                expect(results.slice(0, 5).every(result => result.allowed)).toBe(true);
                expect(results[5]).toMatchObject({
                    allowed: false,
                    quota: { used: 5, remaining: 0, total: 5 }
                });
            });
        });

        test('restores a reserved use when processing fails', () => {
            withTempService((svc) => {
                const { user } = svc.register('refund@test.com', 'pw123456');

                expect(svc.tryConsumeQuota(user.id).quota.remaining).toBe(4);
                const quota = svc.refundUsage(user.id);

                expect(quota).toMatchObject({ used: 0, remaining: 5, total: 5 });
            });
        });

        test('uses the local calendar date for usage keys', () => {
            withTempService((svc) => {
                const localDate = new Date(2026, 0, 2, 0, 30);

                expect(svc._todayKey(localDate)).toBe('2026-01-02');
            });
        });
    });
});
