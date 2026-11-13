#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
envname="${1:?Usage: restore.sh dev|prod backup-directory --replace}"
src="${2:?Usage: restore.sh dev|prod backup-directory --replace}"
[[ ( "$envname" == dev || "$envname" == prod ) && "${3:-}" == --replace ]] || { echo 'Explicit --replace required; this replaces the database and uploads.' >&2; exit 2; }
src=$(realpath "$src")
test -s "$src/database.dump" && test -s "$src/uploads.tar.gz"
compose=(docker compose --project-name "urbanmag-$envname" --env-file ".env.$envname" -f "infra/compose.$envname.yml")
"${compose[@]}" stop web worker
"${compose[@]}" exec -T db dropdb -U urbanmag --if-exists urbanmag
"${compose[@]}" exec -T db createdb -U urbanmag urbanmag
"${compose[@]}" exec -T db pg_restore -U urbanmag -d urbanmag --no-owner < "$src/database.dump"
docker run --rm -v "urbanmag-${envname}_uploads:/target" -v "$src:/backup:ro" alpine:3.22 sh -c 'find /target -mindepth 1 -maxdepth 1 -exec rm -rf {} +; tar xzf /backup/uploads.tar.gz -C /target'
"${compose[@]}" up -d web worker
echo 'Restore completed.'
