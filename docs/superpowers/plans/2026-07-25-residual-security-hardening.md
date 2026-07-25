# Residual Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve residual payment-readiness, GitHub security scanning, and development dependency audit items without weakening production release gates.

**Architecture:** Keep XDDPAY fail-closed until an authoritative signed fixture and complete production endpoints exist. Use GitHub-managed Dependabot and CodeQL default setup for repository security. Replace the vulnerable lint preset dependency chain with direct official Next.js, TypeScript ESLint, and React Hooks plugins, and require a clean full dependency audit in CI.

**Tech Stack:** Next.js 16, ESLint flat config, TypeScript ESLint, GitHub Dependabot, GitHub CodeQL, npm lockfiles, Node.js 22.

## Global Constraints

- Never infer the XDDPAY signing algorithm or expose payment routes without an authoritative provider-signed fixture.
- Never print, persist, or commit production secrets or fixture payloads.
- Keep `.superpowers/` untracked and untouched.
- Production and development npm audits must both report zero vulnerabilities.
- Existing lint, resume tests, production build, deployment gates, and privacy checks must continue to pass.

---

### Task 1: Payment Readiness Gate

**Files:**
- Verify: `deploy/tencent-cloud/README.md`
- Verify: `deploy/tencent-cloud/quick-deploy.sh`
- Verify: `next-src/src/server/env.ts`

**Interfaces:**
- Consumes: production environment key presence and provider fixture inventory.
- Produces: an explicit blocked or ready decision without changing payment behavior.

- [x] **Step 1: Verify production key presence without reading values**

Check `XDDPAY_APP_ID`, `XDDPAY_SECRET`, `XDDPAY_GATEWAY`, and `XDDPAY_NOTIFY_URL` by name and presence only.

- [x] **Step 2: Verify provider fixture availability**

Search only for candidate fixture filenames and report the count; never read or print payloads.

- [x] **Step 3: Apply the release decision**

Keep payment disabled because the gateway, notify URL, and authoritative signed fixture are absent. Do not create routes or infer signing behavior.

### Task 2: GitHub Security Features

**Files:**
- External configuration: repository security settings for `a895411690/ai-tool-hub`

**Interfaces:**
- Consumes: GitHub repository administrator access.
- Produces: Dependabot alerts, automated security fixes, and CodeQL default setup for Actions and JavaScript/TypeScript.

- [x] **Step 1: Enable Dependabot vulnerability alerts and security updates**

Use the GitHub REST API and verify the repository reports `dependabot_security_updates.status=enabled`.

- [x] **Step 2: Enable CodeQL default setup**

Configure the default query suite for `actions` and `javascript-typescript`, then verify the first dynamic analysis run starts.

### Task 3: Full Dependency Audit

**Files:**
- Modify: `next-src/package.json`
- Modify: `next-src/package-lock.json`
- Modify: `next-src/eslint.config.mjs`
- Modify: `scripts/next-audit-guard.mjs`
- Modify: `scripts/next-audit-guard.test.mjs`

**Interfaces:**
- Consumes: official Next.js ESLint plugin rules, TypeScript ESLint recommended rules, React Hooks flat recommended rules.
- Produces: a lint configuration with no vulnerable `minimatch 3` dependency chain and a CI guard that audits production and development dependencies.

- [x] **Step 1: Write the failing full-audit guard test**

Assert that the guard invokes `npm --prefix next-src audit --json` without `--omit=dev`, and rejects any vulnerability entry.

- [x] **Step 2: Run the guard and confirm failure**

Run `node --test scripts/next-audit-guard.test.mjs` and `node scripts/next-audit-guard.mjs`; expect the full audit requirement or existing nine development vulnerabilities to fail.

- [x] **Step 3: Replace the vulnerable lint dependency chain**

Remove `eslint-config-next`; use `eslint@10.8.0`, `@next/eslint-plugin-next@16.2.11`, `typescript-eslint@8.65.0`, and `eslint-plugin-react-hooks@7.1.1`. Compose their flat recommended rules in `next-src/eslint.config.mjs` while retaining project overrides.

- [x] **Step 4: Update the lockfile and verify zero vulnerabilities**

Run `npm --prefix next-src install --package-lock-only --ignore-scripts`, `npm --prefix next-src ci`, and `npm --prefix next-src audit --json`. Expect zero vulnerabilities at every severity.

- [x] **Step 5: Verify behavior**

Run the audit guard tests, repository regression guards, Next.js lint, resume tests, and production build. All commands must exit zero.

### Task 4: Publish And Deploy

**Files:**
- Commit only the files listed in Task 3 and this plan.

**Interfaces:**
- Consumes: verified working tree and exact Git revision.
- Produces: remote `main`, successful GitHub Actions and CodeQL checks, and a healthy production container running the exact revision.

- [ ] **Step 1: Commit and push scoped changes**

Exclude `.superpowers/`; push only the verified security hardening changes to `main`.

- [ ] **Step 2: Deploy the exact revision**

Run the revision-bound production release script and require healthy container, correct revision, route checks, zero privacy-log matches, and zero resume billing table residue.

- [ ] **Step 3: Wait for GitHub checks**

Require the regular CI and CodeQL analyses to complete successfully, then report any remaining payment blocker explicitly.
