#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
umask 077
if [[ -e .env.dev || -e .env.prod ]]; then
  echo 'An environment file already exists; refusing to overwrite it.' >&2
  exit 1
fi
secret_dir="${URBANMAG_SECRET_DIR:-$HOME/.config/urbanmag}"
mkdir -p "$secret_dir"
chmod 700 "$secret_dir"
random() { openssl rand -hex 32; }
make_env() {
  local file="$1" app="$2" staff="$3" mode="$4"
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
SMTP_URL=smtp://mailpit:1025
MAIL_FROM=Urbanmag <noreply@example.com>
UPLOADS_DIR=/data/uploads
IMAGE_TAG=urbanmag:initial
ENV
}
make_env .env.dev https://dev-u.perricheno.com https://staff-dev-u.perricheno.com mock
make_env .env.prod https://u.perricheno.com https://staff-u.perricheno.com sandbox
if command -v docker >/dev/null 2>&1; then
  password=$(random)
  docker run --rm httpd:2.4-alpine htpasswd -nbB urbanmag "$password" > "$secret_dir/dev.htpasswd"
  printf '%s\n' "$password" > "$secret_dir/dev-basic-password"
  for network in urbanmag-prod-frontend urbanmag-dev-frontend; do docker network inspect "$network" >/dev/null 2>&1 || docker network create "$network" >/dev/null; done
else
  echo 'Docker unavailable: create dev.htpasswd with htpasswd -c and create Docker frontend networks before starting edge.'
fi
printf 'Created .env.dev and .env.prod with independent credentials. Configure owner email, SMTP and ApiPay before use. Secrets directory: %s\n' "$secret_dir"
printf 'Place the Cloudflare tunnel token in %s/tunnel-token (mode 600); set URBANMAG_SECRET_DIR to that directory.\n' "$secret_dir"
