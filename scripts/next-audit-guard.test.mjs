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

test('accepts only the pinned Next.js and Sharp advisory chain', async () => {
  const { validateAuditReport } = await loadGuard();
  assert.deepEqual(validateAuditReport(sharpReport(), {
    next: '16.2.11',
    sharp: '0.34.5',
  }), []);
});

test('rejects new advisories even on an allowlisted package', async () => {
  const { validateAuditReport } = await loadGuard();
  assert.deepEqual(validateAuditReport(sharpReport('https://github.com/advisories/GHSA-new-advisory'), {
    next: '16.2.11',
    sharp: '0.34.5',
  }), [
    'sharp: unapproved advisory GHSA-new-advisory',
    'sharp: missing approved advisory GHSA-f88m-g3jw-g9cj',
  ]);
});

test('rejects an incomplete allowlisted vulnerability chain', async () => {
  const { validateAuditReport } = await loadGuard();
  const report = sharpReport();
  report.vulnerabilities.sharp.via = [];
  assert.deepEqual(validateAuditReport(report, {
    next: '16.2.11',
    sharp: '0.34.5',
  }), ['sharp: missing approved advisory GHSA-f88m-g3jw-g9cj']);
});

test('rejects package version drift while an exception is active', async () => {
  const { validateAuditReport } = await loadGuard();
  assert.deepEqual(validateAuditReport(sharpReport(), {
    next: '16.2.12',
    sharp: '0.34.5',
  }), ['next: exception requires 16.2.11, found 16.2.12']);
});

test('rejects vulnerabilities outside the exact exception chain', async () => {
  const { validateAuditReport } = await loadGuard();
  const report = sharpReport();
  report.vulnerabilities['fast-uri'] = {
    name: 'fast-uri',
    severity: 'high',
    via: [{ url: 'https://github.com/advisories/GHSA-unexpected' }],
    nodes: ['node_modules/fast-uri'],
  };
  assert.deepEqual(validateAuditReport(report, {
    next: '16.2.11',
    sharp: '0.34.5',
    'fast-uri': '3.1.4',
  }), ['fast-uri: package is not allowlisted']);
});

test('accepts a clean audit without requiring temporary packages', async () => {
  const { validateAuditReport } = await loadGuard();
  assert.deepEqual(validateAuditReport({ auditReportVersion: 2, vulnerabilities: {} }, {}), []);
});

test('CI runs the exact audit guard instead of broadly lowering the audit level', () => {
  const workflow = readFileSync(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8');
  assert.match(workflow, /node scripts\/next-audit-guard\.mjs/);
  assert.doesNotMatch(workflow, /audit-level=(?:high|critical)/);
});
