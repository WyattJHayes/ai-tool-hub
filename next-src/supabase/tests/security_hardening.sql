\set ON_ERROR_STOP on

begin;

do $$
declare
  v_policy_count integer;
  v_function regprocedure;
begin
  if not (select relrowsecurity from pg_catalog.pg_class where oid = 'public.click_logs'::regclass) then
    raise exception 'click_logs RLS is disabled';
  end if;
  if not (select relrowsecurity from pg_catalog.pg_class where oid = 'public.scene_tools'::regclass) then
    raise exception 'scene_tools RLS is disabled';
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'click_logs'
      and grantee in ('PUBLIC', 'anon', 'authenticated')
  ) then
    raise exception 'click_logs still grants client access';
  end if;
  if not pg_catalog.has_table_privilege('service_role', 'public.click_logs', 'SELECT')
    or not pg_catalog.has_table_privilege('service_role', 'public.click_logs', 'INSERT')
    or not pg_catalog.has_table_privilege('service_role', 'public.click_logs', 'UPDATE')
    or not pg_catalog.has_table_privilege('service_role', 'public.click_logs', 'DELETE') then
    raise exception 'service_role lost click_logs access';
  end if;

  if not pg_catalog.has_table_privilege('anon', 'public.scene_tools', 'SELECT')
    or not pg_catalog.has_table_privilege('authenticated', 'public.scene_tools', 'SELECT') then
    raise exception 'scene_tools client read access is missing';
  end if;
  if pg_catalog.has_table_privilege('anon', 'public.scene_tools', 'INSERT')
    or pg_catalog.has_table_privilege('anon', 'public.scene_tools', 'UPDATE')
    or pg_catalog.has_table_privilege('anon', 'public.scene_tools', 'DELETE')
    or pg_catalog.has_table_privilege('authenticated', 'public.scene_tools', 'INSERT')
    or pg_catalog.has_table_privilege('authenticated', 'public.scene_tools', 'UPDATE')
    or pg_catalog.has_table_privilege('authenticated', 'public.scene_tools', 'DELETE') then
    raise exception 'scene_tools grants client write access';
  end if;

  select count(*) into v_policy_count
  from pg_catalog.pg_policies
  where schemaname = 'public'
    and tablename = 'profiles'
    and policyname in ('profiles_read_own', 'profiles_update_own')
    and roles = array['authenticated']::name[];
  if v_policy_count <> 2 then
    raise exception 'profiles owner policies are incomplete';
  end if;
  if exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'profiles' and cmd = 'INSERT'
  ) then
    raise exception 'profiles still has an insert policy';
  end if;

  foreach v_function in array array[
    'public.handle_new_user()'::regprocedure,
    'public.update_tool_rating()'::regprocedure,
    'public.update_tool_favorite_count()'::regprocedure
  ] loop
    if not exists (
      select 1
      from pg_catalog.pg_proc
      where oid = v_function
        and proconfig @> array['search_path=""']
    ) then
      raise exception '% does not have an empty search_path', v_function;
    end if;
    if pg_catalog.has_function_privilege('anon', v_function, 'EXECUTE')
      or pg_catalog.has_function_privilege('authenticated', v_function, 'EXECUTE') then
      raise exception '% is executable by a client role', v_function;
    end if;
  end loop;
end;
$$;

set local role anon;
select count(*) from public.scene_tools;

do $$
begin
  begin
    perform count(*) from public.click_logs;
    raise exception 'anon read click_logs';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000099","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000099', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select count(*) from public.profiles;

do $$
begin
  begin
    insert into public.profiles (id, email)
    values ('10000000-0000-4000-8000-000000000099', 'forbidden@example.invalid');
    raise exception 'authenticated inserted profile';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

reset role;
rollback;
