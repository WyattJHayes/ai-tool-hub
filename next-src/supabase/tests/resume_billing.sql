-- Execute only against an isolated Supabase/Postgres test database.
-- Every fixture and assertion is rolled back.

begin;

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at
) values
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'resume-free-test@example.invalid', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'resume-basic-test@example.invalid', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'resume-vip-test@example.invalid', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'resume-payment-test@example.invalid', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'resume-other-test@example.invalid', '', now(), now(), now())
on conflict (id) do nothing;

select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select set_config('request.jwt.claim.role', 'service_role', true);

-- Duplicate free reservation decrements only once.
do $$
declare
  v_first record;
  v_duplicate record;
  v_used integer;
begin
  select * into v_first
  from public.reserve_resume_quota(
    '10000000-0000-4000-8000-000000000001',
    'parse',
    'free-idempotency-1',
    '20000000-0000-4000-8000-000000000001'
  );
  select * into v_duplicate
  from public.reserve_resume_quota(
    '10000000-0000-4000-8000-000000000001',
    'parse',
    'free-idempotency-1',
    '20000000-0000-4000-8000-000000000001'
  );

  if v_first.ledger_id <> v_duplicate.ledger_id then
    raise exception 'duplicate free reservation created a second ledger row';
  end if;

  select free_daily_used into v_used
  from public.resume_quota_accounts
  where user_id = '10000000-0000-4000-8000-000000000001';
  if v_used <> 1 then
    raise exception 'duplicate free reservation decremented % times', v_used;
  end if;
end;
$$;

-- Refund restores once.
do $$
declare
  v_ledger_id uuid;
  v_used integer;
  v_status text;
begin
  select id into v_ledger_id
  from public.resume_usage_ledger
  where user_id = '10000000-0000-4000-8000-000000000001'
    and idempotency_key = 'free-idempotency-1';

  perform public.settle_resume_quota(v_ledger_id, 'refunded');
  perform public.settle_resume_quota(v_ledger_id, 'refunded');

  select free_daily_used into v_used
  from public.resume_quota_accounts
  where user_id = '10000000-0000-4000-8000-000000000001';
  select status into v_status
  from public.resume_usage_ledger
  where id = v_ledger_id;

  if v_used <> 0 or v_status <> 'refunded' then
    raise exception 'refund was not exactly-once: used %, status %', v_used, v_status;
  end if;
end;
$$;

-- Basic rejects the eleventh reservation after consuming exactly ten.
do $$
declare
  v_index integer;
  v_reservation record;
  v_remaining integer;
  v_consumed integer;
begin
  insert into public.resume_quota_accounts (
    user_id,
    plan,
    quota_total,
    quota_remaining,
    is_unlimited
  ) values (
    '10000000-0000-4000-8000-000000000002',
    'basic',
    10,
    10,
    false
  );

  for v_index in 1..10 loop
    select * into v_reservation
    from public.reserve_resume_quota(
      '10000000-0000-4000-8000-000000000002',
      'optimize',
      'basic-idempotency-' || v_index,
      gen_random_uuid()
    );
    perform public.settle_resume_quota(v_reservation.ledger_id, 'consumed');
  end loop;

  begin
    perform public.reserve_resume_quota(
      '10000000-0000-4000-8000-000000000002',
      'optimize',
      'basic-idempotency-11',
      gen_random_uuid()
    );
    raise exception 'basic quota accepted an eleventh reservation';
  exception
    when others then
      if sqlerrm <> 'RESUME_QUOTA_EXHAUSTED' then
        raise;
      end if;
  end;

  select quota_remaining into v_remaining
  from public.resume_quota_accounts
  where user_id = '10000000-0000-4000-8000-000000000002';
  select count(*) into v_consumed
  from public.resume_usage_ledger
  where user_id = '10000000-0000-4000-8000-000000000002'
    and status = 'consumed';

  if v_remaining <> 0 or v_consumed <> 10 then
    raise exception 'basic quota mismatch: remaining %, consumed %', v_remaining, v_consumed;
  end if;
end;
$$;

-- VIP remains unlimited while successful usage is recorded.
do $$
declare
  v_reservation record;
  v_account record;
  v_ledger record;
begin
  insert into public.resume_quota_accounts (
    user_id,
    plan,
    quota_total,
    quota_remaining,
    is_unlimited
  ) values (
    '10000000-0000-4000-8000-000000000003',
    'vip',
    0,
    0,
    true
  );

  select * into v_reservation
  from public.reserve_resume_quota(
    '10000000-0000-4000-8000-000000000003',
    'analyze-jd',
    'vip-idempotency-1',
    '20000000-0000-4000-8000-000000000003'
  );
  perform public.settle_resume_quota(v_reservation.ledger_id, 'consumed');

  select * into v_account
  from public.resume_quota_accounts
  where user_id = '10000000-0000-4000-8000-000000000003';
  select * into v_ledger
  from public.resume_usage_ledger
  where id = v_reservation.ledger_id;

  if not v_account.is_unlimited
    or v_account.quota_remaining <> 0
    or v_ledger.quota_delta <> 0
    or v_ledger.status <> 'consumed' then
    raise exception 'vip entitlement or ledger changed unexpectedly';
  end if;
end;
$$;

-- Duplicate payment identifiers grant once.
do $$
declare
  v_order record;
  v_upgrade record;
  v_memberships integer;
  v_events integer;
  v_remaining integer;
begin
  select * into v_order
  from public.create_resume_order(
    '10000000-0000-4000-8000-000000000004',
    'basic',
    'resume-order-payment-1'
  );

  perform public.fulfill_resume_order(
    v_order.order_number,
    'resume-event-payment-1',
    'resume-transaction-payment-1',
    990,
    '{"provider":"test"}'::jsonb
  );
  perform public.fulfill_resume_order(
    v_order.order_number,
    'resume-event-payment-1',
    'resume-transaction-payment-1',
    990,
    '{"provider":"test"}'::jsonb
  );
  perform public.fulfill_resume_order(
    v_order.order_number,
    'resume-event-payment-duplicate-id',
    'resume-transaction-payment-1',
    990,
    '{"provider":"test"}'::jsonb
  );

  select count(*) into v_memberships
  from public.resume_memberships
  where user_id = '10000000-0000-4000-8000-000000000004'
    and status = 'active';
  select count(*) into v_events
  from public.resume_payment_events
  where order_id = v_order.id;
  select quota_remaining into v_remaining
  from public.resume_quota_accounts
  where user_id = '10000000-0000-4000-8000-000000000004';

  if v_memberships <> 1 or v_events <> 1 or v_remaining <> 10 then
    raise exception 'duplicate payment granted more than once';
  end if;

  select * into v_upgrade
  from public.create_resume_order(
    '10000000-0000-4000-8000-000000000004',
    'vip',
    'resume-order-payment-2'
  );
  begin
    perform public.fulfill_resume_order(
      v_upgrade.order_number,
      'resume-event-payment-1',
      'resume-transaction-payment-1',
      9900,
      '{"provider":"test"}'::jsonb
    );
    raise exception 'payment identifiers fulfilled a second order';
  exception
    when others then
      if sqlerrm <> 'RESUME_PAYMENT_IDEMPOTENCY_CONFLICT' then
        raise;
      end if;
  end;

  if exists (
    select 1
    from public.resume_memberships
    where user_id = '10000000-0000-4000-8000-000000000004'
      and status = 'active'
      and plan = 'vip'
  ) then
    raise exception 'conflicting payment identifiers granted vip';
  end if;
end;
$$;

-- Authenticated users cannot read or mutate another user's rows.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}',
  true
);
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000004', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $$
declare
  v_visible_accounts integer;
begin
  select count(*) into v_visible_accounts
  from public.resume_quota_accounts;
  if v_visible_accounts <> 1 then
    raise exception 'RLS exposed % quota accounts instead of one', v_visible_accounts;
  end if;

  if exists (
    select 1
    from public.resume_orders
    where user_id <> '10000000-0000-4000-8000-000000000004'
  ) then
    raise exception 'RLS exposed another user order';
  end if;

  begin
    update public.resume_quota_accounts
    set quota_remaining = 999
    where user_id = '10000000-0000-4000-8000-000000000004';
    raise exception 'authenticated role directly mutated quota';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

reset role;
rollback;
