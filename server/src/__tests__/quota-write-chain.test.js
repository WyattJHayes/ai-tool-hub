/**
 * @jest-environment node
 *
 * Quota persistence write-chain tests for server/src/services/quota.js
 *
 * [L-6] `_enqueueWrite` attaches its error handler to the DERIVED promise
 * instead of assigning the recovered chain back to `this._writeQueue`:
 *
 *   this._writeQueue = this._writeQueue.then(write);   // may become rejected
 *   this._writeQueue.catch(log);                       // not assigned back!
 *
 * After the FIRST write failure, `this._writeQueue` stays rejected forever,
 * so every later `.then(...)` callback is skipped: persistence is silently
 * disabled for the remaining lifetime of the process while in-memory state
 * keeps working (data loss only on restart — the worst kind of silent bug).
 *
 * The `test.failing` case encodes the DESIRED post-fix behavior (a recovered
 * chain that keeps writing after a transient failure). It stays green while
 * the bug is present and turns red once fixed — then promote it to test().
 */
import { jest, describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { mkdtempSync, rmSync, chmodSync, readFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

jest.unstable_mockModule('../utils/logger.js', () => ({
    default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

const { QuotaService } = await import('../services/quota.js');

describe('QuotaService persistence', () => {
    let dir;
    let dataPath;

    beforeAll(() => {
        dir = mkdtempSync(join(tmpdir(), 'quota-write-chain-'));
        dataPath = join(dir, 'quota.json');
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterAll(() => {
        chmodSync(dir, 0o700);
        rmSync(dir, { recursive: true, force: true });
        jest.restoreAllMocks();
    });

    test('persists registered users to disk after flush', async () => {
        const svc = new QuotaService(dataPath);
        svc.register('alice@example.com', 'password1');
        await svc.flush();

        const onDisk = JSON.parse(readFileSync(dataPath, 'utf8'));
        expect(onDisk.users.map((u) => u.email)).toContain('alice@example.com');
        // The stored user must not contain the password hash in plaintext form
        // beyond the scrypt hash itself, and register() must not return it.
        expect(onDisk.users[0].password).toMatch(/^[0-9a-f]+:[0-9a-f]+$/);
    });

    test('[L-6] a transient write failure must not disable later writes', async () => {
        const svc = new QuotaService(dataPath);

        // 1. Healthy write.
        svc.register('bob@example.com', 'password1');
        await svc.flush();

        // 2. Force a write failure: read-only directory makes writeFile fail
        //    with EACCES (a classic transient ops condition).
        chmodSync(dir, 0o500);
        svc.register('carol@example.com', 'password1');
        await svc.flush().catch(() => undefined); // the failing write surfaces here

        // 3. Condition recovered — persistence MUST resume. Today it never
        //    does: _writeQueue stays rejected and every later .then() is
        //    skipped, so nothing after this point ever hits the disk.
        chmodSync(dir, 0o700);
        svc.register('dave@example.com', 'password1');
        await svc.flush();

        expect(existsSync(dataPath)).toBe(true);
        const onDisk = JSON.parse(readFileSync(dataPath, 'utf8'));
        expect(onDisk.users.map((u) => u.email)).toContain('dave@example.com');
    });
});
