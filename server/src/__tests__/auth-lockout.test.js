/**
 * @jest-environment node
 *
 * Login-lockout tests for server/src/routes/auth.js
 *
 * [VULN-3] The lockout map is keyed by email only. Anyone can send 5 wrong
 * passwords for a victim's email and lock the real user out for 15 minutes,
 * without knowing the password (targeted account DoS). The fix keys attempts
 * by (email, client IP); the `test.failing` case below encodes that behavior.
 *
 * NOTE for the fix: `req.ip` only reflects X-Forwarded-For when the app runs
 * with `app.set('trust proxy', ...)` — production deployments behind a proxy
 * must configure that too (this test app enables it explicitly).
 *
 * Isolation: the lockout state lives in a module-level Map, so every test
 * below uses its own email to avoid cross-test contamination.
 */
import { jest, describe, test, expect, afterAll } from '@jest/globals';

// routes/auth.js starts a cleanup interval at import time; neutralize it so
// jest can exit cleanly.
const setIntervalSpy = jest.spyOn(globalThis, 'setInterval').mockImplementation(() => 0);

jest.unstable_mockModule('../utils/logger.js', () => ({
    default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

jest.unstable_mockModule('../config.js', () => ({
    default: {
        JWT_SECRET: 'test-secret',
        JWT_EXPIRES_IN: '1h',
        JWT_ISSUER: 'ai-tool-hub',
        JWT_AUDIENCE: 'ai-tool-hub-users',
        PASSWORD_PEPPER: 'test-pepper',
        NODE_ENV: 'test'
    }
}));

const CORRECT_PASSWORD = 'correct-pass-1';

jest.unstable_mockModule('../services/quota.js', () => ({
    quotaService: {
        register: jest.fn(),
        verifyPassword: jest.fn(async (email, password) =>
            password === CORRECT_PASSWORD ? { id: 'user-1', email } : null),
        checkQuota: jest.fn(() => ({ remaining: 1 })),
        getUserById: jest.fn(),
        getMembership: jest.fn(() => null)
    }
}));

const express = (await import('express')).default;
const request = (await import('supertest')).default;
const authRoutes = (await import('../routes/auth.js')).default;

const app = express();
app.set('trust proxy', true); // so X-Forwarded-For controls req.ip
app.use(express.json());
app.use('/api/v1/auth', authRoutes);

const loginFrom = (ip, email, password) =>
    request(app).post('/api/v1/auth/login').set('X-Forwarded-For', ip).send({ email, password });

afterAll(() => {
    setIntervalSpy.mockRestore();
});

describe('login lockout', () => {
    test('a successful login responds 200 and sets the auth cookie', async () => {
        const res = await loginFrom('8.8.8.8', 'ok@example.com', CORRECT_PASSWORD);
        expect(res.status).toBe(200);
        expect(res.headers['set-cookie'][0]).toMatch(/auth_token=/);
        expect(res.body.user.email).toBe('ok@example.com');
    });

    test('wrong credentials return a generic 401 without leaking account existence', async () => {
        const known = await loginFrom('8.8.8.8', 'enum@example.com', 'wrong-password');
        const unknown = await loginFrom('8.8.8.8', 'nobody@example.com', 'wrong-password');
        expect(known.status).toBe(401);
        expect(unknown.status).toBe(401);
        expect(known.body.error).toBe(unknown.body.error);
    });

    test('locks the account after 5 consecutive failures from one client', async () => {
        const email = 'lockme@example.com';
        for (let i = 0; i < 5; i++) {
            const res = await loginFrom('9.9.9.9', email, 'wrong-password');
            expect(res.status).toBe(401);
        }
        // Even the CORRECT password is refused from the same client while locked.
        const locked = await loginFrom('9.9.9.9', email, CORRECT_PASSWORD);
        expect(locked.status).toBe(429);
    });

    test('a successful login resets the failure counter', async () => {
        const email = 'reset@example.com';
        for (let i = 0; i < 4; i++) {
            const res = await loginFrom('7.7.7.7', email, 'wrong-password');
            expect(res.status).toBe(401);
        }
        const ok = await loginFrom('7.7.7.7', email, CORRECT_PASSWORD);
        expect(ok.status).toBe(200);

        // One more failure after the reset must not be treated as the 5th.
        const stillOpen = await loginFrom('7.7.7.7', email, 'wrong-password');
        expect(stillOpen.status).toBe(401);
        expect(stillOpen.body.remainingAttempts).toBeGreaterThanOrEqual(4);
    });

    test('[VULN-3] attacker failures must not lock out the victim from another IP', async () => {
        const email = 'victim@example.com';
        // Attacker hammers the victim's email with wrong passwords from one IP.
        for (let i = 0; i < 5; i++) {
            const res = await loginFrom('1.2.3.4', email, 'wrong-password');
            expect(res.status).toBe(401);
        }
        // The real victim, from their own IP, with the CORRECT password must
        // still get in. Today this returns 429 because the lock is keyed by
        // email only — fix: key attempts by (email, ip).
        const victim = await loginFrom('5.6.7.8', email, CORRECT_PASSWORD);
        expect(victim.status).toBe(200);
    });
});
