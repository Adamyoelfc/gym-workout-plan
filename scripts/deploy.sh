#!/usr/bin/env bash
set -Eeuo pipefail

DEPLOY_HOST="${DEPLOY_HOST:-root@45.79.31.20}"
DEPLOY_PATH="${DEPLOY_PATH:-/root/docker/gym-ai-web}"
DEPLOY_URL="${DEPLOY_URL:-https://adamdev.me/gym-ai-web/}"
SSH_KEY="${SSH_KEY:-}"

if [[ ! "$DEPLOY_PATH" =~ ^/[A-Za-z0-9._/-]+$ ]]; then
  echo "DEPLOY_PATH contains unsupported characters: $DEPLOY_PATH" >&2
  exit 1
fi

CONTROL_DIR="$(mktemp -d "${TMPDIR:-/tmp}/gym-ai-deploy.XXXXXX")"
CONTROL_PATH="$CONTROL_DIR/ssh"
IDENTITY=()
if [[ -n "$SSH_KEY" ]]; then
  IDENTITY=(-i "$SSH_KEY")
fi

cleanup() {
  ssh -S "$CONTROL_PATH" -O exit "$DEPLOY_HOST" >/dev/null 2>&1 || true
  rmdir "$CONTROL_DIR" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "Opening SSH connection (the server may ask for your password once)"
ssh ${IDENTITY[@]+"${IDENTITY[@]}"} -M -S "$CONTROL_PATH" -o ControlPersist=60 -fNT "$DEPLOY_HOST"
SSH=(ssh -S "$CONTROL_PATH")
RSYNC_SSH="ssh -S $CONTROL_PATH"

echo "Syncing source to $DEPLOY_HOST:$DEPLOY_PATH"
"${SSH[@]}" "$DEPLOY_HOST" "mkdir -p '$DEPLOY_PATH'"
rsync -az --delete \
  --exclude=.git/ \
  --exclude=.env \
  --exclude='**/node_modules/' \
  --exclude='**/dist/' \
  --exclude=.DS_Store \
  -e "$RSYNC_SSH" ./ "$DEPLOY_HOST:$DEPLOY_PATH/"

echo "Building and restarting the application"
"${SSH[@]}" "$DEPLOY_HOST" \
  "cd '$DEPLOY_PATH' && docker compose -f docker-compose.yml -f compose.production.yml up -d --build --remove-orphans"

echo "Waiting for the HTTPS health endpoint"
for attempt in {1..30}; do
  if curl --fail --silent --show-error "${DEPLOY_URL%/}/api/health" >/dev/null; then
    echo "Deployment healthy: $DEPLOY_URL"
    exit 0
  fi
  sleep 2
done

echo "Deployment did not become healthy in time." >&2
"${SSH[@]}" "$DEPLOY_HOST" \
  "cd '$DEPLOY_PATH' && docker compose -f docker-compose.yml -f compose.production.yml ps && docker compose -f docker-compose.yml -f compose.production.yml logs --tail=100 app"
exit 1
