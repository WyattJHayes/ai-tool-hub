import { Router } from 'express';
import { generateToken, authMiddleware } from '../middleware/auth.js';
import { quotaService } from '../services/quota.js';
import config from '../config.js';
import logger from '../utils/logger.js';
import { maskEmail } from '../utils/sanitizer.js';

const router = Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN = 8;
const PASSWORD_STRENGTH_REGEX = /^(?=.*[A-Za-z])(?=.*\d)/;

const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 5;          // per (ip, email) pair — brute-force guard
const IP_MAX_ATTEMPTS = 20;            // per ip across emails — rotation guard
const LOCKOUT_DURATION = 15 * 60 * 1000;
const MAX_LOCKOUT_ENTRIES = 5000;

setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, attempts] of loginAttempts) {
        if (now - attempts.lastAttempt > LOCKOUT_DURATION) {
            loginAttempts.delete(key);
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

// The brute-force budget is scoped to the (ip, email) PAIR, never the email
// alone — otherwise an attacker could lock a victim out with 5 wrong
// passwords from any IP. A separate per-IP budget stops email rotation.
function pairKey(email, ip) {
    return `p:${ip}:${email}`;
}

function checkLoginLock(email, ip) {
    const pairAttempts = loginAttempts.get(pairKey(email, ip));
    if (pairAttempts && pairAttempts.count >= MAX_LOGIN_ATTEMPTS) {
        const elapsed = Date.now() - pairAttempts.lastAttempt;
        if (elapsed < LOCKOUT_DURATION) {
            return { locked: true, remainingMs: LOCKOUT_DURATION - elapsed };
        }
        loginAttempts.delete(pairKey(email, ip));
    }
    const ipAttempts = loginAttempts.get(`i:${ip}`);
    if (ipAttempts && ipAttempts.count >= IP_MAX_ATTEMPTS) {
        const elapsed = Date.now() - ipAttempts.lastAttempt;
        if (elapsed < LOCKOUT_DURATION) {
            return { locked: true, remainingMs: LOCKOUT_DURATION - elapsed };
        }
        loginAttempts.delete(`i:${ip}`);
    }
    return { locked: false, remaining: MAX_LOGIN_ATTEMPTS - (pairAttempts?.count || 0) };
}

function recordFailedAttempt(email, ip) {
    for (const key of [pairKey(email, ip), `i:${ip}`]) {
        const attempts = loginAttempts.get(key) || { count: 0, lastAttempt: 0 };
        attempts.count++;
        attempts.lastAttempt = Date.now();
        loginAttempts.set(key, attempts);
    }
}

function clearFailedAttempts(email, ip) {
    loginAttempts.delete(pairKey(email, ip));
    // The per-IP budget survives a single success so email rotation from one
    // client still exhausts; it only clears when it was never exhausted.
}

const registerAttempts = new Map();
const REGISTER_MAX_ATTEMPTS = 10;
const REGISTER_WINDOW_MS = 10 * 60 * 1000;
const MAX_REGISTER_ENTRIES = 5000;

setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of registerAttempts) {
        if (now - entry.windowStart > REGISTER_WINDOW_MS) registerAttempts.delete(ip);
    }
    if (registerAttempts.size > MAX_REGISTER_ENTRIES) {
        const entries = [...registerAttempts.entries()].sort((a, b) => a[1].windowStart - b[1].windowStart);
        for (let i = 0; i < registerAttempts.size - MAX_REGISTER_ENTRIES; i++) {
            registerAttempts.delete(entries[i][0]);
        }
    }
}, 5 * 60 * 1000).unref?.();

router.post('/register', async (req, res) => {
    try {
        // [VULN-5] A 409 on existing emails lets attackers enumerate accounts.
        // A per-IP budget on this endpoint keeps bulk probing expensive
        // without touching the normal single-signup flow.
        const ip = req.ip;
        const entry = registerAttempts.get(ip) || { count: 0, windowStart: 0 };
        const now = Date.now();
        if (now - entry.windowStart > REGISTER_WINDOW_MS) {
            entry.count = 0;
            entry.windowStart = now;
        }
        if (entry.count >= REGISTER_MAX_ATTEMPTS) {
            logger.warn(`Register rate limit exceeded: ip=${ip}`);
            return res.status(429).json({ error: '注册请求过于频繁，请稍后再试' });
        }
        entry.count++;
        registerAttempts.set(ip, entry);

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

        const lockStatus = checkLoginLock(email, req.ip);
        if (lockStatus.locked) {
            const remainingMin = Math.ceil(lockStatus.remainingMs / 60000);
            logger.warn(`Account locked: ${maskEmail(email)}, ip=${req.ip}`);
            return res.status(429).json({ 
                error: `登录尝试过多，请${remainingMin}分钟后再试` 
            });
        }

        const user = await quotaService.verifyPassword(email, password);
        if (!user) {
            recordFailedAttempt(email, req.ip);
            const remaining = MAX_LOGIN_ATTEMPTS - (loginAttempts.get(pairKey(email, req.ip))?.count || 0);
            logger.warn(`Failed login attempt for: ${maskEmail(email)}, ip=${req.ip}, remaining: ${remaining}`);
            return res.status(401).json({ 
                error: '邮箱或密码不正确',
                remainingAttempts: Math.max(0, remaining)
            });
        }

        clearFailedAttempts(email, req.ip);

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
