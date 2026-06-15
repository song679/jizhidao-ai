-- 在线支付安全底座。
-- 本迁移不连接任何具体支付平台，只提供：
-- 1. 支付平台订单/交易标识；
-- 2. 回调事件幂等记录；
-- 3. 金额校验、订单行锁和原子加点函数。

alter table public.recharge_orders
  add column if not exists payment_provider text,
  add column if not exists provider_order_id text,
  add column if not exists provider_transaction_id text,
  add column if not exists payment_created_at timestamptz,
  add column if not exists payment_metadata jsonb not null default '{}'::jsonb;

create unique index if not exists recharge_orders_provider_order_uidx
  on public.recharge_orders (payment_provider, provider_order_id)
  where payment_provider is not null
    and provider_order_id is not null;

create unique index if not exists recharge_orders_provider_transaction_uidx
  on public.recharge_orders (payment_provider, provider_transaction_id)
  where payment_provider is not null
    and provider_transaction_id is not null;

create table if not exists public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (length(trim(provider)) > 0),
  event_id text not null check (length(trim(event_id)) > 0),
  event_type text,
  order_no text,
  signature_valid boolean not null default false,
  processing_status text not null default 'received'
    check (processing_status in ('received', 'processed', 'ignored', 'failed')),
  payload_digest text,
  error_code text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, event_id)
);

create index if not exists payment_webhook_events_order_idx
  on public.payment_webhook_events (order_no, received_at desc);

create index if not exists payment_webhook_events_status_idx
  on public.payment_webhook_events (processing_status, received_at desc);

alter table public.payment_webhook_events enable row level security;

revoke all on table public.payment_webhook_events from public;

grant select, insert, update, delete
  on table public.payment_webhook_events
  to service_role;

create or replace function public.complete_online_recharge_order(
  p_order_no text,
  p_provider text,
  p_provider_order_id text,
  p_provider_transaction_id text,
  p_amount_cents integer,
  p_event_id text,
  p_event_type text default null,
  p_payload_digest text default null,
  p_payment_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_record_id uuid;
  v_order public.recharge_orders%rowtype;
  v_previous_points integer;
  v_points integer;
  v_provider text := nullif(trim(p_provider), '');
  v_event_id text := nullif(trim(p_event_id), '');
  v_provider_order_id text := nullif(trim(p_provider_order_id), '');
  v_provider_transaction_id text :=
    nullif(trim(p_provider_transaction_id), '');
begin
  if v_provider is null or v_event_id is null then
    return jsonb_build_object('status', 'invalid_event');
  end if;

  insert into public.payment_webhook_events (
    provider,
    event_id,
    event_type,
    order_no,
    signature_valid,
    processing_status,
    payload_digest
  )
  values (
    v_provider,
    v_event_id,
    nullif(trim(p_event_type), ''),
    nullif(trim(p_order_no), ''),
    true,
    'received',
    nullif(trim(p_payload_digest), '')
  )
  on conflict (provider, event_id) do nothing
  returning id into v_event_record_id;

  if v_event_record_id is null then
    return jsonb_build_object('status', 'duplicate_event');
  end if;

  select *
    into v_order
  from public.recharge_orders
  where order_no = nullif(trim(p_order_no), '')
  for update;

  if not found then
    update public.payment_webhook_events
    set
      processing_status = 'ignored',
      error_code = 'order_not_found',
      processed_at = now()
    where id = v_event_record_id;

    return jsonb_build_object('status', 'order_not_found');
  end if;

  if p_amount_cents is null or p_amount_cents <> v_order.amount_cents then
    update public.payment_webhook_events
    set
      processing_status = 'ignored',
      error_code = 'amount_mismatch',
      processed_at = now()
    where id = v_event_record_id;

    return jsonb_build_object(
      'status', 'amount_mismatch',
      'expectedAmountCents', v_order.amount_cents
    );
  end if;

  if v_order.status <> 'pending' then
    update public.payment_webhook_events
    set
      processing_status = 'ignored',
      error_code = concat('order_', v_order.status),
      processed_at = now()
    where id = v_event_record_id;

    return jsonb_build_object(
      'status', v_order.status,
      'orderNo', v_order.order_no
    );
  end if;

  insert into public.user_points (id, email, points)
  values (v_order.user_id, v_order.email, 1000)
  on conflict (id) do nothing;

  select points
    into v_previous_points
  from public.user_points
  where id = v_order.user_id
  for update;

  update public.user_points
  set
    points = points + v_order.points,
    updated_at = now()
  where id = v_order.user_id
  returning points into v_points;

  insert into public.point_transactions (
    user_id,
    email,
    change_amount,
    balance_after,
    type,
    description
  )
  values (
    v_order.user_id,
    v_order.email,
    v_order.points,
    v_points,
    'recharge',
    concat(
      '在线支付订单：', v_order.order_no,
      '；套餐：', v_order.plan_name,
      '；支付渠道：', v_provider,
      case when v_provider_transaction_id is not null
        then concat('；支付流水：', v_provider_transaction_id)
        else ''
      end
    )
  );

  update public.recharge_orders
  set
    status = 'paid',
    payment_channel = v_provider,
    payment_provider = v_provider,
    payment_reference = coalesce(
      v_provider_transaction_id,
      v_provider_order_id
    ),
    provider_order_id = v_provider_order_id,
    provider_transaction_id = v_provider_transaction_id,
    payment_created_at = coalesce(payment_created_at, now()),
    payment_metadata = coalesce(p_payment_metadata, '{}'::jsonb),
    paid_at = now(),
    updated_at = now()
  where id = v_order.id;

  update public.payment_webhook_events
  set
    processing_status = 'processed',
    processed_at = now()
  where id = v_event_record_id;

  return jsonb_build_object(
    'status', 'paid',
    'orderNo', v_order.order_no,
    'email', v_order.email,
    'pointsAdded', v_order.points,
    'previousPoints', v_previous_points,
    'points', v_points
  );
end;
$$;

revoke all on function public.complete_online_recharge_order(
  text, text, text, text, integer, text, text, text, jsonb
) from public;

grant execute on function public.complete_online_recharge_order(
  text, text, text, text, integer, text, text, text, jsonb
) to service_role;
