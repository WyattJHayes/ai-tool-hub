# Supabase Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove the remaining AI Tool Hub-owned Supabase exposures and make DeepSeek production configuration complete and fail-closed.

**Architecture:** Apply one additive Postgres migration that resets grants, enables RLS, installs explicit policies, and replaces trigger functions with fixed schema resolution. Guard the migration and the production env parser with executable regression tests, then rehearse the exact DDL transactionally before applying it.

**Tech Stack:** PostgreSQL/Supabase RLS, Supabase CLI, Python 3, Node.js test runner, Next.js deployment scripts.

## Task 1: Lock the approved contract in failing tests

- [ ] Extend `scripts/deploy-behavior.test.mjs` so the valid fixture contains both DeepSeek endpoint variables.
- [ ] Assert missing, empty, duplicate, interpolated, and invalid-scheme values are rejected without value leakage.
- [ ] Extend `scripts/review-regressions.mjs` to require the generated security migration and its exact grants, policies, RLS, and hardened functions.
- [ ] Add `next-src/supabase/tests/security_hardening.sql` with catalog and role-behavior assertions.
- [ ] Run the focused tests and confirm they fail for the intended missing implementation.

## Task 2: Implement the validator and migration

- [ ] Add both DeepSeek variables to `deploy/tencent-cloud/validate-env.py` and validate the base URL structurally.
- [ ] Generate the migration using `supabase migration new security_hardening`.
- [ ] Implement the approved table privileges, RLS policies, and function hardening.
- [ ] Update deployment documentation only where the new required variables are enumerated.
- [ ] Run focused tests and confirm they pass.

## Task 3: Verify in isolation

- [ ] Apply `001_initial.sql`, the security migration, and the SQL fixture to an isolated Postgres instance.
- [ ] Run deployment behavior tests, regression guards, lint, resume tests, and production build.
- [ ] Review `git diff --check`, secrets scan, and the complete diff.

## Task 4: Rehearse against production

- [ ] Capture the current production grants, policies, functions, and RLS flags without secret output.
- [ ] Execute the exact migration within `BEGIN`/`ROLLBACK` against production.
- [ ] Run catalog and role assertions inside that transaction and verify rollback restored the baseline.

## Task 5: Merge and release

- [ ] Commit the tested changes, push `codex/harden-supabase-security`, and create a pull request.
- [ ] Wait for required CI, review the final PR diff, and merge to `main`.
- [ ] Apply only the migration from the exact merged revision and rerun Security Advisor.
- [ ] Deploy the exact merged revision with all resume release authorization variables set to that revision.
- [ ] Verify production routes, authenticated quota, zero resume data tables, container health/revision, and privacy logs.
- [ ] Record accepted residual findings: leaked-password protection and authenticated `expire_resume_order(...)` execution.
