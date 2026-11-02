-- Admin schema: provider API keys, the user/role roster, and the audit
-- log — the three tables behind the app's /admin pages (Environment,
-- Users, Audit). Run once against the self-hosted Supabase instance
-- (Studio's SQL editor, or `psql`) after terraform/ has stood up the
-- stack. See terraform/README.md for the full first-time setup sequence.
--
-- All three tables are locked down with RLS and NO policies, which is a
-- deliberate deny-all: nobody reaches them through the anon or
-- authenticated Postgres roles (the ones PostgREST/the browser can ever
-- hold), only through the service_role key, which the Next.js server
-- uses from its own API routes and never exposes to the browser. There
-- is no "authenticated users can read their own row" policy here on
-- purpose — even a logged-in admin's browser talks to these tables only
-- through the app's server, so the server can log every write to
-- audit_log on the way through.
--
-- What audit_log can and can't tell you: only actions taken through an
-- authenticated admin session (key changes, user/role changes, admin
-- sign-ins) are attributable to a person right now. Ordinary app usage
-- (uploading extracts, reviewing exceptions) is still anonymous per
-- browser — localStorage, no login required — until Entra ID SSO covers
-- every user, not just admins. Don't read this audit log as a complete
-- "who did what in the system"; it's complete for the admin surface it
-- covers.

-- ---- app_users --------------------------------------------------------
-- One row per admin account, keyed to the matching auth.users row GoTrue
-- manages. Created by an existing admin (Studio, or the /admin/users
-- page) — there is no self-service signup (GOTRUE_DISABLE_SIGNUP=true).

create table if not exists public.app_users (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text not null,
  display_name  text,
  role          text not null default 'user' check (role in ('admin', 'user')),
  created_at    timestamptz not null default now(),
  created_by    text,
  last_active_at timestamptz
);

comment on table public.app_users is
  'Admin/user roster for the Netting Reconciliation app. Row existence + role gates access to /admin; a GoTrue login with no matching row here (or role=''user'') cannot reach any admin page.';

alter table public.app_users enable row level security;
-- No policies: deny-all for anon/authenticated. Only the service_role
-- key (used exclusively by the app's server routes) can read or write.

-- ---- provider_keys ------------------------------------------------------
-- One row per AI provider (ai-factory / mistral / claude / gemini). The
-- app checks here first for a configured key before falling back to the
-- provider's env var, so the .env.local workflow documented in the main
-- README keeps working for local dev even once this is live.

create table if not exists public.provider_keys (
  provider_id  text primary key,
  key_value    text not null,
  updated_at   timestamptz not null default now(),
  updated_by   text
);

comment on table public.provider_keys is
  'API keys for each AI provider, managed from /admin/environment. Plaintext at rest is an accepted tradeoff here — access is already restricted to the service_role key, which is itself only reachable from the app''s server; see terraform/README.md for the Postgres-level exposure this depends on.';

alter table public.provider_keys enable row level security;
-- No policies: deny-all for anon/authenticated.

-- ---- audit_log ------------------------------------------------------
-- Append-only. The app writes one row per admin action; nothing ever
-- updates or deletes a row here from application code.

create table if not exists public.audit_log (
  id          bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id    uuid,
  actor_email text,
  actor_name  text,
  action      text not null,
  target      text,
  details     jsonb
);

comment on table public.audit_log is
  'Append-only record of admin actions (key changes, user/role changes, admin sign-ins) — see the file header for what this does and doesn''t cover.';

create index if not exists audit_log_occurred_at_idx on public.audit_log (occurred_at desc);

alter table public.audit_log enable row level security;
-- No policies: deny-all for anon/authenticated.
