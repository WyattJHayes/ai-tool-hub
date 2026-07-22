-- Atomic billing state for the resume optimizer. This migration intentionally
-- stores billing metadata only; resume, job-description, and model data stay out.

create table if not exists resume_quota_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'basic', 'vip')),
  quota_total integer not null default 0 check (quota_total >= 0),
  quota_remaining integer not null default 0 check (quota_remaining >= 0),
  is_unlimited boolean not null default false,
  free_daily_used integer not null default 0 check (free_daily_used >= 0),
  free_daily_limit integer not null default 10 check (free_daily_limit > 0),
  free_usage_date date not null default timezone('Asia/Shanghai', now())::date,
  version integer not null default 0 check (version >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (quota_remaining <= quota_total),
  check ((plan = 'vip' and is_unlimited) or (plan <> 'vip' and not is_unlimited))
);

create table if not exists resume_usage_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (length(btrim(action)) > 0),
  idempotency_key text not null check (length(btrim(idempotency_key)) > 0),
  request_id uuid not null,
  plan text not null check (plan in ('free', 'basic', 'vip')),
  status text not null default 'reserved' check (status in ('reserved', 'consumed', 'refunded')),
  quota_delta integer not null check (quota_delta in (-1, 0)),
  remaining_after integer check (remaining_after is null or remaining_after >= 0),
  total_quota integer check (total_quota is null or total_quota >= 0),
  quota_window_date date,
  reset_at timestamptz,
  source_type text,
  source_id text,
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  unique (user_id, idempotency_key),
  unique (user_id, request_id),
  unique (source_type, source_id),
  check ((source_type is null) = (source_id is null))
);

create table if not exists resume_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique check (length(btrim(order_number)) > 0),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null check (plan in ('basic', 'vip')),
  payment_channel text not null default 'xddpay',
  amount_fen integer not null check (amount_fen > 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'fulfilled', 'expired', 'review', 'refunded')),
  channel_transaction_id text,
  failure_reason text,
  expires_at timestamptz not null,
  paid_at timestamptz,
  fulfilled_at timestamptz,
  source_type text,
  source_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_type, source_id),
  check ((source_type is null) = (source_id is null))
);

create table if not exists resume_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null check (plan in ('free', 'basic', 'vip')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  source_order_id uuid unique references resume_orders(id) on delete restrict,
  quota_total integer not null default 0 check (quota_total >= 0),
  quota_used integer not null default 0 check (quota_used >= 0 and quota_used <= quota_total),
  is_unlimited boolean not null default false,
  activated_at timestamptz not null default now(),
  ended_at timestamptz,
  source_type text,
  source_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_type, source_id),
  check ((source_type is null) = (source_id is null)),
  check ((plan = 'vip' and is_unlimited) or (plan <> 'vip' and not is_unlimited))
);

create table if not exists resume_payment_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid not null references resume_orders(id) on delete restrict,
  channel_event_id text not null check (length(btrim(channel_event_id)) > 0),
  channel_transaction_id text not null check (length(btrim(channel_transaction_id)) > 0),
  amount_fen integer not null check (amount_fen > 0),
  signature_verified boolean not null,
  event_type text not null default 'payment_succeeded',
  processing_status text not null default 'processed' check (processing_status in ('processed', 'duplicate', 'review', 'rejected')),
  sanitized_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(sanitized_payload) = 'object'),
  source_type text,
  source_id text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (source_type, source_id),
  check ((source_type is null) = (source_id is null))
);

create index if not exists resume_usage_ledger_user_created_idx
  on resume_usage_ledger (user_id, created_at desc);
create index if not exists resume_orders_user_created_idx
  on resume_orders (user_id, created_at desc);
create index if not exists resume_memberships_user_created_idx
  on resume_memberships (user_id, created_at desc);
create index if not exists resume_payment_events_user_received_idx
  on resume_payment_events (user_id, received_at desc);
create index if not exists resume_payment_events_order_idx
  on resume_payment_events (order_id);

create unique index if not exists resume_memberships_one_active_per_user_idx
  on resume_memberships (user_id)
  where status = 'active';
create unique index if not exists resume_orders_channel_transaction_id_idx
  on resume_orders (channel_transaction_id)
  where channel_transaction_id is not null;
create unique index if not exists resume_payment_events_channel_event_id_idx
  on resume_payment_events (channel_event_id)
  where channel_event_id is not null;
create unique index if not exists resume_payment_events_channel_transaction_id_idx
  on resume_payment_events (channel_transaction_id)
  where channel_transaction_id is not null;

alter table resume_quota_accounts enable row level security;
alter table resume_usage_ledger enable row level security;
alter table resume_memberships enable row level security;
alter table resume_orders enable row level security;
alter table resume_payment_events enable row level security;

drop policy if exists resume_quota_accounts_read_own on resume_quota_accounts;
create policy resume_quota_accounts_read_own
  on resume_quota_accounts for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists resume_usage_ledger_read_own on resume_usage_ledger;
create policy resume_usage_ledger_read_own
  on resume_usage_ledger for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists resume_memberships_read_own on resume_memberships;
create policy resume_memberships_read_own
  on resume_memberships for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists resume_orders_read_own on resume_orders;
create policy resume_orders_read_own
  on resume_orders for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists resume_payment_events_read_own on resume_payment_events;
create policy resume_payment_events_read_own
  on resume_payment_events for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table
  resume_quota_accounts,
  resume_usage_ledger,
  resume_memberships,
  resume_orders,
  resume_payment_events
from public, anon, authenticated, service_role;

grant select on table
  resume_quota_accounts,
  resume_usage_ledger,
  resume_memberships,
  resume_orders,
  resume_payment_events
to authenticated, service_role;

create or replace function reserve_resume_quota(
  p_user_id uuid,
  p_action text,
  p_idempotency_key text,
  p_request_id uuid
)
returns table (
  ledger_id uuid,
  plan text,
  remaining integer,
  total integer,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account public.resume_quota_accounts%rowtype;
  v_prior public.resume_usage_ledger%rowtype;
  v_today date := pg_catalog.timezone('Asia/Shanghai', pg_catalog.statement_timestamp())::date;
  v_reset_at timestamptz;
  v_remaining integer;
  v_total integer;
  v_delta integer;
  v_is_service boolean;
begin
  v_is_service := session_user in ('postgres', 'supabase_admin')
    or coalesce((select auth.jwt() ->> 'role'), '') = 'service_role';
  if not v_is_service then
    raise exception using errcode = '42501', message = 'RESUME_SERVICE_ROLE_REQUIRED';
  end if;

  if p_user_id is null
    or p_action is null
    or p_idempotency_key is null
    or p_request_id is null
    or nullif(btrim(p_action), '') is null
    or nullif(btrim(p_idempotency_key), '') is null then
    raise exception using errcode = '22023', message = 'RESUME_INVALID_RESERVATION';
  end if;

  insert into public.resume_quota_accounts (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select account.*
  into v_account
  from public.resume_quota_accounts as account
  where account.user_id = p_user_id
  for update;

  select ledger.*
  into v_prior
  from public.resume_usage_ledger as ledger
  where ledger.user_id = p_user_id
    and ledger.idempotency_key = btrim(p_idempotency_key);

  if found then
    return query
    select v_prior.id, v_prior.plan, v_prior.remaining_after,
      v_prior.total_quota, v_prior.reset_at;
    return;
  end if;

  if v_account.plan = 'free' and v_account.free_usage_date <> v_today then
    update public.resume_quota_accounts as account
    set free_daily_used = 0,
        free_usage_date = v_today,
        version = account.version + 1,
        updated_at = pg_catalog.statement_timestamp()
    where account.id = v_account.id
    returning account.* into v_account;
  end if;

  if v_account.plan = 'free' then
    if v_account.free_daily_used >= v_account.free_daily_limit then
      raise exception using errcode = 'P0001', message = 'RESUME_QUOTA_EXHAUSTED';
    end if;
    v_total := v_account.free_daily_limit;
    v_remaining := v_total - v_account.free_daily_used - 1;
    v_reset_at := ((v_today + 1)::timestamp at time zone 'Asia/Shanghai');
    v_delta := -1;

    update public.resume_quota_accounts as account
    set free_daily_used = account.free_daily_used + 1,
        version = account.version + 1,
        updated_at = pg_catalog.statement_timestamp()
    where account.id = v_account.id;
  elsif v_account.plan = 'basic' then
    if v_account.quota_remaining <= 0 then
      raise exception using errcode = 'P0001', message = 'RESUME_QUOTA_EXHAUSTED';
    end if;
    v_total := v_account.quota_total;
    v_remaining := v_account.quota_remaining - 1;
    v_reset_at := null;
    v_delta := -1;

    update public.resume_quota_accounts as account
    set quota_remaining = account.quota_remaining - 1,
        version = account.version + 1,
        updated_at = pg_catalog.statement_timestamp()
    where account.id = v_account.id;
  elsif v_account.plan = 'vip' and v_account.is_unlimited then
    v_total := null;
    v_remaining := null;
    v_reset_at := null;
    v_delta := 0;
  else
    raise exception using errcode = 'P0001', message = 'RESUME_ACCOUNT_INVALID';
  end if;

  insert into public.resume_usage_ledger (
    user_id,
    action,
    idempotency_key,
    request_id,
    plan,
    status,
    quota_delta,
    remaining_after,
    total_quota,
    quota_window_date,
    reset_at
  ) values (
    p_user_id,
    btrim(p_action),
    btrim(p_idempotency_key),
    p_request_id,
    v_account.plan,
    'reserved',
    v_delta,
    v_remaining,
    v_total,
    case when v_account.plan = 'free' then v_today else null end,
    v_reset_at
  )
  returning id into ledger_id;

  plan := v_account.plan;
  remaining := v_remaining;
  total := v_total;
  reset_at := v_reset_at;
  return next;
end;
$$;

create or replace function settle_resume_quota(
  p_ledger_id uuid,
  p_outcome text
)
returns public.resume_usage_ledger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ledger public.resume_usage_ledger%rowtype;
  v_account public.resume_quota_accounts%rowtype;
  v_is_service boolean;
begin
  v_is_service := session_user in ('postgres', 'supabase_admin')
    or coalesce((select auth.jwt() ->> 'role'), '') = 'service_role';
  if not v_is_service then
    raise exception using errcode = '42501', message = 'RESUME_SERVICE_ROLE_REQUIRED';
  end if;

  if p_ledger_id is null
    or p_outcome is null
    or p_outcome not in ('consumed', 'refunded') then
    raise exception using errcode = '22023', message = 'RESUME_INVALID_SETTLEMENT';
  end if;

  select ledger.*
  into v_ledger
  from public.resume_usage_ledger as ledger
  where ledger.id = p_ledger_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'RESUME_LEDGER_NOT_FOUND';
  end if;

  select account.*
  into v_account
  from public.resume_quota_accounts as account
  where account.user_id = v_ledger.user_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'RESUME_ACCOUNT_NOT_FOUND';
  end if;

  if v_ledger.status = p_outcome then
    return v_ledger;
  end if;
  if v_ledger.status <> 'reserved' then
    raise exception using errcode = 'P0001', message = 'RESUME_LEDGER_ALREADY_SETTLED';
  end if;

  if p_outcome = 'refunded' and v_ledger.quota_delta = -1 then
    if v_ledger.plan = 'free'
      and v_account.plan = 'free'
      and v_account.free_usage_date = v_ledger.quota_window_date then
      update public.resume_quota_accounts as account
      set free_daily_used = greatest(0, account.free_daily_used - 1),
          version = account.version + 1,
          updated_at = pg_catalog.statement_timestamp()
      where account.id = v_account.id;
    elsif v_ledger.plan = 'basic' and v_account.plan = 'basic' then
      update public.resume_quota_accounts as account
      set quota_remaining = least(account.quota_total, account.quota_remaining + 1),
          version = account.version + 1,
          updated_at = pg_catalog.statement_timestamp()
      where account.id = v_account.id;
    end if;
  end if;

  update public.resume_usage_ledger as ledger
  set status = p_outcome,
      settled_at = pg_catalog.statement_timestamp()
  where ledger.id = p_ledger_id
  returning ledger.* into v_ledger;

  return v_ledger;
end;
$$;

create or replace function create_resume_order(
  p_user_id uuid,
  p_plan text,
  p_order_number text
)
returns public.resume_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account public.resume_quota_accounts%rowtype;
  v_membership public.resume_memberships%rowtype;
  v_order public.resume_orders%rowtype;
  v_amount_fen integer;
  v_is_service boolean;
begin
  v_is_service := session_user in ('postgres', 'supabase_admin')
    or coalesce((select auth.jwt() ->> 'role'), '') = 'service_role';
  if not v_is_service then
    raise exception using errcode = '42501', message = 'RESUME_SERVICE_ROLE_REQUIRED';
  end if;

  if p_user_id is null
    or p_plan is null
    or p_plan not in ('basic', 'vip')
    or p_order_number is null
    or nullif(btrim(p_order_number), '') is null then
    raise exception using errcode = '22023', message = 'RESUME_INVALID_ORDER';
  end if;

  select orders.*
  into v_order
  from public.resume_orders as orders
  where orders.order_number = btrim(p_order_number)
  for update;

  if found then
    if v_order.user_id <> p_user_id or v_order.plan <> p_plan then
      raise exception using errcode = '23505', message = 'RESUME_ORDER_IDEMPOTENCY_CONFLICT';
    end if;
    return v_order;
  end if;

  insert into public.resume_quota_accounts (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select account.*
  into v_account
  from public.resume_quota_accounts as account
  where account.user_id = p_user_id
  for update;

  select membership.*
  into v_membership
  from public.resume_memberships as membership
  where membership.user_id = p_user_id
    and membership.status = 'active'
  for update;

  if (found and v_membership.plan = 'vip') or v_account.plan = 'vip' then
    raise exception using errcode = 'P0001', message = 'RESUME_VIP_ALREADY_ACTIVE';
  end if;
  if p_plan = 'basic'
    and v_account.plan = 'basic'
    and v_account.quota_remaining > 0 then
    raise exception using errcode = 'P0001', message = 'RESUME_BASIC_QUOTA_REMAINING';
  end if;

  v_amount_fen := case p_plan
    when 'basic' then 990
    when 'vip' then 9900
  end;

  insert into public.resume_orders (
    order_number,
    user_id,
    plan,
    amount_fen,
    expires_at
  ) values (
    btrim(p_order_number),
    p_user_id,
    p_plan,
    v_amount_fen,
    pg_catalog.statement_timestamp() + interval '30 minutes'
  )
  on conflict (order_number) do nothing
  returning * into v_order;

  if not found then
    select orders.*
    into v_order
    from public.resume_orders as orders
    where orders.order_number = btrim(p_order_number)
    for update;
    if v_order.user_id <> p_user_id or v_order.plan <> p_plan then
      raise exception using errcode = '23505', message = 'RESUME_ORDER_IDEMPOTENCY_CONFLICT';
    end if;
  end if;

  return v_order;
end;
$$;

create or replace function expire_resume_order(
  p_order_number text,
  p_user_id uuid,
  p_failure_reason text
)
returns public.resume_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.resume_orders%rowtype;
  v_caller_id uuid := auth.uid();
  v_is_service boolean;
begin
  v_is_service := session_user in ('postgres', 'supabase_admin')
    or coalesce((select auth.jwt() ->> 'role'), '') = 'service_role';

  if p_order_number is null
    or p_user_id is null
    or nullif(btrim(p_order_number), '') is null then
    raise exception using errcode = '22023', message = 'RESUME_INVALID_ORDER';
  end if;
  if p_failure_reason is null
    or p_failure_reason not in ('payment_creation_failed', 'user_cancelled', 'order_timeout') then
    raise exception using errcode = '22023', message = 'RESUME_INVALID_FAILURE_REASON';
  end if;
  if not v_is_service and (v_caller_id is null or v_caller_id <> p_user_id) then
    raise exception using errcode = '42501', message = 'RESUME_ORDER_ACCESS_DENIED';
  end if;

  select orders.*
  into v_order
  from public.resume_orders as orders
  where orders.order_number = btrim(p_order_number)
    and orders.user_id = p_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'RESUME_ORDER_NOT_FOUND';
  end if;
  if v_order.status = 'expired' then
    return v_order;
  end if;
  if v_order.status <> 'pending' then
    raise exception using errcode = 'P0001', message = 'RESUME_ORDER_NOT_PENDING';
  end if;

  update public.resume_orders as orders
  set status = 'expired',
      failure_reason = p_failure_reason,
      expires_at = least(orders.expires_at, pg_catalog.statement_timestamp()),
      updated_at = pg_catalog.statement_timestamp()
  where orders.id = v_order.id
  returning orders.* into v_order;

  return v_order;
end;
$$;

create or replace function fulfill_resume_order(
  p_order_number text,
  p_channel_event_id text,
  p_channel_transaction_id text,
  p_amount_fen integer,
  p_sanitized_payload jsonb
)
returns public.resume_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.resume_orders%rowtype;
  v_event public.resume_payment_events%rowtype;
  v_account public.resume_quota_accounts%rowtype;
  v_membership public.resume_memberships%rowtype;
  v_is_service boolean;
begin
  v_is_service := session_user in ('postgres', 'supabase_admin')
    or coalesce((select auth.jwt() ->> 'role'), '') = 'service_role';
  if not v_is_service then
    raise exception using errcode = '42501', message = 'RESUME_SERVICE_ROLE_REQUIRED';
  end if;

  if p_order_number is null
    or p_channel_event_id is null
    or p_channel_transaction_id is null
    or p_amount_fen is null
    or p_sanitized_payload is null
    or nullif(btrim(p_order_number), '') is null
    or nullif(btrim(p_channel_event_id), '') is null
    or nullif(btrim(p_channel_transaction_id), '') is null
    or p_amount_fen <= 0
    or pg_catalog.jsonb_typeof(p_sanitized_payload) <> 'object' then
    raise exception using errcode = '22023', message = 'RESUME_INVALID_PAYMENT_EVENT';
  end if;

  select orders.*
  into v_order
  from public.resume_orders as orders
  where orders.order_number = btrim(p_order_number)
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'RESUME_ORDER_NOT_FOUND';
  end if;
  if v_order.amount_fen <> p_amount_fen then
    raise exception using errcode = 'P0001', message = 'RESUME_PAYMENT_AMOUNT_MISMATCH';
  end if;

  select events.*
  into v_event
  from public.resume_payment_events as events
  where events.channel_event_id = btrim(p_channel_event_id)
     or events.channel_transaction_id = btrim(p_channel_transaction_id)
  order by case when events.channel_event_id = btrim(p_channel_event_id) then 0 else 1 end
  limit 1
  for update;

  if found then
    if v_event.order_id <> v_order.id
      or v_event.user_id <> v_order.user_id
      or v_event.amount_fen <> p_amount_fen
      or v_event.channel_transaction_id <> btrim(p_channel_transaction_id) then
      raise exception using errcode = '23505', message = 'RESUME_PAYMENT_IDEMPOTENCY_CONFLICT';
    end if;
    if v_order.status in ('fulfilled', 'review') then
      return v_order;
    end if;
    raise exception using errcode = 'P0001', message = 'RESUME_PAYMENT_STATE_INCONSISTENT';
  end if;

  if v_order.status = 'fulfilled' then
    if v_order.channel_transaction_id <> btrim(p_channel_transaction_id) then
      raise exception using errcode = '23505', message = 'RESUME_PAYMENT_IDEMPOTENCY_CONFLICT';
    end if;
    return v_order;
  end if;

  if v_order.status = 'expired'
    or (v_order.status = 'pending' and v_order.expires_at <= pg_catalog.statement_timestamp()) then
    insert into public.resume_payment_events (
      user_id,
      order_id,
      channel_event_id,
      channel_transaction_id,
      amount_fen,
      signature_verified,
      processing_status,
      sanitized_payload,
      processed_at
    ) values (
      v_order.user_id,
      v_order.id,
      btrim(p_channel_event_id),
      btrim(p_channel_transaction_id),
      p_amount_fen,
      true,
      'review',
      p_sanitized_payload,
      pg_catalog.statement_timestamp()
    );

    update public.resume_orders as orders
    set status = 'review',
        channel_transaction_id = btrim(p_channel_transaction_id),
        paid_at = coalesce(orders.paid_at, pg_catalog.statement_timestamp()),
        failure_reason = 'late_payment_requires_review',
        updated_at = pg_catalog.statement_timestamp()
    where orders.id = v_order.id
    returning orders.* into v_order;
    return v_order;
  end if;

  if v_order.status <> 'pending' then
    raise exception using errcode = 'P0001', message = 'RESUME_ORDER_NOT_FULFILLABLE';
  end if;

  insert into public.resume_payment_events (
    user_id,
    order_id,
    channel_event_id,
    channel_transaction_id,
    amount_fen,
    signature_verified,
    processing_status,
    sanitized_payload,
    processed_at
  ) values (
    v_order.user_id,
    v_order.id,
    btrim(p_channel_event_id),
    btrim(p_channel_transaction_id),
    p_amount_fen,
    true,
    'processed',
    p_sanitized_payload,
    pg_catalog.statement_timestamp()
  );

  update public.resume_orders as orders
  set status = 'paid',
      channel_transaction_id = btrim(p_channel_transaction_id),
      paid_at = pg_catalog.statement_timestamp(),
      updated_at = pg_catalog.statement_timestamp()
  where orders.id = v_order.id
  returning orders.* into v_order;

  insert into public.resume_quota_accounts (user_id)
  values (v_order.user_id)
  on conflict (user_id) do nothing;

  select account.*
  into v_account
  from public.resume_quota_accounts as account
  where account.user_id = v_order.user_id
  for update;

  select membership.*
  into v_membership
  from public.resume_memberships as membership
  where membership.user_id = v_order.user_id
    and membership.status = 'active'
  for update;

  if found then
    update public.resume_memberships as membership
    set status = 'inactive',
        quota_used = case
          when membership.plan = 'basic'
            then greatest(0, membership.quota_total - v_account.quota_remaining)
          else membership.quota_used
        end,
        ended_at = pg_catalog.statement_timestamp(),
        updated_at = pg_catalog.statement_timestamp()
    where membership.id = v_membership.id;
  end if;

  insert into public.resume_memberships (
    user_id,
    plan,
    status,
    source_order_id,
    quota_total,
    quota_used,
    is_unlimited,
    source_type,
    source_id
  ) values (
    v_order.user_id,
    v_order.plan,
    'active',
    v_order.id,
    case when v_order.plan = 'basic' then 10 else 0 end,
    0,
    v_order.plan = 'vip',
    'order',
    v_order.id::text
  );

  update public.resume_quota_accounts as account
  set plan = v_order.plan,
      quota_total = case when v_order.plan = 'basic' then 10 else 0 end,
      quota_remaining = case when v_order.plan = 'basic' then 10 else 0 end,
      is_unlimited = v_order.plan = 'vip',
      version = account.version + 1,
      updated_at = pg_catalog.statement_timestamp()
  where account.id = v_account.id;

  update public.resume_orders as orders
  set status = 'fulfilled',
      fulfilled_at = pg_catalog.statement_timestamp(),
      updated_at = pg_catalog.statement_timestamp()
  where orders.id = v_order.id
  returning orders.* into v_order;

  return v_order;
end;
$$;

revoke execute on function reserve_resume_quota(uuid, text, text, uuid) from public, anon, authenticated;
revoke execute on function settle_resume_quota(uuid, text) from public, anon, authenticated;
revoke execute on function create_resume_order(uuid, text, text) from public, anon, authenticated;
revoke execute on function expire_resume_order(text, uuid, text) from public, anon, authenticated;
revoke execute on function fulfill_resume_order(text, text, text, integer, jsonb) from public, anon, authenticated;

grant execute on function reserve_resume_quota(uuid, text, text, uuid) to service_role;
grant execute on function settle_resume_quota(uuid, text) to service_role;
grant execute on function create_resume_order(uuid, text, text) to service_role;
grant execute on function expire_resume_order(text, uuid, text) to authenticated, service_role;
grant execute on function fulfill_resume_order(text, text, text, integer, jsonb) to service_role;
