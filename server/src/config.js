import dotenv from 'dotenv';
dotenv.config();

function parseDailyQuota(raw) {
    if (raw === undefined || raw === '') return 10;
    const parsed = Number(raw);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 10;
}

const config = {
    PORT: parseInt(process.env.PORT, 10) || 3000,
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_EXPIRES_IN: '7d',
    JWT_ISSUER: process.env.JWT_ISSUER || 'ai-tool-hub',
    JWT_AUDIENCE: process.env.JWT_AUDIENCE || 'ai-tool-hub-users',
    PASSWORD_PEPPER: process.env.PASSWORD_PEPPER || process.env.JWT_SECRET || '',
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY || '',
    DEEPSEEK_BASE_URL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
    DEEPSEEK_MODEL: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    DAILY_QUOTA: parseDailyQuota(process.env.DAILY_QUOTA),

    // ===== 会员体系 =====
    MEMBERSHIP_PLANS: {
        free: {
            name: '免费用户',
            dailyQuota: 1,
            price: 0,
        },
        basic: {
            name: '基础会员',
            totalQuota: 10,       // 一次性 10 次
            price: 9.9,
            priceLabel: '¥9.9',
            description: '10次简历优化',
        },
        vip: {
            name: '永久VIP',
            dailyQuota: Infinity,  // 不限次数
            price: 99,
            priceLabel: '¥99',
            description: '无限次简历优化',
            permanent: true,
        },
    },

    // ===== 支付配置 =====
    ALIPAY_APP_ID: process.env.ALIPAY_APP_ID || '',
    ALIPAY_PRIVATE_KEY: process.env.ALIPAY_PRIVATE_KEY || '',
    ALIPAY_PUBLIC_KEY: process.env.ALIPAY_PUBLIC_KEY || '',
    ALIPAY_GATEWAY: process.env.ALIPAY_GATEWAY || 'https://openapi.alipay.com/gateway.do',
    ALIPAY_NOTIFY_URL: process.env.ALIPAY_NOTIFY_URL || '',

    WECHAT_MCH_ID: process.env.WECHAT_MCH_ID || '',
    WECHAT_APP_ID: process.env.WECHAT_APP_ID || '',
    WECHAT_API_KEY: process.env.WECHAT_API_KEY || '',
    WECHAT_NOTIFY_URL: process.env.WECHAT_NOTIFY_URL || '',
    WECHAT_CERT_PATH: process.env.WECHAT_CERT_PATH || '',

    CORS_ORIGIN: process.env.CORS_ORIGIN || 'https://weihub.cloud,http://localhost:3000',
    NODE_ENV: process.env.NODE_ENV || 'development'
};

export function validateConfig() {
    const warnings = [];
    const errors = [];

    if (!config.JWT_SECRET) {
        errors.push('[FATAL] JWT_SECRET must be set in environment variables!');
    }

    if (!config.PASSWORD_PEPPER) {
        errors.push('[FATAL] PASSWORD_PEPPER (or JWT_SECRET) must be set!');
    }

    if (
        process.env.DAILY_QUOTA !== undefined
        && process.env.DAILY_QUOTA !== ''
        && config.DAILY_QUOTA === 10
        && Number(process.env.DAILY_QUOTA) !== 10
    ) {
        warnings.push(`[CONFIG WARNING] Invalid DAILY_QUOTA "${process.env.DAILY_QUOTA}" — using default 10.`);
    }

    if (!config.DEEPSEEK_API_KEY) {
        warnings.push('[CONFIG WARNING] DEEPSEEK_API_KEY is not set. AI features will be unavailable.');
    }

    const isWildcard = config.CORS_ORIGIN === '*' || config.CORS_ORIGIN.includes('*');
    if (isWildcard && config.NODE_ENV === 'production') {
        warnings.push('[SECURITY WARNING] CORS_ORIGIN contains wildcard in production — restrict this to specific domains.');
    }

    errors.forEach(e => console.error(e));
    warnings.forEach(w => console.warn(w));

    if (errors.length > 0) {
        console.error('\nCannot start server due to configuration errors!');
        process.exit(1);
    }

    return warnings;
}

export default config;
