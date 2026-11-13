#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
image="${1:?Usage: deploy.sh immutable-image-tag}"
[[ "$image" != *:latest && "$image" == *:* ]] || { echo 'Provide a versioned image tag or digest.' >&2; exit 2; }
compose=(docker compose --project-name urbanmag-prod --env-file .env.prod -f infra/compose.prod.yml)
previous=$(docker inspect "$("${compose[@]}" ps -q web)" --format '{{.Config.Image}}' 2>/dev/null || true)
IMAGE_TAG="$image" "${compose[@]}" up -d --no-build
for _ in {1..30}; do
  id=$(IMAGE_TAG="$image" "${compose[@]}" ps -q web)
  if [[ -n "$id" && $(docker inspect "$id" --format '{{.State.Health.Status}}') == healthy ]]; then
    echo "Deployment healthy: $image. Update IMAGE_TAG in .env.prod to persist it."
    exit 0
  fi
  sleep 2
done
echo 'Deployment failed health check.' >&2
if [[ -n "$previous" ]]; then
  echo "Restoring previous image: $previous" >&2
  IMAGE_TAG="$previous" "${compose[@]}" up -d --no-build
fi
exit 1
