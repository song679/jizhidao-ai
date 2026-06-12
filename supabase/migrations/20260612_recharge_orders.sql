create table if not exists public.recharge_orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique,
  user_id uuid not null,
  email text not null,
  plan_id text not null,
  plan_name text not null,
  amount_cents integer not null check (amount_cents > 0),
  points integer not null check (points > 0),
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'cancelled', 'refunded')),
  payment_channel text,
  payment_reference text,
  admin_email text,
  note text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists recharge_orders_user_created_idx
  on public.recharge_orders (user_id, created_at desc);

create index if not exists recharge_orders_status_created_idx
  on public.recharge_orders (status, created_at desc);

alter table public.recharge_orders enable row level security;

grant select, insert, update, delete
  on table public.recharge_orders
  to service_role;

create or replace function public.complete_recharge_order(
  p_order_id uuid,
  p_admin_email text,
  p_payment_channel text default 'manual',
  p_payment_reference text default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.recharge_orders%rowtype;
  v_previous_points integer;
  v_points integer;
begin
  select *
    into v_order
  from public.recharge_orders
  where id = p_order_id
  for update;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if v_order.status <> 'pending' then
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
      '订单充值：', v_order.order_no,
      '；套餐：', v_order.plan_name,
      '；管理员：', p_admin_email,
      case when coalesce(trim(p_note), '') <> ''
        then concat('；备注：', trim(p_note))
        else ''
      end
    )
  );

  update public.recharge_orders
  set
    status = 'paid',
    payment_channel = coalesce(nullif(trim(p_payment_channel), ''), 'manual'),
    payment_reference = nullif(trim(p_payment_reference), ''),
    admin_email = p_admin_email,
    note = nullif(trim(p_note), ''),
    paid_at = now(),
    updated_at = now()
  where id = p_order_id;

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

revoke all on function public.complete_recharge_order(
  uuid, text, text, text, text
) from public;

grant execute on function public.complete_recharge_order(
  uuid, text, text, text, text
) to service_role;
