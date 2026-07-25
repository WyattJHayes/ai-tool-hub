import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const guardUrl = new URL('./next-audit-guard.mjs', import.meta.url);

function sharpReport(url = 'https://github.com/advisories/GHSA-f88m-g3jw-g9cj') {
  return {
    auditReportVersion: 2,
    vulnerabilities: {
      next: {
        name: 'next',
        severity: 'high',
        via: ['sharp'],
        nodes: ['node_modules/next'],
      },
      sharp: {
        name: 'sharp',
        severity: 'high',
        via: [{
          name: 'sharp',
          dependency: 'sharp',
          url,
          severity: 'high',
        }],
        nodes: ['node_modules/sharp'],
      },
    },
  };
}

async function loadGuard() {
  assert.equal(existsSync(guardUrl), true, 'missing executable Next.js audit guard');
  return import(guardUrl.href);
}

test('rejects the former pinned Next.js and Sharp advisory chain', async () => {
  const { validateAuditReport } = await loadGuard();
  assert.deepEqual(validateAuditReport(sharpReport(), {
    next: '16.2.11',
    sharp: '0.34.5',
  }), [
    'next: dependency vulnerability is not allowed',
    'sharp: dependency vulnerability is not allowed',
  ]);
});

test('rejects malformed vulnerability entries without exceptions', async () => {
  const { validateAuditReport } = await loadGuard();
  const report = sharpReport();
  report.vulnerabilities.sharp.via = [];
  assert.deepEqual(validateAuditReport(report, {
    next: '16.2.11',
    sharp: '0.34.5',
  }), [
    'next: dependency vulnerability is not allowed',
    'sharp: dependency vulnerability is not allowed',
  ]);
});

test('accepts a clean audit without requiring temporary packages', async () => {
  const { validateAuditReport } = await loadGuard();
  assert.deepEqual(validateAuditReport({ auditReportVersion: 2, vulnerabilities: {} }, {}), []);
});

test('CI runs the exact audit guard instead of broadly lowering the audit level', () => {
  const workflow = readFileSync(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8');
  const guard = readFileSync(guardUrl, 'utf8');
  assert.match(workflow, /node scripts\/next-audit-guard\.mjs/);
  assert.doesNotMatch(workflow, /audit-level=(?:high|critical)/);
  assert.match(guard, /\['--prefix', 'next-src', 'audit', '--json'\]/);
  assert.doesNotMatch(guard, /--omit=dev/);
});
