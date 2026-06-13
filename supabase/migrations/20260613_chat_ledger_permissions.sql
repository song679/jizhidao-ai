-- Allow trusted server-side APIs to inspect and maintain the chat billing ledger.
-- The service-role key must remain server-side and must never be exposed to browsers.
grant select, insert, update, delete
  on table public.chat_request_ledger
  to service_role;
