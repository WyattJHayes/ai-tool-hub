/**
 * config.js tests
 */
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';

describe('config module', () => {
    const ORIGINAL_ENV = { ...process.env };

    afterEach(() => {
        process.env = { ...ORIGINAL_ENV };
        jest.resetModules();
    });

    test('should use default values when env vars are not set', async () => {
        // Clear relevant env vars
        delete process.env.JWT_SECRET;
        delete process.env.PORT;
        delete process.env.DEEPSEEK_API_KEY;
        delete process.env.DAILY_QUOTA;
        delete process.env.CORS_ORIGIN;
        delete process.env.NODE_ENV;

        const config = (await import('../config.js')).default;

        expect(config.PORT).toBe(3000);
        expect(config.DAILY_QUOTA).toBe(10);
        expect(config.CORS_ORIGIN).toBe('https://weihub.cloud,http://localhost:3000');
        expect(config.NODE_ENV).toBe('development');
        expect(config.DEEPSEEK_API_KEY).toBe('');
    });

    test('should read values from environment', async () => {
        process.env.PORT = '4000';
        process.env.JWT_SECRET = 'test-secret';
        process.env.DEEPSEEK_API_KEY = 'sk-test';
        process.env.DAILY_QUOTA = '20';
        process.env.CORS_ORIGIN = 'https://example.com';
        process.env.NODE_ENV = 'production';

        const config = (await import('../config.js')).default;

        expect(config.PORT).toBe(4000);
        expect(config.JWT_SECRET).toBe('test-secret');
        expect(config.DEEPSEEK_API_KEY).toBe('sk-test');
        expect(config.DAILY_QUOTA).toBe(20);
        expect(config.CORS_ORIGIN).toBe('https://example.com');
        expect(config.NODE_ENV).toBe('production');
    });

    test('validateConfig should error when JWT_SECRET missing', async () => {
        delete process.env.JWT_SECRET;

        const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        const mod = await import('../config.js');
        mod.validateConfig();

        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('JWT_SECRET'));
        expect(exitSpy).toHaveBeenCalledWith(1);

        exitSpy.mockRestore();
        errorSpy.mockRestore();
    });

    test('validateConfig should warn when DEEPSEEK_API_KEY missing', async () => {
        process.env.JWT_SECRET = 'test-secret';
        delete process.env.DEEPSEEK_API_KEY;

        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        const mod = await import('../config.js');
        const warnings = mod.validateConfig();

        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('DEEPSEEK_API_KEY'));
        expect(warnings.length).toBeGreaterThan(0);

        warnSpy.mockRestore();
    });

    test('validateConfig should warn about wildcard CORS in production', async () => {
        process.env.JWT_SECRET = 'test-secret';
        process.env.CORS_ORIGIN = '*';
        process.env.NODE_ENV = 'production';

        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        const mod = await import('../config.js');
        mod.validateConfig();

        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('CORS_ORIGIN'));

        warnSpy.mockRestore();
    });

    test('DAILY_QUOTA falls back to 10 for invalid values', async () => {
        process.env.JWT_SECRET = 'test-secret';
        process.env.DAILY_QUOTA = 'not-a-number';
        const config = (await import('../config.js')).default;
        expect(config.DAILY_QUOTA).toBe(10);
    });

    test('DAILY_QUOTA treats zero and negative as invalid', async () => {
        process.env.JWT_SECRET = 'test-secret';
        process.env.DAILY_QUOTA = '0';
        const config = (await import('../config.js')).default;
        expect(config.DAILY_QUOTA).toBe(10);
    });

    test('validateConfig warns on an invalid DAILY_QUOTA', async () => {
        process.env.JWT_SECRET = 'test-secret';
        process.env.DAILY_QUOTA = 'abc';
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const mod = await import('../config.js');
        mod.validateConfig();
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('DAILY_QUOTA'));
        warnSpy.mockRestore();
    });

    test('PASSWORD_PEPPER falls back to JWT_SECRET, not a hardcoded value', async () => {
        process.env.JWT_SECRET = 'test-secret';
        delete process.env.PASSWORD_PEPPER;
        const config = (await import('../config.js')).default;
        expect(config.PASSWORD_PEPPER).toBe('test-secret');
    });
});
