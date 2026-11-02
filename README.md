<div align="center">

```
┌────────────────────────────────────────────────────────────────────┐
│     _  _ ___ _____ _____ ___ _  _  ___   ___ ___ ___ ___  _  _     │
│    | \| | __|_   _|_   _|_ _| \| |/ __| | _ \ __/ __/ _ \| \| |    │
│    | .` | _|  | |   | |  | || .` | (_ | |   / _| (_| (_) | .` |    │
│    |_|\_|___| |_|   |_| |___|_|\_|\___| |_|_\___\___\___/|_|\_|    │
│                                                                    │
│           Liquid Intelligent Technologies  x  Cassava AI           │
└────────────────────────────────────────────────────────────────────┘
```

### Netting Reconciliation Automation

AI-powered reconciliation, exception detection, and executive reporting for the
Netting control account — built for **Liquid Intelligent Technologies** by
**Cassava AI**.

[![Status](https://img.shields.io/badge/status-active%20development-2ea44f)](#status)
[![Next.js](https://img.shields.io/badge/Next.js-16.2.3-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-v4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Supabase](https://img.shields.io/badge/Supabase-self--hosted-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![Docker](https://img.shields.io/badge/Docker-local%20stack-2496ED?logo=docker&logoColor=white)](docker/README.md)
[![Terraform](https://img.shields.io/badge/Terraform-Azure-7B42BC?logo=terraform&logoColor=white)](terraform/README.md)
[![License](https://img.shields.io/badge/license-private-lightgrey)](#)

</div>

---

## About

Treasury & Billing at Liquid Zimbabwe reconciles the Netting control account
across Dynamics 365, Prism BSS, and multiple banking partners every month —
today, largely by hand. This app automates that matching, surfaces exceptions
(timing differences, mis-posts, suspected fraud) for review, and gives an AI
assistant direct context on the data so the team can ask it questions instead
of digging through spreadsheets.

While programmatic access to D365 and Prism is being provisioned, the app
runs in **demo mode**: upload real CSV/XLSX extracts from Dynamics, Prism,
and the banks, and the app parses, matches, and reconciles them locally.

## Status

This is an active build. Current state:

| Area                                                                   | Status                                                                                                                                        |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Branding & shell (Liquid Intelligent Technologies theme)               | ![Done](https://img.shields.io/badge/-done-2ea44f)                                                                                            |
| Data Sources — CSV/XLSX upload for Dynamics/Prism/Bank extracts        | ![Done](https://img.shields.io/badge/-done-2ea44f)                                                                                            |
| Reconciliation matching + exception engine                             | ![Done](https://img.shields.io/badge/-done-2ea44f)                                                                                            |
| Pluggable multi-provider AI chat (AI Factory, Mistral, Claude, Gemini) | ![Done](https://img.shields.io/badge/-done-2ea44f) — needs API keys to leave demo mode                                                        |
| Dashboard analytics & reporting                                        | ![Done](https://img.shields.io/badge/-done-2ea44f)                                                                                            |
| Notifications — derived live from real app state                       | ![Done](https://img.shields.io/badge/-done-2ea44f)                                                                                            |
| Settings — real profile, data controls, alert thresholds               | ![Done](https://img.shields.io/badge/-done-2ea44f)                                                                                            |
| Help & Support — real FAQ, contacts, build status                      | ![Done](https://img.shields.io/badge/-done-2ea44f)                                                                                            |
| AI Summary on Analytics, AI Usage/token tracking                       | ![Done](https://img.shields.io/badge/-done-2ea44f)                                                                                            |
| Reports — summary, exceptions, duplicates, AI narrative (PDF/Excel)    | ![Done](https://img.shields.io/badge/-done-2ea44f)                                                                                            |
| Admin — Environment (keys), Users, Audit, self-hosted Supabase auth    | ![Done locally](https://img.shields.io/badge/-done%20locally-2ea44f) via Docker — needs `terraform apply` for the Azure production deployment |
| Platform-wide sign-in (every route, not just `/admin`)                 | ![Done](https://img.shields.io/badge/-done-2ea44f) — same self-hosted Supabase Auth as `/admin`, gated in `src/proxy.ts`                      |
| Azure AD / Entra ID SSO                                                | ![Not started](https://img.shields.io/badge/-not%20started-lightgrey) — would replace/augment the Supabase email+password login above         |
| Live D365 / Prism integration                                          | ![Blocked](https://img.shields.io/badge/-blocked-e05d44) on access provisioning                                                               |

## Tech Stack

|                                                                                                       | Technology                                                                                                                                            |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| ![Next.js](https://img.shields.io/badge/-Next.js-000000?logo=nextdotjs&logoColor=white)               | [Next.js 16](https://nextjs.org) (App Router)                                                                                                         |
| ![shadcn/ui](https://img.shields.io/badge/-shadcn%2Fui-000000?logo=shadcnui&logoColor=white)          | [shadcn/ui](https://ui.shadcn.com)                                                                                                                    |
| ![Tailwind CSS](https://img.shields.io/badge/-Tailwind%20CSS-06B6D4?logo=tailwindcss&logoColor=white) | [Tailwind CSS v4](https://tailwindcss.com)                                                                                                            |
| ![Recharts](https://img.shields.io/badge/-Recharts-22B5BF?logo=recharts&logoColor=white)              | [Recharts](https://recharts.org)                                                                                                                      |
| ![Motion](https://img.shields.io/badge/-Motion-0055FF?logo=framer&logoColor=white)                    | [Motion](https://motion.dev)                                                                                                                          |
| ![SheetJS](https://img.shields.io/badge/-SheetJS-217346?logo=microsoftexcel&logoColor=white)          | [SheetJS (xlsx)](https://sheetjs.com) — client-side CSV/XLSX parsing with header-row auto-detection                                                   |
| ![PDF](https://img.shields.io/badge/-jsPDF-DC3545?logo=adobeacrobatreader&logoColor=white)            | [jsPDF](https://github.com/parallax/jsPDF) + jspdf-autotable, SheetJS                                                                                 |
| ![Supabase](https://img.shields.io/badge/-Supabase-3FCF8E?logo=supabase&logoColor=white)              | Self-hosted [Supabase](https://supabase.com) (Postgres, GoTrue auth, PostgREST) on an Azure VM, provisioned via [Terraform](https://www.terraform.io) |
| ![TypeScript](https://img.shields.io/badge/-TypeScript-3178C6?logo=typescript&logoColor=white)        | Language: TypeScript                                                                                                                                  |
| ![Docker](https://img.shields.io/badge/-Docker-2496ED?logo=docker&logoColor=white)                    | Local dev stack — Postgres, GoTrue, PostgREST, Studio, Kong, and the app itself, containerized (`docker/`)                                            |

## Getting Started

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

To enable the AI Assistant against a real provider, copy `.env.example` to
`.env.local` and fill in the API key(s) you have — any provider left blank
falls back to a labelled demo-mode reply instead of erroring.

### Running the Admin backend locally (Docker)

`/admin` needs a real Supabase instance to do anything beyond the "not
configured" fallback. `docker/` has a self-contained local stack —
Postgres, GoTrue auth, PostgREST, Studio, Kong, and the app itself,
containerized — that mirrors the production Terraform module in
`terraform/` without needing Azure. See `docker/README.md` for the full
walkthrough; the short version:

```bash
docker/generate-env.sh
docker compose -f docker/docker-compose.yml --env-file docker/.env up -d --build
# then apply supabase/migrations/0001_admin_schema.sql and run docker/create-admin.sh
```

## Customization

**Theme** — Liquid Intelligent Technologies brand colors, gradient, and
typography live in `src/app/globals.css`.

**Data Sources** — Upload logic and extract parsing live in
`src/lib/extract-parser.ts` and `src/lib/data-sources-context.tsx`.

**Reconciliation engine** — Matching and exception classification live in
`src/lib/reconciliation-engine.ts`, exposed to the app via
`src/lib/reconciliation-context.tsx`. Duplicate handling lives in
`src/lib/duplicate-detection.ts`: a file-level fingerprint check on upload
(`findDuplicateFile` in `data-sources-context.tsx`, prompted via a dialog in
`source-card.tsx`) catches an accidental re-upload of the same extract, and a
record-level pass inside `reconcile()` pulls out transactions that share a
reference + amount + date (or an identical row with no reference) before
matching, so a duplicated row can't inflate matched/exception totals. Nothing
is auto-discarded — both layers surface for human review (an upload-time
dialog, and the "Possible Duplicates" panel on Overview). A reviewer can
mark a flagged group "Not a duplicate" to fold it back into matching;
`src/lib/duplicate-overrides-context.tsx` persists that decision so the
group won't be re-flagged on future reconciliation runs.

**Notifications** — Derived live from actual app state rather than a fake
event log: `src/lib/notifications.ts`'s `deriveNotifications()` looks at the
current reconciliation result and uploaded files each render and surfaces
what's actually true right now (a file just uploaded, high-value exceptions
awaiting review, possible duplicates detected, a low match rate) instead of
inventing history. Read/dismissed state persists separately in
`src/lib/notification-state-context.tsx` (localStorage), and
`src/lib/use-app-notifications.ts` combines both into the hook the sidebar
bell dropdown (`nav-secondary.tsx`) and the full `/notifications` page
(`notifications-page-client.tsx`) share.

**Settings** — `src/components/settings/settings-page-client.tsx` replaces the
template's fake profile/password/2FA/billing screens with what's actually
true for a tool with no backend yet: a Profile tab that persists to this
browser's localStorage (no shared account store), a Data & Privacy tab that
lists exactly what's stored locally (uploaded extracts, duplicate overrides,
notification state, preferences) with a real "clear local app data" action,
an Alert Thresholds tab wired directly to `src/lib/alert-settings-context.tsx`
(which `notifications.ts`'s `deriveNotifications()` reads for its high-value
and low-match-rate cutoffs — changing a threshold here changes what actually
shows up in the bell dropdown), and the already-functional Appearance tab
kept as-is.

**Help & Support** — `src/components/support/support-page-client.tsx` and
`src/lib/support-content.ts` replace the template's fake live-chat bot,
support tickets, and 90-day uptime chart with an FAQ about how this specific
app behaves (uploads, matching, duplicate detection, data storage, the AI
Assistant's scope), real contact cards for the project team, and a build
status tab that mirrors this README's own status table instead of
fabricating service uptime.

**AI Assistant** — Provider adapters live in `src/lib/ai/providers.ts`, the
server route in `src/app/api/chat/route.ts`, and the reconciliation-grounded
context builder in `src/lib/ai/context.ts`. Lives at `/ai-assistant` (not
`/budgets`, a leftover template URL). Every provider call returns real token
usage (`promptTokens`/`completionTokens`/`totalTokens`, parsed from each
provider's own response shape — OpenAI-style `usage` for AI Factory and
Mistral, `input_tokens`/`output_tokens` for Claude, `usageMetadata` for
Gemini); a demo-mode reply reports no usage since nothing was actually
billed. `src/lib/ai-usage-context.tsx` logs every call to localStorage, and
the `/ai-usage` page (`src/components/ai-usage/ai-usage-page-client.tsx`)
shows totals by provider and a recent-calls table from that real log — no
estimates. The Analytics page's **AI Summary** card
(`src/components/analytics/ai-summary-card.tsx`) reuses the same context
builder and provider call to generate an on-demand executive summary of the
current reconciliation period, and logs its usage the same way.

**Reports** — `/reports` (`src/components/reports/reports-page-client.tsx`) generates four report
types straight from the live reconciliation data, each exportable as PDF or
Excel/CSV, entirely client-side: a Reconciliation Summary and Exception
Detail Listing and Duplicate Review Log (`src/lib/reports.ts` builds the
tabular data from `ReconciliationResult`), plus an AI-Written Narrative
Summary generated on demand through the same provider/context plumbing as
the AI Assistant and AI Summary card (logged to `/ai-usage` under a
"reports" source). PDF export uses `jsPDF` + `jspdf-autotable`; Excel/CSV
export reuses the already-installed `xlsx` (SheetJS) package via
`src/lib/report-export.ts`. Nothing is sent to a server — files are built
and downloaded directly in the browser.

**Admin** — `/admin` (Environment, Users, Audit) is the first part of this
app with real, shared backend state and real authentication: a
self-hosted Supabase instance (Postgres + GoTrue auth + PostgREST),
provisioned by Terraform in `terraform/` (see `terraform/README.md` for
the full apply/first-setup sequence — Azure VM, Key Vault-managed
secrets, Caddy for TLS). `supabase/migrations/0001_admin_schema.sql`
creates the three tables (`provider_keys`, `app_users`, `audit_log`),
each RLS-locked to deny-all — every read and write goes through the
Next.js server using the service-role key
(`src/lib/supabase/admin.ts`), never the browser. Session handling uses
`@supabase/ssr` (`src/lib/supabase/server.ts` / `browser.ts`,
`src/proxy.ts` — Next.js 16 renamed `middleware.ts` to `proxy.ts`), and
the real authorization check lives in `src/lib/admin/dal.ts`'s
`verifyAdmin()`, called from every admin page and Server Action, not
just the layout. `src/lib/admin/actions.ts` holds the Server Actions
(set/clear a provider key, create/role-change/remove a user, sign out),
each logging to `audit_log` via `src/lib/admin/audit.ts`. A key set on
`/admin/environment` overrides that provider's env var —
`src/lib/ai/key-resolution.ts` checks Supabase first, wherever
`callProvider()` is invoked. If Supabase isn't configured, `/admin`
shows a plain "not set up yet" message instead of erroring; this exact
fallback is also why `isSupabaseConfigured()` in
`src/lib/supabase/config.ts` exists.

**Platform-wide sign-in** — `src/proxy.ts` gates every route in the
app, not just `/admin/*`: a signed-out visitor is redirected to
`/sign-in` (or `/admin/login` for an admin path), with the originally
requested page preserved via `?next=`. `app_users.role` is `"admin"`
or `"user"` — any account gets into the general app, only `"admin"`
passes `verifyAdmin()` into `/admin` itself. There's no self-service
sign-up (`/sign-up` says so plainly rather than faking one) — an
existing admin creates every account from the Users page. A signed-in
session that sits idle for 15 minutes is signed out automatically
(`src/components/idle-session-timeout.tsx`, and its admin-only sibling
`src/components/admin/admin-idle-timeout.tsx`), separate from the
Supabase JWT's own 1-hour expiry.

**Overview & Analytics** — Reconciliation-driven charts live in
`src/components/reconciliation-overview/` and `src/components/analytics/`,
built on derived stats from `src/lib/reconciliation-stats.ts`. Chart colors
are a dedicated, dataviz-skill-validated palette in `src/lib/chart-colors.ts`
and `src/app/globals.css` (`--data-*` / `--status-*`), kept separate from the
brand UI colors so a data mark never doubles as a UI accent. The Overview
dashboard's richer widgets (bank source cards, reconciliation trend, exception
assignment, flow, health score, recent matches) live alongside the core
Overview components in the same folder. Real bank logo artwork lives in
`public/bank-logos/`, matched to an uploaded statement's file name via
`src/lib/bank-logos.ts` — add a bank by dropping a transparent-background PNG
in that folder and a pattern in the matcher.

## Team

|                        |                  |
| ---------------------- | ---------------- |
| **Christopher Munyau** | Project Lead     |
| **Cuthbert Musengi**   | Engineering Lead |
| **Wesley Nyamosi**     | Lead             |

---

<div align="center">
<sub>Built by Cassava AI for Liquid Intelligent Technologies</sub>
</div>
