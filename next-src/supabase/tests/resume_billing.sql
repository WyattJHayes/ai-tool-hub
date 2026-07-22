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

-- NULL enum and identifier inputs are rejected.
do $$
begin
  begin
    perform public.reserve_resume_quota(
      '10000000-0000-4000-8000-000000000001',
      null,
      'invalid-null-action',
      gen_random_uuid()
    );
    raise exception 'reserve accepted a null action';
  exception
    when others then
      if sqlerrm <> 'RESUME_INVALID_RESERVATION' then
        raise;
      end if;
  end;

  begin
    perform public.settle_resume_quota(gen_random_uuid(), null);
    raise exception 'settle accepted a null outcome';
  exception
    when others then
      if sqlerrm <> 'RESUME_INVALID_SETTLEMENT' then
        raise;
      end if;
  end;

  begin
    perform public.create_resume_order(
      '10000000-0000-4000-8000-000000000001',
      null,
      'invalid-null-plan'
    );
    raise exception 'order creation accepted a null plan';
  exception
    when others then
      if sqlerrm <> 'RESUME_INVALID_ORDER' then
        raise;
      end if;
  end;

  begin
    perform public.expire_resume_order(
      'invalid-null-reason',
      '10000000-0000-4000-8000-000000000001',
      null
    );
    raise exception 'order expiry accepted a null reason';
  exception
    when others then
      if sqlerrm <> 'RESUME_INVALID_FAILURE_REASON' then
        raise;
      end if;
  end;

  begin
    perform public.fulfill_resume_order(
      'invalid-null-event',
      null,
      'invalid-null-event-transaction',
      990,
      '{}'::jsonb
    );
    raise exception 'fulfillment accepted a null event identifier';
  exception
    when others then
      if sqlerrm <> 'RESUME_INVALID_PAYMENT_EVENT' then
        raise;
      end if;
  end;

  begin
    perform public.reserve_resume_quota(null, 'parse', 'invalid-null-user', gen_random_uuid());
    raise exception 'reserve accepted a null user';
  exception
    when others then
      if sqlerrm <> 'RESUME_INVALID_RESERVATION' then
        raise;
      end if;
  end;

  begin
    perform public.reserve_resume_quota(
      '10000000-0000-4000-8000-000000000001',
      'parse',
      '   ',
      gen_random_uuid()
    );
    raise exception 'reserve accepted a blank idempotency key';
  exception
    when others then
      if sqlerrm <> 'RESUME_INVALID_RESERVATION' then
        raise;
      end if;
  end;

  begin
    perform public.reserve_resume_quota(
      '10000000-0000-4000-8000-000000000001',
      'parse',
      'invalid-null-request',
      null
    );
    raise exception 'reserve accepted a null request identifier';
  exception
    when others then
      if sqlerrm <> 'RESUME_INVALID_RESERVATION' then
        raise;
      end if;
  end;

  begin
    perform public.settle_resume_quota(null, 'consumed');
    raise exception 'settle accepted a null ledger identifier';
  exception
    when others then
      if sqlerrm <> 'RESUME_INVALID_SETTLEMENT' then
        raise;
      end if;
  end;

  begin
    perform public.create_resume_order(null, 'basic', 'invalid-null-order-user');
    raise exception 'order creation accepted a null user';
  exception
    when others then
      if sqlerrm <> 'RESUME_INVALID_ORDER' then
        raise;
      end if;
  end;

  begin
    perform public.create_resume_order(
      '10000000-0000-4000-8000-000000000001',
      'basic',
      '   '
    );
    raise exception 'order creation accepted a blank order identifier';
  exception
    when others then
      if sqlerrm <> 'RESUME_INVALID_ORDER' then
        raise;
      end if;
  end;

  begin
    perform public.expire_resume_order(
      '   ',
      '10000000-0000-4000-8000-000000000001',
      'order_timeout'
    );
    raise exception 'order expiry accepted a blank order identifier';
  exception
    when others then
      if sqlerrm <> 'RESUME_INVALID_ORDER' then
        raise;
      end if;
  end;

  begin
    perform public.expire_resume_order('invalid-null-owner', null, 'order_timeout');
    raise exception 'order expiry accepted a null owner';
  exception
    when others then
      if sqlerrm <> 'RESUME_INVALID_ORDER' then
        raise;
      end if;
  end;

  begin
    perform public.fulfill_resume_order(
      '   ',
      'invalid-blank-order-event',
      'invalid-blank-order-transaction',
      990,
      '{}'::jsonb
    );
    raise exception 'fulfillment accepted a blank order identifier';
  exception
    when others then
      if sqlerrm <> 'RESUME_INVALID_PAYMENT_EVENT' then
        raise;
      end if;
  end;

  begin
    perform public.fulfill_resume_order(
      'invalid-blank-transaction',
      'invalid-blank-transaction-event',
      '   ',
      990,
      '{}'::jsonb
    );
    raise exception 'fulfillment accepted a blank transaction identifier';
  exception
    when others then
      if sqlerrm <> 'RESUME_INVALID_PAYMENT_EVENT' then
        raise;
      end if;
  end;

  begin
    perform public.fulfill_resume_order(
      'invalid-null-amount',
      'invalid-null-amount-event',
      'invalid-null-amount-transaction',
      null,
      '{}'::jsonb
    );
    raise exception 'fulfillment accepted a null amount';
  exception
    when others then
      if sqlerrm <> 'RESUME_INVALID_PAYMENT_EVENT' then
        raise;
      end if;
  end;

  begin
    perform public.fulfill_resume_order(
      'invalid-null-payload',
      'invalid-null-payload-event',
      'invalid-null-payload-transaction',
      990,
      null
    );
    raise exception 'fulfillment accepted a null payload';
  exception
    when others then
      if sqlerrm <> 'RESUME_INVALID_PAYMENT_EVENT' then
        raise;
      end if;
  end;
end;
$$;

-- Duplicate free reservation decrements only once.
do $$
declare
  v_first record;
  v_duplicate record;
  v_second record;
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
  select * into v_second
  from public.reserve_resume_quota(
    '10000000-0000-4000-8000-000000000001',
    'parse',
    'free-idempotency-2',
    '20000000-0000-4000-8000-000000000002'
  );

  if v_first.ledger_id <> v_duplicate.ledger_id then
    raise exception 'duplicate free reservation created a second ledger row';
  end if;

  select free_daily_used into v_used
  from public.resume_quota_accounts
  where user_id = '10000000-0000-4000-8000-000000000001';
  if v_used <> 2 or v_first.ledger_id = v_second.ledger_id then
    raise exception 'duplicate free reservation decremented % times', v_used;
  end if;
end;
$$;

-- Exactly-once refund leaves one independent reservation.
do $$
declare
  v_ledger_id uuid;
  v_used integer;
  v_status text;
  v_second_status text;
  v_version_after_first integer;
  v_version_after_duplicate integer;
begin
  select id into v_ledger_id
  from public.resume_usage_ledger
  where user_id = '10000000-0000-4000-8000-000000000001'
    and idempotency_key = 'free-idempotency-1';

  perform public.settle_resume_quota(v_ledger_id, 'refunded');
  select version into v_version_after_first
  from public.resume_quota_accounts
  where user_id = '10000000-0000-4000-8000-000000000001';
  perform public.settle_resume_quota(v_ledger_id, 'refunded');

  select free_daily_used, version into v_used, v_version_after_duplicate
  from public.resume_quota_accounts
  where user_id = '10000000-0000-4000-8000-000000000001';
  select status into v_status
  from public.resume_usage_ledger
  where id = v_ledger_id;
  select status into v_second_status
  from public.resume_usage_ledger
  where user_id = '10000000-0000-4000-8000-000000000001'
    and idempotency_key = 'free-idempotency-2';

  if v_used <> 1
    or v_status <> 'refunded'
    or v_second_status <> 'reserved'
    or v_version_after_first <> v_version_after_duplicate then
    raise exception 'refund was not exactly-once: used %, status %, second %, versions %/%',
      v_used,
      v_status,
      v_second_status,
      v_version_after_first,
      v_version_after_duplicate;
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

  -- Same event with a new transaction is rejected.
  begin
    perform public.fulfill_resume_order(
      v_order.order_number,
      'resume-event-payment-1',
      'resume-transaction-payment-new',
      990,
      '{"provider":"test"}'::jsonb
    );
    raise exception 'same event accepted a new transaction';
  exception
    when others then
      if sqlerrm <> 'RESUME_PAYMENT_IDEMPOTENCY_CONFLICT' then
        raise;
      end if;
  end;

  -- New event with the same transaction is idempotent.
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
      'resume-transaction-payment-2',
      9900,
      '{"provider":"test"}'::jsonb
    );
    raise exception 'duplicate event fulfilled a second order';
  exception
    when others then
      if sqlerrm <> 'RESUME_PAYMENT_IDEMPOTENCY_CONFLICT' then
        raise;
      end if;
  end;

  begin
    perform public.fulfill_resume_order(
      v_upgrade.order_number,
      'resume-event-payment-2',
      'resume-transaction-payment-1',
      9900,
      '{"provider":"test"}'::jsonb
    );
    raise exception 'duplicate transaction fulfilled a second order';
  exception
    when others then
      if sqlerrm <> 'RESUME_PAYMENT_IDEMPOTENCY_CONFLICT' then
        raise;
      end if;
  end;

  select count(*) into v_memberships
  from public.resume_memberships
  where user_id = '10000000-0000-4000-8000-000000000004'
    and status = 'active';
  select count(*) into v_events
  from public.resume_payment_events
  where user_id = '10000000-0000-4000-8000-000000000004';
  select quota_remaining into v_remaining
  from public.resume_quota_accounts
  where user_id = '10000000-0000-4000-8000-000000000004';

  if v_memberships <> 1 or v_events <> 1 or v_remaining <> 10 or exists (
    select 1
    from public.resume_memberships
    where user_id = '10000000-0000-4000-8000-000000000004'
      and status = 'active'
      and plan = 'vip'
  ) then
    raise exception 'conflicting payment identifiers granted a second entitlement';
  end if;
end;
$$;

-- Authenticated users cannot read or mutate another user's rows.
-- Unused authenticated user sees zero rows in all five tables.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000005","role":"authenticated"}',
  true
);
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000005', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $$
declare
  v_visible integer;
begin
  select count(*) into v_visible
  from public.resume_quota_accounts;
  if v_visible <> 0 then
    raise exception 'RLS exposed % quota accounts', v_visible;
  end if;

  select count(*) into v_visible
  from public.resume_usage_ledger;
  if v_visible <> 0 then
    raise exception 'RLS exposed % ledger rows', v_visible;
  end if;

  select count(*) into v_visible
  from public.resume_memberships;
  if v_visible <> 0 then
    raise exception 'RLS exposed % memberships', v_visible;
  end if;

  select count(*) into v_visible
  from public.resume_orders;
  if v_visible <> 0 then
    raise exception 'RLS exposed % orders', v_visible;
  end if;

  select count(*) into v_visible
  from public.resume_payment_events;
  if v_visible <> 0 then
    raise exception 'RLS exposed % payment events', v_visible;
  end if;

  -- Direct mutations are denied across every billing table.
  begin
    update public.resume_quota_accounts
    set quota_remaining = 999
    where user_id = '10000000-0000-4000-8000-000000000001';
    raise exception 'authenticated role directly mutated quota';
  exception
    when insufficient_privilege then null;
  end;

  begin
    update public.resume_usage_ledger
    set status = 'refunded';
    raise exception 'authenticated role directly mutated ledger';
  exception
    when insufficient_privilege then null;
  end;

  begin
    update public.resume_memberships
    set status = 'inactive';
    raise exception 'authenticated role directly mutated membership';
  exception
    when insufficient_privilege then null;
  end;

  begin
    update public.resume_orders
    set status = 'refunded';
    raise exception 'authenticated role directly updated an order';
  exception
    when insufficient_privilege then null;
  end;

  begin
    insert into public.resume_orders (
      order_number,
      user_id,
      plan,
      amount_fen,
      expires_at
    ) values (
      'authenticated-direct-order',
      '10000000-0000-4000-8000-000000000005',
      'basic',
      990,
      now() + interval '30 minutes'
    );
    raise exception 'authenticated role directly inserted an order';
  exception
    when insufficient_privilege then null;
  end;

  begin
    update public.resume_payment_events
    set processing_status = 'rejected';
    raise exception 'authenticated role directly updated a payment event';
  exception
    when insufficient_privilege then null;
  end;

  begin
    insert into public.resume_payment_events (
      user_id,
      order_id,
      channel_event_id,
      channel_transaction_id,
      amount_fen,
      signature_verified
    ) values (
      '10000000-0000-4000-8000-000000000005',
      gen_random_uuid(),
      'authenticated-direct-event',
      'authenticated-direct-transaction',
      990,
      true
    );
    raise exception 'authenticated role directly inserted a payment event';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

reset role;
rollback;
