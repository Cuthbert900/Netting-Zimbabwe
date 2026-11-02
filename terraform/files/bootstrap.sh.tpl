#!/usr/bin/env bash
# Runs on every boot (via the supabase-bootstrap systemd unit cloud-init
# installs). Idempotent: mounting an already-mounted disk, re-deriving the
# same JWTs from the same secret, and `docker compose up -d` on an
# unchanged stack are all safe to repeat.
set -euo pipefail

STACK_DIR=/opt/supabase
DATA_DISK=/dev/disk/azure/scsi1/lun10
DATA_MOUNT=/data

log() { echo "[bootstrap] $*"; }

# ---- 1. Mount the Postgres data disk ----
if ! mountpoint -q "$DATA_MOUNT"; then
  mkdir -p "$DATA_MOUNT"
  if ! blkid "$DATA_DISK" >/dev/null 2>&1; then
    log "Formatting data disk $DATA_DISK (first boot only)"
    mkfs.ext4 -F "$DATA_DISK"
  fi
  DISK_UUID=$(blkid -s UUID -o value "$DATA_DISK")
  grep -q "$DISK_UUID" /etc/fstab || echo "UUID=$DISK_UUID $DATA_MOUNT ext4 defaults,nofail 0 2" >> /etc/fstab
  mount "$DATA_MOUNT"
fi
mkdir -p "$DATA_MOUNT/postgres"

# ---- 2. Pull secrets from Key Vault via the VM's own managed identity ----
# Nothing sensitive ever sits in cloud-init/custom_data — this is the only
# place secrets touch disk, in $STACK_DIR/.env (mode 600, root-only).
az login --identity --allow-no-subscriptions >/dev/null
KV_NAME="${key_vault_name}"

secret() { az keyvault secret show --vault-name "$KV_NAME" --name "$1" --query value -o tsv; }

POSTGRES_PASSWORD=$(secret postgres-password)
JWT_SECRET=$(secret jwt-secret)
DASHBOARD_USERNAME=$(secret dashboard-username)
DASHBOARD_PASSWORD=$(secret dashboard-password)

# ---- 3. Derive the anon / service_role API keys ----
# These are just JWTs signed with JWT_SECRET — {"role": "anon"|"service_role"}
# — which is exactly what Supabase's own generate-keys step does. Terraform
# doesn't have a native JWT-signing resource, so this happens here instead.
b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }
sign_jwt() {
  local role="$1"
  local iat exp header payload h p sig
  iat=$(date +%s)
  exp=$((iat + 315360000)) # ~10 years — an internal service credential, not a user session
  header='{"alg":"HS256","typ":"JWT"}'
  payload=$(printf '{"role":"%s","iss":"supabase","iat":%d,"exp":%d}' "$role" "$iat" "$exp")
  h=$(printf '%s' "$header" | b64url)
  p=$(printf '%s' "$payload" | b64url)
  sig=$(printf '%s.%s' "$h" "$p" | openssl dgst -sha256 -hmac "$JWT_SECRET" -binary | b64url)
  printf '%s.%s.%s' "$h" "$p" "$sig"
}
ANON_KEY=$(sign_jwt anon)
SERVICE_ROLE_KEY=$(sign_jwt service_role)

# Written back to Key Vault so you can read them out without SSHing in:
#   az keyvault secret show --vault-name $KV_NAME --name anon-key --query value -o tsv
az keyvault secret set --vault-name "$KV_NAME" --name anon-key --value "$ANON_KEY" >/dev/null
az keyvault secret set --vault-name "$KV_NAME" --name service-role-key --value "$SERVICE_ROLE_KEY" >/dev/null

# ---- 4. Caddy's basic_auth needs a bcrypt hash, never the plaintext password ----
DASHBOARD_PASSWORD_HASH=$(docker run --rm caddy:2.8-alpine caddy hash-password --plaintext "$DASHBOARD_PASSWORD")

# ---- 5. Write the .env docker-compose.yml reads ----
cat > "$STACK_DIR/.env" <<EOF
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
JWT_SECRET=$JWT_SECRET
ANON_KEY=$ANON_KEY
SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY
DASHBOARD_USERNAME=$DASHBOARD_USERNAME
DASHBOARD_PASSWORD_HASH=$DASHBOARD_PASSWORD_HASH
SITE_URL=${site_url}
EOF
chmod 600 "$STACK_DIR/.env"

# ---- 6. Bring the stack up ----
cd "$STACK_DIR"
docker compose up -d

log "Stack up. Current status:"
docker compose ps
