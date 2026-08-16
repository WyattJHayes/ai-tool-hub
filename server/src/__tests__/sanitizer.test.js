/**
 * Sanitizer tests — sensitive data removal from logs
 */
import { jest } from '@jest/globals';

let sanitize, sanitizeObject, maskEmail;

beforeAll(async () => {
    const sanitizer = await import('../utils/sanitizer.js');
    sanitize = sanitizer.sanitize;
    sanitizeObject = sanitizer.sanitizeObject;
    maskEmail = sanitizer.maskEmail;
});

// ---------------------------------------------------------------------------
// sanitize
// ---------------------------------------------------------------------------

describe('sanitize', () => {
    test('should return non-string values as-is', () => {
        expect(sanitize(null)).toBeNull();
        expect(sanitize(undefined)).toBeUndefined();
        expect(sanitize(42)).toBe(42);
        expect(sanitize({})).toEqual({});
    });

    test('should redact API key patterns', () => {
        const result = sanitize('api_key=sk-abc123def456');
        expect(result).toContain("***");
        expect(result).not.toContain('sk-abc123def456');
    });

    test('should redact named API keys (api_key, api-secret, etc.)', () => {
        const inputs = [
            'api_key=my-secret-key',
            'api-secret=super-secret',
            'secret_key=very-secret',
            'access_token=my-token',
            'auth_token=my-auth-token',
            'jwt_token=my-jwt-value',
            'bearer_token=my-bearer'
        ];
        for (const input of inputs) {
            const result = sanitize(input);
            expect(result).not.toContain('my-secret-key');
            expect(result).not.toContain('super-secret');
        }
    });

    test('should redact email addresses with partial masking', () => {
        const result = sanitize('contact: alice.smith@example.com');
        expect(result).toBe('contact: a*********h@example.com');
        expect(result).not.toContain('alice.smith@example.com');
    });

    test('should redact short email addresses (2 char local)', () => {
        const result = sanitize('email: ab@test.com');
        expect(result).toContain('***@test.com');
    });

    test('should redact phone numbers', () => {
        const result = sanitize('phone: 13812345678');
        expect(result).toBe('phone: 1***');
        expect(result).not.toContain('13812345678');
    });

    test('should redact password fields in query strings', () => {
        const result = sanitize('password=hunter2');
        expect(result).toBe('password=***');
    });

    test('should redact password in JSON', () => {
        const result = sanitize('{"password": "secret123"}');
        expect(result).toContain('"password": "***"');
        expect(result).not.toContain('secret123');
    });

    test('should redact JWT Bearer tokens', () => {
        const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dkNbyCUTpN2KZVuRsH4odVr8HMVf2kfMX6jNfl2-Sk0';
        const result = sanitize(`Authorization: Bearer ${jwt}`);
        expect(result).toBe('Authorization: Bearer ***');
    });

    test('should redact JWT tokens starting with eyJhbGciOiJ', () => {
        const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dkNbyCUTpN2KZVuRsH4odVr8HMVf2kfMX6jNfl2-Sk0';
        const result = sanitize(jwt);
        expect(result).toBe('eyJhbGciOiJ***');
    });

    test('should handle strings with no sensitive data', () => {
        const result = sanitize('Hello, this is a normal log message');
        expect(result).toBe('Hello, this is a normal log message');
    });

    test('should redact AWS access keys', () => {
        const result = sanitize('AWS key: AKIAIOSFODNN7EXAMPLE');
        expect(result).toContain('AKIA***');
        expect(result).not.toContain('AKIAIOSFODNN7EXAMPLE');
    });

    test('should apply multiple redactions in one string', () => {
        const input = 'user: alice@test.com, key: sk-test123, phone: 13900139000';
        const result = sanitize(input);
        expect(result).not.toContain('alice@test.com');
        expect(result).not.toContain('sk-test123');
        expect(result).not.toContain('13900139000');
    });
});

// ---------------------------------------------------------------------------
// sanitizeObject
// ---------------------------------------------------------------------------

describe('sanitizeObject', () => {
    test('should return non-object values as-is', () => {
        expect(sanitizeObject(null)).toBeNull();
        expect(sanitizeObject(42)).toBe(42);
        expect(sanitizeObject('string')).toBe('string');
    });

    test('should sanitize string values in an object', () => {
        const input = {
            email: 'alice@example.com',
            name: 'Alice',
            apiKey: 'sk-abc123'
        };
        const result = sanitizeObject(input);
        expect(result.email).not.toContain('alice@example.com');
        expect(result.name).toBe('Alice');
        expect(result.apiKey).not.toContain('sk-abc123');
    });

    test('should sanitize nested objects', () => {
        const input = {
            user: { email: 'bob@test.com', token: 'Bearer eyJhbGciOiJIUzI1NiJ9.test' }
        };
        const result = sanitizeObject(input);
        expect(result.user.email).not.toContain('bob@test.com');
        expect(result.user.token).toContain('***');
    });

    test('should sanitize arrays of objects', () => {
        const input = [
            { email: 'a@b.com' },
            { email: 'c@d.com' }
        ];
        const result = sanitizeObject(input);
        expect(result[0].email).not.toContain('a@b.com');
        expect(result[1].email).not.toContain('c@d.com');
    });

    test('should handle empty objects', () => {
        expect(sanitizeObject({})).toEqual({});
    });

    test('should handle arrays', () => {
        expect(sanitizeObject([1, 2, 3])).toEqual([1, 2, 3]);
    });
});

// ---------------------------------------------------------------------------
// maskEmail
// ---------------------------------------------------------------------------

describe('maskEmail', () => {
    test('masks the local part of an email', () => {
        expect(maskEmail('alice@example.com')).toBe('a***@example.com');
    });

    test('returns *** for non-string or invalid input', () => {
        expect(maskEmail('')).toBe('***');
        expect(maskEmail(null)).toBe('***');
        expect(maskEmail(42)).toBe('***');
        expect(maskEmail('no-at-sign')).toBe('***');
    });
});
