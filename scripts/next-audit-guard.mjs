import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export function validateAuditReport(report) {
  if (!report || typeof report !== 'object' || !report.vulnerabilities || typeof report.vulnerabilities !== 'object') {
    return ['audit: invalid npm audit report'];
  }

  return Object.keys(report.vulnerabilities)
    .sort((left, right) => left.localeCompare(right))
    .map(name => `${name}: dependency vulnerability is not allowed`);
}

function run() {
  const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
  const result = spawnSync('npm', ['--prefix', 'next-src', 'audit', '--json'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
  if (result.error) {
    console.error(`Next.js audit guard could not run npm audit: ${result.error.message}`);
    process.exitCode = 1;
    return;
  }

  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    console.error('Next.js audit guard received invalid JSON from npm audit.');
    process.exitCode = 1;
    return;
  }

  const errors = validateAuditReport(report);
  if (errors.length) {
    console.error(`Next.js audit guard failed:\n${errors.map(error => `- ${error}`).join('\n')}`);
    process.exitCode = 1;
    return;
  }

  console.log('Next.js dependency audit is clean.');
}

const invokedAsScript = process.argv[1]
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedAsScript) run();
