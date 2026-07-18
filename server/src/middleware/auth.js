import jwt from 'jsonwebtoken';
import config from '../config.js';
import { userRateLimitMiddleware } from './rateLimit.js';

export function authMiddleware(req, res, next) {
    let token = null;
    
    // 优先从 Authorization header 读取
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
    } 
    // 其次从 Cookie 读取
    else if (req.cookies && req.cookies.auth_token) {
        token = req.cookies.auth_token;
    }
    
    if (!token) {
        return res.status(401).json({ error: '未登录，请先登录' });
    }

    let decoded;
    try {
        decoded = jwt.verify(token, config.JWT_SECRET, {
            issuer: config.JWT_ISSUER,
            audience: config.JWT_AUDIENCE
        });
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: '登录已过期，请重新登录' });
        }
        return res.status(401).json({ error: '无效的认证信息' });
    }

    req.user = decoded;
    return userRateLimitMiddleware(req, res, next);
}

export function generateToken(user) {
    return jwt.sign(
        { id: user.id, email: user.email },
        config.JWT_SECRET,
        {
            expiresIn: config.JWT_EXPIRES_IN,
            issuer: config.JWT_ISSUER,
            audience: config.JWT_AUDIENCE
        }
    );
}
