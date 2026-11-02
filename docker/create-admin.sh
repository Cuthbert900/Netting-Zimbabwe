#!/usr/bin/env bash
# Creates the first admin account against the local stack: a GoTrue user
# (auto-confirmed, via the admin API through Kong) plus the matching
# public.app_users row with role='admin' — mirrors terraform/README.md's
# "After apply — first-time setup" step 4, just automated for local dev
# instead of done by hand in Studio's SQL editor.
#
# Usage: docker/create-admin.sh you@example.com 'a-strong-password'
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <email> <password>" >&2
  exit 1
fi
if [[ ! -f "$ENV_FILE" ]]; then
  echo "docker/.env not found — run docker/generate-env.sh first." >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"
EMAIL="$1"
PASSWORD="$2"

echo "Creating auth user for $EMAIL via GoTrue admin API..."
RESPONSE=$(curl -sS -X POST "${SITE_URL}/auth/v1/admin/users" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\",\"email_confirm\":true}")

USER_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [[ -z "$USER_ID" ]]; then
  echo "Failed to create auth user. Response:" >&2
  echo "$RESPONSE" >&2
  exit 1
fi
echo "Auth user created: $USER_ID"

echo "Inserting app_users row (role=admin)..."
docker compose -f "$SCRIPT_DIR/docker-compose.yml" --env-file "$ENV_FILE" exec -T db \
  psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c \
  "insert into public.app_users (id, email, role, created_by) values ('${USER_ID}', '${EMAIL}', 'admin', 'docker/create-admin.sh') on conflict (id) do update set role = 'admin';"

echo
echo "Done. Sign in at http://localhost:3000/admin/login with:"
echo "  email:    $EMAIL"
echo "  password: (what you passed in)"
