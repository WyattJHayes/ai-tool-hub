# Supabase Security Hardening Design

## Status

Approved on 2026-07-24. This design addresses the remaining Security Advisor findings owned by AI Tool Hub without changing unrelated products in the shared Supabase project.

## Goals

- Remove public access to click telemetry and its session identifiers.
- Make scene-to-tool relationships explicitly read-only for public clients.
- Restrict profiles to owner read and update operations; profile creation remains trigger-owned.
- Give trigger functions fixed schema resolution and the smallest executable surface.
- Make production deployment reject incomplete DeepSeek endpoint configuration.
- Preserve the validated resume billing boundary and its authenticated order-expiry RPC.

## Non-Goals

- Do not alter shared-project tables that are not owned by AI Tool Hub.
- Do not enable leaked-password protection; that remains a Supabase Auth dashboard operation.
- Do not change resume quota, membership, order, or payment behavior.
- Do not enable database click logging. The current tracking route remains in-memory only.
- Do not revoke authenticated execution of `expire_resume_order(...)`; it verifies `auth.uid() = p_user_id` and is covered by billing tests.

## Access Model

| Object | `anon` | `authenticated` | `service_role` |
| --- | --- | --- | --- |
| `click_logs` | none | none | full table access |
| `scene_tools` | select | select | full table access |
| `profiles` | none | select/update own row | full table access |

`click_logs` has RLS enabled but no client policies. Its table grants are revoked from `PUBLIC`, `anon`, and `authenticated`. `scene_tools` has RLS enabled, client write grants revoked, and one explicit select policy for `anon` and `authenticated`.

Profiles have two explicit policies for `authenticated`: owner select, and owner update with matching `USING` and `WITH CHECK` predicates. The permissive insert policy is removed. New rows continue to be created by the auth trigger.

## Function Hardening

`handle_new_user()` remains `SECURITY DEFINER`, uses `SET search_path = ''`, and schema-qualifies `public.profiles`. Execution is revoked from `PUBLIC`, `anon`, and `authenticated`; the auth trigger continues to invoke it.

`update_tool_rating()` and `update_tool_favorite_count()` use the same empty search path and schema-qualified table references. Direct execution is revoked from public client roles; their table triggers continue to invoke them.

The migration is idempotent where practical: policies are dropped by name before recreation, RLS enablement is repeatable, grants are explicitly reset, and functions are replaced in place so existing triggers remain attached.

## Deployment Configuration

The production environment validator requires `DEEPSEEK_BASE_URL` and `DEEPSEEK_MODEL` in addition to the existing required variables. Missing, empty, duplicate, malformed, or interpolated assignments fail closed. The base URL must be an absolute `http` or `https` URL with a hostname; credentials and fragments are rejected. Validator output reports names and states only, never values.

## Verification And Release

1. Add regression tests that fail until the validator and migration express the approved boundary.
2. Run the migration plus SQL role assertions in an isolated database transaction.
3. Rehearse the exact migration against production inside `BEGIN`/`ROLLBACK`, including catalog assertions.
4. Merge only after repository tests pass.
5. Apply the exact merged migration, rerun Supabase Security Advisor, and verify accepted exceptions only.
6. Deploy the exact merged revision with all existing resume release gates, then repeat route, auth, quota, data-count, and privacy checks.

The existing deployment backup and container image provide application rollback. Before production DDL, capture grants, policies, function definitions, and RLS state so the database boundary can be restored independently if verification fails.
