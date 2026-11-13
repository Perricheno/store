#!/usr/bin/env bash
set -euo pipefail
cd /app
lock_hash=$(sha256sum package-lock.json | cut -d ' ' -f 1)
installed_hash=$(cat node_modules/.urbanmag-lock 2>/dev/null || true)
if [[ "$lock_hash" != "$installed_hash" || ! -x node_modules/.bin/next ]]; then
  npm ci --prefer-offline
  printf '%s\n' "$lock_hash" > node_modules/.urbanmag-lock
fi
exec npm run dev --workspace @urbanmag/web -- --webpack --hostname 0.0.0.0
