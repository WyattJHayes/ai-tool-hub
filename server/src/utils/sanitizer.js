const SENSITIVE_PATTERNS = [
    { pattern: /(api[_-]?key|api[_-]?secret|secret[_-]?key|access[_-]?token|auth[_-]?token|jwt[_-]?token|bearer[_-]?token)\s*[=:]\s*['"]?([a-zA-Z0-9_\-]+)['"]?/gi, replacement: '$1=***' },
    { pattern: /sk-[a-zA-Z0-9]+/gi, replacement: 'sk-***' },
    { pattern: /pk-[a-zA-Z0-9]+/gi, replacement: 'pk-***' },
    { pattern: /AKIA[0-9A-Z]{16}/gi, replacement: 'AKIA***' },
    { pattern: /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi, replacement: (match) => {
        const parts = match.split('@');
        if (parts[0].length > 2) {
            return parts[0][0] + '*'.repeat(parts[0].length - 2) + parts[0].slice(-1) + '@' + parts[1];
        }
        return '***@' + parts[1];
    }},
    { pattern: /1[3-9]\d{9}/g, replacement: '1***' },
    { pattern: /password\s*[=:]\s*['"]?([^'"]+)['"]?/gi, replacement: 'password=***' },
    { pattern: /("password":\s*")([^"]+)"/gi, replacement: '$1***"' },
    { pattern: /Bearer\s+[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_+/=]+/gi, replacement: 'Bearer ***' },
    { pattern: /eyJhbGciOiJ[^\s]+/gi, replacement: 'eyJhbGciOiJ***' },
];

export function sanitize(text) {
    if (typeof text !== 'string') {
        return text;
    }
    
    let result = text;
    for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
        result = result.replace(pattern, replacement);
    }
    return result;
}

export function maskEmail(email) {
    if (!email || typeof email !== 'string') return '***';
    const [local, domain] = email.split('@');
    if (!domain) return '***';
    return local[0] + '***@' + domain;
}

export function sanitizeObject(obj) {
    if (typeof obj !== 'object' || obj === null) {
        return obj;
    }
    
    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item));
    }
    
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
            sanitized[key] = sanitize(value);
        } else if (typeof value === 'object' && value !== null) {
            sanitized[key] = sanitizeObject(value);
        } else {
            sanitized[key] = value;
        }
    }
    return sanitized;
}