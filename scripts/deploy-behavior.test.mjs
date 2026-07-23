import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
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

function replaceEnvAssignment(content, key, assignment) {
  const pattern = new RegExp(`^\\s*${key}\\s*=`, 'u');
  const lines = content.split('\n').filter(line => !pattern.test(line));
  return `${lines.join('\n')}\n${assignment}\n`;
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
if [ "\${1:-}" = container ] && [ "\${2:-}" = inspect ]; then
  if [ -z "\${FAKE_CURRENT_IMAGE_ID:-}" ]; then
    exit 44
  fi
  printf '%s\n' "$FAKE_CURRENT_IMAGE_ID"
  exit 0
fi
if [ "\${1:-}" = image ] && [ "\${2:-}" = inspect ]; then
  [ "\${FAKE_CURRENT_IMAGE_RESTORABLE:-false}" = true ] || exit 45
  [ "\${3:-}" = "\${FAKE_CURRENT_IMAGE_ID:-}" ] || exit 46
  exit 0
fi
if [ "\${1:-}" = tag ]; then
  [ "\${FAKE_CURRENT_IMAGE_RESTORABLE:-false}" = true ] || exit 47
  printf '%s -> %s\n' "\${2:-}" "\${3:-}" > "\${TAG_MARKER:?}"
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

function fakeActivationDocker(directory) {
  const binary = path.join(directory, 'docker');
  writeFileSync(binary, `#!/usr/bin/env bash
set -u
if [ "\${1:-}" = container ] && [ "\${2:-}" = inspect ]; then
  printf 'sha256:%064d\n' 0
  exit 0
fi
if [ "\${1:-}" = image ] && [ "\${2:-}" = inspect ]; then
  exit 0
fi
if [ "\${1:-}" = tag ]; then
  printf 'tag:%s:%s\n' "\${2:-}" "\${3:-}" >> "$DOCKER_LOG"
  if [ "\${FAKE_RESTORE_FAILURE:-}" = image-tag ] \
    && [ "\${2:-}" = rollback:test ] \
    && [ "\${3:-}" = ai-resume-optimizer:latest ]; then
    exit 84
  fi
  if [ "\${3:-}" = ai-resume-optimizer:latest ]; then
    if [ "\${2:-}" = "$CANDIDATE_IMAGE" ]; then
      printf candidate > "$LATEST_TARGET"
    else
      printf rollback > "$LATEST_TARGET"
    fi
  fi
  exit 0
fi
if [ "\${1:-}" = rm ] && [ "\${2:-}" = -f ]; then
  rm -f "$RUNNING_IMAGE"
  printf 'container-removed\n' >> "$DOCKER_LOG"
  exit 0
fi
if [ "\${1:-}" = exec ]; then
  exit 0
fi
if [ "\${1:-}" = compose ]; then
  printf 'compose-env:%s:%s:%s:%s:%s:%s:%s\n' \
    "\${AI_TOOL_HUB_ENV_FILE:-}" "\${AI_TOOL_HUB_IMAGE:-}" \
    "\${AI_TOOL_HUB_SOURCE_DIR:-}" "\${AI_TOOL_HUB_BUILD_CONTEXT:-}" \
    "\${DGC_NETWORK_NAME:-}" \
    "\${GIT_SHA:-}" "\${COMPOSE_PROJECT_NAME:-}" >> "$DOCKER_LOG"
  printf 'compose-args:%s\n' "$*" >> "$DOCKER_LOG"
  if [ "\${FAKE_RESTORE_FAILURE:-}" = compose ] \
    && [ "$(cat "$LATEST_TARGET")" = rollback ]; then
    exit 85
  fi
  if [ "\${*: -1}" = up ] || [[ " $* " == *" up "* ]]; then
    cp "$LATEST_TARGET" "$RUNNING_IMAGE"
  fi
  exit 0
fi
exit 0
`);
  chmodSync(binary, 0o755);
  return binary;
}

function fakeRestorationCommands(directory) {
  const move = path.join(directory, 'mv');
  writeFileSync(move, `#!/usr/bin/env bash
set -u
if [ "\${FAKE_RESTORE_FAILURE:-}" = source ] && [[ "\${1:-}" == */previous-source ]]; then
  exit 81
fi
exec /bin/mv "$@"
`);
  chmodSync(move, 0o755);

  const install = path.join(directory, 'install');
  writeFileSync(install, `#!/usr/bin/env bash
set -u
for argument in "$@"; do
  if [ "\${FAKE_RESTORE_FAILURE:-}" = config ] && [[ "$argument" == */previous-docker-compose.yml ]]; then
    exit 82
  fi
  if [ "\${FAKE_RESTORE_FAILURE:-}" = nginx ] && [[ "$argument" == */previous-nginx.conf ]]; then
    exit 83
  fi
done
exec /usr/bin/install "$@"
`);
  chmodSync(install, 0o755);
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

test('env validator rejects Compose interpolation for every required key without leaking values', () => {
  const interpolationValues = ['${MISSING}', '${MISSING:-fallback-secret}', '$$'];
  for (const key of [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'DEEPSEEK_API_KEY',
    'DAILY_QUOTA',
  ]) {
    for (const value of interpolationValues) {
      for (const assignment of [`${key}=${value}`, `${key}="${value}"`]) {
        const result = validateEnv(replaceEnvAssignment(validEnv(), key, assignment));
        assert.notEqual(result.status, 0, assignment);
        assert.match(result.stderr, new RegExp(`env_${key}=interpolation_unsupported`));
        assert.doesNotMatch(result.stdout + result.stderr, /MISSING|fallback-secret|test-key/);
      }
    }
  }
});

test('env validator preserves single-quoted dollar literals according to Compose semantics', () => {
  for (const value of ['${MISSING}', '${MISSING:-single-quoted-secret}', '$$']) {
    const content = replaceEnvAssignment(validEnv(), 'SUPABASE_SERVICE_ROLE_KEY', `SUPABASE_SERVICE_ROLE_KEY='${value}'`);
    const result = validateEnv(content);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /env_SUPABASE_SERVICE_ROLE_KEY=present/);
    assert.doesNotMatch(result.stdout + result.stderr, /MISSING|single-quoted-secret|test-key/);
  }
});

test('env validator rejects quoted, unquoted, and duplicate deployment-control keys', () => {
  for (const key of [
    'AI_TOOL_HUB_ENV_FILE',
    'AI_TOOL_HUB_IMAGE',
    'AI_TOOL_HUB_SOURCE_DIR',
    'AI_TOOL_HUB_BUILD_CONTEXT',
    'DGC_NETWORK_NAME',
    'GIT_SHA',
    'COMPOSE_PROJECT_NAME',
    'COMPOSE_FILE',
    'COMPOSE_PROFILES',
    'COMPOSE_ENV_FILES',
  ]) {
    for (const assignments of [
      `${key}=malicious-control-value`,
      `${key}="malicious-control-value"`,
      `${key}='malicious-control-value'`,
      `${key}=first-control-value\n${key}=second-control-value`,
    ]) {
      const result = validateEnv(validEnv(assignments));
      assert.notEqual(result.status, 0, key);
      assert.match(result.stderr, new RegExp(`env_${key}=(forbidden|duplicate)`));
      assert.doesNotMatch(result.stdout + result.stderr, /malicious-control|first-control|second-control|test-key/);
    }
  }
});

test('Compose runner fixes env path, image, build context, network, revision, and project under hostile ambient values', () => {
  const directory = temporaryDirectory();
  const log = path.join(directory, 'docker.log');
  const marker = path.join(directory, 'unused');
  fakeActivationDocker(directory);
  const result = run('/bin/bash', ['-c', `
    source "$RELEASE_LIB"
    run_release_compose /intended/runtime.env /intended/compose.yml \
      intended:image /intended/source intended-revision config -q
  `], { env: {
    RELEASE_LIB: releaseLib,
    DOCKER_LOG: log,
    LATEST_TARGET: marker,
    RUNNING_IMAGE: marker,
    CANDIDATE_IMAGE: 'intended:image',
    AI_TOOL_HUB_ENV_FILE: '/malicious/runtime.env',
    AI_TOOL_HUB_IMAGE: 'malicious:image',
    AI_TOOL_HUB_SOURCE_DIR: '/malicious/source',
    AI_TOOL_HUB_BUILD_CONTEXT: '/malicious/build-context',
    DGC_NETWORK_NAME: 'malicious-network',
    GIT_SHA: 'malicious-revision',
    COMPOSE_PROJECT_NAME: 'malicious-project',
    COMPOSE_FILE: '/malicious/compose.yml',
    PATH: `${directory}:${process.env.PATH}`,
  } });
  assert.equal(result.status, 0, result.stderr);
  const output = readFileSync(log, 'utf8');
  assert.match(output, /compose-env:\/intended\/runtime\.env:intended:image:\/intended\/source:\/intended\/source:dramagenai-cloud_dgc-net:intended-revision:weihub/);
  assert.match(output, /compose-args:compose --project-name weihub --env-file \/intended\/runtime\.env -f \/intended\/compose\.yml config -q/);
  assert.doesNotMatch(output, /malicious/);
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
    validate_and_build_candidate candidate.yml candidate.env candidate-source candidate:image candidate-revision
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
      validate_and_build_candidate_preserving_active \
        candidate.yml candidate.env candidate-source candidate:image candidate-revision \
        "$ACTIVE_COMPOSE" "$ACTIVE_NGINX"
    `], { env: {
      ACTIVE_COMPOSE: activeCompose,
      ACTIVE_NGINX: activeNginx,
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

test('rollback preparation uses the running container image ID when latest is absent', () => {
  const directory = temporaryDirectory();
  const tagMarker = path.join(directory, 'tagged');
  const imageId = `sha256:${'a'.repeat(64)}`;
  fakeDocker(directory);
  const result = run('/bin/bash', ['-c', 'source "$RELEASE_LIB"; prepare_rollback_image weihub-app rollback:test'], { env: {
    RELEASE_LIB: releaseLib,
    FAKE_CURRENT_IMAGE_ID: imageId,
    FAKE_CURRENT_IMAGE_RESTORABLE: 'true',
    TAG_MARKER: tagMarker,
    PATH: `${directory}:${process.env.PATH}`,
  } });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(tagMarker, 'utf8'), `${imageId} -> rollback:test\n`);
  assert.doesNotMatch(result.stdout + result.stderr, new RegExp(imageId));
});

test('rollback preparation fails before activation when no current image is restorable', () => {
  const directory = temporaryDirectory();
  const activationMarker = path.join(directory, 'activated');
  const tagMarker = path.join(directory, 'tagged');
  fakeDocker(directory);
  const result = run('/bin/bash', ['-c', `
    set -e
    source "$RELEASE_LIB"
    prepare_rollback_image weihub-app rollback:test
    printf activated > "$ACTIVATION_MARKER"
  `], { env: {
    RELEASE_LIB: releaseLib,
    ACTIVATION_MARKER: activationMarker,
    TAG_MARKER: tagMarker,
    PATH: `${directory}:${process.env.PATH}`,
  } });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /rollback_image=unavailable/);
  assert.equal(existsSync(activationMarker), false);
  assert.equal(existsSync(tagMarker), false);
});

test('full activation failure restores source, config, image tag, service, and original status', () => {
  const directory = temporaryDirectory();
  const activeSource = path.join(directory, 'active-source');
  const candidateSource = path.join(directory, 'candidate-source');
  const activeCompose = path.join(directory, 'active-compose.yml');
  const candidateCompose = path.join(directory, 'candidate-compose.yml');
  const activeNginx = path.join(directory, 'active-nginx.conf');
  const candidateNginx = path.join(directory, 'candidate-nginx.conf');
  const backupRoot = path.join(directory, 'backup');
  const dockerLog = path.join(directory, 'docker.log');
  const latestTarget = path.join(directory, 'latest-target');
  const runningImage = path.join(directory, 'running-image');
  const candidateImage = 'candidate:test-revision';
  mkdirSync(activeSource);
  mkdirSync(candidateSource);
  writeFileSync(path.join(activeSource, 'version'), 'prior source');
  writeFileSync(path.join(candidateSource, 'version'), 'candidate source');
  writeFileSync(activeCompose, 'prior compose');
  writeFileSync(candidateCompose, 'candidate compose');
  writeFileSync(activeNginx, 'prior nginx');
  writeFileSync(candidateNginx, 'candidate nginx');
  fakeActivationDocker(directory);
  const result = run('/bin/bash', ['-c', `
    source "$RELEASE_LIB"
    fail_verification() { return 73; }
    run_candidate_activation \
      "$CANDIDATE_SOURCE" "$ACTIVE_SOURCE" \
      "$CANDIDATE_COMPOSE" "$ACTIVE_COMPOSE" \
      "$CANDIDATE_NGINX" "$ACTIVE_NGINX" \
      "$BACKUP_ROOT" /intended/runtime.env "$CANDIDATE_IMAGE" \
      rollback:test intended-revision fail_verification
  `], { env: {
    RELEASE_LIB: releaseLib,
    ACTIVE_SOURCE: activeSource,
    CANDIDATE_SOURCE: candidateSource,
    ACTIVE_COMPOSE: activeCompose,
    CANDIDATE_COMPOSE: candidateCompose,
    ACTIVE_NGINX: activeNginx,
    CANDIDATE_NGINX: candidateNginx,
    BACKUP_ROOT: backupRoot,
    CANDIDATE_IMAGE: candidateImage,
    DOCKER_LOG: dockerLog,
    LATEST_TARGET: latestTarget,
    RUNNING_IMAGE: runningImage,
    AI_TOOL_HUB_ENV_FILE: '/malicious/runtime.env',
    AI_TOOL_HUB_IMAGE: 'malicious:image',
    AI_TOOL_HUB_SOURCE_DIR: '/malicious/source',
    DGC_NETWORK_NAME: 'malicious-network',
    GIT_SHA: 'malicious-revision',
    COMPOSE_PROJECT_NAME: 'malicious-project',
    PATH: `${directory}:${process.env.PATH}`,
  } });
  assert.equal(result.status, 73, result.stderr);
  assert.equal(readFileSync(path.join(activeSource, 'version'), 'utf8'), 'prior source');
  assert.equal(readFileSync(activeCompose, 'utf8'), 'prior compose');
  assert.equal(readFileSync(activeNginx, 'utf8'), 'prior nginx');
  assert.equal(readFileSync(latestTarget, 'utf8'), 'rollback');
  assert.equal(readFileSync(runningImage, 'utf8'), 'rollback');
  const output = readFileSync(dockerLog, 'utf8');
  assert.match(output, /container-removed/);
  assert.match(output, /compose-env:\/intended\/runtime\.env:ai-resume-optimizer:latest:/);
  assert.doesNotMatch(output, /malicious/);
});

for (const [failure, step] of [
  ['source', 'source'],
  ['config', 'compose_config'],
  ['nginx', 'nginx_config'],
  ['image-tag', 'image_tag'],
  ['compose', 'compose_recreate'],
]) {
  test(`restoration ${failure} failure returns a distinct status and reports only the failed step`, () => {
    const directory = temporaryDirectory();
    const activeSource = path.join(directory, 'active-source');
    const candidateSource = path.join(directory, 'candidate-source');
    const activeCompose = path.join(directory, 'active-compose.yml');
    const candidateCompose = path.join(directory, 'candidate-compose.yml');
    const activeNginx = path.join(directory, 'active-nginx.conf');
    const candidateNginx = path.join(directory, 'candidate-nginx.conf');
    const backupRoot = path.join(directory, 'backup-private-path');
    const dockerLog = path.join(directory, 'docker.log');
    const latestTarget = path.join(directory, 'latest-target');
    const runningImage = path.join(directory, 'running-image');
    mkdirSync(activeSource);
    mkdirSync(candidateSource);
    writeFileSync(path.join(activeSource, 'version'), 'prior source');
    writeFileSync(path.join(candidateSource, 'version'), 'candidate source');
    writeFileSync(activeCompose, 'prior compose');
    writeFileSync(candidateCompose, 'candidate compose');
    writeFileSync(activeNginx, 'prior nginx');
    writeFileSync(candidateNginx, 'candidate nginx');
    fakeActivationDocker(directory);
    fakeRestorationCommands(directory);

    const result = run('/bin/bash', ['-c', `
      source "$RELEASE_LIB"
      fail_verification() { return 73; }
      run_candidate_activation \
        "$CANDIDATE_SOURCE" "$ACTIVE_SOURCE" \
        "$CANDIDATE_COMPOSE" "$ACTIVE_COMPOSE" \
        "$CANDIDATE_NGINX" "$ACTIVE_NGINX" \
        "$BACKUP_ROOT" /intended/private-runtime.env "$CANDIDATE_IMAGE" \
        rollback:test intended-revision fail_verification
    `], { env: {
      RELEASE_LIB: releaseLib,
      ACTIVE_SOURCE: activeSource,
      CANDIDATE_SOURCE: candidateSource,
      ACTIVE_COMPOSE: activeCompose,
      CANDIDATE_COMPOSE: candidateCompose,
      ACTIVE_NGINX: activeNginx,
      CANDIDATE_NGINX: candidateNginx,
      BACKUP_ROOT: backupRoot,
      CANDIDATE_IMAGE: 'candidate:test-revision',
      DOCKER_LOG: dockerLog,
      LATEST_TARGET: latestTarget,
      RUNNING_IMAGE: runningImage,
      FAKE_RESTORE_FAILURE: failure,
      PATH: `${directory}:${process.env.PATH}`,
    } });

    assert.equal(result.status, 75, result.stderr);
    assert.match(result.stderr, new RegExp(`restoration_step=${step} status=failed`));
    assert.match(result.stderr, /candidate_restoration=failed original_status=73 restoration_status=75/);
    assert.doesNotMatch(result.stdout + result.stderr, /private-runtime|backup-private-path|candidate:test-revision/);
    assert.match(readFileSync(dockerLog, 'utf8'), /container-removed/);
  });
}

test('missing active Compose rejects activation before source, config, tag, or service writes', () => {
  const directory = temporaryDirectory();
  const activeSource = path.join(directory, 'active-source');
  const candidateSource = path.join(directory, 'candidate-source');
  const activeCompose = path.join(directory, 'missing-compose.yml');
  const candidateCompose = path.join(directory, 'candidate-compose.yml');
  const activeNginx = path.join(directory, 'active-nginx.conf');
  const candidateNginx = path.join(directory, 'candidate-nginx.conf');
  const backupRoot = path.join(directory, 'backup');
  const dockerLog = path.join(directory, 'docker.log');
  mkdirSync(activeSource);
  mkdirSync(candidateSource);
  writeFileSync(path.join(activeSource, 'version'), 'prior source');
  writeFileSync(path.join(candidateSource, 'version'), 'candidate source');
  writeFileSync(candidateCompose, 'candidate compose');
  writeFileSync(activeNginx, 'prior nginx');
  writeFileSync(candidateNginx, 'candidate nginx');
  fakeActivationDocker(directory);
  const result = run('/bin/bash', ['-c', `
    source "$RELEASE_LIB"
    pass_verification() { return 0; }
    run_candidate_activation \
      "$CANDIDATE_SOURCE" "$ACTIVE_SOURCE" \
      "$CANDIDATE_COMPOSE" "$ACTIVE_COMPOSE" \
      "$CANDIDATE_NGINX" "$ACTIVE_NGINX" \
      "$BACKUP_ROOT" /intended/runtime.env candidate:test \
      rollback:test intended-revision pass_verification
  `], { env: {
    RELEASE_LIB: releaseLib,
    ACTIVE_SOURCE: activeSource,
    CANDIDATE_SOURCE: candidateSource,
    ACTIVE_COMPOSE: activeCompose,
    CANDIDATE_COMPOSE: candidateCompose,
    ACTIVE_NGINX: activeNginx,
    CANDIDATE_NGINX: candidateNginx,
    BACKUP_ROOT: backupRoot,
    DOCKER_LOG: dockerLog,
    LATEST_TARGET: path.join(directory, 'latest-target'),
    RUNNING_IMAGE: path.join(directory, 'running-image'),
    CANDIDATE_IMAGE: 'candidate:test',
    PATH: `${directory}:${process.env.PATH}`,
  } });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /rollback_state=active_compose_missing/);
  assert.equal(readFileSync(path.join(activeSource, 'version'), 'utf8'), 'prior source');
  assert.equal(readFileSync(activeNginx, 'utf8'), 'prior nginx');
  assert.equal(existsSync(dockerLog), false);
});

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
