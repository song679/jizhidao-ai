create table if not exists public.chat_request_ledger (
  request_id uuid primary key,
  user_id uuid not null,
  email text,
  model_name text not null,
  point_cost integer not null check (point_cost > 0),
  status text not null check (status in ('reserved', 'completed', 'refunded')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists chat_request_ledger_user_created_idx
  on public.chat_request_ledger (user_id, created_at desc);

alter table public.chat_request_ledger enable row level security;

create or replace function public.recover_stale_chat_reservations(
  p_user_id uuid,
  p_stale_seconds integer default 600
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_refund_points integer;
  v_points integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select coalesce(sum(point_cost), 0)
    into v_refund_points
  from public.chat_request_ledger
  where user_id = p_user_id
    and status = 'reserved'
    and created_at < now() - make_interval(secs => p_stale_seconds);

  if v_refund_points <= 0 then
    return jsonb_build_object(
      'status', 'nothing_to_refund',
      'refundedPoints', 0
    );
  end if;

  update public.user_points
  set
    points = points + v_refund_points,
    updated_at = now()
  where id = p_user_id
  returning points into v_points;

  update public.chat_request_ledger
  set
    status = 'refunded',
    completed_at = now()
  where user_id = p_user_id
    and status = 'reserved'
    and created_at < now() - make_interval(secs => p_stale_seconds);

  return jsonb_build_object(
    'status', 'refunded',
    'refundedPoints', v_refund_points,
    'points', v_points
  );
end;
$$;

create or replace function public.reserve_chat_points(
  p_request_id uuid,
  p_user_id uuid,
  p_email text,
  p_point_cost integer,
  p_model_name text,
  p_rate_limit integer default 10,
  p_window_seconds integer default 60
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_points integer;
  v_recent_count integer;
  v_existing_status text;
begin
  if p_point_cost <= 0 then
    raise exception 'invalid_point_cost';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  perform public.recover_stale_chat_reservations(p_user_id, 600);

  select status
    into v_existing_status
  from public.chat_request_ledger
  where request_id = p_request_id;

  if v_existing_status is not null then
    return jsonb_build_object(
      'status', 'duplicate',
      'requestStatus', v_existing_status
    );
  end if;

  select count(*)
    into v_recent_count
  from public.chat_request_ledger
  where user_id = p_user_id
    and created_at >= now() - make_interval(secs => p_window_seconds);

  if v_recent_count >= p_rate_limit then
    return jsonb_build_object(
      'status', 'rate_limited',
      'retryAfter', p_window_seconds
    );
  end if;

  insert into public.user_points (id, email, points)
  values (p_user_id, p_email, 1000)
  on conflict (id) do nothing;

  select points
    into v_points
  from public.user_points
  where id = p_user_id
  for update;

  if v_points < p_point_cost then
    return jsonb_build_object(
      'status', 'insufficient_points',
      'points', v_points,
      'requiredPoints', p_point_cost
    );
  end if;

  update public.user_points
  set
    points = points - p_point_cost,
    updated_at = now()
  where id = p_user_id
  returning points into v_points;

  insert into public.chat_request_ledger (
    request_id,
    user_id,
    email,
    model_name,
    point_cost,
    status
  )
  values (
    p_request_id,
    p_user_id,
    p_email,
    p_model_name,
    p_point_cost,
    'reserved'
  );

  return jsonb_build_object(
    'status', 'reserved',
    'points', v_points
  );
end;
$$;

create or replace function public.complete_chat_request(
  p_request_id uuid,
  p_description text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.chat_request_ledger%rowtype;
  v_points integer;
begin
  select *
    into v_request
  from public.chat_request_ledger
  where request_id = p_request_id
  for update;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if v_request.status <> 'reserved' then
    return jsonb_build_object(
      'status', v_request.status
    );
  end if;

  select points
    into v_points
  from public.user_points
  where id = v_request.user_id;

  insert into public.point_transactions (
    user_id,
    email,
    change_amount,
    balance_after,
    type,
    description
  )
  values (
    v_request.user_id,
    v_request.email,
    -v_request.point_cost,
    v_points,
    'chat',
    p_description
  );

  update public.chat_request_ledger
  set
    status = 'completed',
    completed_at = now()
  where request_id = p_request_id;

  return jsonb_build_object(
    'status', 'completed',
    'points', v_points
  );
end;
$$;

create or replace function public.refund_chat_request(
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.chat_request_ledger%rowtype;
  v_points integer;
begin
  select *
    into v_request
  from public.chat_request_ledger
  where request_id = p_request_id
  for update;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if v_request.status <> 'reserved' then
    return jsonb_build_object(
      'status', v_request.status
    );
  end if;

  update public.user_points
  set
    points = points + v_request.point_cost,
    updated_at = now()
  where id = v_request.user_id
  returning points into v_points;

  update public.chat_request_ledger
  set
    status = 'refunded',
    completed_at = now()
  where request_id = p_request_id;

  return jsonb_build_object(
    'status', 'refunded',
    'points', v_points
  );
end;
$$;

revoke all on function public.reserve_chat_points(
  uuid, uuid, text, integer, text, integer, integer
) from public, anon, authenticated;
revoke all on function public.recover_stale_chat_reservations(uuid, integer)
  from public, anon, authenticated;
revoke all on function public.complete_chat_request(uuid, text)
  from public, anon, authenticated;
revoke all on function public.refund_chat_request(uuid)
  from public, anon, authenticated;

grant execute on function public.reserve_chat_points(
  uuid, uuid, text, integer, text, integer, integer
) to service_role;
grant execute on function public.recover_stale_chat_reservations(uuid, integer)
  to service_role;
grant execute on function public.complete_chat_request(uuid, text)
  to service_role;
grant execute on function public.refund_chat_request(uuid)
  to service_role;
