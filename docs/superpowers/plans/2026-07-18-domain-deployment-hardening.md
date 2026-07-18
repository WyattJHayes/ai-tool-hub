# Domain Deployment Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `weihub.cloud` a reproducible AI Tool Hub deployment with a preserved `/love/` static-site exception, no host-exposed application port, and no stale DramaGen or monitoring routes.

**Architecture:** Build the Next.js application as a standalone, non-root container. Run it through a dedicated `weihub` Compose project attached to the existing external `dramagenai-cloud_dgc-net` network, and let the existing `dgc-nginx` container reach it only through the `weihub-app` network alias. Keep one canonical Nginx template and one deployment script.

**Tech Stack:** Next.js 16 standalone output, Node.js 22 Alpine, Docker Compose v2, Nginx, shell deployment scripts, Node.js regression guards.

## Global Constraints

- Preserve all unrelated changes in the existing dirty worktree.
- Do not commit or push changes unless explicitly requested.
- Never put application secrets in tracked files or command output.
- Back up the live container metadata, environment, and Nginx configuration before replacement.
- `dramagenai.cloud` routes and containers must remain unchanged.

---

### Task 1: Encode the production deployment contract

**Files:**
- Modify: `scripts/review-regressions.mjs`
- Test: `scripts/review-regressions.mjs`

**Interfaces:**
- Consumes: repository deployment files as UTF-8 text.
- Produces: a failing process exit when the production deployment exposes port 3100, lacks the external network alias, contains stale routes, or lacks standalone Next.js output.

- [ ] **Step 1: Add failing assertions**

Assert that `next-src/next.config.mjs` contains `output: 'standalone'`, the production Compose file has no `ports`, the `weihub-app` alias is present on the external DGC network, the canonical Nginx file preserves `/love/`, and it contains no Grafana, Kibana, OpenClaw, Metrics, or `dramagenai.cloud` routes.

- [ ] **Step 2: Verify the guard fails for missing production artifacts**

Run: `node scripts/review-regressions.mjs`

Expected: non-zero exit mentioning missing `deploy/tencent-cloud/docker-compose.prod.yml` or missing standalone output.

- [ ] **Step 3: Keep the guard focused on deployment invariants**

Use structured YAML parsing when an existing parser is available; otherwise use anchored checks that reject `ports:` under the application service and require `expose:`, `external: true`, and the `ai-tool-hub` alias.

- [ ] **Step 4: Verify the guard passes after Tasks 2 and 3**

Run: `node scripts/review-regressions.mjs`

Expected: `deployment regression checks passed`.

### Task 2: Add a reproducible standalone application container

**Files:**
- Create: `next-src/Dockerfile`
- Create: `next-src/.dockerignore`
- Modify: `next-src/next.config.mjs`
- Create: `deploy/tencent-cloud/docker-compose.prod.yml`
- Test: `scripts/review-regressions.mjs`

**Interfaces:**
- Consumes: `next-src/package-lock.json`, runtime variables from `/opt/ai-tool-hub/.env`, and external Docker network `dramagenai-cloud_dgc-net`.
- Produces: image `ai-resume-optimizer:latest`, container `weihub-app`, internal port `3100`, and DNS alias `weihub-app`.

- [ ] **Step 1: Enable standalone Next.js output**

Add `output: 'standalone'` to `nextConfig`.

- [ ] **Step 2: Add a locked multi-stage Docker build**

Use `node:22-alpine`, `npm ci`, `npm run build`, copy `.next/standalone`, `.next/static`, and `public`, then run `node server.js` as UID/GID 1001 with `PORT=3100` and `HOSTNAME=0.0.0.0`.

- [ ] **Step 3: Add the production Compose service**

Define `restart: unless-stopped`, `env_file: /opt/ai-tool-hub/.env`, `expose: ["3100"]`, a Node-based HTTP healthcheck, and the `weihub-app` alias on an external network. Do not define `ports`.

- [ ] **Step 4: Build and inspect the image locally**

Run: `docker build -t ai-resume-optimizer:verify -f next-src/Dockerfile next-src`

Expected: successful build; `docker image inspect` reports user `nextjs`, exposed port `3100/tcp`, and command `node server.js`.

### Task 3: Consolidate Nginx and deployment entrypoints

**Files:**
- Modify: `deploy/tencent-cloud/nginx.conf`
- Modify: `deploy/tencent-cloud/quick-deploy.sh`
- Modify: `deploy/tencent-cloud/deploy.sh`
- Modify: `deploy/tencent-cloud/README.md`
- Delete: `deploy/tencent-cloud/ai-tool-hub统一.conf`
- Delete: `deploy/tencent-cloud/weihub.cloud统一.conf`
- Test: `scripts/review-regressions.mjs`

**Interfaces:**
- Consumes: image `ai-resume-optimizer:latest`, production Compose file, existing TLS files under `/etc/letsencrypt/live/weihub.cloud`, and external DGC network.
- Produces: HTTP-to-HTTPS routing and HTTPS proxying to `http://weihub-app:3100`, with `/love/` served from the preserved static directory.

- [ ] **Step 1: Replace the canonical Nginx template**

Listen on container ports 8080/8443, use only `weihub.cloud www.weihub.cloud`, redirect HTTP to `https://weihub.cloud`, preserve the `/love/` static site, and proxy every other HTTPS path to `weihub-app:3100` with forwarding and WebSocket headers. Remove all monitoring and DramaGen routes.

- [ ] **Step 2: Remove duplicate Nginx templates**

Delete both files whose names end in `统一.conf`; the canonical source becomes `deploy/tencent-cloud/nginx.conf`.

- [ ] **Step 3: Replace quick deployment with image deployment**

Build the Next.js image, transfer it to the server, install the Compose and Nginx files, require `/opt/ai-tool-hub/.env`, validate Compose and Nginx, recreate the application, reload Nginx, and verify both domains.

- [ ] **Step 4: Make the legacy deploy script a compatibility wrapper**

Resolve its directory and execute `quick-deploy.sh` with the provided command, defaulting to `full`.

- [ ] **Step 5: Rewrite deployment documentation around the single production path**

Document the required environment file without secret values, the external network prerequisite, deployment commands, rollback location, and domain isolation checks.

- [ ] **Step 6: Validate scripts and guard**

Run: `bash -n deploy/tencent-cloud/quick-deploy.sh deploy/tencent-cloud/deploy.sh`

Run: `node scripts/review-regressions.mjs`

Expected: both exit zero.

### Task 4: Migrate and verify production safely

**Files:**
- Install remotely: `/opt/ai-tool-hub/docker-compose.yml`
- Create remotely with mode 0600: `/opt/ai-tool-hub/.env`
- Install remotely: `/opt/dramagenai/dramagenai-cloud/nginx/conf.d/legacy-domain-redirect.conf`

**Interfaces:**
- Consumes: currently running `ai-resume-optimizer` image and environment.
- Produces: Compose-managed AI Tool Hub with no host port mapping and exclusive `weihub.cloud` routing.

- [ ] **Step 1: Back up current production state**

Store `docker inspect` output, the application environment, the legacy systemd unit, current Compose file if present, and Nginx configuration under `/opt/ai-tool-hub/backups/<timestamp>` with directory mode 0700 and secret files mode 0600.

- [ ] **Step 2: Install and validate candidate deployment files**

Upload repository Compose and Nginx files, create a filtered application `.env` without printing values, and run `docker compose config -q` before replacing the container.

- [ ] **Step 3: Replace the manual container transactionally**

Start the collision-free Compose service alongside the old container, wait for a healthy state, and leave the old service untouched if startup fails. Disable the legacy `ai-resume-optimizer.service` unit and remove its host-published container only after the new service and Nginx route are healthy.

- [ ] **Step 4: Validate and reload Nginx**

Run `docker exec dgc-nginx nginx -t`, reload, and retain the prior Nginx file as a timestamped backup.

- [ ] **Step 5: Verify isolation and port closure**

Verify `https://weihub.cloud/` and `https://www.weihub.cloud/` return the AI Tool Hub title, `https://weihub.cloud/love/` still returns the static memorial page, `https://dramagenai.cloud/` returns the DramagenAI title, `docker inspect` reports no host port mapping for 3100, and Nginx resolves `weihub-app`.

- [ ] **Step 6: Run repository verification**

Run: `npm test -- --runInBand`

Run: `npm run lint`

Run: `node scripts/review-guard.mjs && node scripts/review-regressions.mjs`

Expected: all tests pass; lint has zero errors; both review guards pass.
