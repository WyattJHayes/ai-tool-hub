/** @jest-environment node */
import { jest } from '@jest/globals';

jest.unstable_mockModule('../utils/logger.js', () => ({
    default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

jest.unstable_mockModule('../config.js', () => ({
    default: {
        MEMBERSHIP_PLANS: {
            free: { name: 'Free', dailyQuota: 1, price: 0 },
            basic: { name: 'Basic', totalQuota: 10, price: 9.9 },
            vip: { name: 'VIP', dailyQuota: Infinity, price: 99, permanent: true }
        },
        ALIPAY_APP_ID: '',
        WECHAT_MCH_ID: 'configured-but-not-integrated',
        WECHAT_APP_ID: 'app-id',
        WECHAT_API_KEY: 'api-key',
        WECHAT_NOTIFY_URL: 'https://example.com/notify',
        NODE_ENV: 'test'
    }
}));

const createOrder = jest.fn();
jest.unstable_mockModule('../services/quota.js', () => ({
    quotaService: {
        getMembership: jest.fn(() => null),
        checkQuota: jest.fn(() => ({ remaining: 1 })),
        createOrder,
        getOrder: jest.fn(),
        getOrdersByUser: jest.fn()
    }
}));

jest.unstable_mockModule('../middleware/auth.js', () => ({
    authMiddleware: (req, res, next) => {
        req.user = { id: 'user-1' };
        next();
    }
}));

const express = (await import('express')).default;
const request = (await import('supertest')).default;
const paymentRoutes = (await import('../routes/payment.js')).default;

const app = express();
app.use(express.json());
app.use('/api/v1/payment', paymentRoutes);

test('returns 501 for WeChat until server-side unified-order creation is implemented', async () => {
    const response = await request(app)
        .post('/api/v1/payment/order')
        .send({ plan: 'basic', paymentMethod: 'wechat' });

    expect(response.status).toBe(501);
    expect(createOrder).not.toHaveBeenCalled();
});
