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
  if (/^\s*ports:\s*$/m.test(productionCompose)) {
    failures.push(`${productionComposePath} must not publish application ports on the host`);
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

for (const [pattern, message] of [
  [/node-version:\s*['"]22['"]/, 'CI must use Node.js 22'],
  [/npm --prefix server ci/, 'CI must install locked server dependencies'],
  [/npm --prefix next-src ci/, 'CI must install locked Next.js dependencies'],
  [/npm run lint/, 'CI must lint the root application'],
  [/npm run build/, 'CI must build the root application before deployment'],
  [/npm --prefix next-src run lint/, 'CI must lint the Next.js application'],
  [/npm --prefix next-src run build/, 'CI must build the Next.js application'],
  [/npm --prefix next-src audit --omit=dev/, 'CI must audit Next.js production dependencies'],
  [/npm --prefix server audit --omit=dev/, 'CI must audit server production dependencies'],
  [/node next-src\/tests\/api-regressions\.test\.mjs/, 'CI must run Next.js API regressions'],
  [/node \.next\/standalone\/server\.js/, 'CI must start the standalone Next.js server before API regressions'],
  [/TEST_BASE_URL=http:\/\/127\.0\.0\.1:/, 'CI must provide the Next.js API regression base URL'],
  [/node --test tools\/resume-optimizer\/tests\/api-client-auth\.test\.cjs/, 'CI must run resume optimizer regressions'],
  [/node scripts\/review-regressions\.mjs/, 'CI must run deployment regressions'],
  [/git diff --check/, 'CI must reject whitespace errors'],
]) {
  requireMatch(workflowTestJob, pattern, message);
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
