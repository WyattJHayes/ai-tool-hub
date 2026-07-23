import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const temporaryExceptions = {
  next: {
    version: '16.2.11',
    severity: 'high',
    advisories: new Set(),
    viaPackages: new Set(['sharp']),
  },
  sharp: {
    version: '0.34.5',
    severity: 'high',
    advisories: new Set(['GHSA-f88m-g3jw-g9cj']),
    viaPackages: new Set(),
  },
};

function advisoryId(url) {
  return typeof url === 'string' ? url.match(/GHSA-[a-z0-9-]+/i)?.[0] : undefined;
}

export function validateAuditReport(report, installedVersions) {
  if (!report || typeof report !== 'object' || !report.vulnerabilities || typeof report.vulnerabilities !== 'object') {
    return ['audit: invalid npm audit report'];
  }

  const errors = [];
  for (const [name, vulnerability] of Object.entries(report.vulnerabilities).sort(([left], [right]) => left.localeCompare(right))) {
    const exception = temporaryExceptions[name];
    if (!exception) {
      errors.push(`${name}: package is not allowlisted`);
      continue;
    }

    const installedVersion = installedVersions[name];
    if (installedVersion !== exception.version) {
      errors.push(`${name}: exception requires ${exception.version}, found ${installedVersion ?? 'missing'}`);
      continue;
    }
    if (vulnerability.severity !== exception.severity) {
      errors.push(`${name}: exception requires ${exception.severity} severity, found ${vulnerability.severity ?? 'missing'}`);
      continue;
    }
    if (!Array.isArray(vulnerability.via)) {
      errors.push(`${name}: malformed vulnerability chain`);
      continue;
    }

    const observedAdvisories = new Set();
    const observedPackages = new Set();
    for (const source of vulnerability.via) {
      if (typeof source === 'string') {
        observedPackages.add(source);
        if (!exception.viaPackages.has(source)) {
          errors.push(`${name}: unapproved transitive vulnerability ${source}`);
        }
        continue;
      }

      const id = advisoryId(source?.url);
      if (id) observedAdvisories.add(id);
      if (!id || !exception.advisories.has(id)) {
        errors.push(`${name}: unapproved advisory ${id ?? 'missing-id'}`);
      }
    }
    for (const expected of exception.viaPackages) {
      if (!observedPackages.has(expected)) {
        errors.push(`${name}: missing transitive vulnerability ${expected}`);
      }
    }
    for (const expected of exception.advisories) {
      if (!observedAdvisories.has(expected)) {
        errors.push(`${name}: missing approved advisory ${expected}`);
      }
    }
  }
  return errors;
}

function run() {
  const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
  const result = spawnSync('npm', ['--prefix', 'next-src', 'audit', '--omit=dev', '--json'], {
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

  const lock = JSON.parse(readFileSync(path.join(repositoryRoot, 'next-src/package-lock.json'), 'utf8'));
  const installedVersions = Object.fromEntries(Object.entries(report.vulnerabilities ?? {}).map(([name, vulnerability]) => {
    const node = Array.isArray(vulnerability.nodes) ? vulnerability.nodes[0] : undefined;
    return [name, node ? lock.packages?.[node]?.version : undefined];
  }));
  const errors = validateAuditReport(report, installedVersions);
  if (errors.length) {
    console.error(`Next.js audit guard failed:\n${errors.map(error => `- ${error}`).join('\n')}`);
    process.exitCode = 1;
    return;
  }

  const count = Object.keys(report.vulnerabilities ?? {}).length;
  console.log(count
    ? 'Next.js audit guard accepted the pinned Next.js 16.2.11 / Sharp GHSA-f88m-g3jw-g9cj exception.'
    : 'Next.js production dependency audit is clean.');
}

const invokedAsScript = process.argv[1]
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedAsScript) run();
