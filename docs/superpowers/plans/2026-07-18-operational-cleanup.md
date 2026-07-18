# Operational Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining CI and production-operations gaps after the full-review deployment.

**Architecture:** Expand the existing GitHub Pages test job into a full repository quality gate. Keep production cleanup inside the transactional deployment script so old rollback tags, backups, and the retired systemd unit are handled only after a verified deployment.

**Tech Stack:** GitHub Actions, npm, Jest, Next.js, Docker Compose, systemd, Bash.

## Global Constraints

- Keep `weihub.cloud/love/` available.
- Do not modify any `dramagenai.cloud` route or container.
- Retain three rollback image tags and ten timestamped deployment backup directories.
- Preserve the two local diagnostic scripts without committing them.
- Verify production before deleting retired operational state.

---

### Task 1: Encode CI and retention requirements

**Files:**
- Modify: `scripts/review-regressions.mjs`
- Test: `scripts/review-regressions.mjs`

**Interfaces:**
- Consumes: `.github/workflows/deploy.yml` and `deploy/tencent-cloud/quick-deploy.sh`.
- Produces: a non-zero exit when full-stack CI, bounded retention, or legacy-unit removal is missing.

- [ ] Add checks for root lint/build/test, Next install/build/lint/audit/regressions, server install/audit, resume tests, review guards, and `git diff --check`.
- [ ] Add checks for rollback retention of 3, backup retention of 10, and unlinking the retired systemd unit.
- [ ] Run `node scripts/review-regressions.mjs` and confirm it fails for the missing requirements.

### Task 2: Expand GitHub Actions coverage

**Files:**
- Modify: `.github/workflows/deploy.yml`
- Test: `scripts/review-regressions.mjs`

**Interfaces:**
- Consumes: the three lockfiles and repository test/build commands.
- Produces: a required `test` job that covers every application boundary before Pages deployment.

- [ ] Upgrade CI to Node.js 22 and install root, server, and Next dependencies with `npm ci`.
- [ ] Run root Jest/lint/build, Next regression/lint/build/audit, server audit, resume Node tests, review guards, shell syntax, and whitespace checks.
- [ ] Keep `build-and-deploy` dependent on the expanded test job.
- [ ] Run the static deployment guard and validate the workflow syntax structurally.

### Task 3: Bound production history and retire the old unit

**Files:**
- Modify: `deploy/tencent-cloud/quick-deploy.sh`
- Modify: `deploy/tencent-cloud/README.md`
- Test: `scripts/review-regressions.mjs`

**Interfaces:**
- Consumes: successful production deployment state.
- Produces: at most 3 rollback tags, at most 10 backup directories, and no `/etc/systemd/system/ai-resume-optimizer.service`.

- [ ] Add a post-verification cleanup function with explicit retention constants.
- [ ] Back up, disable, stop, unlink, and daemon-reload the obsolete systemd unit only after all route checks pass.
- [ ] Prune older rollback tags and backup directories after successful deployment.
- [ ] Run Bash syntax and deployment regression checks.

### Task 4: Deploy and verify operations

**Files:**
- Local-only: `.git/info/exclude`
- Remote: `/etc/systemd/system/ai-resume-optimizer.service`

**Interfaces:**
- Consumes: the verified deployment script and server package manager.
- Produces: installed Docker Buildx, clean local status, and bounded production rollback state.

- [ ] Add the two local diagnostic scripts to `.git/info/exclude` without deleting them.
- [ ] Install the Docker Buildx plugin on the production host and verify `docker buildx version`.
- [ ] Commit and push the cleanup changes to `main`.
- [ ] Run `quick-deploy.sh full` and require a zero exit.
- [ ] Verify all public routes, container health, no host port 3100, absent legacy unit, rollback count at most 3, backup count at most 10, CI success, and clean repository status.
