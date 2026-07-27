/**
 * Guards the service worker cache version against drifting from package.json.
 *
 * sw.js keeps a literal CACHE_VERSION so it stays valid JavaScript for the
 * tests that evaluate it directly. The build rewrites that literal from
 * package.json, and these tests fail if the checked-in value falls behind.
 */
import { describe, test, expect } from '@jest/globals';
import fs from 'fs';

const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
const swSource = fs.readFileSync('./sw.js', 'utf8');

describe('service worker cache version', () => {
    test('declares CACHE_VERSION in a form the build can rewrite', () => {
        expect(swSource).toMatch(/^const CACHE_VERSION = 'v\d+\.\d+\.\d+';$/m);
    });

    test('matches the version in package.json', () => {
        const match = /^const CACHE_VERSION = '(v[^']*)';$/m.exec(swSource);

        expect(match).not.toBeNull();
        expect(match[1]).toBe(`v${pkg.version}`);
    });

    test('derives CACHE_NAME from the prefix and version', () => {
        expect(swSource).toMatch(/const CACHE_NAME = `\$\{CACHE_PREFIX\}\$\{CACHE_VERSION\}`/);
    });

    test('does not hardcode a version string anywhere else', () => {
        const withoutVersionLine = swSource.replace(/^const CACHE_VERSION = 'v[^']*';$/m, '');

        expect(withoutVersionLine).not.toMatch(/v\d+\.\d+\.\d+/);
    });
});
