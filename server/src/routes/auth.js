import { Router } from 'express';
import { generateToken, authMiddleware } from '../middleware/auth.js';
import { quotaService } from '../services/quota.js';
import config from '../config.js';
import logger from '../utils/logger.js';

const router = Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN = 8;
const PASSWORD_STRENGTH_REGEX = /^(?=.*[A-Za-z])(?=.*\d)/;

const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000;
const MAX_LOCKOUT_ENTRIES = 5000;

setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    for (const [email, attempts] of loginAttempts) {
        if (now - attempts.lastAttempt > LOCKOUT_DURATION) {
            loginAttempts.delete(email);
            cleaned++;
        }
    }
    // Evict oldest entries if Map exceeds capacity
    if (loginAttempts.size > MAX_LOCKOUT_ENTRIES) {
        const entries = [...loginAttempts.entries()].sort((a, b) => a[1].lastAttempt - b[1].lastAttempt);
        const excess = loginAttempts.size - MAX_LOCKOUT_ENTRIES;
        for (let i = 0; i < excess; i++) {
            loginAttempts.delete(entries[i][0]);
            cleaned++;
        }
    }
    if (cleaned > 0) {
        logger.info(`Cleaned ${cleaned} expired/evicted login lockouts`);
    }
}, 5 * 60 * 1000);

function checkLoginLock(email) {
    const attempts = loginAttempts.get(email);
    if (!attempts) return { locked: false, remaining: MAX_LOGIN_ATTEMPTS };
    
    if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
        const elapsed = Date.now() - attempts.lastAttempt;
        if (elapsed < LOCKOUT_DURATION) {
            return { locked: true, remainingMs: LOCKOUT_DURATION - elapsed };
        }
        loginAttempts.delete(email);
    }
    return { locked: false, remaining: MAX_LOGIN_ATTEMPTS - (attempts?.count || 0) };
}

function recordFailedAttempt(email) {
    const attempts = loginAttempts.get(email) || { count: 0, lastAttempt: 0 };
    attempts.count++;
    attempts.lastAttempt = Date.now();
    loginAttempts.set(email, attempts);
}

function clearFailedAttempts(email) {
    loginAttempts.delete(email);
}

function maskEmail(email) {
    if (!email || typeof email !== 'string') return '***';
    const [local, domain] = email.split('@');
    if (!domain) return '***';
    return local[0] + '***@' + domain;
}

router.post('/register', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: '邮箱和密码不能为空' });
        }

        if (!EMAIL_REGEX.test(email)) {
            return res.status(400).json({ error: '邮箱格式不正确' });
        }

        if (password.length < PASSWORD_MIN) {
            return res.status(400).json({ error: `密码至少${PASSWORD_MIN}位` });
        }

        if (!PASSWORD_STRENGTH_REGEX.test(password)) {
            return res.status(400).json({ error: '密码必须包含至少一个字母和一个数字' });
        }

        const result = await quotaService.register(email, password);
        if (result.error) {
            return res.status(409).json({ error: result.error });
        }

        const user = result.user;
        const token = generateToken({ id: user.id, email: user.email });
        const quota = quotaService.checkQuota(user.id);

        const cookieOptions = {
            httpOnly: true,
            secure: config.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            path: '/'
        };
        res.cookie('auth_token', token, cookieOptions);

        logger.info(`User registered: ${maskEmail(email)}`);
        res.status(201).json({
            user,
            quota
        });
    } catch (error) {
        logger.error('Register error:', error);
        res.status(500).json({ error: '注册失败，请稍后重试' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: '邮箱和密码不能为空' });
        }

        const lockStatus = checkLoginLock(email);
        if (lockStatus.locked) {
            const remainingMin = Math.ceil(lockStatus.remainingMs / 60000);
            logger.warn(`Account locked: ${maskEmail(email)}`);
            return res.status(429).json({ 
                error: `登录尝试过多，请${remainingMin}分钟后再试` 
            });
        }

        const user = await quotaService.verifyPassword(email, password);
        if (!user) {
            recordFailedAttempt(email);
            const remaining = MAX_LOGIN_ATTEMPTS - (loginAttempts.get(email)?.count || 0);
            logger.warn(`Failed login attempt for: ${maskEmail(email)}, remaining: ${remaining}`);
            return res.status(401).json({ 
                error: '邮箱或密码不正确',
                remainingAttempts: remaining
            });
        }

        clearFailedAttempts(email);

        const token = generateToken({ id: user.id, email: user.email });
        const quota = quotaService.checkQuota(user.id);

        const cookieOptions = {
            httpOnly: true,
            secure: config.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            path: '/'
        };
        res.cookie('auth_token', token, cookieOptions);

        logger.info(`User logged in: ${maskEmail(email)}`);
        res.json({
            user: { id: user.id, email: user.email },
            quota
        });
    } catch (error) {
        logger.error('Login error:', error);
        res.status(500).json({ error: '登录失败，请稍后重试' });
    }
});

router.post('/logout', (req, res) => {
    res.clearCookie('auth_token', {
        httpOnly: true,
        secure: config.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/'
    });
    res.json({ ok: true });
});

router.get('/me', authMiddleware, (req, res) => {
    try {
        const user = quotaService.getUserById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }

        const quota = quotaService.checkQuota(user.id);
        const membership = quotaService.getMembership(user.id);
        res.json({
            user: { id: user.id, email: user.email, createdAt: user.createdAt },
            quota,
            membership: membership || { plan: 'free', status: 'active' },
        });
    } catch (error) {
        logger.error('Get user info error:', error);
        res.status(500).json({ error: '获取用户信息失败' });
    }
});

export default router;
