import logger from '../utils/logger.js';

const requestsPerMinute = new Map();
const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 30;
const MAX_MAP_SIZE = 10000;

export function rateLimitMiddleware(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();

    // ── IP-based rate limiting ──
    const ipKey = `ip:${ip}`;
    if (!requestsPerMinute.has(ipKey)) {
        requestsPerMinute.set(ipKey, []);
    }
    const ipRequests = requestsPerMinute.get(ipKey);
    const recentIpRequests = ipRequests.filter(t => now - t < WINDOW_MS);
    requestsPerMinute.set(ipKey, recentIpRequests);

    const remaining = MAX_REQUESTS - recentIpRequests.length;
    const resetTime = Math.ceil((WINDOW_MS - (now - (recentIpRequests[0] || now))) / 1000);

    res.setHeader('X-RateLimit-Limit', MAX_REQUESTS);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, remaining));
    res.setHeader('X-RateLimit-Reset', resetTime);

    if (recentIpRequests.length >= MAX_REQUESTS) {
        logger.warn(`[${req.requestId}] Rate limit exceeded: ip=${ip}, requests=${recentIpRequests.length}`);
        res.setHeader('Retry-After', resetTime);
        return res.status(429).json({ 
            error: '请求过于频繁，请稍后再试',
            retryAfter: resetTime 
        });
    }

    recentIpRequests.push(now);

    next();
}

export function userRateLimitMiddleware(req, res, next) {
    const userId = req.user?.id;
    if (!userId) return next();

    const now = Date.now();
    const userKey = `user:${userId}`;
    const userRequests = requestsPerMinute.get(userKey) || [];
    const recentUserRequests = userRequests.filter(t => now - t < WINDOW_MS);
    if (recentUserRequests.length >= MAX_REQUESTS) {
        logger.warn(`[${req.requestId}] User rate limit exceeded: user=${userId}`);
        return res.status(429).json({ error: '请求过于频繁，请稍后再试' });
    }
    recentUserRequests.push(now);
    requestsPerMinute.set(userKey, recentUserRequests);
    next();
}

setInterval(() => {
    const now = Date.now();
    let cleanedCount = 0;
    for (const [key, requests] of requestsPerMinute) {
        const recent = requests.filter(t => now - t < WINDOW_MS);
        if (recent.length === 0) {
            requestsPerMinute.delete(key);
            cleanedCount++;
        } else {
            requestsPerMinute.set(key, recent);
        }
    }
    // Evict oldest entries if Map exceeds capacity
    if (requestsPerMinute.size > MAX_MAP_SIZE) {
        const keys = [...requestsPerMinute.keys()];
        const excess = requestsPerMinute.size - MAX_MAP_SIZE;
        for (let i = 0; i < excess; i++) {
            requestsPerMinute.delete(keys[i]);
        }
        cleanedCount += excess;
    }
    if (cleanedCount > 0) {
        logger.debug(`Rate limit cleanup: removed ${cleanedCount} entries`);
    }
}, WINDOW_MS);
