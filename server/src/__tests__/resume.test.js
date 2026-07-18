/**
 * Resume route tests
 */
import { jest } from '@jest/globals';
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock dependencies before importing routes
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

const mockLlmService = {
    parseResumeText: jest.fn(),
    analyzeJD: jest.fn()
};

jest.unstable_mockModule('../services/llm.js', () => ({
    LLMService: jest.fn(() => mockLlmService)
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
    mockQuotaService.tryConsumeQuota.mockImplementation(() => ({
        allowed: true,
        quota: mockQuotaService.incrementUsage()
    }));
});

// ---------------------------------------------------------------------------
// POST /parse
// ---------------------------------------------------------------------------

describe('POST /api/v1/resume/parse', () => {
    test('should parse resume text successfully', async () => {
        mockLlmService.parseResumeText.mockResolvedValue({
            profile: { name: '张三', email: 'zhang@example.com' },
            skills: ['JavaScript', 'React']
        });

        const res = await request(app)
            .post('/api/v1/resume/parse')
            .send({ text: 'This is a resume with more than ten characters...' });

        expect(res.status).toBe(200);
        expect(res.body.profile.name).toBe('张三');
        expect(res.body.skills).toHaveLength(2);
    });

    test('should reject missing text', async () => {
        const res = await request(app)
            .post('/api/v1/resume/parse')
            .send({});

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('缺少');
    });

    test('should reject too short text', async () => {
        const res = await request(app)
            .post('/api/v1/resume/parse')
            .send({ text: 'short' });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('文本过短');
    });

    test('should reject oversized text', async () => {
        const res = await request(app)
            .post('/api/v1/resume/parse')
            .send({ text: 'x'.repeat(50001) });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('过长');
    });

    test('should return 429 when quota exhausted', async () => {
        mockQuotaService.tryConsumeQuota.mockReturnValue({
            allowed: false,
            quota: { used: 10, remaining: 0, total: 10 }
        });

        const res = await request(app)
            .post('/api/v1/resume/parse')
            .send({ text: 'This is a resume with enough text to pass validation...' });

        expect(res.status).toBe(429);
        expect(res.body.error).toContain('已用完');
    });

    test('should return 503 when LLM not configured', async () => {
        mockLlmService.parseResumeText.mockRejectedValue(new Error('not configured'));

        const res = await request(app)
            .post('/api/v1/resume/parse')
            .send({ text: 'This is a resume with enough text to pass validation...' });

        expect(res.status).toBe(503);
        expect(res.body.fallback).toBe(true);
    });

    test('should return 500 on service error', async () => {
        mockLlmService.parseResumeText.mockRejectedValue(new Error('API error'));

        const res = await request(app)
            .post('/api/v1/resume/parse')
            .send({ text: 'This is a resume with enough text to pass validation...' });

        expect(res.status).toBe(500);
        expect(res.body.error).toContain('解析失败');
        expect(mockQuotaService.refundUsage).toHaveBeenCalledWith(1);
    });

    test('should allow only one concurrent request to consume the final quota', async () => {
        let remaining = 1;
        mockQuotaService.tryConsumeQuota.mockImplementation(() => {
            if (remaining === 0) {
                return { allowed: false, quota: { used: 1, remaining: 0, total: 1 } };
            }
            remaining -= 1;
            return { allowed: true, quota: { used: 1, remaining: 0, total: 1 } };
        });
        mockLlmService.parseResumeText.mockImplementation(async () => {
            await new Promise(resolve => setTimeout(resolve, 10));
            return { profile: { name: 'Allowed' } };
        });

        const requests = [1, 2].map(() => request(app)
            .post('/api/v1/resume/parse')
            .send({ text: 'This is a resume with enough text to pass validation...' }));
        const responses = await Promise.all(requests);

        expect(responses.map(response => response.status).sort()).toEqual([200, 429]);
    });
});

// ---------------------------------------------------------------------------
// POST /analyze-jd
// ---------------------------------------------------------------------------

describe('POST /api/v1/resume/analyze-jd', () => {
    test('should analyze job description successfully', async () => {
        mockLlmService.analyzeJD.mockResolvedValue({
            keywords: ['React', 'TypeScript'],
            requirements: ['3年经验']
        });

        const res = await request(app)
            .post('/api/v1/resume/analyze-jd')
            .send({ jdText: 'We are looking for a senior React developer...' });

        expect(res.status).toBe(200);
        expect(res.body.keywords).toContain('React');
    });

    test('should reject missing jdText', async () => {
        const res = await request(app)
            .post('/api/v1/resume/analyze-jd')
            .send({});

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('缺少');
    });

    test('should reject oversized JD text', async () => {
        const res = await request(app)
            .post('/api/v1/resume/analyze-jd')
            .send({ jdText: 'x'.repeat(10001) });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('过长');
    });

    test('should return 429 when quota exhausted', async () => {
        mockQuotaService.tryConsumeQuota.mockReturnValue({
            allowed: false,
            quota: { used: 10, remaining: 0, total: 10 }
        });

        const res = await request(app)
            .post('/api/v1/resume/analyze-jd')
            .send({ jdText: 'We are looking for a developer...' });

        expect(res.status).toBe(429);
        expect(res.body.error).toContain('已用完');
    });

    test('should return 500 on service error', async () => {
        mockLlmService.analyzeJD.mockRejectedValue(new Error('API error'));

        const res = await request(app)
            .post('/api/v1/resume/analyze-jd')
            .send({ jdText: 'We are looking for a developer...' });

        expect(res.status).toBe(500);
        expect(res.body.error).toContain('分析失败');
        expect(mockQuotaService.refundUsage).toHaveBeenCalledWith(1);
    });
});
