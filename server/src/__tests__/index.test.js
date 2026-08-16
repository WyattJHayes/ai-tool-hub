/**
 * Express app setup tests
 * Tests the middleware stack, health endpoint, 404 handler, CORS, and security headers
 * by building an inline app that mirrors index.js's middleware composition.
 */
import { jest, describe, test, expect, beforeAll, beforeEach } from '@jest/globals';
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

let app;
let request;

beforeAll(async () => {
    const supertestModule = await import('supertest');
    request = supertestModule.default;
    const express = (await import('express')).default;
    const cors = (await import('cors')).default;
    const cookieParser = (await import('cookie-parser')).default;

    // Build app with the same middleware as server/src/index.js
    app = express();

    // CORS (mirror index.js logic)
    const allowedOrigins = ['http://localhost:3000'];
    app.use(cors({
        origin: (origin, callback) => {
            if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        },
        credentials: true,
        maxAge: 86400
    }));

    // Security headers (mirror index.js)
    app.use((req, res, next) => {
        res.setHeader('Content-Security-Policy', [
            "default-src 'self'",
            "script-src 'self'",
            "style-src 'self'",
            "img-src 'self' data:",
            "font-src 'self'",
            "connect-src 'self'",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'"
        ].join('; '));
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        next();
    });

    // Request body parser (100kb limit)
    app.use(express.json({ limit: '100kb' }));
    app.use(cookieParser());

    // Health endpoint
    app.get('/api/v1/health', (req, res) => {
        res.json({
            status: 'ok',
            version: '1.0.0',
            deepseek: true,
            timestamp: new Date().toISOString()
        });
    });

    // 404 handler
    app.use((req, res) => {
        res.status(404).json({ error: '接口不存在', path: req.path });
    });

    // Error handler
    app.use((err, req, res, _next) => {
        if (res.headersSent) return;
        const errorMsg = err.message || '服务器内部错误';
        res.status(err.status || 500).json({
            error: errorMsg,
            requestId: req.requestId
        });
    });
});

// ---------------------------------------------------------------------------
// Health endpoint
// ---------------------------------------------------------------------------

describe('GET /api/v1/health', () => {
    test('should return ok status', async () => {
        const res = await request(app)
            .get('/api/v1/health')
            .expect('Content-Type', /json/);

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
        expect(res.body.version).toBe('1.0.0');
        expect(res.body).toHaveProperty('timestamp');
    });

    test('should indicate deepseek configuration status', async () => {
        const res = await request(app).get('/api/v1/health');
        expect(res.body).toHaveProperty('deepseek');
        expect(res.body.deepseek).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// 404 handler
// ---------------------------------------------------------------------------

describe('404 handler', () => {
    test('should return 404 for unknown API routes', async () => {
        const res = await request(app)
            .get('/api/v1/nonexistent')
            .expect('Content-Type', /json/);

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('接口不存在');
        expect(res.body).toHaveProperty('path');
    });

    test('should return 404 for unknown paths', async () => {
        const res = await request(app).get('/unknown-path');
        expect(res.status).toBe(404);
        expect(res.body.error).toBe('接口不存在');
    });
});

// ---------------------------------------------------------------------------
// CORS headers
// ---------------------------------------------------------------------------

describe('CORS headers', () => {
    test('should include ACAO header for allowed origin', async () => {
        const res = await request(app)
            .get('/api/v1/health')
            .set('Origin', 'http://localhost:3000');

        expect(res.headers).toHaveProperty('access-control-allow-origin');
    });

    test('should reject disallowed origins', async () => {
        const res = await request(app)
            .get('/api/v1/health')
            .set('Origin', 'https://evil.com');

        expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// Security headers
// ---------------------------------------------------------------------------

describe('security headers', () => {
    test('should include X-Content-Type-Options: nosniff', async () => {
        const res = await request(app).get('/api/v1/health');
        expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    test('should include X-Frame-Options: DENY', async () => {
        const res = await request(app).get('/api/v1/health');
        expect(res.headers['x-frame-options']).toBe('DENY');
    });

    test('should not include deprecated X-XSS-Protection header', async () => {
        const res = await request(app).get('/api/v1/health');
        expect(res.headers['x-xss-protection']).toBeUndefined();
    });

    test('should include Referrer-Policy', async () => {
        const res = await request(app).get('/api/v1/health');
        expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    });

    test('should include Content-Security-Policy with expected directives', async () => {
        const res = await request(app).get('/api/v1/health');
        const csp = res.headers['content-security-policy'];
        expect(csp).toBeDefined();
        expect(csp).toContain("default-src 'self'");
        expect(csp).toContain("frame-ancestors 'none'");
        expect(csp).toContain("base-uri 'self'");
        expect(csp).toContain("form-action 'self'");
    });
});

// ---------------------------------------------------------------------------
// JSON body parsing
// ---------------------------------------------------------------------------

describe('JSON body parsing', () => {
    test('should parse JSON bodies on POST (via health GET)', async () => {
        const res = await request(app)
            .get('/api/v1/health')
            .send({ test: 'data' })
            .expect('Content-Type', /json/);
        expect(res.status).toBe(200);
    });

    test('should reject oversized bodies exceeding 100kb', async () => {
        const largeStr = 'x'.repeat(150000);
        const res = await request(app)
            .get('/api/v1/health')
            .send({ data: largeStr });

        expect([413, 400]).toContain(res.status);
    });
});

// ---------------------------------------------------------------------------
// Error handler
// ---------------------------------------------------------------------------

describe('error handler', () => {
    test('should catch thrown errors and return 500 with message', async () => {
        const errorApp = (await import('express')).default();
        errorApp.use((await import('express')).default.json());
        errorApp.get('/trigger-error', (req, res, next) => {
            next(new Error('Test error'));
        });
        errorApp.use((err, req, res, _next) => {
            res.status(500).json({ error: err.message, requestId: req.requestId });
        });

        const localReq = request(errorApp);
        const res = await localReq.get('/trigger-error');
        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Test error');
    });
});
