#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
umask 077
if [[ -e .env.dev || -e .env.prod ]]; then
  echo 'An environment file already exists; refusing to overwrite it.' >&2
  exit 1
fi
# Verify the runtime and installed native dependency before creating any files.
if ! command -v node >/dev/null 2>&1 || ! node --input-type=module -e 'if (Number(process.versions.node.split(".")[0]) !== 26) process.exit(1); await import("@node-rs/argon2");' >/dev/null 2>&1; then
  echo 'Node.js 26 and installed dependencies are required. Select Node.js 26, run npm ci, then retry.' >&2
  exit 1
fi
secret_dir="${URBANMAG_SECRET_DIR:-$HOME/.config/urbanmag}"
mkdir -p "$secret_dir"
chmod 700 "$secret_dir"
random() { openssl rand -hex 32; }
make_env() {
  local file="$1" app="$2" staff="$3" mode="$4" smtp='' sender=''
  if [[ "$mode" == mock ]]; then smtp='smtp://mailpit:1025'; sender='Urbanmag <noreply@urbanmag.test>'; fi
  cat > "$file" <<ENV
POSTGRES_PASSWORD=$(random)
APP_URL=$app
STAFF_URL=$staff
BOOTSTRAP_OWNER_EMAIL=owner@example.com
BOOTSTRAP_OWNER_PASSWORD=$(random)
APP_SECRET=$(random)
MAIL_ENCRYPTION_KEY=$(random)
APIPAY_MODE=$mode
APIPAY_API_KEY=
APIPAY_WEBHOOK_SECRET=
SMTP_URL=$smtp
MAIL_FROM=$sender
SEO_INDEXING_ENABLED=false
WALLET_PRODUCTION_ENABLED=false
UPLOADS_DIR=/data/uploads
IMAGE_TAG=urbanmag:initial
ENV
}
make_env .env.dev https://dev-u.perricheno.com https://staff-dev-u.perricheno.com mock
make_env .env.prod https://u.perricheno.com https://staff-u.perricheno.com sandbox
node scripts/dev-access-credentials.mjs .env.dev "$secret_dir"
if command -v docker >/dev/null 2>&1; then
  for network in urbanmag-prod-frontend urbanmag-dev-frontend; do docker network inspect "$network" >/dev/null 2>&1 || docker network create "$network" >/dev/null; done
else
  echo 'Docker unavailable: create the Docker frontend networks before starting edge.'
fi
printf 'Created .env.dev and .env.prod with independent credentials. Configure owner email, SMTP and ApiPay before use. Secrets directory: %s\n' "$secret_dir"
printf 'For an optional Compose-managed tunnel, store its token in %s/tunnel-token (mode 600) and set URBANMAG_SECRET_DIR. An existing host-managed tunnel needs only its routes to the edge port.\n' "$secret_dir"
