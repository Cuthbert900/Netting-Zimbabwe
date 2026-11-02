-- Balance reconciliations: one row per finalised month-end front page for a
-- GL account and currency (today only the Netting account, 60703003). Saving a month is
-- what lets the next month's "Balance as at 01 <month>" carry over from this
-- month's closing balance instead of being retyped.
--
-- Same lock-down as 0001_admin_schema.sql: RLS on, no policies. Every read
-- and write goes through the Next.js server with the service_role key
-- (src/lib/balance-reconciliation-actions.ts), which first checks the caller
-- is signed in and logs each save to audit_log.

create table if not exists public.balance_reconciliations (
  id                 bigint generated always as identity primary key,
  account_number     text not null,
  period             date not null,   -- first day of the reporting month
  currency           text not null,  -- each currency is reconciled separately
  opening_balance    numeric(20, 2) not null,
  reconciling_items  jsonb not null,  -- [{ id, label, value }] as shown on the page
  subtotal           numeric(20, 2) not null,
  gl_balance         numeric(20, 2) not null,
  difference         numeric(20, 2) not null,
  comments           text,
  finalised_at       timestamptz not null default now(),
  finalised_by_id    uuid,
  finalised_by_email text,
  unique (account_number, period, currency)
);

comment on table public.balance_reconciliations is
  'Finalised month-end balance reconciliation front pages. The gl_balance of one month is the opening_balance carried into the next.';

alter table public.balance_reconciliations enable row level security;
-- No policies: deny-all for anon/authenticated.
