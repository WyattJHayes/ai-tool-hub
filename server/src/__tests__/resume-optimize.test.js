/**
 * Resume route: POST /optimize validation + SSE endpoint tests
 * Tests all validation paths and SSE streaming via supertest
 */
import { jest } from '@jest/globals';
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

jest.unstable_mockModule('../utils/logger.js', () => ({
    default: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        http: jest.fn()
    }
}));

jest.unstable_mockModule('../config.js', () => ({
    default: {
        JWT_SECRET: 'test-secret-key',
        JWT_EXPIRES_IN: '7d',
        JWT_ISSUER: 'test-issuer',
        JWT_AUDIENCE: 'test-audience',
        NODE_ENV: 'test',
        CORS_ORIGIN: 'http://localhost:3000',
        DAILY_QUOTA: 10
    },
    validateConfig: jest.fn()
}));

const mockQuotaService = {
    checkQuota: jest.fn(() => ({ used: 0, remaining: 10, total: 10 })),
    incrementUsage: jest.fn(() => ({ used: 1, remaining: 9, total: 10 })),
    tryConsumeQuota: jest.fn(),
    refundUsage: jest.fn()
};

jest.unstable_mockModule('../services/quota.js', () => ({
    quotaService: mockQuotaService
}));

// Create a mock LLMService that returns an async generator
const mockStreamOptimize = jest.fn();
jest.unstable_mockModule('../services/llm.js', () => ({
    LLMService: jest.fn(() => ({
        streamOptimize: (...args) => mockStreamOptimize(...args)
    }))
}));

jest.unstable_mockModule('../middleware/auth.js', () => ({
    authMiddleware: (req, res, next) => {
        req.user = { id: 1, email: 'test@example.com' };
        next();
    }
}));

let app, request;

beforeAll(async () => {
    const express = (await import('express')).default;
    request = (await import('supertest')).default;
    const resumeRoutes = (await import('../routes/resume.js')).default;
    app = express();
    app.use(express.json({ limit: '100kb' }));
    app.use('/api/v1/resume', resumeRoutes);
});

beforeEach(() => {
    jest.clearAllMocks();
    mockQuotaService.checkQuota.mockReturnValue({ used: 0, remaining: 10, total: 10 });
    mockQuotaService.incrementUsage.mockReturnValue({ used: 1, remaining: 9, total: 10 });
    mockQuotaService.tryConsumeQuota.mockReturnValue({
        allowed: true,
        quota: { used: 1, remaining: 9, total: 10 }
    });
});

// ---------------------------------------------------------------------------
// POST /optimize — validation (returns JSON errors before SSE)
// ---------------------------------------------------------------------------

describe('POST /api/v1/resume/optimize — validation', () => {
    test('rejects missing params', async () => {
        const res = await request(app).post('/api/v1/resume/optimize').send({});
        expect(res.status).toBe(400);
        expect(res.body.error).toContain('缺少');
    });

    test('rejects invalid level', async () => {
        const res = await request(app)
            .post('/api/v1/resume/optimize').send({ level: 'bad', resumeText: 'My resume' });
        expect(res.status).toBe(400);
        expect(res.body.error).toContain('无效');
    });

    test('rejects oversized resumeText', async () => {
        const res = await request(app)
            .post('/api/v1/resume/optimize').send({ level: 'light', resumeText: 'x'.repeat(50001) });
        expect(res.status).toBe(400);
        expect(res.body.error).toContain('过长');
    });

    test('rejects oversized JD', async () => {
        const res = await request(app)
            .post('/api/v1/resume/optimize')
            .send({ level: 'light', resumeText: 'x', jobDescription: 'x'.repeat(10001) });
        expect(res.status).toBe(400);
        expect(res.body.error).toContain('过长');
    });

    test('rejects medium without JD', async () => {
        const res = await request(app)
            .post('/api/v1/resume/optimize').send({ level: 'medium', resumeText: 'x' });
        expect(res.status).toBe(400);
    });

    test('rejects deep without JD', async () => {
        const res = await request(app)
            .post('/api/v1/resume/optimize').send({ level: 'deep', resumeText: 'x' });
        expect(res.status).toBe(400);
    });

    test('returns 429 on quota exhaustion', async () => {
        mockQuotaService.tryConsumeQuota.mockReturnValue({
            allowed: false,
            quota: { used: 10, remaining: 0, total: 10 }
        });
        const res = await request(app)
            .post('/api/v1/resume/optimize').send({ level: 'light', resumeText: 'x' });
        expect(res.status).toBe(429);
        expect(res.body.error).toContain('已用完');
    });
});

// ---------------------------------------------------------------------------
// POST /optimize — SSE streaming
// ---------------------------------------------------------------------------

describe('POST /api/v1/resume/optimize — SSE', () => {
    test('returns SSE content-type', async () => {
        mockStreamOptimize.mockReturnValue((async function* () {
            yield { type: 'done', data: { optimizedContent: 'Done', score: 90 } };
        })());

        const res = await request(app)
            .post('/api/v1/resume/optimize').send({ level: 'light', resumeText: 'My resume' });
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('text/event-stream');
    });

    test('handles error in generator', async () => {
        mockStreamOptimize.mockReturnValue((async function* () {
            throw new Error('LLM error');
        })());

        const res = await request(app)
            .post('/api/v1/resume/optimize').send({ level: 'light', resumeText: 'My resume' });
        expect(res.status).toBe(200);
    });

    test('refunds reserved quota on error', async () => {
        mockStreamOptimize.mockReturnValue((async function* () {
            throw new Error('LLM error');
        })());

        await request(app)
            .post('/api/v1/resume/optimize').send({ level: 'light', resumeText: 'My resume' });
        expect(mockQuotaService.refundUsage).toHaveBeenCalledWith(1);
    });
});
