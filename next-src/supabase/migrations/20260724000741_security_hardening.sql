-- Restrict AI Tool Hub-owned public schema objects to their intended roles.

alter table public.click_logs enable row level security;

drop policy if exists "Public read click_logs" on public.click_logs;
drop policy if exists "Public insert click_logs" on public.click_logs;

revoke all on table public.click_logs from public, anon, authenticated;
revoke all on sequence public.click_logs_id_seq from public, anon, authenticated;
grant all on table public.click_logs to service_role;
grant usage, select on sequence public.click_logs_id_seq to service_role;

alter table public.scene_tools enable row level security;

drop policy if exists scene_tools_public_read on public.scene_tools;

revoke all on table public.scene_tools from public, anon, authenticated;
grant select on table public.scene_tools to anon, authenticated;
grant all on table public.scene_tools to service_role;

create policy scene_tools_public_read
  on public.scene_tools
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Allow trigger to insert profiles" on public.profiles;
drop policy if exists profiles_read_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;

revoke all on table public.profiles from public, anon, authenticated;
grant select, update on table public.profiles to authenticated;
grant all on table public.profiles to service_role;

create policy profiles_read_own
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$;

create or replace function public.update_tool_rating()
returns trigger
language plpgsql
security invoker
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
security invoker
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

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.update_tool_rating() from public, anon, authenticated;
revoke execute on function public.update_tool_favorite_count() from public, anon, authenticated;
