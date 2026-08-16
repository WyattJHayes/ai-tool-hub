-- ============================================================================
-- 003_content_rls: close the anon-key write surface on public content tables
--
-- [VULN-1] tools/categories/scenes have never had RLS enabled. The anon key
-- is public by design (it ships in the frontend bundle), and Supabase grants
-- anon/authenticated full table privileges unless RLS constrains them, so
-- anyone could rewrite tools.website_url (phishing), click_count,
-- avg_rating, or is_featured through PostgREST.
--
-- [L-3] ratings had no DELETE policy, so users could not retract a review.
--
-- Consume-safety: read policies keep the public catalog readable for the
-- anonymous frontend; ALL writes move to the service role.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Enable RLS on the content tables.
-- ---------------------------------------------------------------------------
alter table public.tools enable row level security;
alter table public.categories enable row level security;
alter table public.scenes enable row level security;

-- ---------------------------------------------------------------------------
-- 2. Public read policies (anon + authenticated).
-- ---------------------------------------------------------------------------
create policy tools_public_read
  on public.tools
  for select
  to anon, authenticated
  using (true);

create policy categories_public_read
  on public.categories
  for select
  to anon, authenticated
  using (true);

create policy scenes_public_read
  on public.scenes
  for select
  to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- 3. Defense in depth: strip anon/authenticated write privileges entirely.
--    (RLS blocks row access; REVOKE removes the underlying table grants.)
-- ---------------------------------------------------------------------------
revoke insert, update, delete on table public.tools from anon, authenticated;
revoke insert, update, delete on table public.categories from anon, authenticated;
revoke insert, update, delete on table public.scenes from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. [L-3] Users may delete their own ratings (data-subject rights).
-- ---------------------------------------------------------------------------
create policy ratings_delete_own
  on public.ratings
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- 5. Counter triggers must become security definer.
--
--    RLS on tools now blocks anon/authenticated from updating it, but the
--    ratings INSERT path (allowed by RLS for authenticated users) fires
--    update_tool_rating() as the INVOKER — that update would be rejected and
--    roll back the whole rating submission. SECURITY DEFINER keeps the
--    counters consistent for both write paths (RLS-authenticated and
--    service-role). Bodies match 20260724000741_security_hardening.sql.
-- ---------------------------------------------------------------------------
create or replace function public.update_tool_rating()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.tools
  set avg_rating = (
        select pg_catalog.coalesce(pg_catalog.avg(rating.score), 0)
        from public.ratings as rating
        where rating.tool_id = pg_catalog.coalesce(new.tool_id, old.tool_id)
      ),
      rating_count = (
        select pg_catalog.count(*)
        from public.ratings as rating
        where rating.tool_id = pg_catalog.coalesce(new.tool_id, old.tool_id)
      ),
      updated_at = pg_catalog.now()
  where id = pg_catalog.coalesce(new.tool_id, old.tool_id);
  return new;
end;
$$;

create or replace function public.update_tool_favorite_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.tools
    set favorite_count = favorite_count + 1
    where id = new.tool_id;
  elsif tg_op = 'DELETE' then
    update public.tools
    set favorite_count = favorite_count - 1
    where id = old.tool_id;
  end if;
  return null;
end;
$$;

revoke execute on function public.update_tool_rating() from public, anon, authenticated;
revoke execute on function public.update_tool_favorite_count() from public, anon, authenticated;
