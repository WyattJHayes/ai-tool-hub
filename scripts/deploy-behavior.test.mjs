import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const validator = path.join(root, 'deploy/tencent-cloud/validate-env.py');
const releaseLib = path.join(root, 'deploy/tencent-cloud/release-lib.sh');

function temporaryDirectory() {
  return mkdtempSync(path.join(os.tmpdir(), 'weihub-deploy-test-'));
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, ...options.env },
  });
}

function validateEnv(content) {
  const directory = temporaryDirectory();
  const envFile = path.join(directory, '.env');
  writeFileSync(envFile, content, { mode: 0o600 });
  return run('python3', [validator, envFile]);
}

function validEnv(overrides = '') {
  return `
    # comments and surrounding whitespace are valid
    NEXT_PUBLIC_SUPABASE_URL = "https://project.example.invalid"
    NEXT_PUBLIC_SUPABASE_ANON_KEY='anonymous-test-key'
    SUPABASE_SERVICE_ROLE_KEY = service-role-test-key # inline comment
    DEEPSEEK_API_KEY="deepseek-test-key"
    DAILY_QUOTA = '10'
    ${overrides}
  `;
}

function fakeDocker(directory) {
  const binary = path.join(directory, 'docker');
  writeFileSync(binary, `#!/usr/bin/env bash
set -u
if [ "\${1:-}" = logs ]; then
  if [ "\${FAKE_LOG_MODE:-zero}" = fail ]; then
    printf 'raw-private-log-must-not-escape\\n' >&2
    exit 24
  fi
  if [ "\${FAKE_LOG_MODE:-zero}" = match ]; then
    printf 'resumeText\\n'
  fi
  exit 0
fi
if [[ " $* " == *" config "* ]]; then
  [ "\${FAKE_COMPOSE_MODE:-ok}" = config-fail ] && exit 42
  exit 0
fi
if [[ " $* " == *" build "* ]]; then
  [ "\${FAKE_COMPOSE_MODE:-ok}" = build-fail ] && exit 43
  printf 'built\\n' > "\${BUILD_MARKER:?}"
  exit 0
fi
exit 0
`);
  chmodSync(binary, 0o755);
  return binary;
}

test('env validator accepts Compose-style quoted and unquoted values without printing values', () => {
  const result = validateEnv(validEnv());
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /env_DAILY_QUOTA=present_exact_10/);
  assert.doesNotMatch(result.stdout + result.stderr, /project\.example|test-key/);
});

test('env validator rejects an overridden exact quota instead of accepting the first value', () => {
  const result = validateEnv(validEnv('DAILY_QUOTA=11'));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /env_DAILY_QUOTA=duplicate/);
  assert.doesNotMatch(result.stdout + result.stderr, /test-key/);
});

test('env validator rejects quoted-empty required values', () => {
  for (const assignment of [
    'NEXT_PUBLIC_SUPABASE_URL=""',
    "NEXT_PUBLIC_SUPABASE_ANON_KEY=''",
    "SUPABASE_SERVICE_ROLE_KEY='   '",
    'DEEPSEEK_API_KEY=""',
  ]) {
    const key = assignment.split('=')[0];
    const lines = validEnv().split('\n').filter(line => !line.includes(`${key} =`) && !line.includes(`${key}=`));
    const result = validateEnv(`${lines.join('\n')}\n${assignment}\n`);
    assert.notEqual(result.status, 0, key);
    assert.match(result.stderr, new RegExp(`env_${key}=empty`));
  }
});

test('env validator rejects duplicate required secrets', () => {
  for (const key of ['SUPABASE_SERVICE_ROLE_KEY', 'DEEPSEEK_API_KEY']) {
    const result = validateEnv(validEnv(`${key}=second-test-value`));
    assert.notEqual(result.status, 0, key);
    assert.match(result.stderr, new RegExp(`env_${key}=duplicate`));
    assert.doesNotMatch(result.stdout + result.stderr, /second-test-value|test-key/);
  }
});

test('env validator rejects malformed required assignments', () => {
  for (const malformed of ['DAILY_QUOTA 10', 'SUPABASE_SERVICE_ROLE_KEY secret']) {
    const key = malformed.split(' ')[0];
    const lines = validEnv().split('\n').filter(line => !line.includes(`${key} =`) && !line.includes(`${key}=`));
    const result = validateEnv(`${lines.join('\n')}\n${malformed}\n`);
    assert.notEqual(result.status, 0, malformed);
    assert.match(result.stderr, new RegExp(`env_${key}=malformed`));
  }
});

test('tampered source archive blocks before candidate build', () => {
  const directory = temporaryDirectory();
  const archive = path.join(directory, 'source.tar');
  const marker = path.join(directory, 'built');
  writeFileSync(archive, 'approved source bytes');
  const expected = createHash('sha256').update(readFileSync(archive)).digest('hex');
  writeFileSync(archive, 'tampered source bytes');
  fakeDocker(directory);
  const result = run('/bin/bash', ['-c', `
    set -e
    source "$RELEASE_LIB"
    verify_source_archive "$ARCHIVE" "$EXPECTED"
    validate_and_build_candidate candidate.yml candidate.env candidate-source
  `], { env: {
    RELEASE_LIB: releaseLib,
    ARCHIVE: archive,
    EXPECTED: expected,
    BUILD_MARKER: marker,
    PATH: `${directory}:${process.env.PATH}`,
  } });
  assert.notEqual(result.status, 0);
  assert.equal(readFileSync(archive, 'utf8'), 'tampered source bytes');
  assert.doesNotMatch(result.stdout + result.stderr, /approved source bytes|tampered source bytes/);
  assert.equal(existsSync(marker), false);
});

for (const [mode, expectedStatus] of [['config-fail', 42], ['build-fail', 43]]) {
  test(`candidate ${mode} leaves active files unchanged and returns the original status`, () => {
    const directory = temporaryDirectory();
    const activeCompose = path.join(directory, 'active-compose.yml');
    const activeNginx = path.join(directory, 'active-nginx.conf');
    const marker = path.join(directory, 'built');
    writeFileSync(activeCompose, 'active compose');
    writeFileSync(activeNginx, 'active nginx');
    fakeDocker(directory);
    const result = run('/bin/bash', ['-c', `
      source "$RELEASE_LIB"
      validate_and_build_candidate candidate.yml candidate.env candidate-source
    `], { env: {
      RELEASE_LIB: releaseLib,
      FAKE_COMPOSE_MODE: mode,
      BUILD_MARKER: marker,
      PATH: `${directory}:${process.env.PATH}`,
    } });
    assert.equal(result.status, expectedStatus, result.stderr);
    assert.equal(readFileSync(activeCompose, 'utf8'), 'active compose');
    assert.equal(readFileSync(activeNginx, 'utf8'), 'active nginx');
  });
}

test('privacy scan distinguishes log-read failure from zero matches without leaking logs', () => {
  const directory = temporaryDirectory();
  const marker = path.join(directory, 'unused');
  fakeDocker(directory);
  const failed = run('/bin/bash', ['-c', 'source "$RELEASE_LIB"; scan_privacy_logs app'], { env: {
    RELEASE_LIB: releaseLib,
    FAKE_LOG_MODE: 'fail',
    BUILD_MARKER: marker,
    PATH: `${directory}:${process.env.PATH}`,
  } });
  assert.notEqual(failed.status, 0);
  assert.match(failed.stderr, /privacy_log_read=fail/);
  assert.doesNotMatch(failed.stdout + failed.stderr, /raw-private-log/);

  const passed = run('/bin/bash', ['-c', 'source "$RELEASE_LIB"; scan_privacy_logs app'], { env: {
    RELEASE_LIB: releaseLib,
    FAKE_LOG_MODE: 'zero',
    BUILD_MARKER: marker,
    PATH: `${directory}:${process.env.PATH}`,
  } });
  assert.equal(passed.status, 0, passed.stderr);
  assert.match(passed.stdout, /privacy_log_scan=passed/);
});

test('aggregate execution failure emits explicit transport and query failures for every endpoint', () => {
  const result = run('/bin/bash', ['-c', 'source "$RELEASE_LIB"; classify_aggregate_probe 29 ""'], {
    env: { RELEASE_LIB: releaseLib },
  });
  assert.notEqual(result.status, 0);
  for (const label of [
    'auth_users', 'profiles', 'resume_quota_accounts', 'resume_usage_ledger',
    'resume_memberships', 'resume_orders', 'resume_payment_events',
  ]) {
    assert.match(result.stdout, new RegExp(`aggregate_transport_${label}=fail`));
    assert.match(result.stdout, new RegExp(`aggregate_query_${label}=fail`));
    assert.doesNotMatch(result.stdout, new RegExp(`aggregate_result_${label}=`));
  }
});
