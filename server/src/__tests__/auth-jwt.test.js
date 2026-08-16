/**
 * @jest-environment node
 *
 * JWT hardening tests for server/src/middleware/auth.js
 *
 * [L-1] `jwt.verify` is called without pinning `algorithms`, so any HMAC
 * variant signed with the same secret (e.g. HS512) is accepted even though
 * the issuer only ever signs HS256. The `test.failing` case encodes the
 * desired post-fix behavior (explicit `algorithms: ['HS256']`); it stays
 * green while the bug is present and turns red once fixed — then promote it
 * to a plain test().
 */
import { jest, describe, test, expect, beforeAll } from '@jest/globals';

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

// authMiddleware chains to userRateLimitMiddleware on success; passthrough so
// these tests isolate the JWT layer only.
jest.unstable_mockModule('../middleware/rateLimit.js', () => ({
    userRateLimitMiddleware: (req, res, next) => next()
}));

const jwt = (await import('jsonwebtoken')).default;
const { authMiddleware, generateToken } = await import('../middleware/auth.js');
const express = (await import('express')).default;
const request = (await import('supertest')).default;

const app = express();
app.use(express.json());
app.post('/protected', authMiddleware, (req, res) => {
    res.status(200).json({ ok: true, userId: req.user?.id });
});

const SECRET = 'test-secret';
const basePayload = { id: 'user-1', email: 'alice@example.com' };
const signOptions = { issuer: 'ai-tool-hub', audience: 'ai-tool-hub-users', expiresIn: '1h' };

function unsignedToken() {
    const enc = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
    return `${enc({ alg: 'none', typ: 'JWT' })}.${enc({ ...basePayload, ...signOptions, exp: undefined })}.`;
}

describe('authMiddleware JWT verification', () => {
    test('accepts a valid HS256 token issued by generateToken', async () => {
        const token = generateToken({ id: 'user-1', email: 'alice@example.com' });
        const res = await request(app).post('/protected').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.userId).toBe('user-1');
    });

    test('rejects a missing token with 401', async () => {
        const res = await request(app).post('/protected');
        expect(res.status).toBe(401);
    });

    test('rejects an alg:none token with 401', async () => {
        const res = await request(app).post('/protected').set('Authorization', `Bearer ${unsignedToken()}`);
        expect(res.status).toBe(401);
    });

    test('rejects an expired token with 401', async () => {
        const token = jwt.sign(basePayload, SECRET, {
            ...signOptions,
            expiresIn: '-1h'
        });
        const res = await request(app).post('/protected').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(401);
    });

    test('rejects a token signed for a different audience', async () => {
        const token = jwt.sign(basePayload, SECRET, { ...signOptions, audience: 'other-audience' });
        const res = await request(app).post('/protected').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(401);
    });

    test('rejects a token signed with a different secret', async () => {
        const token = jwt.sign(basePayload, 'attacker-secret', signOptions);
        const res = await request(app).post('/protected').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(401);
    });

    test('[L-1] rejects an HS512 token even though it uses the same secret', async () => {
        // The system only ever signs HS256 (jsonwebtoken default with a string
        // secret). Verification must pin algorithms: ['HS256'] so unrelated
        // HMAC variants are refused instead of silently accepted.
        const token = jwt.sign(basePayload, SECRET, { ...signOptions, algorithm: 'HS512' });
        const res = await request(app).post('/protected').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(401);
    });
});
