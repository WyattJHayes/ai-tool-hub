# Full Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve every actionable P0-P2 issue identified in the 2026-07-17 full repository review.

**Architecture:** Preserve the existing Vite, Express, Next.js, and resume-optimizer boundaries. Replace unsafe build/auth assumptions at their source, make API identity and database writes explicit, make quota operations atomic, and add regression coverage beside the owning subsystem.

**Tech Stack:** JavaScript ES modules, Jest, Express 4, Next.js 14/React 18, Supabase/PostgreSQL, Docker Compose.

## Global Constraints

- Preserve all pre-existing dirty-worktree changes.
- Do not commit or deploy.
- Add a failing regression test or executable check before each production-code behavior change.
- Keep vendored `public/skills` assets out of scope.

---

### Task 1: Resume Optimizer Build And Authentication

**Files:**
- Modify: `tools/resume-optimizer/scripts/build.cjs`
- Modify: `tools/resume-optimizer/src/lib/apiClient.js`
- Modify: `server/src/routes/auth.js`
- Create: `tools/resume-optimizer/tests/build-output.test.cjs`
- Create: `tools/resume-optimizer/tests/api-client-auth.test.cjs`

**Interfaces:**
- Produces: syntactically valid `dist` modules and server-verified cookie sessions.

- [ ] Write build and authentication regression tests that reproduce URL corruption, missing modules, and the unreadable HttpOnly-cookie session check.
- [ ] Run the focused tests and confirm they fail for those reasons.
- [ ] Replace regex JavaScript minification with the installed Terser API, copy the complete module graph, and add `/auth/logout` plus `/auth/session`-based client state.
- [ ] Rebuild and confirm the focused tests and browser flow pass.

### Task 2: Next.js Cloud Data And UI

**Files:**
- Modify: `next-src/next.config.mjs`
- Modify: `next-src/src/lib/api.ts`
- Modify: `next-src/src/app/api/favorites/route.ts`
- Modify: `next-src/src/app/api/ratings/route.ts`
- Modify: `next-src/src/components/ratings/RatingWidget.tsx`
- Modify: `next-src/src/app/page.tsx`
- Modify: `next-src/src/app/tools/[slug]/page.tsx`
- Modify: `next-src/src/app/user/page.tsx`
- Modify: `next-src/package.json`
- Create: `next-src/tests/api-regressions.test.mjs`

**Interfaces:**
- Produces: authenticated API requests, per-browser anonymous sessions, truthful rating UI, Supabase-compatible CSP, and mapped icons.

- [ ] Write executable regression checks for request headers, anonymous-session isolation, rating failure handling, CSP, and icon rendering.
- [ ] Run the checks and confirm current behavior fails.
- [ ] Centralize authenticated headers/session IDs, reject invalid mutations, surface persistence errors, update local rating state, allow Supabase origins, and use `ToolIcon` consistently.
- [ ] Upgrade Next.js to a patched compatible release and run type/build/audit checks.

### Task 3: Express Streaming, Quota, Rate Limit, And Payment

**Files:**
- Modify: `server/src/services/llm.js`
- Modify: `server/src/services/quota.js`
- Modify: `server/src/routes/resume.js`
- Modify: `server/src/middleware/rateLimit.js`
- Modify: `server/src/index.js`
- Modify: `server/src/routes/payment.js`
- Modify: `server/src/__tests__/llm.test.js`
- Modify: `server/src/__tests__/quota.test.js`
- Modify: `server/src/__tests__/rateLimit.test.js`

**Interfaces:**
- Produces: buffered SSE parsing, atomic quota reservation/commit/release, authenticated user limiting, and an explicit unsupported WeChat response instead of a non-payable order.

- [ ] Add failing tests for split SSE frames, concurrent final-quota reservations, user-rate limiting, and incomplete WeChat order creation.
- [ ] Run the focused Jest suites and verify expected failures.
- [ ] Implement minimal fixes at each owning boundary.
- [ ] Run focused and full Jest suites.

### Task 4: Database And Deployment Integrity

**Files:**
- Modify: `next-src/supabase/migrations/001_initial.sql`
- Modify: `server/docker-compose.yml`
- Modify: `.gitignore`
- Add: `package-lock.json`, `server/package-lock.json`, `next-src/package-lock.json`
- Create: `scripts/review-regressions.mjs`

**Interfaces:**
- Produces: update-capable rating RLS, correct DELETE aggregates, protected click logs, reproducible installs, and a valid health check.

- [ ] Add static migration/deployment regression checks and run them red.
- [ ] Correct policies/triggers/RLS, health path, and lockfile tracking.
- [ ] Run the checks green and verify clean-copy `npm ci`.

### Task 5: End-To-End Verification

**Files:**
- Modify only if verification exposes a regression in the files above.

**Interfaces:**
- Produces: fresh test, build, audit, HTTP, and browser evidence.

- [ ] Run root Jest, lint, and Vite build.
- [ ] Run resume optimizer build plus syntax/module checks.
- [ ] Run Next typecheck, production build, and dependency audit.
- [ ] Run browser smoke tests for the resume optimizer and Next home/detail/auth flows.
- [ ] Inspect final diff and confirm pre-existing unrelated changes remain intact.
