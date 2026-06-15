--
-- PostgreSQL database dump
--

\restrict ljGU6vPmVNiJi1Qfiz0EEsn7cR4FYbI0SnbrM9bLbYI3tKBmOFxTQ3GRJbVd53A

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: complete_chat_request(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.complete_chat_request(p_request_id uuid, p_description text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: complete_recharge_order(uuid, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.complete_recharge_order(p_order_id uuid, p_admin_email text, p_payment_channel text DEFAULT 'manual'::text, p_payment_reference text DEFAULT NULL::text, p_note text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: recover_stale_chat_reservations(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.recover_stale_chat_reservations(p_user_id uuid, p_stale_seconds integer DEFAULT 600) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: refund_chat_request(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refund_chat_request(p_request_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: reserve_chat_points(uuid, uuid, text, integer, text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reserve_chat_points(p_request_id uuid, p_user_id uuid, p_email text, p_point_cost integer, p_model_name text, p_rate_limit integer DEFAULT 10, p_window_seconds integer DEFAULT 60) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: rls_auto_enable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    email text,
    role text NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    session_id uuid
);


--
-- Name: chat_request_ledger; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_request_ledger (
    request_id uuid NOT NULL,
    user_id uuid NOT NULL,
    email text,
    model_name text NOT NULL,
    point_cost integer NOT NULL,
    status text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    CONSTRAINT chat_request_ledger_point_cost_check CHECK ((point_cost > 0)),
    CONSTRAINT chat_request_ledger_status_check CHECK ((status = ANY (ARRAY['reserved'::text, 'completed'::text, 'refunded'::text])))
);


--
-- Name: chat_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    email text,
    title text DEFAULT '新聊天'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: point_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.point_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    email text,
    change_amount integer NOT NULL,
    balance_after integer NOT NULL,
    type text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: recharge_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recharge_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_no text NOT NULL,
    user_id uuid NOT NULL,
    email text NOT NULL,
    plan_id text NOT NULL,
    plan_name text NOT NULL,
    amount_cents integer NOT NULL,
    points integer NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    payment_channel text,
    payment_reference text,
    admin_email text,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    paid_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT recharge_orders_amount_cents_check CHECK ((amount_cents > 0)),
    CONSTRAINT recharge_orders_points_check CHECK ((points > 0)),
    CONSTRAINT recharge_orders_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'paid'::text, 'cancelled'::text, 'refunded'::text])))
);


--
-- Name: user_points; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_points (
    id uuid NOT NULL,
    email text,
    points integer DEFAULT 1000 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);


--
-- Name: chat_request_ledger chat_request_ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_request_ledger
    ADD CONSTRAINT chat_request_ledger_pkey PRIMARY KEY (request_id);


--
-- Name: chat_sessions chat_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_sessions
    ADD CONSTRAINT chat_sessions_pkey PRIMARY KEY (id);


--
-- Name: point_transactions point_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_transactions
    ADD CONSTRAINT point_transactions_pkey PRIMARY KEY (id);


--
-- Name: recharge_orders recharge_orders_order_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recharge_orders
    ADD CONSTRAINT recharge_orders_order_no_key UNIQUE (order_no);


--
-- Name: recharge_orders recharge_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recharge_orders
    ADD CONSTRAINT recharge_orders_pkey PRIMARY KEY (id);


--
-- Name: user_points user_points_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_points
    ADD CONSTRAINT user_points_pkey PRIMARY KEY (id);


--
-- Name: chat_request_ledger_user_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chat_request_ledger_user_created_idx ON public.chat_request_ledger USING btree (user_id, created_at DESC);


--
-- Name: recharge_orders_status_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recharge_orders_status_created_idx ON public.recharge_orders USING btree (status, created_at DESC);


--
-- Name: recharge_orders_user_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recharge_orders_user_created_idx ON public.recharge_orders USING btree (user_id, created_at DESC);


--
-- Name: chat_messages chat_messages_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.chat_sessions(id) ON DELETE CASCADE;


--
-- Name: chat_messages chat_messages_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: chat_sessions chat_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_sessions
    ADD CONSTRAINT chat_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: point_transactions point_transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_transactions
    ADD CONSTRAINT point_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_points user_points_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_points
    ADD CONSTRAINT user_points_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: chat_messages Users can view own chat messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own chat messages" ON public.chat_messages FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: chat_sessions Users can view own chat sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own chat sessions" ON public.chat_sessions FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: point_transactions Users can view own point transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own point transactions" ON public.point_transactions FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: user_points Users can view own points; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own points" ON public.user_points FOR SELECT TO authenticated USING ((auth.uid() = id));


--
-- Name: chat_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_request_ledger; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_request_ledger ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: point_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: recharge_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.recharge_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: user_points; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_points ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION complete_chat_request(p_request_id uuid, p_description text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.complete_chat_request(p_request_id uuid, p_description text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.complete_chat_request(p_request_id uuid, p_description text) TO service_role;


--
-- Name: FUNCTION complete_recharge_order(p_order_id uuid, p_admin_email text, p_payment_channel text, p_payment_reference text, p_note text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.complete_recharge_order(p_order_id uuid, p_admin_email text, p_payment_channel text, p_payment_reference text, p_note text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.complete_recharge_order(p_order_id uuid, p_admin_email text, p_payment_channel text, p_payment_reference text, p_note text) TO service_role;


--
-- Name: FUNCTION recover_stale_chat_reservations(p_user_id uuid, p_stale_seconds integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.recover_stale_chat_reservations(p_user_id uuid, p_stale_seconds integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.recover_stale_chat_reservations(p_user_id uuid, p_stale_seconds integer) TO service_role;


--
-- Name: FUNCTION refund_chat_request(p_request_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.refund_chat_request(p_request_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.refund_chat_request(p_request_id uuid) TO service_role;


--
-- Name: FUNCTION reserve_chat_points(p_request_id uuid, p_user_id uuid, p_email text, p_point_cost integer, p_model_name text, p_rate_limit integer, p_window_seconds integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.reserve_chat_points(p_request_id uuid, p_user_id uuid, p_email text, p_point_cost integer, p_model_name text, p_rate_limit integer, p_window_seconds integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.reserve_chat_points(p_request_id uuid, p_user_id uuid, p_email text, p_point_cost integer, p_model_name text, p_rate_limit integer, p_window_seconds integer) TO service_role;


--
-- Name: TABLE chat_messages; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.chat_messages TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.chat_messages TO authenticated;
GRANT ALL ON TABLE public.chat_messages TO service_role;


--
-- Name: TABLE chat_request_ledger; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.chat_request_ledger TO anon;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.chat_request_ledger TO authenticated;
GRANT ALL ON TABLE public.chat_request_ledger TO service_role;


--
-- Name: TABLE chat_sessions; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.chat_sessions TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.chat_sessions TO authenticated;
GRANT ALL ON TABLE public.chat_sessions TO service_role;


--
-- Name: TABLE point_transactions; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.point_transactions TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.point_transactions TO authenticated;
GRANT ALL ON TABLE public.point_transactions TO service_role;


--
-- Name: TABLE recharge_orders; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.recharge_orders TO anon;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.recharge_orders TO authenticated;
GRANT ALL ON TABLE public.recharge_orders TO service_role;


--
-- Name: TABLE user_points; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.user_points TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.user_points TO authenticated;
GRANT ALL ON TABLE public.user_points TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict ljGU6vPmVNiJi1Qfiz0EEsn7cR4FYbI0SnbrM9bLbYI3tKBmOFxTQ3GRJbVd53A

