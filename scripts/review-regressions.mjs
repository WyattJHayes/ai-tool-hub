import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');
const failures = [];

function requireMatch(content, pattern, message) {
  if (!pattern.test(content)) failures.push(message);
}

const migration = read('next-src/supabase/migrations/001_initial.sql');
const compose = read('server/docker-compose.yml');
const gitignore = read('.gitignore');
const nextConfig = read('next-src/next.config.mjs');
const nginxConfigPath = 'deploy/tencent-cloud/nginx.conf';
const nginxConfig = read(nginxConfigPath);
const productionComposePath = 'deploy/tencent-cloud/docker-compose.prod.yml';
const dockerfilePath = 'next-src/Dockerfile';
const deploymentScript = read('deploy/tencent-cloud/quick-deploy.sh');
const deploymentReadme = read('deploy/tencent-cloud/README.md');
const deploymentReleaseLib = read('deploy/tencent-cloud/release-lib.sh');
const deploymentEnvValidator = read('deploy/tencent-cloud/validate-env.py');
const resumeBillingFixture = read('next-src/supabase/tests/resume_billing.sql');
const deploymentBehaviorTestPath = 'scripts/deploy-behavior.test.mjs';
const deploymentBehaviorTest = read(deploymentBehaviorTestPath);
const workflow = read('.github/workflows/deploy.yml');
const workflowTestJob = workflow.split('\n  build-and-deploy:')[0];

requireMatch(
  migration,
  /CREATE POLICY\s+"[^"]+"\s+ON ratings\s+FOR UPDATE\s+USING\s*\(auth\.uid\(\)\s*=\s*user_id\)\s+WITH CHECK\s*\(auth\.uid\(\)\s*=\s*user_id\)/i,
  'ratings must allow users to update only their own rating'
);
requireMatch(
  migration,
  /COALESCE\s*\(NEW\.tool_id\s*,\s*OLD\.tool_id\)/i,
  'rating aggregate trigger must handle DELETE through OLD.tool_id'
);
requireMatch(
  migration,
  /ALTER TABLE click_logs ENABLE ROW LEVEL SECURITY/i,
  'click_logs must have row-level security enabled'
);
requireMatch(
  migration,
  /CREATE POLICY\s+"[^"]+"\s+ON click_logs\s+FOR INSERT\s+WITH CHECK\s*\(true\)/i,
  'click_logs must have an explicit public insert policy'
);
requireMatch(
  migration,
  /CREATE POLICY\s+"[^"]+"\s+ON click_logs\s+FOR SELECT\s+USING\s*\(true\)/i,
  'click_logs must have an explicit public read policy'
);
requireMatch(
  compose,
  /http:\/\/localhost:3000\/api\/v1\/health/,
  'Docker healthcheck must use /api/v1/health'
);

if (/^package-lock\.json\s*$/m.test(gitignore)) {
  failures.push('.gitignore must not ignore every package-lock.json');
}

for (const lockfile of ['package-lock.json', 'server/package-lock.json', 'next-src/package-lock.json']) {
  if (!fs.existsSync(path.join(root, lockfile))) failures.push(`${lockfile} is missing`);
}

requireMatch(
  nextConfig,
  /output:\s*['"]standalone['"]/,
  'Next.js production build must use standalone output'
);

for (const obsoletePath of [
  'deploy/tencent-cloud/ai-tool-hub统一.conf',
  'deploy/tencent-cloud/weihub.cloud统一.conf',
]) {
  if (fs.existsSync(path.join(root, obsoletePath))) {
    failures.push(`${obsoletePath} is obsolete; nginx.conf must be the only production template`);
  }
}

requireMatch(
  nginxConfig,
  /server_name\s+weihub\.cloud\s+www\.weihub\.cloud\s*;/,
  `${nginxConfigPath} must only serve the weihub.cloud hostnames`
);
requireMatch(
  nginxConfig,
  /proxy_pass\s+http:\/\/weihub-app:3100\s*;/,
  `${nginxConfigPath} must proxy to the internal weihub-app service`
);
requireMatch(
  nginxConfig,
  /location\s*=\s*\/love\s*{[\s\S]*?return\s+301\s+\/love\/\s*;/,
  `${nginxConfigPath} must preserve the /love redirect`
);
requireMatch(
  nginxConfig,
  /location\s+\^~\s+\/love\/\s*{[\s\S]*?alias\s+\/var\/www\/html\/love\/\s*;/,
  `${nginxConfigPath} must preserve the /love static site`
);
requireMatch(
  nginxConfig,
  /location\s*=\s*\/resume-optimizer\s*{\s*return\s+301\s+\/resume\s*;\s*}/,
  `${nginxConfigPath} must redirect the legacy resume path to /resume`
);
requireMatch(
  nginxConfig,
  /location\s*=\s*\/resume-optimizer\/\s*{\s*return\s+301\s+\/resume\s*;\s*}/,
  `${nginxConfigPath} must redirect the trailing-slash legacy resume path to /resume`
);
requireMatch(
  nginxConfig,
  /location\s*=\s*\/reset-domain-cache\s*{[\s\S]*?default_type\s+text\/html\s*;[\s\S]*?add_header\s+Clear-Site-Data\s+['"]?['"]cache['"]['"]?\s+always\s*;[\s\S]*?add_header\s+Cache-Control\s+['"]no-store['"]\s+always\s*;[\s\S]*?return\s+200\s+['"][\s\S]*?http-equiv=["']refresh["'][\s\S]*?domain-cache-reset=2[\s\S]*?['"]\s*;/i,
  `${nginxConfigPath} must serve a cache-only recovery page for legacy permanent redirects`
);

for (const forbidden of [
  /listen\s+[^;]*\bdefault_server\b/i,
  /server_name\s+[^;]*(?:^|\s)_(?:\s|;)/im,
  /dramagenai\.cloud/i,
  /grafana|kibana|openclaw|metrics/i,
]) {
  if (forbidden.test(nginxConfig)) {
    failures.push(`${nginxConfigPath} contains a forbidden catch-all, legacy, or cross-product route`);
  }
}

if (!fs.existsSync(path.join(root, dockerfilePath))) {
  failures.push(`${dockerfilePath} is missing`);
} else {
  const dockerfile = read(dockerfilePath);
  requireMatch(dockerfile, /\bRUN\s+npm\s+ci\b/, `${dockerfilePath} must use npm ci`);
  requireMatch(dockerfile, /\bUSER\s+nextjs\b/, `${dockerfilePath} must run as nextjs`);
  requireMatch(dockerfile, /\bARG\s+GIT_SHA(?:=\S+)?\b/, `${dockerfilePath} must accept the Git revision`);
  requireMatch(
    dockerfile,
    /\bLABEL\s+org\.opencontainers\.image\.revision=["']?\$\{?GIT_SHA\}?["']?/,
    `${dockerfilePath} must expose the Git revision as an OCI label`
  );
}

if (!fs.existsSync(path.join(root, productionComposePath))) {
  failures.push(`${productionComposePath} is missing`);
} else {
  const productionCompose = read(productionComposePath);
  requireMatch(productionCompose, /^\s*expose:\s*$/m, `${productionComposePath} must expose port 3100 internally`);
  requireMatch(productionCompose, /^\s*external:\s*true\s*$/m, `${productionComposePath} must use an external network`);
  requireMatch(productionCompose, /^name:\s*weihub\s*$/m, `${productionComposePath} must use the isolated weihub project`);
  requireMatch(productionCompose, /^\s*container_name:\s*weihub-app\s*$/m, `${productionComposePath} must use the collision-free weihub-app container name`);
  requireMatch(productionCompose, /^\s*-\s+weihub-app\s*$/m, `${productionComposePath} must define the weihub-app alias`);
  requireMatch(productionCompose, /restart:\s*unless-stopped/, `${productionComposePath} must restart unless stopped`);
  requireMatch(productionCompose, /image:\s*\$\{AI_TOOL_HUB_IMAGE:-ai-resume-optimizer:latest\}/, `${productionComposePath} must support a candidate image tag`);
  requireMatch(productionCompose, /context:\s*\$\{AI_TOOL_HUB_BUILD_CONTEXT:-\.\/source\}/, `${productionComposePath} must support an isolated candidate source tree`);
  requireMatch(productionCompose, /^\s+GIT_SHA:\s*\$\{GIT_SHA:-unknown\}\s*$/m, `${productionComposePath} must forward the Git revision`);
  if (/^\s*ports:\s*$/m.test(productionCompose)) {
    failures.push(`${productionComposePath} must not publish application ports on the host`);
  }
  for (const privateName of [
    'SUPABASE_SERVICE_ROLE_KEY',
    'DEEPSEEK_API_KEY',
    'DAILY_QUOTA',
    'XDDPAY_APP_ID',
    'XDDPAY_SECRET',
    'XDDPAY_GATEWAY',
    'XDDPAY_NOTIFY_URL',
  ]) {
    requireMatch(
      productionCompose,
      new RegExp(`\\b${privateName}\\b`),
      `${productionComposePath} must document the ${privateName} runtime boundary without a value`,
    );
  }
  if (/^\s+(?:SUPABASE_SERVICE_ROLE_KEY|DEEPSEEK_API_KEY|DAILY_QUOTA|XDDPAY_[A-Z_]+):\s+[^#\s].*$/m.test(productionCompose)) {
    failures.push(`${productionComposePath} must not contain literal private runtime values`);
  }
  if (/^\s+args:[\s\S]*?(?:SUPABASE_SERVICE_ROLE_KEY|DEEPSEEK_API_KEY|DAILY_QUOTA|XDDPAY_)/m.test(productionCompose)) {
    failures.push(`${productionComposePath} must never pass private runtime values as build arguments`);
  }
}

if (/docker inspect ai-resume-optimizer\b/.test(deploymentScript)) {
  failures.push('quick-deploy.sh must use docker container inspect for the legacy container');
}
requireMatch(
  deploymentScript,
  /docker container inspect ai-resume-optimizer\b/,
  'quick-deploy.sh must distinguish the legacy container from the same-named image'
);
requireMatch(deploymentScript, /git\s+-C\s+"\$PROJECT_ROOT"\s+rev-parse\s+HEAD/, 'deployment must capture the current Git revision');
requireMatch(
  deploymentScript,
  /git\s+-C\s+"\$PROJECT_ROOT"\s+diff\s+--quiet\s+HEAD\s+--\s+next-src/,
  'deployment must reject committed-path changes that are not represented by the revision'
);
requireMatch(
  deploymentScript,
  /git\s+-C\s+"\$PROJECT_ROOT"\s+ls-files\s+--others\s+--exclude-standard\s+--\s+next-src/,
  'deployment must reject untracked application source files'
);
if (/\brsync\b|source-revision\.new/.test(deploymentScript)) {
  failures.push('deployment must not trust a mutable rsync tree or staged revision text file');
}
requireMatch(
  deploymentScript,
  /create_source_archive\s+"\$PROJECT_ROOT"\s+"\$(?:source_revision|expected_revision)"\s+"\$archive"/,
  'deployment must create source archives through the approved helper',
);
requireMatch(
  deploymentReleaseLib,
  /git\s+-C\s+"\$repository"\s+archive\s+--format=tar\s+--output="\$output"[\s\\]*"\$revision"\s+next-src/,
  'deployment must derive deterministic source bytes from the approved Git commit',
);
requireMatch(
  deploymentScript,
  /tar\s+-xf\s+"\$candidate_archive"\s+-C\s+"\$candidate_source"\s+--strip-components=1/,
  'deployment must restore the archived next-src path as the candidate build root',
);
requireMatch(deploymentScript, /release_sha256\s+"\$archive"/, 'deployment must hash the commit-derived source archive');
requireMatch(deploymentScript, /verify_source_archive\s+"\$candidate_archive"\s+"\$expected_checksum"/, 'deployment must verify staged source bytes before extraction');
requireMatch(deploymentScript, /verify_candidate_checksum\s+"\$candidate_release_lib"\s+"\$expected_release_lib_checksum"/, 'deployment must verify the staged helper before sourcing it');
requireMatch(deploymentScript, /verify_candidate_checksum\s+"\$candidate_compose"\s+"\$expected_compose_checksum"/, 'deployment must verify staged Compose before candidate build');
requireMatch(deploymentScript, /candidate_root="\$remote_root\/candidates\/\$expected_revision"/, 'deployment candidates must be scoped to the approved revision');
requireMatch(deploymentScript, /validate_and_build_candidate/, 'deployment must validate and build the staged candidate');
requireMatch(deploymentScript, /validate_and_build_candidate_preserving_active/, 'deployment must verify active files around staged config and build');
requireMatch(deploymentScript, /run_candidate_activation/, 'deployment must use the tested activation transaction');
requireMatch(deploymentReleaseLib, /prepare_rollback_image weihub-app "\$rollback_image"/, 'deployment must snapshot the running container image before activation');
requireMatch(deploymentReleaseLib, /docker container inspect --format '\{\{\.Image\}\}'/, 'rollback preparation must inspect the running container image ID');
requireMatch(deploymentReleaseLib, /docker tag "\$rollback_image" ai-resume-optimizer:latest/, 'rollback must restore the captured image tag');
requireMatch(deploymentReleaseLib, /previous-docker-compose\.yml" "\$active_compose"/, 'rollback must restore the prior Compose configuration');
requireMatch(deploymentReleaseLib, /restore_active_release[\s\S]*?run_release_compose[\s\S]*?up -d --force-recreate/, 'rollback must recreate the prior Compose service');
requireMatch(deploymentReleaseLib, /RESTORATION_FAILED_STATUS=75/, 'rollback restoration failures must use a distinct status');
requireMatch(deploymentReleaseLib, /restoration_step=\$step status=failed/, 'rollback failures must identify only the failed restoration step');
requireMatch(deploymentReleaseLib, /candidate_restoration=failed original_status=\$status restoration_status=\$restoration_status/, 'activation must report restoration failure separately from the candidate failure');
if (/restore_active_release[\s\S]{0,300}\|\| true/.test(deploymentReleaseLib)) {
  failures.push('activation must never suppress restore_active_release failures');
}
requireMatch(deploymentReleaseLib, /docker rm -f weihub-app/, 'rollback must remove the candidate container before recreation');
if (/docker image inspect ai-resume-optimizer:latest/.test(deploymentScript + deploymentReleaseLib)) {
  failures.push('rollback preparation must not depend on the mutable latest tag');
}
requireMatch(deploymentScript, /candidate_image="ai-resume-optimizer:candidate-\$expected_revision"/, 'deployment must build a revision-specific candidate image');
requireMatch(deploymentReleaseLib, /docker tag "\$candidate_image" ai-resume-optimizer:latest/, 'deployment must promote the candidate image only during activation');
requireMatch(deploymentScript, /scan_privacy_logs weihub-app/, 'deployment must use the fail-closed privacy log helper');
requireMatch(
  deploymentScript,
  /verify_local_permanent_redirect[\s\S]*?--location[\s\S]*?%\{url_effective\}[\s\S]*?200/,
  'deployment must follow the legacy resume redirect and verify its final 200 destination',
);
requireMatch(deploymentScript, /classify_aggregate_probe "\$aggregate_status" "\$aggregate_output"/, 'deployment must classify aggregate execution failures explicitly');
requireMatch(deploymentScript, /python3 - "\$REMOTE_ROOT\/\.env"\s*<\s*"\$ENV_VALIDATOR"/, 'deployment must stream the approved env validator to the server');
requireMatch(deploymentReleaseLib, /GIT_SHA="\$revision"/, 'deployment must provide the fixed revision to Docker Compose');
requireMatch(
  deploymentScript,
  /org\.opencontainers\.image\.revision/,
  'deployment must verify the running image revision label'
);

for (const privateName of [
  'SUPABASE_SERVICE_ROLE_KEY',
  'DEEPSEEK_API_KEY',
  'DAILY_QUOTA',
  'XDDPAY_APP_ID',
  'XDDPAY_SECRET',
  'XDDPAY_GATEWAY',
  'XDDPAY_NOTIFY_URL',
]) {
  requireMatch(
    deploymentScript + '\n' + deploymentEnvValidator,
    new RegExp(`\\b${privateName}\\b`),
    `deployment preflight must inspect ${privateName} by name only`,
  );
  requireMatch(
    deploymentReadme,
    new RegExp(`\\b${privateName}\\b`),
    `deployment runbook must document ${privateName} without a real value`,
  );
}

for (const [pattern, message] of [
  [/stat\s+-c\s+['"]%a['"]\s+"\$remote_root\/\.env"/, 'deployment preflight must verify the private env file mode'],
  [/DAILY_QUOTA[^\n]*10/, 'deployment preflight must require DAILY_QUOTA=10 explicitly'],
  [/resume_billing\.sql/, 'deployment must gate production DDL on the isolated billing fixture'],
  [/aggregate_transport/, 'zero-source reconciliation must report transport separately from aggregate results'],
  [/aggregate_query/, 'zero-source reconciliation must report query success separately from aggregate results'],
  [/aggregate_result/, 'zero-source reconciliation must distinguish zero and nonzero aggregate results'],
  [/payment_boundary[^\n]*disabled/, 'deployment must keep the unvalidated payment boundary disabled'],
  [/\/resume\//, 'deployment must verify the canonical resume editor route'],
  [/resume-optimizer/, 'deployment must verify the permanent legacy resume redirect'],
  [/Authorization:\s*Bearer/, 'deployment runbook must provide an authenticated API verification command'],
  [/XDDPAY_NOTIFY_URL[^\n]*\/api\/resume\/payments\/xddpay\/notify/, 'deployment runbook must document the intended payment callback URL'],
  [/privacy[^\n]*(?:scan|log)/i, 'deployment must run a privacy log scan before release'],
  [/source_revision[^\n]*running_revision|running_revision[^\n]*source_revision/, 'deployment must compare the running and approved source revisions'],
  [/candidate_root[^\n]*expected_revision|expected_revision[^\n]*candidate_root/, 'deployment must select only the approved revision candidate'],
]) {
  requireMatch(deploymentScript + '\n' + deploymentEnvValidator + '\n' + deploymentReleaseLib + '\n' + deploymentReadme, pattern, message);
}

const stagedBuildIndex = deploymentScript.indexOf('validate_and_build_candidate');
const activationIndex = deploymentScript.indexOf('run_candidate_activation');
if (stagedBuildIndex === -1 || activationIndex < stagedBuildIndex) {
  failures.push('candidate config/build must finish before active Compose or Nginx replacement');
}

const restorableCheckIndex = deploymentReleaseLib.indexOf('require_restorable_active_release "$active_source"');
const rollbackPreparationIndex = deploymentReleaseLib.indexOf('prepare_rollback_image weihub-app');
const activeSourceMoveIndex = deploymentReleaseLib.indexOf('mv "$active_source" "$backup_root/previous-source"');
if (restorableCheckIndex === -1 || rollbackPreparationIndex < restorableCheckIndex || activeSourceMoveIndex < rollbackPreparationIndex) {
  failures.push('a restorable current container image must be tagged before activation');
}
requireMatch(deploymentEnvValidator, /interpolation_unsupported/, 'deployment env validation must reject Compose interpolation');
requireMatch(deploymentEnvValidator, /quote\s*!=\s*"'"/, 'deployment env validation must preserve single-quoted literal semantics');
for (const controlName of [
  'AI_TOOL_HUB_ENV_FILE', 'AI_TOOL_HUB_IMAGE', 'AI_TOOL_HUB_SOURCE_DIR',
  'AI_TOOL_HUB_BUILD_CONTEXT', 'DGC_NETWORK_NAME', 'GIT_SHA',
  'COMPOSE_PROJECT_NAME', 'COMPOSE_FILE', 'COMPOSE_PROFILES',
  'COMPOSE_ENV_FILES',
]) {
  requireMatch(deploymentEnvValidator, new RegExp(`"${controlName}"`), `deployment env validation must reject ${controlName}`);
}
for (const fixedControl of [
  /AI_TOOL_HUB_ENV_FILE="\$env_file"/,
  /AI_TOOL_HUB_IMAGE="\$image"/,
  /AI_TOOL_HUB_SOURCE_DIR="\$source_dir"/,
  /AI_TOOL_HUB_BUILD_CONTEXT="\$source_dir"/,
  /DGC_NETWORK_NAME=dramagenai-cloud_dgc-net/,
  /COMPOSE_PROJECT_NAME=weihub/,
  /docker compose --project-name weihub --env-file "\$env_file" -f "\$compose_file"/,
]) {
  requireMatch(deploymentReleaseLib, fixedControl, 'release Compose invocations must fix every deployment-control value');
}
for (const [pattern, message] of [
  [/rejects Compose interpolation for every required key/, 'deployment behavior tests must cover required-key interpolation'],
  [/preserves single-quoted dollar literals/, 'deployment behavior tests must cover Compose single-quoted literals'],
  [/uses the running container image ID when latest is absent/, 'deployment behavior tests must cover rollback without latest'],
  [/fails before activation when no current image is restorable/, 'deployment behavior tests must cover missing rollback sources'],
  [/validate_and_build_candidate_preserving_active/, 'deployment behavior tests must exercise the active-file preservation seam'],
  [/rejects quoted, unquoted, and duplicate deployment-control keys/, 'deployment behavior tests must reject env-file control overrides'],
  [/fixes env path, image, build context, network, revision, and project/, 'deployment behavior tests must reject ambient control overrides'],
  [/full activation failure restores source, config, image tag, service, and original status/, 'deployment behavior tests must cover full activation rollback'],
  [/restoration .* failure returns a distinct status and reports only the failed step/, 'deployment behavior tests must inject every restoration-step failure'],
  [/missing active Compose rejects activation before source, config, tag, or service writes/, 'deployment behavior tests must reject missing active Compose'],
]) {
  requireMatch(deploymentBehaviorTest, pattern, message);
}

requireMatch(
  deploymentReadme,
  /payment[^\n]*(?:disabled|fail-closed)/i,
  'deployment runbook must state that payment remains fail-closed',
);

if (!fs.existsSync(path.join(root, deploymentBehaviorTestPath))) {
  failures.push(`${deploymentBehaviorTestPath} is missing`);
}
requireMatch(
  workflowTestJob,
  /node --test scripts\/deploy-behavior\.test\.mjs/,
  'CI must execute deployment behavior regressions',
);
requireMatch(
  workflowTestJob,
  /bash -n[^\n]*deploy\/tencent-cloud\/release-lib\.sh/,
  'CI must syntax-check the shared deployment release library',
);

requireMatch(
  resumeBillingFixture,
  /basic-compensation-reserved/,
  'isolated billing fixture must cover Basic reservation compensation',
);
requireMatch(
  resumeBillingFixture,
  /vip-compensation-reserved/,
  'isolated billing fixture must cover VIP reservation compensation',
);

for (const [pattern, message] of [
  [/actions\/checkout@v5/, 'CI must use the Node 24-based checkout action'],
  [/actions\/setup-node@v5/, 'CI must use the Node 24-based setup-node action'],
  [/node-version:\s*['"]22['"]/, 'CI must use Node.js 22'],
  [/npm --prefix server ci/, 'CI must install locked server dependencies'],
  [/npm --prefix next-src ci/, 'CI must install locked Next.js dependencies'],
  [/npm run lint/, 'CI must lint the root application'],
  [/npm run build/, 'CI must build the root application before deployment'],
  [/npm --prefix next-src run lint/, 'CI must lint the Next.js application'],
  [/npm --prefix next-src run build/, 'CI must build the Next.js application'],
  [/node scripts\/next-audit-guard\.mjs/, 'CI must run the guarded Next.js production dependency audit'],
  [/npm --prefix server audit --omit=dev/, 'CI must audit server production dependencies'],
  [/node next-src\/tests\/api-regressions\.test\.mjs/, 'CI must run Next.js API regressions'],
  [/node \.next\/standalone\/server\.js/, 'CI must start the standalone Next.js server before API regressions'],
  [/TEST_BASE_URL=http:\/\/127\.0\.0\.1:/, 'CI must provide the Next.js API regression base URL'],
  [
    /TASK_FIRST_UI_URL=http:\/\/127\.0\.0\.1:4181 node scripts\/task-first-ui-guard\.mjs/,
    'CI must run the task-first Next.js browser guard',
  ],
  [
    /cd next-src\s+exec node node_modules\/next\/dist\/bin\/next start --hostname 127\.0\.0\.1 --port 4181/,
    'CI must own the task-first Next.js server through the direct Next CLI process',
  ],
  [/if ! kill -0 "\$next_pid" 2>\/dev\/null; then/, 'CI must detect early task-first Next.js server exit'],
  [/wait "\$next_pid" 2>\/dev\/null \|\| true/, 'CI must wait for the exact task-first Next.js server process'],
  [/exit_status=\$\?/, 'CI task-first cleanup must preserve the failing command status'],
  [
    /if \[ "\$exit_status" -ne 0 \]; then\s+cat "\$task_log"\s+fi\s+rm -f "\$task_log"/,
    'CI task-first cleanup must print a failed run log once before removing it',
  ],
  [/rm -f "\$task_log"/, 'CI task-first cleanup must remove its temporary log'],
  [/trap - EXIT INT TERM/, 'CI task-first cleanup must remove its traps after explicit cleanup'],
  [/node --test tools\/resume-optimizer\/tests\/api-client-auth\.test\.cjs/, 'CI must run resume optimizer regressions'],
  [/node scripts\/review-regressions\.mjs/, 'CI must run deployment regressions'],
  [/git diff --check/, 'CI must reject whitespace errors'],
]) {
  requireMatch(workflowTestJob, pattern, message);
}

if (/npm --prefix next-src run start -- --hostname 127\.0\.0\.1 --port 4181/.test(workflowTestJob)) {
  failures.push('CI task-first browser guard must not own an npm wrapper process');
}

requireMatch(deploymentScript, /rollback_keep=3/, 'deployment must retain exactly three rollback tags');
requireMatch(deploymentScript, /backup_keep=10/, 'deployment must retain exactly ten backup directories');
requireMatch(deploymentScript, /prune_deployment_history\s*\(\)/, 'deployment must prune old rollback state');
requireMatch(
  deploymentScript,
  /unlink \/etc\/systemd\/system\/ai-resume-optimizer\.service/,
  'deployment must remove the retired systemd unit after verification'
);

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('deployment regression checks passed');
