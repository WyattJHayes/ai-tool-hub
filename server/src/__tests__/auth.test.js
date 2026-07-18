/**
 * Auth route tests
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
    register: jest.fn(),
    verifyPassword: jest.fn(),
    checkQuota: jest.fn(() => ({ used: 0, remaining: 10, total: 10 })),
    getUserById: jest.fn(),
    getMembership: jest.fn(() => ({ plan: 'free', status: 'active' }))
};

jest.unstable_mockModule('../services/quota.js', () => ({
    quotaService: mockQuotaService
}));

jest.unstable_mockModule('../middleware/auth.js', () => ({
    authMiddleware: (req, res, next) => {
        req.user = { id: 1, email: 'test@example.com' };
        next();
    },
    generateToken: jest.fn(() => 'mock-jwt-token')
}));

let app, request;

beforeAll(async () => {
    const express = (await import('express')).default;
    request = (await import('supertest')).default;
    const authRoutes = (await import('../routes/auth.js')).default;
    app = express();
    app.use(express.json());
    app.use('/api/v1/auth', authRoutes);
    app.use((req, res) => res.status(404).json({ error: 'not found' }));
});

beforeEach(() => {
    jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// POST /register
// ---------------------------------------------------------------------------

describe('POST /api/v1/auth/register', () => {
    test('should register successfully with valid email and password', async () => {
        mockQuotaService.register.mockResolvedValue({
            user: { id: 2, email: 'new@example.com' }
        });

        const res = await request(app)
            .post('/api/v1/auth/register')
            .send({ email: 'new@example.com', password: 'Password1' });

        expect(res.status).toBe(201);
        expect(res.body.user.email).toBe('new@example.com');
    });

    test('should reject request with missing email', async () => {
        const res = await request(app)
            .post('/api/v1/auth/register')
            .send({ password: 'Password1' });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('不能为空');
    });

    test('should reject request with missing password', async () => {
        const res = await request(app)
            .post('/api/v1/auth/register')
            .send({ email: 'test@example.com' });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('不能为空');
    });

    test('should reject invalid email format', async () => {
        const res = await request(app)
            .post('/api/v1/auth/register')
            .send({ email: 'not-a-valid-email', password: 'Password1' });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('邮箱格式不正确');
    });

    test('should reject short password', async () => {
        const res = await request(app)
            .post('/api/v1/auth/register')
            .send({ email: 'test@example.com', password: 'Ab1' });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('密码至少8位');
    });

    test('should reject weak password without letters', async () => {
        const res = await request(app)
            .post('/api/v1/auth/register')
            .send({ email: 'test@example.com', password: '12345678' });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('密码必须包含');
    });

    test('should reject weak password without numbers', async () => {
        const res = await request(app)
            .post('/api/v1/auth/register')
            .send({ email: 'test@example.com', password: 'password' });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('密码必须包含');
    });

    test('should return 409 when email is already registered', async () => {
        mockQuotaService.register.mockResolvedValue({ error: '该邮箱已注册' });

        const res = await request(app)
            .post('/api/v1/auth/register')
            .send({ email: 'existing@example.com', password: 'Password1' });

        expect(res.status).toBe(409);
        expect(res.body.error).toBe('该邮箱已注册');
    });

    test('should return 500 on service error', async () => {
        mockQuotaService.register.mockRejectedValue(new Error('DB error'));

        const res = await request(app)
            .post('/api/v1/auth/register')
            .send({ email: 'test@example.com', password: 'Password1' });

        expect(res.status).toBe(500);
        expect(res.body.error).toContain('注册失败');
    });
});

// ---------------------------------------------------------------------------
// POST /login
// ---------------------------------------------------------------------------

describe('POST /api/v1/auth/login', () => {
    test('should login successfully with valid credentials', async () => {
        mockQuotaService.verifyPassword.mockResolvedValue({
            id: 1, email: 'test@example.com'
        });

        const res = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: 'test@example.com', password: 'Password1' });

        expect(res.status).toBe(200);
        expect(res.body.user).toBeDefined();
        expect(res.body.quota).toBeDefined();
    });

    test('should reject missing email', async () => {
        const res = await request(app)
            .post('/api/v1/auth/login')
            .send({ password: 'Password1' });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('不能为空');
    });

    test('should reject invalid credentials', async () => {
        mockQuotaService.verifyPassword.mockResolvedValue(null);

        const res = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: 'wrong@example.com', password: 'WrongPass1' });

        expect(res.status).toBe(401);
        expect(res.body.error).toContain('邮箱或密码不正确');
    });

    test('should track remaining login attempts', async () => {
        mockQuotaService.verifyPassword.mockResolvedValue(null);

        const res = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: 'hacker@example.com', password: 'WrongPass1' });

        expect(res.status).toBe(401);
        expect(res.body.remainingAttempts).toBeDefined();
    });

    test('should return 500 on service error', async () => {
        mockQuotaService.verifyPassword.mockRejectedValue(new Error('DB error'));

        const res = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: 'test@example.com', password: 'Password1' });

        expect(res.status).toBe(500);
        expect(res.body.error).toContain('登录失败');
    });
});

// ---------------------------------------------------------------------------
// GET /me
// ---------------------------------------------------------------------------

describe('GET /api/v1/auth/me', () => {
    test('should return user info for authenticated user', async () => {
        mockQuotaService.getUserById.mockReturnValue({
            id: 1, email: 'test@example.com', createdAt: '2024-01-01'
        });

        const res = await request(app)
            .get('/api/v1/auth/me');

        expect(res.status).toBe(200);
        expect(res.body.user.email).toBe('test@example.com');
    });

    test('should return 404 when user not found', async () => {
        mockQuotaService.getUserById.mockReturnValue(null);

        const res = await request(app)
            .get('/api/v1/auth/me');

        expect(res.status).toBe(404);
        expect(res.body.error).toContain('用户不存在');
    });

    test('should return 500 on service error', async () => {
        mockQuotaService.getUserById.mockImplementation(() => {
            throw new Error('DB error');
        });

        const res = await request(app)
            .get('/api/v1/auth/me');

        expect(res.status).toBe(500);
        expect(res.body.error).toContain('获取用户信息失败');
    });
});

describe('POST /api/v1/auth/logout', () => {
    test('clears the HttpOnly authentication cookie', async () => {
        const res = await request(app)
            .post('/api/v1/auth/logout');

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(res.headers['set-cookie'][0]).toContain('auth_token=;');
    });
});
