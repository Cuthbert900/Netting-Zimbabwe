# Running this locally in Docker

This spins up the same self-hosted Supabase stack as the Azure Terraform
module (`terraform/`) — Postgres, GoTrue auth, PostgREST, postgres-meta,
Studio, Kong — on plain HTTP on your own machine, plus the Next.js app
itself, containerized. It's meant for local development and for seeing the
`/admin` feature actually work end to end without touching Azure.

It is **not** a copy of the Azure deployment: no Caddy, no TLS, no Key
Vault, no Azure CLI dependency — secrets are generated locally with
`openssl` and never leave your machine. `terraform/` is still what stands
up the real, production Supabase instance; this is for your laptop.

## Prerequisites

Docker and Docker Compose v2 (`docker compose version` should work). On
Linux this all works out of the box. On macOS/Windows (Docker Desktop) see
the [Docker Desktop note](#docker-desktop-macwindows-note) below before you
run `up`.

## Quickstart

From the repo root:

```bash
docker/generate-env.sh
docker compose -f docker/docker-compose.yml --env-file docker/.env up -d --build
```

First boot takes a minute or two (Postgres init + the Next.js build). Watch
it with:

```bash
docker compose -f docker/docker-compose.yml --env-file docker/.env ps
docker compose -f docker/docker-compose.yml --env-file docker/.env logs -f app
```

Once `db` is healthy, apply the admin schema migration:

```bash
docker compose -f docker/docker-compose.yml --env-file docker/.env exec -T db \
  psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/migrations/0001_admin_schema.sql
```

Create your first admin account:

```bash
docker/create-admin.sh you@example.com 'a-strong-password'
```

Then:

| What                | Where                             |
| ------------------- | --------------------------------- |
| The app             | http://localhost:3000             |
| Admin login         | http://localhost:3000/admin/login |
| Supabase Studio     | http://localhost:3001             |
| Supabase API (Kong) | http://localhost:8000             |

Sign in at `/admin/login` with the email/password you just created, and you
should land on `/admin/environment` — a real, working admin session backed
by the containerized Supabase stack, not the "not configured" fallback.

## Tearing down / resetting

```bash
docker compose -f docker/docker-compose.yml --env-file docker/.env down
```

Add `-v` to also drop the Postgres volume (wipes all admin data — you'll
need to re-run the migration and `create-admin.sh` next time). To rotate
secrets, `down -v` first, then delete `docker/.env` and start over from
`generate-env.sh`.

## Why the app container uses `network_mode: host`

`NEXT_PUBLIC_SUPABASE_URL` gets inlined into both the browser bundle _and_
the server code at build time — Next.js doesn't treat those differently for
`NEXT_PUBLIC_*` vars. That means the app's own Node process and your
browser both need to resolve Supabase at the exact same address. Host
networking makes `http://localhost:8000` valid from both places at once.

This also happens to mirror production more faithfully than bridging the
containers on a private Docker network would: the real Azure deployment has
the app and the Supabase VM as two separately-reachable things talking over
a public URL (see `terraform/README.md`), not two containers whispering to
each other by service name. Local dev and prod agree on that shape.

## Docker Desktop (Mac/Windows) note

`network_mode: host` is native on Linux Docker Engine. Docker Desktop
supports it too on recent versions, but it may need enabling under
**Settings → Resources → Network → Enable host networking**. If it's not
available on your setup, containerize just the Supabase half and run the
app the normal way instead:

```bash
docker/generate-env.sh
docker compose -f docker/docker-compose.yml --env-file docker/.env up -d db auth rest meta studio kong
# apply the migration + create-admin.sh as above, then:
source docker/.env
NEXT_PUBLIC_SUPABASE_URL="$SITE_URL" \
NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY" \
SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" \
pnpm dev
```

Same Supabase-in-Docker, same env vars, app running directly on your host —
still fully "Supabase on Docker," just without the app's own container
layer, which was the part that gets Docker-Desktop-networking-dependent.

## Rebuilding the app image after code changes

```bash
docker compose -f docker/docker-compose.yml --env-file docker/.env up -d --build app
```
