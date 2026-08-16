-- ============================================================================
-- RLS / authorization regression contracts (run in the Supabase SQL Editor,
-- after applying supabase/migrations/*.sql — same procedure as
-- tests/resume_billing.sql).
--
-- [VULN-1] tools / categories / scenes have NEVER had `enable row level
-- security` in any migration. The anon key is public by design, and Supabase
-- grants anon/authenticated full table privileges unless RLS constrains them:
-- anyone with the public anon key can currently UPDATE tools.website_url
-- (phishing), rewrite click_count / avg_rating / is_featured, or DELETE rows.
--
-- [L-3] ratings has no DELETE policy, so users cannot remove their own
-- rating (data-subject rights gap).
--
-- This file FAILS (raise exception) while the gaps exist and PASSES once the
-- 003 migration lands. It is the executable counterpart of the audit report.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- [VULN-1a] RLS must be enabled on every public-content table.
-- ---------------------------------------------------------------------------
do $$
declare
  v_missing text;
begin
  select string_agg(tablename, ', ') into v_missing
  from (
    select 'tools' as tablename
    union all select 'categories'
    union all select 'scenes'
  ) t
  where not exists (
    select 1 from pg_catalog.pg_tables
    where schemaname = 'public'
      and tablename = t.tablename
      and rowsecurity
  );

  if v_missing is not null then
    raise exception 'VULN-1: row level security missing on public tables: %', v_missing;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- [VULN-1b] anon/authenticated must hold NO write policies on those tables
-- (reads stay public; writes must go through service-role only).
-- ---------------------------------------------------------------------------
do $$
declare
  v_offenders text;
begin
  select string_agg(tablename || ':' || policyname, ', ') into v_offenders
  from pg_catalog.pg_policies
  where schemaname = 'public'
    and tablename in ('tools', 'categories', 'scenes')
    and cmd in ('INSERT', 'UPDATE', 'DELETE')
    and (roles && array['anon', 'authenticated']::name[]);

  if v_offenders is not null then
    raise exception 'VULN-1: anon/authenticated hold write policies on content tables: %', v_offenders;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- [VULN-1c] public read access must stay available for the anonymous catalog
-- (the frontend and ratings GET depend on it) — otherwise the fix would
-- break the site while closing the write hole.
-- ---------------------------------------------------------------------------
do $$
declare
  v_missing text;
begin
  select string_agg(tablename, ', ') into v_missing
  from (
    select 'tools' as tablename
    union all select 'categories'
    union all select 'scenes'
  ) t
  where not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = t.tablename
      and cmd = 'SELECT'
      and roles && array['anon']::name[]
  );

  if v_missing is not null then
    raise exception 'REGRESSION: anonymous read policies missing on: %', v_missing;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- [L-3] users must be able to delete their own ratings.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'ratings'
      and cmd = 'DELETE'
      and qual like '%auth.uid()%'
  ) then
    raise exception 'L-3: ratings has no user-scoped DELETE policy';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Guardrail: the resume billing tables must keep RLS enabled (guards against
-- a future migration accidentally disabling it).
-- ---------------------------------------------------------------------------
do $$
declare
  v_missing text;
begin
  select string_agg(tablename, ', ') into v_missing
  from (
    select 'resume_quota_accounts' as tablename
    union all select 'resume_usage_ledger'
    union all select 'resume_memberships'
    union all select 'resume_orders'
    union all select 'resume_payment_events'
  ) t
  where not exists (
    select 1 from pg_catalog.pg_tables
    where schemaname = 'public'
      and tablename = t.tablename
      and rowsecurity
  );

  if v_missing is not null then
    raise exception 'REGRESSION: RLS disabled on resume billing tables: %', v_missing;
  end if;
end;
$$;
