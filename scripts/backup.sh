#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
envname="${1:?Usage: backup.sh dev|prod output-directory}"
dest="${2:?Usage: backup.sh dev|prod output-directory}"
[[ "$envname" == dev || "$envname" == prod ]] || exit 2
umask 077
mkdir -p "$dest"
chmod 700 "$dest"
dest=$(realpath "$dest")
compose=(docker compose --project-name "urbanmag-$envname" --env-file ".env.$envname" -f "infra/compose.$envname.yml")
"${compose[@]}" exec -T db pg_dump -U urbanmag -d urbanmag -Fc > "$dest/database.dump"
docker run --rm -v "urbanmag-${envname}_uploads:/source:ro" alpine:3.22 tar czf - -C /source . > "$dest/uploads.tar.gz"
echo "Backup saved to $dest. Store encrypted and verify restores."
