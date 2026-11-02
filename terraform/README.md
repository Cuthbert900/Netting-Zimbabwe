# Self-hosted Supabase — Terraform module

Stands up a single Azure VM running a trimmed self-hosted Supabase stack
(Postgres, GoTrue auth, PostgREST, postgres-meta, Studio, Kong, all behind
Caddy for automatic TLS) for the Netting Reconciliation app's admin
features: provider API keys, the user/role roster, and the audit log.

This backs the `/admin` pages in the Next.js app (`src/app/(dashboard)/admin`
once that lands) — Environment (keys), Users, and Audit — gated by
Supabase's own auth (GoTrue), not the app's earlier "temporary passcode"
idea. See the main `README.md`'s Customization section for how the app
side consumes this.

**I have not run any of this.** Applying Terraform means acting on your
Azure subscription with your credentials — that has to happen from your
own machine or CI, the same way you `git push` yourself. Everything below
is written and ready; running it is on you.

## What gets created

- Resource group, VNet/subnet, NSG (SSH + Studio restricted to
  `allowed_admin_cidrs`; 80/443 open for the public API/auth gateway)
- A VM (`Standard_B2ms` by default — 2 vCPU / 8GB, Supabase's own minimum
  is 2 vCPU / 4GB) with a system-assigned managed identity
- A separate managed disk for Postgres's data directory, mounted at `/data`
  — sized independently of the OS disk
- An Azure Key Vault holding the generated Postgres password, JWT signing
  secret, and Studio dashboard credentials; the VM's managed identity can
  _read_ these (never write), you get full access to manage them
- Cloud-init that installs Docker + Azure CLI, writes the compose stack to
  `/opt/supabase`, and a `supabase-bootstrap.service` systemd unit that
  formats/mounts the data disk, pulls secrets from Key Vault, derives the
  `anon` / `service_role` API keys from the JWT secret, and runs
  `docker compose up -d` — on every boot, idempotently

## What's deliberately excluded

Realtime, Storage, Edge Functions, and the analytics/Logflare stack aren't
part of this compose file. The app's three tables (`provider_keys`,
`app_users`, `audit_log`) don't need file storage or realtime
subscriptions — every service you run is something you have to patch and
secure, so this only runs what's used. Add a service back into
`files/docker-compose.yml` (and route it in `files/kong.yml`) the same way
if a future feature needs it.

## Prerequisites

- An Azure subscription and an identity with rights to create the
  resources above (Contributor on the target subscription/resource group,
  plus rights to create Key Vault role assignments)
- [Terraform](https://developer.hashicorp.com/terraform/install) >= 1.7
- The [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli),
  logged in (`az login`) — the `azurerm` provider uses your CLI session by
  default
- An SSH key pair (`ssh-keygen -t ed25519`) — the VM has no password login
- Your office/VPN egress IP(s), for `allowed_admin_cidrs`
- If you want TLS from the start (you should): a DNS name you control, so
  you can point it at the VM's IP and let Caddy request a Let's Encrypt
  certificate automatically

## Applying it

```bash
cd terraform
terraform init
cp terraform.tfvars.example terraform.tfvars
# edit terraform.tfvars: admin_ssh_public_key, allowed_admin_cidrs,
# and (strongly recommended) domain_name + letsencrypt_email
terraform plan
terraform apply
```

State is local by default (`terraform.tfstate`, gitignored — it contains
the generated secrets in plaintext, same as any Terraform state with
`random_password` resources, so keep it out of git regardless). Before
this is truly production, move to a remote backend — an Azure Storage
container with versioning and encryption — by uncommenting the `backend
"azurerm" {}` block in `versions.tf` and running `terraform init
-migrate-state`. Commit `.terraform.lock.hcl` after your first `init` so
provider versions are pinned for the next person who runs this.

If `domain_name` is set, point its DNS A record at the `vm_public_ip`
output **before** the VM finishes booting, so Caddy's certificate request
succeeds on first try (it retries on its own if you're a few minutes
late). Leaving `domain_name` empty is fine for a first smoke test — the
stack is reachable over plain HTTP on `:8000`, restricted to
`allowed_admin_cidrs` — but set it before this holds anything real.

## After apply — first-time setup

`terraform apply` prints a `next_steps` output with the exact commands.
In short:

1. Wait for cloud-init: `ssh <admin_username>@<vm_public_ip> "sudo cloud-init status --wait"`, then `sudo systemctl status supabase-bootstrap` to confirm the stack came up.
2. Pull `anon-key` and `service-role-key` out of Key Vault and put them, along with the `supabase_url` output, into the app's environment as `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` (server-only — never prefix it `NEXT_PUBLIC_`).
3. Open Studio (`<supabase_url>/studio`, basic-auth with the `dashboard-username`/`dashboard-password` Key Vault secrets) and run `supabase/migrations/0001_admin_schema.sql` from the app repo in the SQL editor — creates `provider_keys`, `app_users`, `audit_log`.
4. Create the first admin: Studio → Authentication → Add user (email + password, or use the GoTrue admin API), then in the SQL editor insert a matching row into `app_users` with `role = 'admin'`. Until that row exists, nobody — including that login — can reach `/admin` in the app.
5. Sign in at `/admin/login` in the app with that email/password.

## Operating it

- **Restart / redeploy after a stack change**: edit the files under
  `terraform/files/`, `terraform apply` (updates `custom_data`, but Azure
  doesn't re-run cloud-init on an existing VM just because `custom_data`
  changed) — then `ssh` in and either re-run
  `sudo /opt/supabase/bootstrap.sh` for a config-only change, or `scp` the
  updated compose/kong/Caddy files to `/opt/supabase/` directly for a
  quicker iteration loop.
- **Back up Postgres**: the data disk (`postgres_data` managed disk) is
  what actually matters — Azure Backup or periodic
  `azurerm_managed_disk` snapshots cover it. A logical `pg_dump` from
  inside the `db` container is worth scripting too, for point-in-time
  restores without needing the whole disk back.
- **Rotate secrets**: `terraform taint random_password.postgres` (or
  `jwt_secret`, `dashboard_password`) then `terraform apply` regenerates
  it in Key Vault; re-run `bootstrap.sh` on the VM to pick it up and
  restart the stack. Rotating `jwt_secret` invalidates every existing
  session and previously-issued `anon`/`service_role` key — update the
  app's env vars afterward.
- **Destroy**: `terraform destroy`. The Key Vault has purge protection on,
  so it soft-deletes rather than vanishing immediately — that's
  deliberate, it's your recovery window if `destroy` was a mistake.

## Security notes

- Postgres (5432) is never exposed outside the VM's Docker network —
  nothing reaches it except the other containers on the same compose
  stack.
- `provider_keys`, `app_users`, and `audit_log` all ship with RLS enabled
  and a deny-all default (see `supabase/migrations/0001_admin_schema.sql`)
  — every read/write the app does goes through the Next.js server using
  the `service_role` key, which bypasses RLS by design. The `anon` key
  can authenticate a user (GoTrue) but can't read or write those tables
  directly.
- `GOTRUE_DISABLE_SIGNUP` is on — there's no self-service account
  creation. Every admin account is created deliberately, by an existing
  admin, in Studio or on the `/admin/users` page.
- `GOTRUE_MAILER_AUTOCONFIRM` is on because there's no SMTP configured yet
  — admin-created accounts are auto-confirmed rather than waiting on a
  confirmation email nobody would receive. Wire up real SMTP
  (`GOTRUE_SMTP_*` env vars in `files/docker-compose.yml`) before this
  matters for anything beyond a handful of admin-created logins.
