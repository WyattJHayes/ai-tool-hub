const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const toolRoot = path.resolve(__dirname, '..');
const distRoot = path.join(toolRoot, 'dist');

function listJavaScriptFiles(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) return listJavaScriptFiles(fullPath);
        return entry.name.endsWith('.js') ? [fullPath] : [];
    });
}

test('production build emits valid JavaScript with a complete local module graph', () => {
    execFileSync(process.execPath, [path.join(toolRoot, 'scripts/build.cjs')], {
        cwd: toolRoot,
        stdio: 'pipe'
    });

    const requiredFiles = [
        'src/lib/utils.js',
        'src/lib/apiClient.js',
        'src/components/authModal.js',
        'src/styles/tailwind.min.css'
    ];
    for (const relativePath of requiredFiles) {
        assert.equal(fs.existsSync(path.join(distRoot, relativePath)), true, `${relativePath} must be emitted`);
    }

    for (const file of listJavaScriptFiles(distRoot)) {
        execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
        const source = fs.readFileSync(file, 'utf8');
        const importPattern = /(?:from\s+|import\s*\()(['"])(\.\.?\/[^'"]+)\1/g;
        for (const match of source.matchAll(importPattern)) {
            const importedFile = path.resolve(path.dirname(file), match[2]);
            assert.equal(fs.existsSync(importedFile), true, `${path.relative(distRoot, file)} imports missing ${match[2]}`);
        }
    }
});
